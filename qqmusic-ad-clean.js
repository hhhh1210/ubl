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

function base64DecodeBinary(input) {
  if (typeof atob === 'function') {
    return atob(input);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < input.length; i++) {
    const value = chars.indexOf(input.charAt(i));
    if (input.charAt(i) === '=') {
      break;
    }
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

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return undefined;
  }
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

function buildHeaders(baseHeaders, marker, contentType) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  if (contentType) {
    setHeaderCaseInsensitive(headers, 'Content-Type', contentType);
  }
  setHeaderCaseInsensitive(headers, 'X-uBO-QQMusic', marker);
  return headers;
}

function finishJson(reason, value, marker) {
  console.log(`uBO QQMusic ad clean: ${reason}`);
  done({
    status: 200,
    headers: buildHeaders($response && $response.headers, marker, 'application/json; charset=utf-8'),
    body: JSON.stringify(value),
  });
}

function finishNoContent(reason, marker) {
  console.log(`uBO QQMusic ad clean: ${reason}`);
  done({
    status: 204,
    headers: buildHeaders($response && $response.headers, marker, ''),
    body: '',
  });
}

function finishDirectNoContent(reason, marker) {
  console.log(`uBO QQMusic ad clean: ${reason}`);
  done({
    response: {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-uBO-QQMusic': marker,
      },
      body: '',
    },
  });
}

function finishProtoNoAd(reason, marker) {
  const body = base64DecodeBinary('CAAov+eP9uUzOoABWUxOT29xbmhsbHRYQmJ0T2laeWFEeFd2MWpGeDczL3VaZUQzN1ZNWC8ycG8vWDJFTHA2UFFseUJUWHU1MFdGaHlyODZwNkNpU1lHRmsvUzVHNzEycEJ0Skd6TGM1Vk94SGhYQVFCR0tCTUMybkx0Q2lrWlQ0cnhEcW80bmlCTnVI/5Pr3ANQAFogZWFmMWFjMDkwMDAwMDAxODE1ZWMyNjdkNmExNDI5ZjhoAQ==');
  console.log(`uBO QQMusic ad clean: ${reason}`);
  done({
    status: 200,
    headers: buildHeaders($response && $response.headers, marker, 'application/proto'),
    body,
  });
}

function requestFingerprint(request, bodyText) {
  const headers = request && request.headers;
  return [
    request && request.url,
    bodyText,
    getHeader(headers, 'User-Agent'),
    decodeURIComponentSafe(getHeader(headers, 'User-Agent')),
    getHeader(headers, 'app-name'),
    getHeader(headers, 'app-id'),
  ].join('\n');
}

function isQQMusicRequest(request, bodyText) {
  const text = requestFingerprint(request, bodyText);
  return /com\.tencent\.QQMusic|QQ(?:%E9%9F%B3%E4%B9%90|音乐)|appkey"?\s*:\s*"?1107900362|hostappid(?:%22%3A%22|"?\s*[:=]\s*"?)1107900362|appid=100497308|mediumId=5766736179307259435|app-id\n?5766736179307259435/i.test(text);
}

function cleanTmeGetInfo(payload, state) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.rpt_msg_pos_ad_info)) {
    for (const pos of payload.rpt_msg_pos_ad_info) {
      if (pos && typeof pos === 'object') {
        if (Array.isArray(pos.rpt_msg_ad_info) && pos.rpt_msg_ad_info.length !== 0) {
          pos.rpt_msg_ad_info = [];
          state.changed = true;
        }
        if (pos.ret !== 102006) {
          pos.ret = 102006;
          state.changed = true;
        }
        if (pos.msg !== 'no ad') {
          pos.msg = 'no ad';
          state.changed = true;
        }
      }
    }
  }
  payload.ret = 0;
  return payload;
}

