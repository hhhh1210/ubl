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

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return undefined;
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

function finishDirectJson(reason, value, marker) {
  console.log(`uBO QQMusic ad clean: ${reason}`);
  done({
    response: {
      status: 200,
      headers: buildHeaders({}, marker, 'application/json; charset=utf-8'),
      body: JSON.stringify(value),
    },
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
  return /com\.tencent\.QQMusic|QQ(?:%E9%9F%B3%E4%B9%90|音乐)|appkey"?\s*:\s*"?1107900362|hostappid(?:%22%3A%22|"?\s*[:=]\s*"?)1107900362|appid=100497308|posid=4070643834392507|mediumId=5766736179307259435|app-id\n?5766736179307259435/i.test(text);
}

function noGdtExappPayload() {
  return {
    ret: 0,
    rpt: 0,
    msg: '',
    reqinterval: 3600,
    last_ads: {},
    data: {},
  };
}

function markGdtSlotNoAd(slot) {
  if (!slot || typeof slot !== 'object') {
    return;
  }
  slot.ret = 102006;
  slot.msg = 'no ad';
  slot.list = [];
  slot.dr = slot.dr || 0;
}

function extractParam(text, name) {
  const match = String(text || '').match(new RegExp(`(?:^|&)${name}=([^&]*)`));
  return match ? decodeURIComponentSafe(match[1]) : '';
}

function cleanGdtExapp(requestText, responseText) {
  const payload = parseMaybeJson(responseText);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  const data = payload.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const requestSlot = extractParam(requestText, 'posid');
  const slotIds = Object.keys(data).filter((slotId) => {
    return slotId === requestSlot || /^(?:4070643834392507|1050088140283129)$/.test(slotId);
  });
  if (slotIds.length === 0) {
    return undefined;
  }
  for (const slotId of slotIds) {
    markGdtSlotNoAd(data[slotId]);
  }
  payload.ret = 0;
  payload.rpt = 0;
  payload.msg = '';
  payload.reqinterval = 3600;
  payload.last_ads = {};
  return payload;
}

function clearArrayField(payload, name, state) {
  if (Array.isArray(payload[name]) && payload[name].length !== 0) {
    payload[name] = [];
    state.changed = true;
  } else if (!Array.isArray(payload[name])) {
    payload[name] = [];
    state.changed = true;
  }
}

function setPayloadField(payload, name, value, state) {
  if (payload[name] !== value) {
    payload[name] = value;
    state.changed = true;
  }
}

function cleanTmeGetInfo(payload, state) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  // QQMusic 20.5.0 still reads "no ad" position metadata from getInfo even when
  // rpt_msg_ad_info is empty.  The IPA points to TMEHippyAdManagerModule / FreeModeDialog
  // using these positions (300201/300909*) to drive splash/free-mode/reward popups, so
  // remove the whole position list instead of only clearing nested ad creatives.
  clearArrayField(payload, 'rpt_msg_pos_ad_info', state);
  clearArrayField(payload, 'rpt_msg_neg_feedback', state);
  clearArrayField(payload, 'ad_cache_list', state);
  clearArrayField(payload, 'conf_update_time', state);

  setPayloadField(payload, 'ret', 0, state);
  setPayloadField(payload, 'msg', '', state);
  setPayloadField(payload, 'ad_channel_id', 0, state);
  setPayloadField(payload, 'req_type', 0, state);
  setPayloadField(payload, 'seq', 0, state);
  setPayloadField(payload, 'piano_error', 0, state);
  setPayloadField(payload, 'use_local_clock', 0, state);
  setPayloadField(payload, 'disable_feature_splash', 1, state);
  setPayloadField(payload, 'dynamic_splash_ecpm_floor', 0, state);
  setPayloadField(payload, 'local_cache_pick', 0, state);
  setPayloadField(payload, 'gdt_contract_splash_pak', '', state);
  setPayloadField(payload, 'gdt_contract_splash_pak_ver', '', state);
  return payload;
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

  if (urlInfo.host === 'us.l.qq.com' && urlInfo.path === '/exapp') {
    if (isQQMusic && /(?:^|&)phase=gdt-exapp-request(?:&|$)/.test(argument)) {
      finishDirectJson('QQMusic GDT exapp request emptied', noGdtExappPayload(), 'gdt-exapp-request-empty-2');
    } else if (isQQMusic) {
      const payload = cleanGdtExapp(requestText, responseText);
      if (payload !== undefined) {
        finishJson('QQMusic GDT exapp response no-fill', payload, 'gdt-exapp-nofill-3');
      } else {
        done({});
      }
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && /^tmead\.y\.qq\.com$/.test(urlInfo.host) && urlInfo.path === '/maproxy/getPbCompressAd') {
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
