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

function removeQueryParam(url, key) {
  const source = String(url || '');
  const hashIndex = source.indexOf('#');
  const beforeHash = hashIndex === -1 ? source : source.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : source.slice(hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  if (queryIndex === -1) {
    return source;
  }
  const base = beforeHash.slice(0, queryIndex);
  const query = beforeHash.slice(queryIndex + 1);
  const kept = [];
  for (const part of query.split('&')) {
    if (!part) {
      continue;
    }
    const name = decodeURIComponentSafe(part.split('=')[0]);
    if (name !== key) {
      kept.push(part);
    }
  }
  return base + (kept.length ? `?${kept.join('&')}` : '') + hash;
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
  setHeaderCaseInsensitive(headers, 'X-uBO-DiDi', marker);
  return headers;
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return undefined;
  }
}

function stringValue(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function finishJson(reason, value, marker) {
  const headers = buildJsonHeaders($response && $response.headers, marker);
  console.log(`uBO DiDi ad clean: ${reason}`);
  done({
    status: 200,
    headers,
    body: JSON.stringify(value),
  });
}

function isTogglesEndpoint(urlInfo) {
  return urlInfo.host === 'as.xiaojukeji.com' && urlInfo.path === '/ep/as/toggles';
}

function isShieldEndpoint(urlInfo) {
  return urlInfo.host === 'guard.sec.xiaojukeji.com' &&
    urlInfo.path === '/api/guard/psg/v2/getShieldStatus';
}

function isThanosEndpoint(urlInfo) {
  return urlInfo.host === 'thanos.xiaojukeji.com' &&
    urlInfo.path === '/api/thanos/update';
}

const BAD_TOGGLE_NAMES = new Set([
  'Freight_Passenger_Union_Popup_Switch',
  'app_hm_show_guide_popup',
  'bottom_bar_coupon',
  'coupon_cashier_highlight',
  'ddpay_coupon_center',
  'didipas_splash_mp4control',
  'di_splash_view_toggle',
  'di_splash_view_toggle_exp',
  'gj_zf_qb',
  'gray_map_pt_hppop',
  'home_Xpanel_notice_22',
  'IsLaunchTaskEnable',
  'launch_advertising_display_interval',
  'min_drn_bundle_version_config_xpanel',
  'Request_Xpanel_22',
  'Request_Xpanel_notice_22',
  'setting_toggle_coupon_filter',
  'wyc_splash_ad_status_sw',
  'Xpanel_Notice',
  'xbanner_toggle',
]);

const BAD_TOGGLE_NAME_RE = /(?:coupon|cashier|ddpay|popup|dialog|modal|xpanel|xbanner|banner|grey|gray|mask|overlay)/i;

const DISABLED_RESOURCE_KEYS = [
  'pas_start_page',
  'pas_notice_webview',
  'didipas_remote_index_notice',
  'didipas_startpage_map',
  'pas_home_activity',
  'pas_swipe_sucess_notice',
  'didipas_second_floor_confirm_call',
  'didipas_second_floor_index',
  'didipas_second_floor_ride_end',
  'didipas_second_floor_running',
  'didipas_second_floor_wait_response',
];

const BAD_THANOS_TEXT_RE = /(?:drn-sk-dialog-rn|xpanel-thanos|energy-coupons|mfe-energy-activity|energy-wallet|xjcfthanos|ad_oss|zhunxing-creative|dpubstatic\.udache\.com\/static\/dpubimg)/i;

function cleanShieldPayload(payload) {
  const out = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : { errno: 0, errmsg: '' };
  if (!out.data || typeof out.data !== 'object' || Array.isArray(out.data)) {
    out.data = {};
  }
  out.data.shieldInfo = [];
  return out;
}

function isBadThanosModule(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return false;
  }
  const text = [
    item.module_code,
    item.moduleCode,
    item.name,
    item.url,
    item.bundle_url,
    item.bundleUrl,
    item.zip_url,
    item.zipUrl,
    item.md5,
  ].map(stringValue).join(' ');
  return BAD_THANOS_TEXT_RE.test(text);
}

function cleanThanosPayload(payload, state) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.data)) {
    const kept = payload.data.filter((item) => !isBadThanosModule(item));
    if (kept.length !== payload.data.length) {
      payload.data = kept;
      state.changed = true;
    }
  }
  return payload;
}

function cleanToggleScalar(value, state) {
  if (typeof value === 'boolean') {
    if (value !== false) {
      state.changed = true;
    }
    return false;
  }
  if (typeof value === 'number') {
    if (value !== 0) {
      state.changed = true;
    }
    return 0;
  }
  if (typeof value === 'string') {
    if (value !== '' && value !== '0' && value.toLowerCase() !== 'false') {
      state.changed = true;
      return '0';
    }
    return value;
  }
  return value;
}

function disableToggleObject(object, state) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    return object;
  }
  if (object.allow !== false) {
    object.allow = false;
    state.changed = true;
  }
  if (object.assign !== undefined) {
    delete object.assign;
    state.changed = true;
  }
  return object;
}

function cleanToggleValue(value, state) {
  if (Array.isArray(value)) {
    if (value.length !== 0) {
      state.changed = true;
    }
    return [];
  }
  if (value && typeof value === 'object') {
    return disableToggleObject(value, state);
  }
  return cleanToggleScalar(value, state);
}

