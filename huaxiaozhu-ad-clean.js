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

function deleteHeader(headers, target) {
  const lower = String(target).toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      delete headers[key];
    }
  }
}

function setHeader(headers, name, value) {
  deleteHeader(headers, name);
  headers[name] = value;
}

function getHeader(headers, target) {
  const lower = String(target).toLowerCase();
  if (!headers || typeof headers !== 'object') {
    return '';
  }
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      return headers[key];
    }
  }
  return '';
}

function bytesToText(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] & 0xff);
  }
  return out;
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

function decodeSafe(text) {
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
  return { host: match[1].toLowerCase(), path: match[2] || '/', query: match[3] || '' };
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
  const kept = [];
  for (const part of beforeHash.slice(queryIndex + 1).split('&')) {
    if (!part) {
      continue;
    }
    if (decodeSafe(part.split('=')[0]) !== key) {
      kept.push(part);
    }
  }
  return base + (kept.length ? `?${kept.join('&')}` : '') + hash;
}

function parseJson(text) {
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

function buildHeaders(baseHeaders, marker, contentType) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeader(headers, 'Content-Encoding');
  deleteHeader(headers, 'Content-Length');
  deleteHeader(headers, 'Transfer-Encoding');
  setHeader(headers, 'Cache-Control', 'no-store');
  setHeader(headers, 'Pragma', 'no-cache');
  setHeader(headers, 'Expires', '0');
  if (contentType) {
    setHeader(headers, 'Content-Type', contentType);
  }
  setHeader(headers, 'X-uBO-Huaxiaozhu', marker);
  return headers;
}

function finishJson(reason, value, marker) {
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
  done({
    status: 200,
    headers: buildHeaders($response && $response.headers, marker, 'application/json; charset=utf-8'),
    body: JSON.stringify(value),
  });
}

function finishNoContent(reason, marker) {
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
  done({
    status: 204,
    headers: buildHeaders($response && $response.headers, marker, 'text/plain; charset=utf-8'),
    body: '',
  });
}

function finishDirectJson(reason, value, marker) {
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
  done({
    response: {
      status: 200,
      headers: buildHeaders({}, marker, 'application/json; charset=utf-8'),
      body: JSON.stringify(value),
    },
  });
}

function finishDirectNoContent(reason, marker) {
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
  done({
    response: {
      status: 204,
      headers: buildHeaders({}, marker, 'text/plain; charset=utf-8'),
      body: '',
    },
  });
}

const APP_MARKER_KEY = 'ubo.huaxiaozhu.recent';
const APP_MARKER_TTL_MS = 20000;

function nowMs() {
  return Date.now ? Date.now() : new Date().getTime();
}

function hasStore() {
  return typeof $persistentStore === 'object' &&
    $persistentStore !== null &&
    typeof $persistentStore.read === 'function' &&
    typeof $persistentStore.write === 'function';
}

function markApp(reason) {
  if (hasStore()) {
    $persistentStore.write(String(nowMs()), APP_MARKER_KEY);
  }
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
}

function hasRecentAppMarker() {
  if (!hasStore()) {
    return false;
  }
  const value = Number($persistentStore.read(APP_MARKER_KEY) || 0);
  return Number.isFinite(value) && value > 0 && nowMs() - value < APP_MARKER_TTL_MS;
}

function isMarkerEndpoint(urlInfo) {
  return urlInfo.host === 'omgup.hongyibo.com.cn' &&
    (
      urlInfo.path === '/syncconfig/ios/com.huaxiaozhu.rider' ||
      urlInfo.path === '/api/realtime/stat/ios'
    );
}

function isToggleEndpoint(urlInfo) {
  return urlInfo.host === 'as.hongyibo.com.cn' && urlInfo.path === '/ep/as/toggles';
}

