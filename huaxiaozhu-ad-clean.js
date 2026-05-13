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

function decodeURIComponentSafe(text) {
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
  return {
    host: match[1].toLowerCase(),
    path: match[2] || '/',
    query: match[3] || '',
  };
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

function isHuaxiaozhuGdtBody(body) {
  const text = bodyToText(body);
  if (/com\.huaxiaozhu\.rider|c_pkgname=|appid=1210818176|posid=8156967880562298/i.test(text)) {
    return /com\.huaxiaozhu\.rider|appid=1210818176|posid=8156967880562298/i.test(text);
  }
  const decoded = decodeURIComponentSafe(text);
  return /com\.huaxiaozhu\.rider|"appid"\s*:\s*"1210818176"|posid=8156967880562298/i.test(decoded);
}

function isHuaxiaozhuGdtEndpoint(urlInfo) {
  return urlInfo.host === 'mi.gdt.qq.com' && urlInfo.path === '/server_bidding2';
}

function isHuaxiaozhuMarkerEndpoint(urlInfo) {
  return urlInfo.host === 'omgup.hongyibo.com.cn' && (
    urlInfo.path === '/syncconfig/ios/com.huaxiaozhu.rider' ||
    urlInfo.path === '/api/realtime/stat/ios'
  );
}

function isHuaxiaozhuShieldEndpoint(urlInfo) {
  return urlInfo.host === 'sec-guard.hongyibo.com.cn' &&
    urlInfo.path === '/api/guard/psg/v2/getShieldStatus';
}

function isHuaxiaozhuActivityEndpoint(urlInfo) {
  return urlInfo.host === 'res-new.hongyibo.com.cn' &&
    urlInfo.path === '/resapi/activity/mget';
}

function isHuaxiaozhuBronzedoorEndpoint(urlInfo) {
  return urlInfo.host === 'api.hongyibo.com.cn' &&
    /^\/gulfstream\/passenger-center\/v1\/other\/p(?:Data|Layout)$/.test(urlInfo.path);
}

function isHuaxiaozhuWebxNaEndpoint(urlInfo) {
  return urlInfo.host === 'api.didi.cn' &&
    urlInfo.path === '/webx/na/product/init';
}

function isHuaxiaozhuToggleEndpoint(urlInfo) {
  return urlInfo.host === 'as.hongyibo.com.cn' &&
    urlInfo.path === '/ep/as/toggles';
}

function extractParam(text, key) {
  const match = new RegExp(`(?:^|&)${key}=([^&]*)`).exec(String(text || ''));
  return match ? decodeURIComponentSafe(match[1]) : '';
}

function extractGdtSlotId(body, payload) {
  const bodyText = bodyToText(body);
  const posid = extractParam(bodyText, 'posid');
  if (posid) {
    return posid;
  }
  const data = payload && payload.data;
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length !== 0) {
      return keys[0];
    }
  }
  return '8156967880562298';
}

const DEFAULT_GDT_SLOT_META = {
  cfg: {
    playcfg: {},
    playmod: 1,
  },
  ctrl_config: {
    app: {
      acr_cfg: '{"1":0,"2":4,"3":1,"4":1,"n":6,"t":4}',
    },
  },
  dr: 0,
  is_encrypted: 0,
};

function clonePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = value[key];
  }
  return out;
}

function buildNoAdSlot(originalSlot) {
  const slot = {};
  const cfg = clonePlainObject(originalSlot && originalSlot.cfg) || DEFAULT_GDT_SLOT_META.cfg;
  const ctrlConfig = clonePlainObject(originalSlot && originalSlot.ctrl_config) || DEFAULT_GDT_SLOT_META.ctrl_config;

  slot.cfg = cfg;
  slot.ctrl_config = ctrlConfig;
  slot.dr = originalSlot && originalSlot.dr !== undefined ? originalSlot.dr : DEFAULT_GDT_SLOT_META.dr;
  slot.is_encrypted = originalSlot && originalSlot.is_encrypted !== undefined
    ? originalSlot.is_encrypted
    : DEFAULT_GDT_SLOT_META.is_encrypted;
  slot.list = [];
  slot.msg = '';
  slot.ret = 0;
  return slot;
}

