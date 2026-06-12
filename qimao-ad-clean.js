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

function isBaiduMads(urlInfo) {
  return urlInfo.host === 'mobads.baidu.com' && urlInfo.path === '/cpro/ui/mads.php';
}

function isGdtMview(urlInfo) {
  return urlInfo.host === 'mi.gdt.qq.com' && urlInfo.path === '/gdt_mview.fcg';
}

function isUserPopupConfigs(urlInfo) {
  return urlInfo.host === 'qm-sf.wtzw.com' && urlInfo.path === '/api/v2/sfo/user_popup_configs';
}

const QIMAO_GDT_SLOTS = {
  '1160339633993603': true,
  '2026212585765216': true,
  '7053344540756528': true,
  '8035514834672656': true,
  '8120532693295569': true,
  '1067616752819125': true,
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
  return /com\.yueyou\.cyreader/i.test(decodeURIComponent(String(text || ''))) ||
    /%22c_pkgname%22%3A%22com\.yueyou\.cyreader%22/i.test(String(text || ''));
}

function isKnownQimaoGdtSlot(slotId) {
  return !!QIMAO_GDT_SLOTS[String(slotId || '')];
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
    return hasFill && (qimaoRequest || isKnownQimaoGdtSlot(key));
  });
  if (targetKeys.length === 0) {
    return payload;
  }
  for (const key of targetKeys) {
    const slot = data[key];
    if (slot && Array.isArray(slot.list) && slot.list.length > 0) {
      data[key] = noFillGdtSlot(slot);
      state.changed = true;
    }
  }
  if (state.changed) {
    payload.last_ads = {};
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

function finishJson(reason, value, marker) {
  console.log('uBO Qimao ad clean: ' + reason);
  done({
    status: 200,
    headers: buildJsonHeaders($response && $response.headers, marker),
    body: JSON.stringify(value),
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const urlInfo = parseUrl(request.url);
  const payload = parseMaybeJson(bodyToText(response.body));
  const requestText = bodyToText(request.body);

  if (!payload || typeof payload !== 'object') {
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
  } else {
    done({});
  }
} catch (error) {
  console.log('uBO Qimao ad clean failed: ' + (error && error.message ? error.message : String(error)));
  done({});
}