function isActivityEndpoint(urlInfo) {
  return (
    urlInfo.host === 'res-new.hongyibo.com.cn' &&
    urlInfo.path === '/resapi/activity/mget'
  ) || (
    urlInfo.host === 'res.hongyibo.com.cn' &&
    (
      urlInfo.path === '/resapi/activity/mget' ||
      urlInfo.path === '/os/gs/resapi/activity/mget'
    )
  );
}

function isPDataEndpoint(urlInfo) {
  return urlInfo.host === 'api.hongyibo.com.cn' &&
    /^\/gulfstream\/(?:passenger-center\/v1\/other\/(?:p(?:Data|Layout)|pGetKFlowerActivityInfo|pGetMarketingInfo|pGetKfUnfinishedMsg)|pre-sale\/v1\/other\/(?:pGetIndexInfo|pGetConfig\/kFlowerConfig)|api\/v1\/passenger\/pGetPanelConfig)$/.test(urlInfo.path);
}

function isShieldEndpoint(urlInfo) {
  return urlInfo.host === 'sec-guard.hongyibo.com.cn' &&
    urlInfo.path === '/api/guard/psg/v2/getShieldStatus';
}

function isGdtBiddingEndpoint(urlInfo) {
  return urlInfo.host === 'mi.gdt.qq.com' && urlInfo.path === '/server_bidding2';
}

function isGdtLaunchEndpoint(urlInfo) {
  return urlInfo.host === 'sdk.e.qq.com' && urlInfo.path === '/launch';
}

function isHuaxiaozhuGdtBody(body) {
  const text = bodyToText(body);
  if (/com\.huaxiaozhu\.rider|appid=1210818176|posid=8156967880562298/i.test(text)) {
    return true;
  }
  return /com\.huaxiaozhu\.rider|"appid"\s*:\s*"1210818176"|posid=8156967880562298/i.test(decodeSafe(text));
}

function isGdtSdkRequest(request) {
  return /GDTMobSDK/i.test(String(getHeader(request && request.headers, 'User-Agent') || ''));
}

function extractParam(text, key) {
  const match = new RegExp(`(?:^|&)${key}=([^&]*)`).exec(String(text || ''));
  return match ? decodeSafe(match[1]) : '';
}

function gdtSlotId(body, payload) {
  const posid = extractParam(bodyToText(body), 'posid');
  if (posid) {
    return posid;
  }
  const data = payload && payload.data;
  const keys = data && typeof data === 'object' ? Object.keys(data) : [];
  return keys[0] || '8156967880562298';
}

function noFillGdtPayload(body, originalPayload) {
  const slotId = gdtSlotId(body, originalPayload);
  const originalSlot = originalPayload && originalPayload.data && originalPayload.data[slotId];
  return {
    ret: 0,
    msg: '',
    data: {
      [slotId]: {
        cfg: originalSlot && originalSlot.cfg ? originalSlot.cfg : { playcfg: {}, playmod: 1 },
        ctrl_config: originalSlot && originalSlot.ctrl_config ? originalSlot.ctrl_config : { app: {} },
        dr: originalSlot && originalSlot.dr !== undefined ? originalSlot.dr : 0,
        is_encrypted: originalSlot && originalSlot.is_encrypted !== undefined ? originalSlot.is_encrypted : 0,
        list: [],
        msg: '',
        ret: 0,
      },
    },
    ip_ping_url: '',
    last_ads: {},
    reqinterval: 1,
  };
}

function noShieldPayload(originalPayload) {
  const payload = originalPayload && typeof originalPayload === 'object' && !Array.isArray(originalPayload)
    ? originalPayload
    : { errno: 0, errmsg: '' };
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    payload.data = {};
  }
  payload.data.dashboardLink = '';
  payload.data.shieldInfo = [];
  return payload;
}

