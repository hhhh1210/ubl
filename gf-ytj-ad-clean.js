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

function setHeaderCaseInsensitive(headers, name, value) {
  deleteHeaderCaseInsensitive(headers, name);
  headers[name] = value;
}

function parseUrl(url) {
  const match = String(url || '').match(/^https?:\/\/([^/?#:]+)([^?#]*)(?:\?([^#]*))?/i);
  if (!match) {
    return { host: '', path: '', query: '' };
  }
  return {
    host: match[1].toLowerCase(),
    path: match[2] || '/',
    query: match[3] || '',
  };
}

function buildJsonHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'X-uBO-GFYTJ', marker);
  return headers;
}

function isStartupAdEndpoint(urlInfo) {
  return urlInfo.host === 'config.gf.com.cn' && urlInfo.path === '/ad/info';
}

function isGatewayEndpoint(urlInfo) {
  return urlInfo.host === 'gw.gf.com.cn' && urlInfo.path === '/gateway';
}

function noAdPayload() {
  return {
    code: 0,
    msg: 'success',
    data: null,
    result: null,
    list: [],
  };
}

function finishJson(reason, value, marker) {
  const headers = buildJsonHeaders($response && $response.headers, marker);
  console.log(`uBO GFYTJ ad clean: ${reason}`);
  done({
    status: 200,
    headers,
    body: JSON.stringify(value),
  });
}

function finishDirectJson(reason, value, marker) {
  console.log(`uBO GFYTJ ad clean: ${reason}`);
  done({
    response: {
      status: 200,
      headers: buildJsonHeaders({}, marker),
      body: JSON.stringify(value),
    },
  });
}

function hasPhase(value) {
  return new RegExp(`(?:^|&)phase=${value}(?:&|$)`).test(String(typeof $argument === 'string' ? $argument : ''));
}

function bodyToText(body) {
  if (typeof body === 'string') {
    return body;
  }
  if (body && typeof body.length === 'number') {
    let text = '';
    for (let i = 0; i < body.length; i++) {
      text += String.fromCharCode(body[i] & 0xff);
    }
    return text;
  }
  return '';
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return undefined;
  }
}

function cleanGatewayLaunchAdConfig(value, state) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = cleanGatewayLaunchAdConfig(value[i], state);
    }
    return value;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  for (const key of Object.keys(value)) {
    if (key === 'launch_ad_config' && Array.isArray(value[key]) && value[key].length !== 0) {
      value[key] = [];
      state.changed = true;
    } else {
      value[key] = cleanGatewayLaunchAdConfig(value[key], state);
    }
  }
  return value;
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);

  if (isStartupAdEndpoint(urlInfo)) {
    if (hasPhase('startup-ad-request')) {
      finishDirectJson('startup ad request emptied', noAdPayload(), 'gfytj-startup-ad-request-empty-1');
    } else {
      finishJson('startup ad endpoint emptied', noAdPayload(), 'gfytj-startup-ad-empty-3');
    }
  } else if (isGatewayEndpoint(urlInfo)) {
    const payload = parseMaybeJson(bodyToText($response && $response.body));
    if (payload && typeof payload === 'object') {
      const state = { changed: false };
      cleanGatewayLaunchAdConfig(payload, state);
      if (state.changed) {
        finishJson('gateway launch ad config emptied', payload, 'gfytj-gateway-launch-ad-empty-1');
      } else {
        done({});
      }
    } else {
      done({});
    }
  } else {
    done({});
  }
} catch (error) {
  console.log('uBO GFYTJ ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