function patchDaggerLaunchConfig(object, state) {
  const args = object && object.assign && object.assign.args;
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return;
  }
  if (args.is_launch_enable !== undefined && args.is_launch_enable !== '0') {
    args.is_launch_enable = '0';
    state.changed = true;
  }
  if (typeof args.launch_config !== 'string') {
    return;
  }
  const parsed = parseMaybeJson(args.launch_config);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return;
  }
  const before = JSON.stringify(parsed);
  if (Array.isArray(parsed.page_names)) {
    parsed.page_names = parsed.page_names.filter((name) => name !== 'DSplashViewController' && name !== 'ORSSplashViewController');
  }
  if (parsed.prewarming_threshold !== undefined) {
    parsed.prewarming_threshold = '0';
  }
  if (JSON.stringify(parsed) !== before) {
    args.launch_config = JSON.stringify(parsed);
    state.changed = true;
  }
}

function patchWebxConfig(object, state) {
  const args = object && object.assign && object.assign.args;
  if (!args || typeof args.config !== 'string') {
    return;
  }
  const parsed = parseMaybeJson(args.config);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return;
  }
  if (Array.isArray(parsed.webviewPage) && parsed.webviewPage.length !== 0) {
    parsed.webviewPage = [];
    args.config = JSON.stringify(parsed);
    state.changed = true;
  }
}

function patchToggleObject(object, state) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    return;
  }
  const name = stringValue(object.name);
  const args = object.assign && object.assign.args;

  if (name === 'IsDaggerEnable') {
    patchDaggerLaunchConfig(object, state);
  }
  if (name === 'webx_get_prod_page_conf') {
    patchWebxConfig(object, state);
  }

  if (BAD_TOGGLE_NAMES.has(name) || BAD_TOGGLE_NAME_RE.test(name)) {
    disableToggleObject(object, state);
    return;
  }

  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return;
  }

  if (name === 'new_resource_sdk_toggle') {
    for (const key of DISABLED_RESOURCE_KEYS) {
      if (args[key] !== undefined && args[key] !== '0') {
        args[key] = '0';
        state.changed = true;
      }
    }
  }

  if (name === 'ios_activity_download_config') {
    if (args.enable !== 0) {
      args.enable = 0;
      state.changed = true;
    }
    if (args.url) {
      args.url = '';
      state.changed = true;
    }
  }

  if (name === 'xpanel_revision') {
    if (args.enable !== 0) {
      args.enable = 0;
      state.changed = true;
    }
    if (args.banner_enable !== '0') {
      args.banner_enable = '0';
      state.changed = true;
    }
    if (args.url) {
      args.url = '';
      state.changed = true;
    }
  }

  if (name === 'qu_dialog_rn_new' && args.dialog_popup_operation_banner !== undefined && args.dialog_popup_operation_banner !== 0) {
    args.dialog_popup_operation_banner = 0;
    state.changed = true;
  }
}

function cleanStringifiedJson(text, state) {
  const trimmed = String(text || '').trim();
  if (!/^[\[{]/.test(trimmed)) {
    return text;
  }
  const parsed = parseMaybeJson(trimmed);
  if (parsed === undefined) {
    return text;
  }
  const before = JSON.stringify(parsed);
  cleanTogglePayload(parsed, state);
  if (JSON.stringify(parsed) !== before) {
    state.changed = true;
    return JSON.stringify(parsed);
  }
  return text;
}

function cleanTogglePayload(value, state) {
  if (Array.isArray(value)) {
    for (const item of value) {
      cleanTogglePayload(item, state);
    }
    return value;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  patchToggleObject(value, state);
  for (const key of Object.keys(value)) {
    if (BAD_TOGGLE_NAMES.has(key) || BAD_TOGGLE_NAME_RE.test(key)) {
      value[key] = cleanToggleValue(value[key], state);
      continue;
    }
    if (typeof value[key] === 'string') {
      value[key] = cleanStringifiedJson(value[key], state);
      continue;
    }
    cleanTogglePayload(value[key], state);
  }
  return value;
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const argument = typeof $argument === 'string' ? $argument : '';
  const urlInfo = parseUrl(request.url);

  if (/(?:^|&)phase=toggles-request(?:&|$)/.test(argument) && isTogglesEndpoint(urlInfo)) {
    const nextUrl = removeQueryParam(request.url, 'md5');
    if (nextUrl !== request.url) {
      console.log('uBO DiDi ad clean: toggles md5 cache key removed');
      done({ url: nextUrl });
    } else {
      done({});
    }
  } else if (isTogglesEndpoint(urlInfo)) {
    const payload = parseMaybeJson(bodyToText(response.body));
    if (payload !== undefined) {
      const state = { changed: false };
      cleanTogglePayload(payload, state);
      if (state.changed) {
        finishJson('DiDi popup toggles cleaned', payload, 'didi-lite-toggles-20260613-1');
      } else {
        done({});
      }
    } else {
      done({});
    }
  } else if (isShieldEndpoint(urlInfo)) {
    const payload = parseMaybeJson(bodyToText(response.body) || '{}') || {};
    finishJson('DiDi safety shield overlay emptied', cleanShieldPayload(payload), 'didi-lite-shield-20260613-1');
  } else if (isThanosEndpoint(urlInfo)) {
    const payload = parseMaybeJson(bodyToText(response.body));
    if (payload !== undefined) {
      const state = { changed: false };
      cleanThanosPayload(payload, state);
      if (state.changed) {
        finishJson('DiDi Thanos popup modules cleaned', payload, 'didi-lite-thanos-20260613-1');
      } else {
        done({});
      }
    } else {
      done({});
    }
  } else {
    done({});
  }
} catch (error) {
  console.log('uBO DiDi ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