function buildNoFillGdtPayload(body, originalPayload) {
  const slotId = extractGdtSlotId(body, originalPayload);
  const payload = {
    ret: 0,
    msg: '',
    data: {},
    ip_ping_url: '',
    last_ads: {},
    reqinterval: 1,
  };
  if (originalPayload && originalPayload.seq !== undefined) {
    payload.seq = originalPayload.seq;
  }
  const originalSlot = originalPayload && originalPayload.data && originalPayload.data[slotId];
  payload.data[slotId] = buildNoAdSlot(originalSlot);
  return payload;
}

function buildNoFillHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'text/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'X-uBO-Huaxiaozhu', marker);
  return headers;
}

const APP_MARKER_KEY = 'ubo.huaxiaozhu.recent';
const APP_MARKER_TTL_MS = 20000;

function nowMs() {
  return Date.now ? Date.now() : new Date().getTime();
}

function hasPersistentStore() {
  return typeof $persistentStore === 'object' &&
    $persistentStore !== null &&
    typeof $persistentStore.read === 'function' &&
    typeof $persistentStore.write === 'function';
}

function markHuaxiaozhuApp(reason) {
  if (!hasPersistentStore()) {
    return;
  }
  $persistentStore.write(String(nowMs()), APP_MARKER_KEY);
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
}

function hasRecentHuaxiaozhuMarker() {
  if (!hasPersistentStore()) {
    return false;
  }
  const value = Number($persistentStore.read(APP_MARKER_KEY) || 0);
  return Number.isFinite(value) && value > 0 && nowMs() - value < APP_MARKER_TTL_MS;
}

function buildNoShieldPayload(originalPayload) {
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

const BAD_ACTIVITY_KEY_RE = /^(?:p_startpage|p_home_popup|p_super_banner|p_home_other_banner|p_home_page_upper_right|p_home_core_left|p_home_core_right_up|p_home_core_right_down|p_nav_new|homepage_pop_window|activity_cover_layer|marketing_bubble|new_marketing_bubble|banner_position_list|destination_promotion|home_right_top_common)$/i;
const BAD_ACTIVITY_COMPONENT_RE = /^(?:homepage_pop_window|activity_cover_layer|marketing_bubble|new_marketing_bubble|banner_position_list|destination_promotion|home_right_top_common)$/i;
const BAD_ACTIVITY_VALUE_RE = /(?:p_startpage|p_home_popup|p_super_banner|p_home_other_banner|p_home_page_upper_right|p_home_core_left|p_home_core_right_up|p_home_core_right_down|p_nav_new|homepage_pop_window|activity_cover_layer|marketing_bubble|new_marketing_bubble|banner_position_list|destination_promotion|home_right_top_common|youlianghui_external_commercial_ad|staticImage|static_icon_120_120|kf_multi_image_1|kf_home_core_left_title_image|kf_home_core_right_up_title_image|kf_home_core_steps_upgrade_fission|kf_home_other_title_image|kf_title_image_new|upgrade-fission|prod\.huaxz\.cn\/imk-kf-index|imk-kf-index|home_pop_manual|channel_id=1300000014|entrance_channel=1300000014|img-ys011\.didistatic\.com\/static\/ad_oss\/)/i;
const BAD_ACTIVITY_IDS = {
  '14': true,
  '15': true,
  '416': true,
  '428': true,
  '434': true,
  '436': true,
  '454': true,
  '590': true,
  '620': true,
};

const BAD_TOGGLE_NAMES = new Set([
  'launch_advertising_display_interval',
  'kf_home_bronzedoor_enable',
  'kf_hummer_discount_retain_popup',
  'kf_hummer_end_marketing_pkg',
  'kf_hummer_flower_coin_popup',
  'kf_hummer_home_top_remind_pop',
  'kf_hummer_inservice_communicate_cards',
  'kf_hummer_inservice_communicate_cards_test',
  'kf_activity_show_launchvideo_close_delay',
  'kf_home_popup_req_remove_city',
  'kf_hummer_right_upgrade_dialog',
  'kf_marketing_dialog_toggle',
]);

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

function activityItemText(item) {
  if (!item || typeof item !== 'object') {
    return stringValue(item);
  }
  const fields = [
    item.resource_name,
    item.resourceName,
    item.position_name,
    item.positionName,
    item.rn,
    item.name,
    item.position,
    item.component_name,
    item.componentName,
    item.api_tpl_name,
    item.apiTplName,
    item.api_com_name,
    item.apiComName,
    item.title,
    item.T,
    item.tpl,
    item.template,
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
    item.log_data,
    item.logData,
    item.custom_channel,
    item.customChannel,
    item.channel_id,
    item.channelId,
    item.entrance_channel,
    item.entranceChannel,
  ];
  return fields.map(stringValue).join(' ');
}

function isBadActivityObject(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const resourceId = stringValue(item.resource_id || item.resourceId || item.rid);
  const unitId = stringValue(item.unit_id || item.unitId);
  const componentName = stringValue(
    item.component_name ||
    item.componentName ||
    item.api_tpl_name ||
    item.apiTplName ||
    item.api_com_name ||
    item.apiComName
  );
  const text = activityItemText(item);
  return BAD_ACTIVITY_IDS[resourceId] === true ||
    BAD_ACTIVITY_IDS[unitId] === true ||
    BAD_ACTIVITY_COMPONENT_RE.test(componentName) ||
    BAD_ACTIVITY_VALUE_RE.test(text);
}

function patchJsonStringFlag(object, key, flag, value, state) {
  const assign = object && object.assign;
  const args = assign && assign.args;
  if (!args || typeof args !== 'object' || typeof args[key] !== 'string') {
    return;
  }
  const parsed = parseMaybeJson(args[key]);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return;
  }
  if (parsed[flag] !== undefined && parsed[flag] !== value) {
    parsed[flag] = value;
    args[key] = JSON.stringify(parsed);
    state.changed = true;
  }
}

