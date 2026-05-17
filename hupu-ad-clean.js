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

function nowMs() {
  return Date.now ? Date.now() : new Date().getTime();
}

const MARKER_KEY = 'ubo_hupu_app_seen_at';
const MARKER_TTL_MS = 5 * 60 * 1000;
const HUPU_BUNDLE_RE = /com\.hupu\.games\.pro|hostver=8\.2\.\d+|app_version=8\.2\.\d+|clientId=160043493/i;
const GDT_HUPU_POSID_RE = /(?:posid=)(?:6239517967885584|2219617937880575|2209718927387577|1219719987882536)(?:&|$)/;
const AD_FLAG_KEY_RE = /(?:^|_)(?:ad|adsdk|sdkad|openad|frombackopenad|gdt|ylh|csj|splash|pangolin)(?:_|$)|adLaunchTimeout/i;

function markHupuApp(reason) {
  try {
    $persistentStore.write(String(nowMs()), MARKER_KEY);
  } catch (error) {
  }
  if (reason) {
    console.log(`uBO Hupu ad clean: ${reason}`);
  }
}

function hasRecentHupuMarker() {
  try {
    const value = Number($persistentStore.read(MARKER_KEY) || 0);
    return Number.isFinite(value) && value > 0 && nowMs() - value < MARKER_TTL_MS;
  } catch (error) {
    return false;
  }
}

function isHupuConfigEndpoint(urlInfo) {
  return urlInfo.host === 'goblin.hupu.com' && /\/config\/app$/i.test(urlInfo.path);
}

function isHupuInterfaceAdEndpoint(urlInfo) {
  return urlInfo.host === 'goblin.hupu.com' && /\/interfaceAd\/getOther\/v3$/i.test(urlInfo.path);
}

function isHupuThemisEndpoint(urlInfo) {
  return urlInfo.host === 'themis.hupu.com' && urlInfo.path === '/ab';
}

function isHupuGdtMviewEndpoint(urlInfo) {
  return urlInfo.host === 'v2mi.gdt.qq.com' && urlInfo.path === '/gdt_mview.fcg';
}

function isGdtLaunchEndpoint(urlInfo) {
  return urlInfo.host === 'sdkquic.e.qq.com' && urlInfo.path === '/launch';
}

function isHupuGdtMviewBody(body) {
  const text = bodyToText(body);
  const decoded = decodeURIComponentSafe(text);
  return HUPU_BUNDLE_RE.test(decoded) || GDT_HUPU_POSID_RE.test(text);
}

function parseGdtPosid(body) {
  const text = bodyToText(body);
  const match = text.match(/(?:^|&)posid=([^&]+)/);
  return match ? decodeURIComponentSafe(match[1]) : '0';
}

function buildGdtNoFillPayload(body, originalPayload) {
  const posid = parseGdtPosid(body);
  const payload = originalPayload && typeof originalPayload === 'object' && !Array.isArray(originalPayload)
    ? originalPayload
    : {};
  payload.ret = 0;
  payload.msg = '';
  payload.reqinterval = Math.max(Number(payload.reqinterval) || 0, 3600);
  payload.last_ads = { responsed_ad_data: '' };
  payload.data = {};
  payload.data[posid] = {
    ret: 102006,
    external_info: {
      msg: 'no ad',
    },
    list: [],
  };
  return payload;
}

function finishJson(reason, value, marker) {
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const headers = cloneHeaders(response.headers);
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'X-uBO-Hupu', marker || 'json-clean-1');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  console.log(`uBO Hupu ad clean: ${reason}`);
  done({
    status: 200,
    headers,
    body: JSON.stringify(value),
  });
}

function finishDirectJson(reason, value, marker) {
  console.log(`uBO Hupu ad clean: ${reason}`);
  done({
    response: {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-uBO-Hupu': marker || 'direct-json-1',
      },
      body: JSON.stringify(value),
    },
  });
}

function finishDirectNoContent(reason, marker) {
  console.log(`uBO Hupu ad clean: ${reason}`);
  done({
    response: {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-uBO-Hupu': marker || 'direct-no-content-1',
      },
      body: '',
    },
  });
}

function setIfChanged(object, key, value, state) {
  if (!object || typeof object !== 'object' || object[key] === value) {
    return;
  }
  object[key] = value;
  state.changed = true;
}

