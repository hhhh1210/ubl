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

function base64DecodeBinary(input) {
  if (typeof atob === 'function') {
    return atob(input);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i);
    if (c === '=') {
      break;
    }
    const value = chars.indexOf(c);
    if (value < 0) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

function base64EncodeBinary(input) {
  if (typeof btoa === 'function') {
    return btoa(input);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  while (i < input.length) {
    const c1 = input.charCodeAt(i++) & 0xff;
    const c2 = i < input.length ? input.charCodeAt(i++) & 0xff : NaN;
    const c3 = i < input.length ? input.charCodeAt(i++) & 0xff : NaN;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : (c2 >> 4));
    const e3 = isNaN(c2) ? 64 : (((c2 & 15) << 2) | (isNaN(c3) ? 0 : (c3 >> 6)));
    const e4 = isNaN(c3) ? 64 : (c3 & 63);
    output += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return output;
}

function base64DecodeJson(input) {
  const compact = String(input || '').replace(/\s+/g, '');
  const padded = compact + '==='.slice((compact.length + 3) % 4);
  const binary = base64DecodeBinary(padded);
  const text = decodeURIComponent(escape(binary));
  return JSON.parse(text);
}

function base64EncodeJson(value) {
  const text = JSON.stringify(value);
  return base64EncodeBinary(unescape(encodeURIComponent(text)));
}

function setIfDifferent(target, key, value, changes) {
  if (!target || typeof target !== 'object') {
    return;
  }
  if (target[key] !== value) {
    target[key] = value;
    changes.push(key);
  }
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
  setHeaderCaseInsensitive(headers, 'X-uBO-Huya', marker);
  return headers;
}

function currentUrl() {
  return String((typeof $request !== 'undefined' && $request && $request.url) || '');
}

function isHuyaExappRequest(requestText) {
  const text = String(requestText || '');
  return /(?:^|&)posid=3026774105282411(?:&|$)/.test(text)
    && /(?:hostappid%22%3A%221112179873|hostappid"?\s*[:=]\s*"?1112179873|com\.yy\.kiwi)/i.test(text);
}

function cleanGdtExappFill(requestText, responseText) {
  const payload = JSON.parse(responseText || '{}');
  const slot = payload && payload.data && payload.data['3026774105282411'];
  if (!slot || typeof slot !== 'object') {
    return null;
  }
  const hasRequestBody = String(requestText || '').length > 0;
  if (hasRequestBody && !isHuyaExappRequest(requestText)) {
    return null;
  }

  slot.ret = 0;
  slot.msg = '';
  slot.list = [];
  slot.dr = slot.dr || 0;
  payload.last_ads = {};
  payload.ret = 0;
  payload.rpt = 0;
  payload.reqinterval = 1;
  return JSON.stringify(payload);
}

function hasHuyaTangramMarker(requestText, sdk, app) {
  if (/com\.yy\.kiwi|1112179873/i.test(requestText || '')) {
    return true;
  }
  if (app && Object.prototype.hasOwnProperty.call(app, '5035917038257268')) {
    return true;
  }
  return !!(sdk && /huya|ios_hy_splash|ioshuya/i.test(String(sdk.ex_exp_info || '')));
}

function cleanTangramUpdateSetting(requestText, responseText) {
  const payload = JSON.parse(responseText || '{}');
  if (!payload || !payload.setting || typeof payload.setting !== 'object') {
    return null;
  }

  const sdk = payload.setting.sdk ? base64DecodeJson(payload.setting.sdk) : null;
  const app = payload.setting.app ? base64DecodeJson(payload.setting.app) : null;
  if (!hasHuyaTangramMarker(requestText, sdk, app)) {
    return null;
  }

  const changes = [];
  if (sdk) {
    setIfDifferent(sdk, 'openSplashDynamic', 0, changes);
    setIfDifferent(sdk, 'splashReqAdCount', 0, changes);
    setIfDifferent(sdk, 'tangram_splash_material_check', 0, changes);
    setIfDifferent(sdk, 'enableDSDKBackgroundSaveTemplateDict', 0, changes);
    setIfDifferent(sdk, 'newDeviceIntoFetch', 0, changes);
    setIfDifferent(sdk, 'cookieForLastAds', 0, changes);
    setIfDifferent(sdk, 'enableIdfaCache', 0, changes);
    setIfDifferent(sdk, 'maxCount', 0, changes);
    setIfDifferent(sdk, 'native_loadad_count_limit', 0, changes);
    setIfDifferent(sdk, 'inter_loadad_count_limit', 0, changes);
    setIfDifferent(sdk, 'sscaad', 0, changes);
    setIfDifferent(sdk, 'pingLocalDnsList', '', changes);
    setIfDifferent(sdk, 'srcap', 0, changes);
    setIfDifferent(sdk, 'spl_exptime', 0, changes);
    setIfDifferent(sdk, 'spl_ltime', 0, changes);
    setIfDifferent(sdk, 'spl_maxrn', 0, changes);
    payload.setting.sdk = base64EncodeJson(sdk);
  }

  if (app) {
    for (const slotId of Object.keys(app)) {
      if (app[slotId] && typeof app[slotId] === 'object') {
        setIfDifferent(app[slotId], 'dynamic_use_lgt', 0, changes);
      }
    }
    payload.setting.app = base64EncodeJson(app);
  }

  if (changes.length === 0) {
    return null;
  }
  return JSON.stringify(payload);
}

try {
  const requestText = bodyToText($request && $request.body);
  const responseText = bodyToText($response && $response.body);
  const url = currentUrl();
  const body = /:\/\/us\.l\.qq\.com\/exapp(?:[?#]|$)/.test(url)
    ? cleanGdtExappFill(requestText, responseText)
    : cleanTangramUpdateSetting(requestText, responseText);

  if (!body) {
    done({});
  } else {
    done({
      body,
      headers: buildJsonHeaders($response && $response.headers, 'huya-splash-cache-nofill-1'),
    });
  }
} catch (error) {
  done({});
}