function patchDaggerLaunchConfig(object, state) {
  const assign = object && object.assign;
  const args = assign && assign.args;
  if (!args || typeof args !== 'object') {
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
  const original = JSON.stringify(parsed);
  if (Array.isArray(parsed.page_names)) {
    parsed.page_names = parsed.page_names.filter((name) => name !== 'DSplashViewController');
  }
  if (parsed.prewarming_threshold !== undefined) {
    parsed.prewarming_threshold = '0';
  }
  if (JSON.stringify(parsed) !== original) {
    args.launch_config = JSON.stringify(parsed);
    state.changed = true;
  }
}

function patchWebxProductPageConfig(object, state) {
  const assign = object && object.assign;
  const args = assign && assign.args;
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

const API_HOST_FOR_DOMAIN_MITM = 'api.hongyibo.com.cn';

function isApiHostEntry(value, host) {
  const text = stringValue(value).toLowerCase();
  return text === host ||
    text === `https://${host}` ||
    text.indexOf(`${host}/*`) === 0;
}

function cleanHostRoutingValue(value, host, state) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      if (isApiHostEntry(item, host)) {
        state.changed = true;
        continue;
      }
      out.push(cleanHostRoutingValue(item, host, state));
    }
    return out;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      const item = value[key];
      if (typeof item === 'string' && isApiHostEntry(item, host)) {
        state.changed = true;
        continue;
      }
      out[key] = cleanHostRoutingValue(item, host, state);
    }
    return out;
  }
  return value;
}

function cleanJsonHostRoutingString(value, host, state) {
  if (typeof value !== 'string' || value.indexOf(host) === -1) {
    return value;
  }
  const parsed = parseMaybeJson(value);
  if (parsed === undefined) {
    return value;
  }
  const before = JSON.stringify(parsed);
  const cleaned = cleanHostRoutingValue(parsed, host, state);
  if (JSON.stringify(cleaned) === before) {
    return value;
  }
  return JSON.stringify(cleaned);
}

function patchKflowerHttpDnsConfig(object, state) {
  const assign = object && object.assign;
  const args = assign && assign.args;
  if (!args || typeof args !== 'object') {
    return;
  }
  for (const key of Object.keys(args)) {
    args[key] = cleanJsonHostRoutingString(args[key], API_HOST_FOR_DOMAIN_MITM, state);
  }
}