const DISABLE_TOGGLES = new Set([
  'HTTP_DNS_KFLOWER_PSNGER',
  'isUseHTTPDNS',
  'isUseSocketHTTPDNS',
  'launch_advertising_display_interval',
  'kf_activity_resource_config',
  'kf_activity_show_launchvideo',
  'kf_activity_show_launchvideo_close_delay',
  'kf_home_bronzedoor_enable',
  'kf_home_popup_req_remove_city',
  'kf_marketing_dialog_toggle',
  'kf_operation_resource_config',
  'kf_passenger_native_resource_sdk_init',
  'kf_passenger_webx_nasdk_control',
  'kf_res_popup_check_show_control_ios',
  'kf_native_tt_ad',
  'kf_kuaishou_ad',
]);

const ENABLE_WEBX_CLOSE_TOGGLES = new Set([
  'Webx_nasdk_close_cover_request',
  'Webx_nasdk_close_getProdPageConf_request',
  'Webx_nasdk_close_launch_enter_params',
  'Webx_nasdk_close_omega',
  'Webx_nasdk_close_page_did_show',
  'Webx_nasdk_close_product_init_request',
  'webx_nasdk_close_all',
]);

const BAD_KEY_RE = /^(?:p_startpage|p_home_popup|p_super_banner|p_home_other_banner|p_home_page_upper_right|p_home_core_left|p_home_core_right_up|p_home_core_right_down|p_nav_new|homepage_pop_window|activity_cover_layer|marketing_bubble|new_marketing_bubble|banner_position_list|destination_promotion|home_right_top_common)$/i;
const BAD_COMPONENT_RE = /^(?:homepage_pop_window|activity_cover_layer|marketing_bubble|new_marketing_bubble|banner_position_list|destination_promotion|home_right_top_common|KFHotTipCom|KFActivityInfoCom|KFResourceServiceCom|KFTravelPopupCom|DADForceShowActivityCenterView|DPSPopupWindow)$/i;
const BAD_VALUE_RE = /(?:p_startpage|p_home_popup|home_pop_manual|channel_id=1300000014|entrance_channel=1300000014|prod\.huaxz\.cn\/imk-kf-index|imk-kf-index|KFHotTipCom|KFActivityInfoCom|KFResourceServiceCom|KFTravelPopupCom|DADForceShowActivityCenterView|DPSPopupWindow|DAD_force_btn_close|advertise_logo|ad_jump_detail|staticImage|static_icon_120_120|posterImage|kf_home_core|kf_home_other|upgrade-fission|img-ys011\.didistatic\.com\/static\/ad_oss\/)/i;
const BAD_IDS = new Set(['14', '15', '416', '428', '434', '436', '454', '590', '620']);
const BAD_COMPONENT_IDS = new Set(['10005', '10006', '14013', '15004']);

function itemText(item) {
  if (!item || typeof item !== 'object') {
    return stringValue(item);
  }
  const fields = [
    item.resource_name,
    item.resourceName,
    item.position_name,
    item.positionName,
    item.component_name,
    item.componentName,
    item.cname,
    item.popup_type,
    item.popupType,
    item.api_tpl_name,
    item.apiTplName,
    item.api_com_name,
    item.apiComName,
    item.title,
    item.T,
    item.tpl,
    item.template_name,
    item.templateName,
    item.image,
    item.img,
    item.icon,
    item.file_url,
    item.fileUrl,
    item.url,
    item.link,
    item.landing_url,
    item.landingUrl,
    item.custom_channel,
    item.customChannel,
    item.channel_id,
    item.channelId,
    item.entrance_channel,
    item.entranceChannel,
  ];
  return fields.map(stringValue).join(' ');
}

function isBadItem(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const resourceId = stringValue(item.resource_id || item.resourceId || item.rid);
  const unitId = stringValue(item.unit_id || item.unitId);
  const componentId = stringValue(item.cid || item.component_id || item.componentId);
  const componentName = stringValue(
    item.component_name ||
    item.componentName ||
    item.cname ||
    item.api_tpl_name ||
    item.apiTplName ||
    item.api_com_name ||
    item.apiComName
  );
  return BAD_IDS.has(resourceId) ||
    BAD_IDS.has(unitId) ||
    BAD_COMPONENT_IDS.has(componentId) ||
    BAD_COMPONENT_RE.test(componentName) ||
    BAD_VALUE_RE.test(itemText(item));
}

