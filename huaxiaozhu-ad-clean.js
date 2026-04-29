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

function finishJson(reason, value) {
  const headers = cloneHeaders($response && $response.headers);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
  done({
    status: 200,
    headers,
    body: JSON.stringify(value),
  });
}

function emptyGdtAds(payload) {
  let changed = false;
  if (payload && payload.last_ads) {
    payload.last_ads = {};
    changed = true;
  }
  if (payload && typeof payload.ip_ping_url === 'string') {
    payload.ip_ping_url = '';
    changed = true;
  }

  const data = payload && payload.data;
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      const slot = data[key];
      if (!slot || typeof slot !== 'object') {
        continue;
      }
      if (Array.isArray(slot.list) && slot.list.length !== 0) {
        slot.list = [];
        changed = true;
      }
      if (slot.ret === undefined) {
        slot.ret = 0;
      }
      if (slot.msg === undefined) {
        slot.msg = '';
      }
    }
  }
  return changed;
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const urlInfo = parseUrl(request.url);
  let handled = false;

  if (
    isHuaxiaozhuGdtEndpoint(urlInfo) &&
    isHuaxiaozhuGdtBody(request.body)
  ) {
    const text = bodyToText(response.body);
    const payload = JSON.parse(text);
    if (emptyGdtAds(payload)) {
      finishJson('Tencent GDT Huaxiaozhu bidding response emptied', payload);
      handled = true;
    }
  }

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO Huaxiaozhu ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
