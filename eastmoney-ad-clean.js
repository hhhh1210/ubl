function done(payload) {
  $done(payload || {});
}

function bytesToText(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i++) {
    text += String.fromCharCode(bytes[i] & 0xff);
  }
  return text;
}

function bodyToText(body) {
  if (typeof body === 'string') {
    return body;
  }
  if (typeof ArrayBuffer !== 'undefined') {
    if (body instanceof ArrayBuffer) {
      return bytesToText(new Uint8Array(body));
    }
    if (body && typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(body)) {
      return bytesToText(new Uint8Array(body.buffer, body.byteOffset || 0, body.byteLength));
    }
  }
  if (body && typeof body.length === 'number') {
    return bytesToText(body);
  }
  return '';
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

function buildJsonHeaders(marker) {
  const headers = cloneHeaders($response && $response.headers);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'X-uBO-EastMoney', marker);
  return headers;
}

function getPhase() {
  const arg = String(typeof $argument === 'string' ? $argument : '');
  const match = arg.match(/(?:^|&)phase=([^&]+)/);
  return match ? match[1] : '';
}

function parseJson(text) {
  return JSON.parse(text || '{}');
}

function isCfwIosRequest(request) {
  return request
    && request.appKey === 'cfw'
    && request.client === 'ios'
    && request.clientType === 'cfw';
}

function cleanInfoService(requestText, responseText) {
  const payload = parseJson(responseText);
  const data = payload && payload.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const request = requestText ? parseJson(requestText) : null;
  const hasRequestMarker = isCfwIosRequest(request)
    && /^(?:marketad|bubblead)$/.test(String(request.method || ''));
  const hasAdPayload = Array.isArray(data.adpositionidlist)
    || Array.isArray(data.fundPositionList)
    || data.isMarketingAd === true;
  if (!hasRequestMarker && !hasAdPayload) {
    return null;
  }

  payload.code = 0;
  payload.message = payload.message || 'Success';
  data.adpositionidlist = [];
  data.fundPositionList = [];
  data.isMarketingAd = false;
  data.cacheExpire = Math.max(Number(data.cacheExpire) || 0, 3600);
  data.cacheDataExpireMin = Math.max(Number(data.cacheDataExpireMin) || 0, 4320);
  return payload;
}

function hasMxAdMarker(data) {
  const text = JSON.stringify(data || {});
  return /sceneKey=AD|sceneKey=PopupMX|PopupMX/i.test(text);
}

function cleanMxEntrance(responseText) {
  const payload = parseJson(responseText);
  const data = payload && payload.data;
  if (!data || typeof data !== 'object' || !hasMxAdMarker(data)) {
    return null;
  }

  data.questions = [];
  data.tired = [];
  data.androidJumpUrl = '';
  data.androidBaseJumpUrl = '';
  data.iosJumpUrl = '';
  data.iosBaseJumpUrl = '';
  return payload;
}

try {
  const phase = getPhase();
  const requestText = bodyToText($request && $request.body);
  const responseText = bodyToText($response && $response.body);
  const body = phase === 'mx-entrance'
    ? cleanMxEntrance(responseText)
    : cleanInfoService(requestText, responseText);

  if (!body) {
    done({});
  } else {
    done({
      status: 200,
      headers: buildJsonHeaders(phase || 'ad-service'),
      body: JSON.stringify(body),
    });
  }
} catch (error) {
  done({});
}
