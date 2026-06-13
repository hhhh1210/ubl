'use strict';

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

function buildJsonHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'X-uBO-Qimao', marker);
  return headers;
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

function bodyToText(body) {
  if (typeof body === 'string') {
    return body;
  }
  if (typeof ArrayBuffer !== 'undefined') {
    if (body instanceof ArrayBuffer) {
      body = new Uint8Array(body);
    } else if (body && typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(body)) {
      body = new Uint8Array(body.buffer, body.byteOffset || 0, body.byteLength);
    }
  }
  if (body && typeof body.length === 'number') {
    let text = '';
    for (let i = 0; i < body.length; i++) {
      text += String.fromCharCode(body[i] & 0xff);
    }
    return text;
  }
  return '';
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return undefined;
  }
}

function decodeSafe(text) {
  try {
    return decodeURIComponent(String(text || '').replace(/\+/g, ' '));
  } catch (error) {
    return String(text || '');
  }
}

function isBaiduMads(urlInfo) {
  return urlInfo.host === 'mobads.baidu.com' && urlInfo.path === '/cpro/ui/mads.php';
}

function isBaiduBggProduce(urlInfo) {
  return urlInfo.host === 'bgg.baidu.com' && urlInfo.path === '/bgg/produce';
}

function isGdtMview(urlInfo) {
  return urlInfo.host === 'mi.gdt.qq.com' && urlInfo.path === '/gdt_mview.fcg';
}

function isUserPopupConfigs(urlInfo) {
  return urlInfo.host === 'qm-sf.wtzw.com' && urlInfo.path === '/api/v2/sfo/user_popup_configs';
}

function isUbixEndpoint(urlInfo) {
  return urlInfo.host === 'tx-cfg-u1.ubixioe.com' && urlInfo.path === '/mob/sdk/v2/endpoint';
}

function isUbixInitEndpoint(urlInfo) {
  return urlInfo.host === 'tx-cfg-u1.ubixioe.com' && urlInfo.path === '/mob/sdk/v3/init';
}

function isPangolinGetAds(urlInfo) {
  return /^api-access\.pangolin-sdk-toutiao(?:1|-b)?\.com$/i.test(urlInfo.host) &&
    urlInfo.path === '/api/ad/union/sdk/get_ads/' &&
    /(?:^|&)aid=5000546(?:&|$)/.test(urlInfo.query);
}

function isPangolinSettings(urlInfo) {
  return /^api-access\.pangolin-sdk-toutiao(?:1|-b)?\.com$/i.test(urlInfo.host) &&
    urlInfo.path === '/api/ad/union/sdk/settings/' &&
    /(?:^|&)aid=5000546(?:&|$)/.test(urlInfo.query);
}

function isWebcastPangleSetting(urlInfo) {
  return urlInfo.host === 'webcast-open.douyin.com' &&
    urlInfo.path === '/webcast/openapi/pangle/setting/' &&
    (/(?:^|&)app_id=395670(?:&|$)/.test(urlInfo.query) ||
      /(?:^|&)package_name=com\.yueyou\.cyreader(?:&|$)/.test(urlInfo.query));
}

function isGdtSdkControl(urlInfo) {
  return urlInfo.host === 'sdk.e.qq.com' && /^(?:\/launch|\/msg|\/event)$/.test(urlInfo.path);
}

const QIMAO_GDT_SLOTS = {
  '1160339633993603': true,
  '2026212585765216': true,
  '7053344540756528': true,
  '8035514834672656': true,
  '8120532693295569': true,
  '1067616752819125': true,
  '7034844680253349': true,
};

function looksLikeQimaoBaiduAd(ad) {
  const text = JSON.stringify(ad || {});
  const hasVerifiedMaterial = /qh-material\.taobao\.com/i.test(text) ||
    /mobads-pre-config\.cdn\.bcebos\.com\/splash\/SDK200(?:10|3[234])\.png/i.test(text);
  const hasNativeSplash = /"native_rsplash":true/.test(text);
  const hasKnownDsp = /59229808/.test(text);
  const hasObservedTaobaoSplash = /"adslot":46/.test(text) && /"pk":"com\.taobao\.taobao"/.test(text);
  return hasVerifiedMaterial && (hasNativeSplash || hasKnownDsp || hasObservedTaobaoSplash);
}