function cleanHupuConfigValue(value, state, keyName) {
  if (Array.isArray(value)) {
    if (/ad|slot|cache|sdkTimeOut|ylh|gdt|csj|splash/i.test(keyName || '')) {
      if (value.length !== 0) {
        state.changed = true;
      }
      return [];
    }
    return value.map((item) => cleanHupuConfigValue(item, state, keyName));
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (/^(?:ylh_slotId_list|slot_timeout_list|cache_slot_list|cache_limit_list|sdkTimeOutList)$/i.test(key)) {
        if (Array.isArray(value[key]) && value[key].length !== 0) {
          value[key] = [];
          state.changed = true;
        }
        continue;
      }
      if (/^(?:is_preload|preload|enable|enabled)$/i.test(key) && /ad|ylh|gdt|csj|slot|splash/i.test(JSON.stringify(value).slice(0, 1000))) {
        setIfChanged(value, key, false, state);
        continue;
      }
      value[key] = cleanHupuConfigValue(value[key], state, key);
    }
  }
  return value;
}

function patchHupuConfig(payload, state) {
  const data = payload && payload.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return payload;
  }
  for (const key of [
    'boot_pre_timeout',
    'gdt_timeout_boot',
    'tt_timeout_boot',
    'xm_timeout_boot',
    'ylh_sdk_timeout_boot',
    'ylh_sdk_timeout_flow',
    'ylh_sdk_reserve_min',
    'download_change_time',
  ]) {
    if (data[key] !== undefined) {
      setIfChanged(data, key, 0, state);
    }
  }
  for (const key of ['cache_limit_list', 'cache_slot_list', 'sdkTimeOutList', 'ylh_sdk_pull_slotId_list']) {
    if (Array.isArray(data[key]) && data[key].length !== 0) {
      data[key] = [];
      state.changed = true;
    }
  }
  cleanHupuConfigValue(data.page_pid, state, 'page_pid');
  return payload;
}

function patchHupuThemisValue(value, state) {
  if (Array.isArray(value)) {
    for (const item of value) {
      patchHupuThemisValue(item, state);
    }
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }
  if (typeof value.k === 'string' && AD_FLAG_KEY_RE.test(value.k) && value.v !== '0') {
    value.v = '0';
    state.changed = true;
  }
  for (const item of Object.keys(value)) {
    patchHupuThemisValue(value[item], state);
  }
}

function patchHupuInterfaceAd(payload, state) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.ads) && payload.ads.length !== 0) {
    payload.ads = [];
    state.changed = true;
  }
  if (payload.ad_code !== 0) {
    payload.ad_code = 0;
    state.changed = true;
  }
  if (payload.extra !== undefined && JSON.stringify(payload.extra) !== '{}') {
    payload.extra = {};
    state.changed = true;
  }
  return payload;
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const urlInfo = parseUrl(request.url);
  const argument = typeof $argument === 'string' ? $argument : '';
  let handled = false;

  if (
    /(?:^|&)phase=gdt-mview-request(?:&|$)/.test(argument) &&
    isHupuGdtMviewEndpoint(urlInfo)
  ) {
    if (isHupuGdtMviewBody(request.body)) {
      markHupuApp('Hupu GDT mview marker refreshed');
      finishDirectJson(
        'Hupu GDT mview request short-circuited with no-fill',
        buildGdtNoFillPayload(request.body),
        'gdt-mview-fast-nofill-1'
      );
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=gdt-launch-request(?:&|$)/.test(argument) &&
    isGdtLaunchEndpoint(urlInfo)
  ) {
    if (hasRecentHupuMarker()) {
      finishDirectNoContent(
        'Hupu GDT launch request short-circuited',
        'gdt-launch-fast-empty-1'
      );
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=config(?:&|$)/.test(argument) &&
    isHupuConfigEndpoint(urlInfo)
  ) {
    markHupuApp('Hupu config marker refreshed');
    const payload = JSON.parse(bodyToText(response.body) || '{}');
    const state = { changed: false };
    patchHupuConfig(payload, state);
    if (state.changed) {
      finishJson('Hupu app ad config cleaned', payload, 'config-clean-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=interface-ad(?:&|$)/.test(argument) &&
    isHupuInterfaceAdEndpoint(urlInfo)
  ) {
    markHupuApp('Hupu interface ad marker refreshed');
    const payload = JSON.parse(bodyToText(response.body) || '{}');
    const state = { changed: false };
    patchHupuInterfaceAd(payload, state);
    if (state.changed) {
      finishJson('Hupu interfaceAd ads emptied', payload, 'interface-ad-empty-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=themis(?:&|$)/.test(argument) &&
    isHupuThemisEndpoint(urlInfo)
  ) {
    markHupuApp('Hupu Themis marker refreshed');
    const payload = JSON.parse(bodyToText(response.body) || '{}');
    const state = { changed: false };
    patchHupuThemisValue(payload, state);
    if (state.changed) {
      finishJson('Hupu Themis ad flags disabled', payload, 'themis-ad-flags-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO Hupu ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