function patchJsonFlag(object, key, flag, value, state) {
  const args = object && object.assign && object.assign.args;
  if (!args || typeof args[key] !== 'string') {
    return;
  }
  const parsed = parseJson(args[key]);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return;
  }
  if (parsed[flag] !== undefined && parsed[flag] !== value) {
    parsed[flag] = value;
    args[key] = JSON.stringify(parsed);
    state.changed = true;
  }
}

function patchToggle(object, state) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    return;
  }
  const name = stringValue(object.name);

  if (name === 'IsLaunchTaskEnable' || name === 'LaunchEnableTest') {
    patchJsonFlag(object, 'config', 'is_fast_ad', 0, state);
    patchJsonFlag(object, 'config', 'is_resource', 0, state);
    patchJsonFlag(object, 'config', 'is_webxnasdk', 0, state);
    if (object.assign && object.assign.args && object.assign.args.delay_time !== undefined) {
      object.assign.args.delay_time = '0';
      state.changed = true;
    }
  }

  if (name === 'IsDaggerEnable') {
    const args = object.assign && object.assign.args;
    if (args && args.is_launch_enable !== undefined && args.is_launch_enable !== '0') {
      args.is_launch_enable = '0';
      state.changed = true;
    }
  }

  if (DISABLE_TOGGLES.has(name)) {
    if (object.allow !== false) {
      object.allow = false;
      state.changed = true;
    }
    if (object.assign !== undefined) {
      delete object.assign;
      state.changed = true;
    }
  }

  if (ENABLE_WEBX_CLOSE_TOGGLES.has(name)) {
    if (object.allow !== true) {
      object.allow = true;
      state.changed = true;
    }
    if (object.assign !== undefined) {
      delete object.assign;
      state.changed = true;
    }
  }
}