function cleanBaiduMads(payload, state) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.ad)) {
    return payload;
  }
  const before = payload.ad.length;
  payload.ad = payload.ad.filter((ad) => !looksLikeQimaoBaiduAd(ad));
  if (payload.ad.length !== before) {
    state.changed = true;
  }
  return payload;
}

function isQimaoGdtRequest(text) {
  return /com\.yueyou\.cyreader/i.test(decodeSafe(text)) ||
    /%22c_pkgname%22%3A%22com\.yueyou\.cyreader%22/i.test(String(text || ''));
}

function isKnownQimaoGdtSlot(slotId) {
  return !!QIMAO_GDT_SLOTS[String(slotId || '')];
}

function hasOwnEnumerableKeys(value) {
  return value && typeof value === 'object' && Object.keys(value).length > 0;
}

function noFillGdtSlot(slot) {
  return {
    ret: 102006,
    external_info: {
      ret: 102006,
      msg: 'Match no ad.',
    },
    msg: "Match no ad. Please DON'T retry immediately.",
  };
}

function cleanGdtMview(payload, requestText, state) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const qimaoRequest = isQimaoGdtRequest(requestText);
  const data = payload.data && typeof payload.data === 'object' ? payload.data : null;
  if (!data) {
    return payload;
  }
  const targetKeys = Object.keys(data).filter((key) => {
    const slot = data[key];
    const hasFill = slot && Array.isArray(slot.list) && slot.list.length > 0;
    const hasReusableLastAd = hasOwnEnumerableKeys(payload.last_ads);
    return (hasFill || hasReusableLastAd || isKnownQimaoGdtSlot(key)) &&
      (qimaoRequest || isKnownQimaoGdtSlot(key));
  });
  if (targetKeys.length === 0) {
    return payload;
  }
  for (const key of targetKeys) {
    const slot = data[key];
    if (slot && slot.ret !== 102006) {
      data[key] = noFillGdtSlot(slot);
      state.changed = true;
    }
  }
  if (hasOwnEnumerableKeys(payload.last_ads)) {
    payload.last_ads = {};
    state.changed = true;
  }
  return payload;
}

function emptyPopupValue(value) {
  if (Array.isArray(value)) {
    return [];
  }
  if (value && typeof value === 'object') {
    return {};
  }
  return value;
}

function cleanUserPopupConfigs(payload, state) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  for (const key of ['data', 'configs', 'items', 'list', 'popups', 'popup_configs', 'user_popup_configs']) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const next = emptyPopupValue(payload[key]);
      if (JSON.stringify(next) !== JSON.stringify(payload[key])) {
        payload[key] = next;
        state.changed = true;
      }
    }
  }
  return payload;
}

function looksLikeQimaoUbixJdPayload(responseText, requestText) {
  const combined = responseText + '\n' + requestText;
  const hasQimaoScope = /com\.yueyou\.cyreader|YYReader|vlffmhp|14095310|42650/i.test(combined);
  const hasJdCreative = /com\.360buy\.jdmobile|360buyimg\.com\/pop\/jfs|ccc-x\.jd\.com\/dsp\/|im-x\.jd\.com\/dsp\/np|openApp\.jdMobile/i.test(responseText);
  return hasQimaoScope && hasJdCreative;
}

function isQimaoBaiduBggRequest(requestText) {
  const text = decodeSafe(requestText);
  return /(?:^|&)bundleId=com\.yueyou\.cyreader(?:&|$)/.test(text) ||
    /(?:^|&)appn=七猫小说(?:&|$)/.test(text);
}

function finishJson(reason, value, marker) {
  console.log('uBO Qimao ad clean: ' + reason);
  done({
    status: 200,
    headers: buildJsonHeaders($response && $response.headers, marker),
    body: JSON.stringify(value),
  });
}

function finishNoContent(reason, marker) {
  const headers = buildJsonHeaders($response && $response.headers, marker);
  setHeaderCaseInsensitive(headers, 'Content-Type', 'text/plain; charset=utf-8');
  console.log('uBO Qimao ad clean: ' + reason);
  done({
    status: 204,
    headers,
    body: '',
  });
}

