function done(payload) {
  $done(payload || {});
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
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

function shouldSkipUrl(url) {
  return /\/youtubei\/v1\/player(?:[/?#]|$)/i.test(String(url || ''));
}

const DROP = Symbol('drop');
const REMOVE_KEYS = new Set([
  'adPlacements',
  'playerAds',
  'adSlots',
  'adBreakHeartbeatParams',
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
]);

function containsAdRenderer(container) {
  if (!isPlainObject(container)) {
    return false;
  }
  return Object.keys(container).some(key => DROP_RENDERER_KEYS.has(key));
}

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

  if (node.richItemRenderer?.content && containsAdRenderer(node.richItemRenderer.content)) {
    return DROP;
  }

  if (node.richSectionRenderer?.content && containsAdRenderer(node.richSectionRenderer.content)) {
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

  const candidate = out === null ? node : out;

  if (candidate.richItemRenderer?.content && isPlainObject(candidate.richItemRenderer.content) &&
      Object.keys(candidate.richItemRenderer.content).length === 0) {
    return DROP;
  }

  if (candidate.richSectionRenderer?.content && isPlainObject(candidate.richSectionRenderer.content) &&
      Object.keys(candidate.richSectionRenderer.content).length === 0) {
    return DROP;
  }

  return candidate;
}

try {
  if (shouldSkipUrl($request && $request.url)) {
    done({});
  }

  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const headers = response.headers || {};
  const body = typeof response.body === 'string' ? response.body : '';
  const contentType = String(headers['Content-Type'] || headers['content-type'] || '');

  if (!shouldHandle(body, contentType)) {
    done({});
  }

  const { prefix, jsonText } = splitXssiPrefix(body);
  const parsed = JSON.parse(jsonText);
  const state = { removedKeys: 0, dropped: 0 };
  const cleaned = cleanNode(parsed, state);

  if (cleaned === parsed && state.removedKeys === 0 && state.dropped === 0) {
    done({});
  }

  const nextBody = `${prefix}${JSON.stringify(cleaned)}`;
  console.log(
    `uBO youtube json clean: removedKeys=${state.removedKeys} dropped=${state.dropped} url=${$request.url}`
  );
  done(nextBody === body ? {} : { body: nextBody });
} catch (error) {
  console.log('uBO youtube json clean failed:', error && error.message ? error.message : String(error));
  done({});
}
