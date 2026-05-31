'use strict';

function done(payload) {
  $done(payload || {});
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

function cloneHeaders(headers) {
  const result = {};
  if (!headers || typeof headers !== 'object') {
    return result;
  }
  Object.keys(headers).forEach((key) => {
    result[key] = headers[key];
  });
  return result;
}

function deleteHeaderCaseInsensitive(headers, name) {
  const target = String(name).toLowerCase();
  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === target) {
      delete headers[key];
    }
  });
}

function setHeaderCaseInsensitive(headers, name, value) {
  const target = String(name).toLowerCase();
  let existing = null;
  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === target) {
      existing = key;
    }
  });
  headers[existing || name] = value;
}

function buildJsonHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'X-uBO-Kuaishou', marker);
  return headers;
}

function isRealtimeStartupEndpoint(urlInfo) {
  return /^(?:az[1-4]-api\.ksapisrv\.com|az[1-4]-api-js\.gifshow\.com)$/.test(urlInfo.host) &&
    urlInfo.path === '/rest/n/system/realtime/startup';
}

function stripRealtimeSplash(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  let changed = false;
  if (Object.prototype.hasOwnProperty.call(payload, 'splash')) {
    delete payload.splash;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'splashInfo')) {
    delete payload.splashInfo;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'realtimeSplashInfo')) {
    delete payload.realtimeSplashInfo;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'splashLlsid')) {
    delete payload.splashLlsid;
    changed = true;
  }

  return changed;
}

function finishJson(reason, payload, marker) {
  console.log('uBO Kuaishou ad clean: ' + reason);
  done({
    status: 200,
    headers: buildJsonHeaders($response && $response.headers, marker),
    body: JSON.stringify(payload),
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const urlInfo = parseUrl(request.url);

  if (!isRealtimeStartupEndpoint(urlInfo)) {
    done({});
  } else {
    const body = response.body || '';
    const payload = JSON.parse(body);
    const changed = stripRealtimeSplash(payload);
    if (changed) {
      finishJson('realtime startup splash removed', payload, 'kuaishou-realtime-splash-empty-1');
    } else {
      done({});
    }
  }
} catch (error) {
  console.log('uBO Kuaishou ad clean failed: ' + (error && error.message ? error.message : String(error)));
  done({});
}