function finishDirectNoContent(reason, marker) {
  const headers = buildJsonHeaders({}, marker);
  setHeaderCaseInsensitive(headers, 'Content-Type', 'text/plain; charset=utf-8');
  console.log('uBO Qimao ad clean: ' + reason);
  done({
    response: {
      status: 204,
      headers,
      body: '',
    },
  });
}

function pangleNoFillPayload() {
  return {
    request_id: 'ubo-qimao-nofill',
    status_code: 20001,
    reason: 141,
    desc: 'no ad',
    ads: [],
    data: null,
  };
}

function cleanWebcastPangleSetting(payload, state) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const data = payload.data && typeof payload.data === 'object' ? payload.data : null;
  if (!data) {
    return payload;
  }
  if (data.setting_url) {
    data.setting_url = '';
    state.changed = true;
  }
  const extra = data.extra_settings && typeof data.extra_settings === 'object' ? data.extra_settings : null;
  if (extra) {
    if (hasOwnEnumerableKeys(extra.ad_id)) {
      extra.ad_id = {};
      state.changed = true;
    }
    if (extra.init_enable !== false) {
      extra.init_enable = false;
      state.changed = true;
    }
    if (extra.enable_feed_no_ad !== true) {
      extra.enable_feed_no_ad = true;
      state.changed = true;
    }
    if (extra.use_pangle_plugin !== false) {
      extra.use_pangle_plugin = false;
      state.changed = true;
    }
  }
  return payload;
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const urlInfo = parseUrl(request.url);
  const payload = parseMaybeJson(bodyToText(response.body));
  const requestText = bodyToText(request.body);

  const responseText = bodyToText(response.body);

  if (isGdtSdkControl(urlInfo) && !response.body) {
    finishDirectNoContent('GDT SDK control request emptied', 'qimao-gdt-sdk-empty-2');
  } else if (isBaiduBggProduce(urlInfo) && isQimaoBaiduBggRequest(requestText) && !response.body) {
    finishDirectNoContent('Baidu BGG produce request emptied', 'qimao-baidu-bgg-empty-1');
  } else if (isPangolinGetAds(urlInfo)) {
    finishJson('Pangle get_ads no-fill', pangleNoFillPayload(), 'qimao-pangle-getads-nofill-1');
  } else if (isPangolinSettings(urlInfo)) {
    finishNoContent('Pangle settings emptied', 'qimao-pangle-settings-empty-1');
  } else if (isBaiduBggProduce(urlInfo) && isQimaoBaiduBggRequest(requestText)) {
    finishNoContent('Baidu BGG produce emptied', 'qimao-baidu-bgg-empty-1');
  } else if (isUbixInitEndpoint(urlInfo)) {
    finishNoContent('Ubix init emptied', 'qimao-ubix-init-empty-1');
  } else if (isUbixEndpoint(urlInfo) && looksLikeQimaoUbixJdPayload(responseText, requestText)) {
    finishNoContent('Ubix JD DSP payload emptied', 'qimao-ubix-jd-empty-1');
  } else if (!payload || typeof payload !== 'object') {
    done({});
  } else if (isBaiduMads(urlInfo)) {
    const state = { changed: false };
    cleanBaiduMads(payload, state);
    if (state.changed) {
      finishJson('Baidu splash/feed ad emptied', payload, 'qimao-baidu-mads-empty-1');
    } else {
      done({});
    }
  } else if (isGdtMview(urlInfo)) {
    const state = { changed: false };
    cleanGdtMview(payload, requestText, state);
    if (state.changed) {
      finishJson('GDT mview no-fill', payload, 'qimao-gdt-mview-nofill-1');
    } else {
      done({});
    }
  } else if (isUserPopupConfigs(urlInfo)) {
    const state = { changed: false };
    cleanUserPopupConfigs(payload, state);
    if (state.changed) {
      finishJson('user popup configs emptied', payload, 'qimao-user-popup-empty-1');
    } else {
      done({});
    }
  } else if (isWebcastPangleSetting(urlInfo)) {
    const state = { changed: false };
    cleanWebcastPangleSetting(payload, state);
    if (state.changed) {
      finishJson('Webcast Pangle setting disabled', payload, 'qimao-webcast-pangle-setting-1');
    } else {
      done({});
    }
  } else {
    done({});
  }
} catch (error) {
  console.log('uBO Qimao ad clean failed: ' + (error && error.message ? error.message : String(error)));
  done({});
}
