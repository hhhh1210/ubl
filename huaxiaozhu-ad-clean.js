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

function decodeURIComponentSafe(text) {
  try {
    return decodeURIComponent(String(text || '').replace(/\+/g, ' '));
  } catch (error) {
    return String(text || '');
  }
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

function isHuaxiaozhuGdtBody(body) {
  const text = bodyToText(body);
  if (/com\.huaxiaozhu\.rider|c_pkgname=|appid=1210818176|posid=8156967880562298/i.test(text)) {
    return /com\.huaxiaozhu\.rider|appid=1210818176|posid=8156967880562298/i.test(text);
  }
  const decoded = decodeURIComponentSafe(text);
  return /com\.huaxiaozhu\.rider|"appid"\s*:\s*"1210818176"|posid=8156967880562298/i.test(decoded);
}

function isHuaxiaozhuGdtEndpoint(urlInfo) {
  return urlInfo.host === 'mi.gdt.qq.com' && urlInfo.path === '/server_bidding2';
}

function extractParam(text, key) {
  const match = new RegExp(`(?:^|&)${key}=([^&]*)`).exec(String(text || ''));
  return match ? decodeURIComponentSafe(match[1]) : '';
}

function extractGdtSlotId(body, payload) {
  const bodyText = bodyToText(body);
  const posid = extractParam(bodyText, 'posid');
  if (posid) {
    return posid;
  }
  const data = payload && payload.data;
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length !== 0) {
      return keys[0];
    }
  }
  return '8156967880562298';
}

function buildNoFillGdtPayload(body, originalPayload) {
  const slotId = extractGdtSlotId(body, originalPayload);
  const payload = {
    ret: 0,
    msg: '',
    data: {},
    ip_ping_url: '',
    last_ads: {},
    reqinterval: 3600,
  };
  if (originalPayload && originalPayload.seq !== undefined) {
    payload.seq = originalPayload.seq;
  }
  payload.data[slotId] = {
    ret: 0,
    msg: '',
    list: [],
  };
  return payload;
}

function finishJson(reason, value) {
  const headers = cloneHeaders($response && $response.headers);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
  done({
    status: 200,
    headers,
    body: JSON.stringify(value),
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);
  let handled = false;

  if (
    isHuaxiaozhuGdtEndpoint(urlInfo) &&
    isHuaxiaozhuGdtBody(request.body)
  ) {
    const response = typeof $response === 'object' && $response !== null ? $response : {};
    const text = bodyToText(response.body);
    const payload = JSON.parse(text);
    finishJson(
      'Tencent GDT Huaxiaozhu bidding response replaced with no-fill',
      buildNoFillGdtPayload(request.body, payload)
    );
    handled = true;
  }

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO Huaxiaozhu ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