function cleanGdtExapp(payload, state) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const data = payload.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const slotId of Object.keys(data)) {
      const slot = data[slotId];
      if (!slot || typeof slot !== 'object') {
        continue;
      }
      if (Array.isArray(slot.list) && slot.list.length !== 0) {
        slot.list = [];
        state.changed = true;
      }
      if (slot.ret !== 102006) {
        slot.ret = 102006;
        state.changed = true;
      }
      if (slot.msg !== 'no ad') {
        slot.msg = 'no ad';
        state.changed = true;
      }
    }
  }
  payload.ret = 0;
  payload.rpt = 0;
  payload.msg = '';
  payload.last_ads = {};
  payload.reqinterval = Math.max(Number(payload.reqinterval) || 0, 3600);
  return payload;
}

function cleanTangramSetting(requestText, responseText) {
  const payload = parseMaybeJson(responseText || '{}');
  if (!payload || !payload.setting || typeof payload.setting !== 'object') {
    return null;
  }
  if (!/com\.tencent\.QQMusic|appkey"?\s*:\s*"?1107900362/i.test(requestText || '')) {
    return null;
  }

  const state = { changed: false };
  const sdk = payload.setting.sdk ? base64DecodeJson(payload.setting.sdk) : null;
  const app = payload.setting.app ? base64DecodeJson(payload.setting.app) : null;

  if (sdk) {
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
    ];
    for (const key of zeroKeys) {
      setIfDifferent(sdk, key, 0, state);
    }
    for (const key of [
      'iOSBannerPageUrl',
      'iOSInterstitialPageUrl',
      'tpl',
      'mmaConfigURL',
      'miniCardList',
      'miniCardRef',
      'rewardVideoUseJsCallbackJudgeWebSuccess',
    ]) {
      setIfDifferent(sdk, key, '', state);
    }
    setIfDifferent(sdk, 'stop', 1, state);
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

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const argument = typeof $argument === 'string' ? $argument : '';
  const urlInfo = parseUrl(request.url);
  const requestText = bodyToText(request.body);
  const responseText = bodyToText(response.body);
  const isQQMusic = isQQMusicRequest(request, requestText);
  let handled = false;

  if (/^tmead\.y\.qq\.com$/.test(urlInfo.host) && urlInfo.path === '/maproxy/getPbCompressAd') {
    if (isQQMusic && /(?:^|&)phase=pb-request(?:&|$)/.test(argument)) {
      done({});
    } else if (isQQMusic && /(?:^|&)phase=pb-response(?:&|$)/.test(argument)) {
      finishProtoNoAd('QQMusic protobuf ad response no-ad', 'pb-response-noad-proto-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && isQQMusic && urlInfo.host === 'tmead.y.qq.com' && urlInfo.path === '/maproxy/getInfo') {
    const payload = parseMaybeJson(responseText);
    if (payload !== undefined) {
      const state = { changed: false };
      cleanTmeGetInfo(payload, state);
      finishJson('QQMusic TME getInfo no-fill', payload, 'tme-getinfo-nofill-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && isQQMusic && urlInfo.host === 'us.l.qq.com' && urlInfo.path === '/exapp') {
    const payload = parseMaybeJson(responseText);
    if (payload !== undefined) {
      const state = { changed: false };
      cleanGdtExapp(payload, state);
      finishJson('QQMusic GDT exapp no-fill', payload, 'gdt-exapp-nofill-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && urlInfo.host === 'tangram.e.qq.com' && urlInfo.path === '/updateSetting') {
    const payload = cleanTangramSetting(requestText, responseText);
    if (payload) {
      finishJson('QQMusic Tangram splash/reward settings disabled', payload, 'tangram-setting-clean-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && isQQMusic && urlInfo.host === 'ad.tencentmusic.com') {
    if (/^\/(?:config\/uni|sdk\/(?:config|ad\/strategies))$/.test(urlInfo.path)) {
      finishNoContent('QQMusic encrypted ad config emptied', 'ad-config-empty-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO QQMusic ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