function cleanStringJson(text, state) {
  const trimmed = String(text || '').trim();
  if (!/^[\[{]/.test(trimmed)) {
    return text;
  }
  const parsed = parseJson(trimmed);
  if (parsed === undefined) {
    return text;
  }
  const before = JSON.stringify(parsed);
  const cleaned = cleanValue(parsed, state);
  const after = JSON.stringify(cleaned);
  if (after !== before) {
    state.changed = true;
    return after;
  }
  return text;
}

function cleanArray(array, state) {
  const out = [];
  for (const item of array) {
    if (typeof item === 'string') {
      const cleaned = cleanStringJson(item, state);
      if (BAD_VALUE_RE.test(cleaned)) {
        state.changed = true;
        continue;
      }
      out.push(cleaned);
      continue;
    }
    if (isBadItem(item)) {
      state.changed = true;
      continue;
    }
    out.push(cleanValue(item, state));
  }
  if (out.length !== array.length) {
    state.changed = true;
  }
  return out;
}

function cleanObject(object, state) {
  patchToggle(object, state);
  const out = {};
  for (const key of Object.keys(object)) {
    if (BAD_KEY_RE.test(key)) {
      state.changed = true;
      continue;
    }
    const value = object[key];
    if (isBadItem(value)) {
      state.changed = true;
      continue;
    }
    if (typeof value === 'string') {
      const cleaned = cleanStringJson(value, state);
      if (BAD_VALUE_RE.test(cleaned) && /^(?:image|img|icon|url|link|landing_url|file_url|fileUrl|material|content|resource_name|resourceName|template_name|templateName|api_tpl_name|apiTplName|tpl|T)$/i.test(key)) {
        out[key] = '';
        state.changed = true;
        continue;
      }
      out[key] = cleaned;
      continue;
    }
    out[key] = cleanValue(value, state);
  }
  return out;
}

function cleanValue(value, state) {
  if (Array.isArray(value)) {
    return cleanArray(value, state);
  }
  if (value && typeof value === 'object') {
    return cleanObject(value, state);
  }
  return value;
}

function cleanJsonPayload(payload) {
  const state = { changed: false };
  const cleaned = cleanValue(payload, state);
  return { cleaned, changed: state.changed };
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const argument = typeof $argument === 'string' ? $argument : '';
  const urlInfo = parseUrl(request.url);
  let handled = false;

  if (/(?:^|&)phase=app-marker(?:&|$)/.test(argument)) {
    if (isMarkerEndpoint(urlInfo)) {
      markApp('app marker refreshed');
    }
    done({});
    handled = true;
  }

  if (handled === false && /(?:^|&)phase=toggles-request(?:&|$)/.test(argument) && isToggleEndpoint(urlInfo)) {
    const nextUrl = removeQueryParam(request.url, 'md5');
    done(nextUrl !== request.url ? { url: nextUrl } : {});
    handled = true;
  }

  if (handled === false && /(?:^|&)phase=toggles-response(?:&|$)/.test(argument) && isToggleEndpoint(urlInfo)) {
    markApp('toggles marker refreshed');
    const payload = parseJson(bodyToText(response.body) || '{}') || {};
    const result = cleanJsonPayload(payload);
    if (result.changed) {
      finishJson('startup/home popup toggles cleaned', result.cleaned, 'toggles-lite-clean-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && /(?:^|&)phase=sec-guard(?:&|$)/.test(argument) && isShieldEndpoint(urlInfo)) {
    markApp('safety shield marker refreshed');
    const payload = parseJson(bodyToText(response.body) || '{}') || {};
    finishJson('safety shield promo emptied', noShieldPayload(payload), 'sec-guard-empty-1');
    handled = true;
  }

  if (handled === false && /(?:^|&)phase=activity(?:&|$)/.test(argument) && isActivityEndpoint(urlInfo)) {
    markApp('activity resource marker refreshed');
    const payload = parseJson(bodyToText(response.body) || '{}') || {};
    const result = cleanJsonPayload(payload);
    if (result.changed) {
      finishJson('activity marketing resources cleaned', result.cleaned, 'activity-lite-clean-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && /(?:^|&)phase=pdata(?:&|$)/.test(argument) && isPDataEndpoint(urlInfo)) {
    markApp('pData marker refreshed');
    const payload = parseJson(bodyToText(response.body) || '{}') || {};
    const result = cleanJsonPayload(payload);
    if (result.changed) {
      finishJson('pData marketing resources cleaned', result.cleaned, 'pdata-lite-clean-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && /(?:^|&)phase=gdt-request(?:&|$)/.test(argument) && isGdtBiddingEndpoint(urlInfo)) {
    if (isHuaxiaozhuGdtBody(request.body) || hasRecentAppMarker()) {
      markApp('GDT bidding marker refreshed');
      finishDirectJson('GDT bidding request no-fill', noFillGdtPayload(request.body), 'gdt-request-fast-nofill-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && /(?:^|&)phase=gdt-launch-request(?:&|$)/.test(argument) && isGdtLaunchEndpoint(urlInfo)) {
    if (hasRecentAppMarker() || isGdtSdkRequest(request)) {
      markApp('GDT launch marker refreshed');
      finishDirectNoContent('GDT launch request emptied', 'gdt-launch-fast-empty-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && /(?:^|&)phase=gdt-launch(?:&|$)/.test(argument) && isGdtLaunchEndpoint(urlInfo)) {
    if (hasRecentAppMarker() || isGdtSdkRequest(request)) {
      markApp('GDT launch marker refreshed');
      finishNoContent('GDT launch response emptied', 'gdt-launch-empty-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && isGdtBiddingEndpoint(urlInfo) && (isHuaxiaozhuGdtBody(request.body) || hasRecentAppMarker())) {
    markApp('GDT bidding marker refreshed');
    const payload = parseJson(bodyToText(response.body) || '{}') || {};
    finishJson('GDT bidding response no-fill', noFillGdtPayload(request.body, payload), 'gdt-response-nofill-1');
    handled = true;
  }

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO Huaxiaozhu ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
