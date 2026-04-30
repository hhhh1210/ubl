function done(payload) {
  $done(payload || {});
}

function cloneHeaders(headers) {
  const out = {};
  if (headers && typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      out[key] = headers[key];
    }
  }
  return out;
}

function deleteHeaderCaseInsensitive(headers, target) {
  const lower = String(target).toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      delete headers[key];
    }
  }
}

function getHeaderCaseInsensitive(headers, target) {
  const lower = String(target).toLowerCase();
  for (const key of Object.keys(headers || {})) {
    if (key.toLowerCase() === lower) {
      return headers[key];
    }
  }
  return '';
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function withChannelUserAgent(userAgent) {
  const text = String(userAgent || '');
  if (/(^|[ ;])channel([ ;]|$)/i.test(text)) {
    return text;
  }
  if (/Mozilla\/5\.0 \([^)]+/.test(text)) {
    return text.replace(/(Mozilla\/5\.0 \([^)]+)/, '$1; channel');
  }
  return text ? `${text} channel` : 'channel';
}

function withReloadHash(value) {
  const text = String(value || '');
  if (text.includes('#reloadxhr')) {
    return text;
  }
  if (text !== '') {
    return `${text}#reloadxhr`;
  }
  return 'https://www.youtube.com/#reloadxhr';
}

function hasChannelMarker(userAgent) {
  return /(^|[ ;])channel([ ;]|$)/i.test(String(userAgent || ''));
}

function hasPlaybackMarker(userAgent) {
  return /adunit|channel|lactmilli|instream|eafg/i.test(String(userAgent || ''));
}

function pruneAdFields(node) {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      if (pruneAdFields(node[i]) === false) {
        node.splice(i, 1);
      }
    }
    return true;
  }

  if (!isPlainObject(node)) {
    return true;
  }

  if (node.adClientParams?.isAd === true) {
    return false;
  }
  if (node.command?.reelWatchEndpoint?.adClientParams?.isAd === true) {
    return false;
  }

  for (const key of [
    'adPlacements',
    'adSlots',
    'playerAds',
    'adBreakHeartbeatParams',
    'legacyImportant',
  ]) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      delete node[key];
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (pruneAdFields(value) === false) {
      delete node[key];
    }
  }

  return true;
}

function editPlayerPayload(body, requestHeaders) {
  if (typeof body !== 'string' || body === '') {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    return null;
  }

  const context = parsed.context = isPlainObject(parsed.context) ? parsed.context : {};
  const client = context.client = isPlainObject(context.client) ? context.client : {};
  const userAgent = client.userAgent || '';
  const shouldUseChannelScreen = hasChannelMarker(userAgent);
  const shouldUseReloadReferer = hasPlaybackMarker(userAgent);
  const graftUrl = String(client.mainAppWebInfo?.graftUrl || '');

  if (!shouldUseChannelScreen && !shouldUseReloadReferer) {
    return null;
  }

  const playbackContext = parsed.playbackContext = isPlainObject(parsed.playbackContext) ? parsed.playbackContext : {};
  const contentPlaybackContext = playbackContext.contentPlaybackContext =
    isPlainObject(playbackContext.contentPlaybackContext) ? playbackContext.contentPlaybackContext : {};

  if (client.clientName === undefined) {
    client.clientName = 'WEB';
  }
  if (/adunit/i.test(userAgent) && client.clientName === 'WEB') {
    client.clientScreen = 'ADUNIT';
  }
  if (shouldUseChannelScreen) {
    if (client.clientName === 'WEB') {
      client.clientScreen = 'CHANNEL';
    }
    client.userAgent = withChannelUserAgent(userAgent || getHeaderCaseInsensitive(requestHeaders, 'User-Agent'));
  }
  if (/lactmilli/i.test(userAgent) && graftUrl.includes('&list=')) {
    parsed.params = '8AUB';
  }
  if (/instream/i.test(userAgent)) {
    contentPlaybackContext.adPlaybackContext = { adType: 'AD_TYPE_INSTREAM' };
  }
  if (/eafg/i.test(userAgent)) {
    parsed.params = 'eAFgAQ';
  }
  if (shouldUseReloadReferer) {
    contentPlaybackContext.referer = withReloadHash(
      contentPlaybackContext.referer ||
      getHeaderCaseInsensitive(requestHeaders, 'Referer')
    );
    contentPlaybackContext.isInlinePlaybackNoAd = true;
  }

  pruneAdFields(parsed);
  return JSON.stringify(parsed);
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const headers = cloneHeaders(request.headers);
  deleteHeaderCaseInsensitive(headers, 'Attribution-Reporting-Eligible');
  deleteHeaderCaseInsensitive(headers, 'Sec-Browsing-Topics');
  const body = typeof request.body === 'string' ? request.body : '';
  const nextBody = editPlayerPayload(body, headers);

  if (nextBody === null || nextBody === body) {
    done({});
  } else {
    deleteHeaderCaseInsensitive(headers, 'Content-Length');
    deleteHeaderCaseInsensitive(headers, 'content-length');
    console.log(`uBO youtube player request clean: edited body url=${request.url}`);
    done({ headers, body: nextBody });
  }
} catch (error) {
  console.log('uBO youtube player request clean failed:', error && error.message ? error.message : String(error));
  done({});
}
