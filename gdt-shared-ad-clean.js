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
    return { host: '', path: '', query: '' };
  }
  return {
    host: match[1].toLowerCase(),
    path: match[2] || '/',
    query: match[3] || '',
  };
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

function buildHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'X-uBO-GDT', marker);
  return headers;
}

function responseJson(payload, marker) {
  done({
    status: 200,
    headers: buildHeaders($response && $response.headers, marker),
    body: JSON.stringify(payload),
  });
}

function isQQMusicText(text) {
  return /com\.tencent\.QQMusic|QQ(?:%E9%9F%B3%E4%B9%90|音乐)|appkey"?\s*:\s*"?1107900362|hostappid(?:%22%3A%22|"?\s*[:=]\s*"?)1107900362|appid=100497308|mediumId=5766736179307259435|app-id\n?5766736179307259435/i.test(String(text || ''));
}

function isHuyaExappRequest(requestText) {
  return /(?:^|&)posid=(?:3026774105282411|3096015588382074|4076515691155523|6076318568786637)(?:&|$)/.test(String(requestText || ''))
    && /(?:hostappid%22%3A%221112179873|hostappid"?\s*[:=]\s*"?1112179873|com\.yy\.kiwi)/i.test(String(requestText || ''));
}

function isHuyaGdtSlot(slotId) {
  return /^(?:3026774105282411|3096015588382074|4076515691155523|6076318568786637)$/.test(String(slotId || ''));
}

function cleanGdtExapp(payload, mode) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const data = payload.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  let changed = false;
  for (const slotId of Object.keys(data)) {
    if (mode === 'huya' && !isHuyaGdtSlot(slotId)) {
      continue;
    }
    const slot = data[slotId];
    if (!slot || typeof slot !== 'object') {
      continue;
    }
    slot.ret = mode === 'qqmusic' ? 102006 : 0;
    slot.msg = mode === 'qqmusic' ? 'no ad' : '';
    slot.list = [];
    slot.dr = slot.dr || 0;
    changed = true;
  }
  if (changed) {
    payload.ret = 0;
    payload.rpt = 0;
    payload.msg = '';
    payload.last_ads = {};
    payload.reqinterval = mode === 'qqmusic' ? 3600 : 1;
  }
  return changed;
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

function cleanTangramSdk(sdk, state) {
  const zeroKeys = [
    'openSplashDynamic',
    'splashReqAdCount',
    'splash_preload_material_download_retry',
    'newDeviceIntoFetch',
    'cookieForLastAds',
    'hippyReward_clicked',
    'hippyReward_notCloseAdOnClickExpe',
    'inner_browser_on',
    'miniCardSupport',
    'mmaEnabled',
    'native_loadad_count_limit',
    'inter_loadad_count_limit',
    'sscaad',
    'appstore_jump_product',
    'report_jump_appstore',
    'rewardH5EffectiveTime',
    'maxCount',
    'tangram_splash_material_check',
    'enableDSDKBackgroundSaveTemplateDict',
    'enableIdfaCache',
    'srcap',
    'spl_exptime',
    'spl_ltime',
    'spl_maxrn',
    'landingpageExtraTime',
    'store_load_to',
    'interfaceFrequency',
    'feedsADExposureTime',
    'openTuringSDK',
  ];
  for (const key of zeroKeys) {
    setIfDifferent(sdk, key, 0, state);
  }
  const emptyKeys = [
    'iOSBannerPageUrl',
    'iOSInterstitialPageUrl',
    'tpl',
    'mmaConfigURL',
    'miniCardList',
    'miniCardRef',
    'rewardVideoUseJsCallbackJudgeWebSuccess',
    'pingLocalDnsList',
    'real_time_report_event_id_list',
    'ex_exp_info',
  ];
  for (const key of emptyKeys) {
    setIfDifferent(sdk, key, '', state);
  }
  setIfDifferent(sdk, 'stop', 1, state);
  setIfDifferent(sdk, 'reqInterval', 86400, state);
}

function cleanTangramSetting(requestText, responseText) {
  const payload = JSON.parse(responseText || '{}');
  if (!payload || !payload.setting || typeof payload.setting !== 'object') {
    return null;
  }
  const sdk = payload.setting.sdk ? base64DecodeJson(payload.setting.sdk) : null;
  const app = payload.setting.app ? base64DecodeJson(payload.setting.app) : null;
  const mode = isQQMusicText(requestText) || (sdk && /qqmusic|ios_qm_splash/i.test(String(sdk.ex_exp_info || '')))
    ? 'qqmusic'
    : hasHuyaTangramMarker(requestText, sdk, app)
      ? 'huya'
      : '';
  if (!mode) {
    return null;
  }

  const state = { changed: false };
  if (sdk) {
    cleanTangramSdk(sdk, state);
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
  return state.changed ? { payload, marker: `${mode}-tangram-clean-1` } : null;
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const requestText = bodyToText(request.body);
  const responseText = bodyToText(response.body);
  const urlInfo = parseUrl(request.url);
  const fingerprint = [
    request.url,
    requestText,
    decodeURIComponentSafe(getHeader(request.headers, 'User-Agent')),
    getHeader(request.headers, 'app-name'),
    getHeader(request.headers, 'app-id'),
  ].join('\n');

  if (urlInfo.host === 'us.l.qq.com' && urlInfo.path === '/exapp') {
    const mode = isQQMusicText(fingerprint) ? 'qqmusic' : isHuyaExappRequest(requestText) ? 'huya' : '';
    if (!mode) {
      done({});
    } else {
      const payload = JSON.parse(responseText || '{}');
      if (cleanGdtExapp(payload, mode)) {
        responseJson(payload, `${mode}-gdt-exapp-nofill-1`);
      } else {
        done({});
      }
    }
  } else if (urlInfo.host === 'tangram.e.qq.com' && urlInfo.path === '/updateSetting') {
    const result = cleanTangramSetting(requestText, responseText);
    if (result) {
      responseJson(result.payload, result.marker);
    } else {
      done({});
    }
  } else {
    done({});
  }
} catch (error) {
  console.log('uBO GDT shared ad clean failed:', error && error.message ? error.message : String(error));
  done({});
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