function patchHuaxiaozhuToggleObject(object, state) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    return;
  }
  const name = stringValue(object.name);
  if (name === 'IsDaggerEnable') {
    patchDaggerLaunchConfig(object, state);
  }
  if (name === 'webx_get_prod_page_conf') {
    patchWebxProductPageConfig(object, state);
  }
  if (name === 'HTTP_DNS_KFLOWER_PSNGER') {
    patchKflowerHttpDnsConfig(object, state);
  }
  if (name === 'isUseHTTPDNS' || name === 'isEnableOKNetSwitcher') {
    patchKflowerHttpDnsConfig(object, state);
  }
  if (name === 'IsLaunchTaskEnable' || name === 'LaunchEnableTest') {
    patchJsonStringFlag(object, 'config', 'is_fast_ad', 0, state);
    patchJsonStringFlag(object, 'config', 'is_resource', 0, state);
    patchJsonStringFlag(object, 'config', 'is_webxnasdk', 0, state);
    if (object.assign && object.assign.args && object.assign.args.delay_time !== undefined) {
      object.assign.args.delay_time = '0';
      state.changed = true;
    }
  }
  if (BAD_TOGGLE_NAMES.has(name)) {
    if (object.allow !== false) {
      object.allow = false;
      state.changed = true;
    }
    if (object.assign !== undefined) {
      delete object.assign;
      state.changed = true;
    }
  }
}

