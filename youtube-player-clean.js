function done(payload) {
  $done(payload || {});
}

function shouldHandle(body, contentType) {
  if (typeof body !== 'string' || body === '') {
    return false;
  }
  if (/json|javascript|text\/plain/i.test(String(contentType || ''))) {
    return true;
  }
  return /^[\s\r\n]*[\[{]/.test(body) || /^[\s\r\n]*\)\]\}'/.test(body);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function splitXssiPrefix(body) {
  const match = String(body).match(/^\)\]\}'\n?/);
  if (!match) {
    return { prefix: '', jsonText: body };
  }
  return {
    prefix: match[0],
    jsonText: body.slice(match[0].length),
  };
}

function renameAdFieldsText(body) {
  return String(body)
    .replace(/"adPlacements"/g, '"no_ads"')
    .replace(/"adSlots"/g, '"no_ads"')
    .replace(/"playerAds"/g, '"no_ads"')
    .replace(/"adBreakHeartbeatParams"/g, '"no_ads"')
    .replace(/"legacyImportant"/g, '"no_ads"');
}

const DROP = Symbol('drop');
const REMOVE_KEYS = new Set([
  'adPlacements',
  'adSlots',
  'playerAds',
  'adBreakHeartbeatParams',
  'legacyImportant',
]);
const DROP_RENDERER_KEYS = new Set([
  'adSlotRenderer',
  'displayAdRenderer',
  'promotedSparklesWebRenderer',
  'promotedVideoRenderer',
  'videoMastheadAdV3Renderer',
  'mastheadAdRenderer',
  'playerLegacyDesktopWatchAdsRenderer',
  'inFeedAdLayoutRenderer',
  'promotedSparklesTextSearchRenderer',
  'carouselAdRenderer',
]);

function cleanNode(node, state) {
  if (Array.isArray(node)) {
    let changed = false;
    const out = [];
    for (const item of node) {
      const cleaned = cleanNode(item, state);
      if (cleaned === DROP) {
        changed = true;
        state.dropped += 1;
        continue;
      }
      out.push(cleaned);
      if (cleaned !== item) {
        changed = true;
      }
    }
    return changed ? out : node;
  }

  if (!isPlainObject(node)) {
    return node;
  }

  if (node.adClientParams?.isAd === true) {
    return DROP;
  }
  if (node.command?.reelWatchEndpoint?.adClientParams?.isAd === true) {
    return DROP;
  }

  const keys = Object.keys(node);
  if (keys.length !== 0 && keys.every(key => DROP_RENDERER_KEYS.has(key))) {
    return DROP;
  }

  let out = null;
  for (const [key, value] of Object.entries(node)) {
    if (REMOVE_KEYS.has(key) || DROP_RENDERER_KEYS.has(key)) {
      if (out === null) {
        out = { ...node };
      }
      delete out[key];
      state.removedKeys += 1;
      continue;
    }

    const cleaned = cleanNode(value, state);
    if (cleaned === DROP) {
      if (out === null) {
        out = { ...node };
      }
      delete out[key];
      state.dropped += 1;
      continue;
    }
    if (cleaned !== value) {
      if (out === null) {
        out = { ...node };
      }
      out[key] = cleaned;
    }
  }

  return out === null ? node : out;
}

function cleanJsonBody(body) {
  const { prefix, jsonText } = splitXssiPrefix(body);
  const parsed = JSON.parse(jsonText);
  const state = { removedKeys: 0, dropped: 0 };
  const cleaned = cleanNode(parsed, state);
  return {
    body: `${prefix}${JSON.stringify(cleaned === DROP ? {} : cleaned)}`,
    removedKeys: state.removedKeys,
    dropped: state.dropped,
  };
}

try {
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const headers = response.headers || {};
  const body = typeof response.body === 'string' ? response.body : '';
  const contentType = String(headers['Content-Type'] || headers['content-type'] || '');

  if (!shouldHandle(body, contentType)) {
    done({});
  } else {
    let result;
    try {
      result = cleanJsonBody(body);
    } catch (error) {
      const nextBody = renameAdFieldsText(body);
      result = {
        body: nextBody,
        removedKeys: nextBody === body ? 0 : -1,
        dropped: 0,
      };
    }

    if (result.body === body) {
      done({});
    } else {
      console.log(
        `uBO youtube player clean: removedKeys=${result.removedKeys} dropped=${result.dropped} url=${$request.url}`
      );
      done({ body: result.body });
    }
  }
} catch (error) {
  console.log('uBO youtube player clean failed:', error && error.message ? error.message : String(error));
  done({});
}
