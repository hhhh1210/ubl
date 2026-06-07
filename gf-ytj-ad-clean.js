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

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);

  if (!isStartupAdEndpoint(urlInfo)) {
    done({});
  } else if (hasPhase('startup-ad-request')) {
    finishDirectJson('startup ad request emptied', noAdPayload(), 'gfytj-startup-ad-request-empty-1');
  } else {
    finishJson('startup ad endpoint emptied', noAdPayload(), 'gfytj-startup-ad-empty-3');
  }
} catch (error) {
  console.log('uBO GFYTJ ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
