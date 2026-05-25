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

function parseUrl(url) {
  const match = String(url || '').match(/^https?:\/\/([^/?#:]+)([^?#]*)(?:\?([^#]*))?/i);
  if (!match) {
    return { host: '', path: '/', query: '' };
  }
  return {
    host: match[1].toLowerCase(),
    path: match[2] || '/',
    query: match[3] || '',
  };
}

function getHeader(headers, name) {
  const lower = String(name || '').toLowerCase();
  if (!headers || typeof headers !== 'object') {
    return '';
  }
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      return String(headers[key] || '');
    }
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

function extractParam(text, key) {
  const match = new RegExp(`(?:^|&)${key}=([^&]*)`).exec(String(text || ''));
  if (!match) {
    return '';
  }
  return decodeURIComponentSafe(match[1]);
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
    output += chars.charAt(c1 >> 2);
    output += chars.charAt(((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4));
    output += chars.charAt(isNaN(c2) ? 64 : (((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6)));
    output += chars.charAt(isNaN(c3) ? 64 : (c3 & 63));
  }
  return output;
}

function base64DecodeJson(input) {
  const compact = String(input || '').replace(/\s+/g, '');
  const padded = compact + '==='.slice((compact.length + 3) % 4);
  const binary = base64DecodeBinary(padded);
  return JSON.parse(decodeURIComponent(escape(binary)));
}

function base64EncodeJson(value) {
  return base64EncodeBinary(unescape(encodeURIComponent(JSON.stringify(value))));
}

function setIfDifferent(target, key, value, state) {
  if (!target || typeof target !== 'object') {
    return;
  }
  if (target[key] !== value) {
    target[key] = value;
    state.changed = true;
  }
}

function buildJsonHeaders(baseHeaders, headerName, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, headerName, marker);
  return headers;
}

function finishJson(value, headerName, marker) {
  done({
    status: 200,
    headers: buildJsonHeaders($response && $response.headers, headerName, marker),
    body: JSON.stringify(value),
  });
}

function requestFingerprint(requestText) {
  const headers = $request && $request.headers;
  const ua = getHeader(headers, 'User-Agent');
  return [
    requestText,
    ua,
    decodeURIComponentSafe(ua),
  ].join('\n');
}

function isQQMusicRequest(requestText) {
  const text = requestFingerprint(requestText);
  return /com\.tencent\.QQMusic|QQ(?:%E9%9F%B3%E4%B9%90|音乐)|appkey"?\s*:\s*"?1107900362|hostappid(?:%22%3A%22|"?\s*[:=]\s*"?)1107900362|posid=4070643834392507|mediumId=5766736179307259435/i.test(text);
}

function isHuyaExappRequest(requestText) {
  const text = String(requestText || '');
  return /(?:^|&)posid=(?:3026774105282411|3096015588382074|4076515691155523|6076318568786637)(?:&|$)/.test(text)
    && /(?:hostappid%22%3A%221112179873|hostappid"?\s*[:=]\s*"?1112179873|com\.yy\.kiwi)/i.test(text);
}

function isHuyaGdtSlot(slotId) {
  return /^(?:3026774105282411|3096015588382074|4076515691155523|6076318568786637)$/.test(String(slotId || ''));
}

function cleanExappSlot(slot, noAdRet) {
  if (!slot || typeof slot !== 'object') {
    return;
  }
  slot.ret = noAdRet;
  slot.msg = noAdRet === 0 ? '' : 'no ad';
  slot.list = [];
  slot.dr = slot.dr || 0;
}

function cleanQQMusicExapp(requestText, responseText) {
  if (!isQQMusicRequest(requestText)) {
    return null;
  }
  const payload = JSON.parse(responseText || '{}');
  const data = payload && payload.data;
  if (!data || typeof data !== 'object') {
    return null;
  }
  const requestSlot = extractParam(requestText, 'posid');
  const slotIds = Object.keys(data).filter((slotId) => {
    return slotId === requestSlot || /^(?:4070643834392507|1050088140283129)$/.test(slotId);
  });
  if (slotIds.length === 0) {
    return null;
  }
  for (const slotId of slotIds) {
    cleanExappSlot(data[slotId], 102006);
  }
  payload.ret = 0;
  payload.rpt = 0;
  payload.msg = '';
  payload.last_ads = {};
  payload.reqinterval = Math.max(Number(payload.reqinterval) || 0, 3600);
  return payload;
}

function cleanHuyaExapp(requestText, responseText) {
  const hasRequestBody = String(requestText || '').length > 0;
  const requestSlot = extractParam(requestText, 'posid');
  if (hasRequestBody && (!isHuyaExappRequest(requestText) || !isHuyaGdtSlot(requestSlot))) {
    return null;
  }
  const payload = JSON.parse(responseText || '{}');
  const data = payload && payload.data;
  if (!data || typeof data !== 'object') {
    return null;
  }
  const slotIds = Object.keys(data).filter(isHuyaGdtSlot);
  if (slotIds.length === 0) {
    return null;
  }
  for (const slotId of slotIds) {
    cleanExappSlot(data[slotId], 0);
  }
  payload.last_ads = {};
  payload.ret = 0;
  payload.rpt = 0;
  payload.reqinterval = 1;
  return payload;
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

function cleanTangramSdkCommon(sdk, state) {
  const zeroKeys = [
    'openSplashDynamic',
    'splashReqAdCount',
    'tangram_splash_material_check',
    'enableDSDKBackgroundSaveTemplateDict',
    'newDeviceIntoFetch',
    'cookieForLastAds',
    'enableIdfaCache',
    'maxCount',
    'native_loadad_count_limit',
    'inter_loadad_count_limit',
    'mmaEnabled',
    'miniCardSupport',
    'inner_browser_on',
    'sscaad',
  ];
  for (const key of zeroKeys) {
    setIfDifferent(sdk, key, 0, state);
  }
  for (const key of [
    'iOSBannerPageUrl',
    'iOSInterstitialPageUrl',
    'tpl',
    'mmaConfigURL',
    'miniCardRef',
    'miniCardList',
  ]) {
    setIfDifferent(sdk, key, '', state);
  }
  setIfDifferent(sdk, 'stop', 1, state);
}

function cleanQQMusicTangram(requestText, responseText) {
  if (!isQQMusicRequest(requestText)) {
    return null;
  }
  const payload = JSON.parse(responseText || '{}');
  if (!payload || !payload.setting || typeof payload.setting !== 'object') {
    return null;
  }
  const state = { changed: false };
  const sdk = payload.setting.sdk ? base64DecodeJson(payload.setting.sdk) : null;
  const app = payload.setting.app ? base64DecodeJson(payload.setting.app) : null;
  if (sdk) {
    cleanTangramSdkCommon(sdk, state);
    for (const key of [
      'splash_preload_material_download_retry',
      'hippyReward_clicked',
      'hippyReward_notCloseAdOnClickExpe',
      'appstore_jump_product',
      'report_jump_appstore',
      'rewardH5EffectiveTime',
    ]) {
      setIfDifferent(sdk, key, 0, state);
    }
    setIfDifferent(sdk, 'rewardVideoUseJsCallbackJudgeWebSuccess', '', state);
    setIfDifferent(sdk, 'reqInterval', 86400, state);
    payload.setting.sdk = base64EncodeJson(sdk);
  }
  if (app && typeof app === 'object') {
    for (const slotId of Object.keys(app)) {
      if (app[slotId] && typeof app[slotId] === 'object') {
        setIfDifferent(app[slotId], 'dynamic_use_lgt', 0, state);
      }
    }
    payload.setting.app = base64EncodeJson(app);
  }
  return state.changed ? payload : null;
}

function cleanHuyaTangram(requestText, responseText) {
  const payload = JSON.parse(responseText || '{}');
  if (!payload || !payload.setting || typeof payload.setting !== 'object') {
    return null;
  }
  const sdk = payload.setting.sdk ? base64DecodeJson(payload.setting.sdk) : null;
  const app = payload.setting.app ? base64DecodeJson(payload.setting.app) : null;
  if (!hasHuyaTangramMarker(requestText, sdk, app)) {
    return null;
  }
  const state = { changed: false };
  if (sdk) {
    cleanTangramSdkCommon(sdk, state);
    setIfDifferent(sdk, 'pingLocalDnsList', '', state);
    setIfDifferent(sdk, 'srcap', 0, state);
    setIfDifferent(sdk, 'spl_exptime', 0, state);
    setIfDifferent(sdk, 'spl_ltime', 0, state);
    setIfDifferent(sdk, 'spl_maxrn', 0, state);
    payload.setting.sdk = base64EncodeJson(sdk);
  }
  if (app && typeof app === 'object') {
    for (const slotId of Object.keys(app)) {
      if (app[slotId] && typeof app[slotId] === 'object') {
        setIfDifferent(app[slotId], 'dynamic_use_lgt', 0, state);
      }
    }
    payload.setting.app = base64EncodeJson(app);
  }
  return state.changed ? payload : null;
}

try {
  const requestText = bodyToText($request && $request.body);
  const responseText = bodyToText($response && $response.body);
  const urlInfo = parseUrl($request && $request.url);

  if (urlInfo.host === 'us.l.qq.com' && urlInfo.path === '/exapp') {
    const qqmusic = cleanQQMusicExapp(requestText, responseText);
    if (qqmusic) {
      finishJson(qqmusic, 'X-uBO-QQMusic', 'gdt-exapp-nofill-2');
    } else {
      const huya = cleanHuyaExapp(requestText, responseText);
      if (huya) {
        finishJson(huya, 'X-uBO-Huya', 'huya-gdt-page-nofill-1');
      } else {
        done({});
      }
    }
  } else if (urlInfo.host === 'tangram.e.qq.com' && urlInfo.path === '/updateSetting') {
    const qqmusic = cleanQQMusicTangram(requestText, responseText);
    if (qqmusic) {
      finishJson(qqmusic, 'X-uBO-QQMusic', 'tangram-setting-clean-2');
    } else {
      const huya = cleanHuyaTangram(requestText, responseText);
      if (huya) {
        finishJson(huya, 'X-uBO-Huya', 'huya-gdt-page-nofill-1');
      } else {
        done({});
      }
    }
  } else {
    done({});
  }
} catch (error) {
  done({});
}