function cleanStringifiedActivityJson(text, state) {
  const trimmed = String(text || '').trim();
  if (!/^[\[{]/.test(trimmed)) {
    return text;
  }
  const parsed = parseMaybeJson(trimmed);
  if (parsed === undefined) {
    return text;
  }
  const before = JSON.stringify(parsed);
  const cleaned = cleanActivityValue(parsed, state);
  if (JSON.stringify(cleaned) !== before) {
    state.changed = true;
    return JSON.stringify(cleaned);
  }
  return text;
}

function cleanActivityArray(array, state) {
  const out = [];
  for (const item of array) {
    if (typeof item === 'string') {
      const cleanedString = cleanStringifiedActivityJson(item, state);
      if (BAD_ACTIVITY_VALUE_RE.test(cleanedString)) {
        state.changed = true;
        continue;
      }
      out.push(cleanedString);
      continue;
    }
    if (isBadActivityObject(item)) {
      state.changed = true;
      continue;
    }
    out.push(cleanActivityValue(item, state));
  }
  if (out.length !== array.length) {
    state.changed = true;
  }
  return out;
}

function cleanActivityObject(object, state) {
  patchHuaxiaozhuToggleObject(object, state);
  const out = {};
  for (const key of Object.keys(object)) {
    if (BAD_ACTIVITY_KEY_RE.test(key)) {
      state.changed = true;
      continue;
    }
    const value = object[key];
    if (isBadActivityObject(value)) {
      state.changed = true;
      continue;
    }
    if (typeof value === 'string') {
      const cleanedString = cleanStringifiedActivityJson(value, state);
      if (BAD_ACTIVITY_VALUE_RE.test(cleanedString) && /^(?:image|img|icon|url|link|landing_url|material|content)$/i.test(key)) {
        out[key] = '';
        state.changed = true;
        continue;
      }
      out[key] = cleanedString;
      continue;
    }
    out[key] = cleanActivityValue(value, state);
  }
  return out;
}

function cleanActivityValue(value, state) {
  if (Array.isArray(value)) {
    return cleanActivityArray(value, state);
  }
  if (value && typeof value === 'object') {
    return cleanActivityObject(value, state);
  }
  return value;
}

function finishJson(reason, value, marker) {
  const headers = buildNoFillHeaders($response && $response.headers, marker || 'gdt-response-nofill-1');
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
  done({
    status: 200,
    headers,
    body: JSON.stringify(value),
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);
  const argument = typeof $argument === 'string' ? $argument : '';
  let handled = false;

  if (/(?:^|&)phase=app-marker(?:&|$)/.test(argument)) {
    if (
      isHuaxiaozhuMarkerEndpoint(urlInfo) &&
      (
        urlInfo.path === '/syncconfig/ios/com.huaxiaozhu.rider' ||
        /com\.huaxiaozhu\.rider|DSplashViewController|kf-passenger-app/i.test(bodyToText(request.body))
      )
    ) {
      markHuaxiaozhuApp('Huaxiaozhu app marker refreshed');
    }
    done({});
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=toggles-request(?:&|$)/.test(argument) &&
    isHuaxiaozhuToggleEndpoint(urlInfo)
  ) {
    const nextUrl = removeQueryParam(request.url, 'md5');
    if (nextUrl !== request.url) {
      console.log('uBO Huaxiaozhu ad clean: toggles md5 cache key removed');
      done({ url: nextUrl });
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=gdt-request(?:&|$)/.test(argument) &&
    isHuaxiaozhuGdtEndpoint(urlInfo)
  ) {
    if (isHuaxiaozhuGdtBody(request.body)) {
      markHuaxiaozhuApp('Huaxiaozhu GDT bidding marker refreshed');
    }
    done({});
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=toggles-response(?:&|$)/.test(argument) &&
    isHuaxiaozhuToggleEndpoint(urlInfo)
  ) {
    markHuaxiaozhuApp('Huaxiaozhu toggles marker refreshed');
    const response = typeof $response === 'object' && $response !== null ? $response : {};
    const payload = JSON.parse(bodyToText(response.body) || '{}');
    const state = { changed: false };
    const cleaned = cleanActivityValue(payload, state);
    if (state.changed) {
      finishJson(
        'Huaxiaozhu startup/home popup toggles cleaned',
        cleaned,
        'toggles-httpdns-api-clean-2'
      );
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=sec-guard(?:&|$)/.test(argument) &&
    isHuaxiaozhuShieldEndpoint(urlInfo)
  ) {
    markHuaxiaozhuApp('Huaxiaozhu safety shield promo marker refreshed');
    const response = typeof $response === 'object' && $response !== null ? $response : {};
    const payload = JSON.parse(bodyToText(response.body) || '{}');
    finishJson(
      'Huaxiaozhu safety shield promo panels emptied',
      buildNoShieldPayload(payload),
      'sec-guard-empty-1'
    );
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=activity(?:&|$)/.test(argument) &&
    isHuaxiaozhuActivityEndpoint(urlInfo)
  ) {
    markHuaxiaozhuApp('Huaxiaozhu activity resource marker refreshed');
    const response = typeof $response === 'object' && $response !== null ? $response : {};
    const payload = JSON.parse(bodyToText(response.body) || '{}');
    const state = { changed: false };
    const cleaned = cleanActivityValue(payload, state);
    if (state.changed) {
      finishJson(
        'Huaxiaozhu activity marketing resources cleaned',
        cleaned,
        'activity-mget-clean-1'
      );
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=pdata(?:&|$)/.test(argument) &&
    isHuaxiaozhuBronzedoorEndpoint(urlInfo)
  ) {
    markHuaxiaozhuApp('Huaxiaozhu Bronzedoor resource marker refreshed');
    const response = typeof $response === 'object' && $response !== null ? $response : {};
    const payload = JSON.parse(bodyToText(response.body) || '{}');
    const state = { changed: false };
    const cleaned = cleanActivityValue(payload, state);
    if (state.changed) {
      finishJson(
        'Huaxiaozhu Bronzedoor pData marketing resources cleaned',
        cleaned,
        'pdata-clean-1'
      );
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=webxna(?:&|$)/.test(argument) &&
    isHuaxiaozhuWebxNaEndpoint(urlInfo)
  ) {
    markHuaxiaozhuApp('Huaxiaozhu WebX NA product marker refreshed');
    const response = typeof $response === 'object' && $response !== null ? $response : {};
    const payload = JSON.parse(bodyToText(response.body) || '{}');
    const state = { changed: false };
    const cleaned = cleanActivityValue(payload, state);
    if (state.changed) {
      finishJson(
        'Huaxiaozhu WebX NA product marketing resources cleaned',
        cleaned,
        'webxna-clean-1'
      );
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    isHuaxiaozhuGdtEndpoint(urlInfo) &&
    (isHuaxiaozhuGdtBody(request.body) || hasRecentHuaxiaozhuMarker())
  ) {
    markHuaxiaozhuApp('Huaxiaozhu GDT bidding marker refreshed');
    const response = typeof $response === 'object' && $response !== null ? $response : {};
    const text = bodyToText(response.body);
    const payload = JSON.parse(text);
    finishJson(
      'Tencent GDT Huaxiaozhu bidding response replaced with no-fill',
      buildNoFillGdtPayload(request.body, payload)
    );
    handled = true;
  }

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO Huaxiaozhu ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
