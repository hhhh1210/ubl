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

const BAD_CARD_KEYS = new Set([
  'super_banner_card',
  'new_loss_banner_card',
  'marketing_card',
  'marketing_banner_card',
  'middle_banner_card',
  'middle_banner_card_v2',
  'bottom_marketing_banner_first',
  'bottom_marketing_banner_second',
  'new_customer_banner_card',
]);

const BAD_NAV_IDS = new Set([
  'didifinance',
  'yuantu',
]);

const BAD_LINK_RE = /(?:manhattan\.webapp\.xiaojukeji\.com\/heranew|v\.didi\.cn\/prs\/M5Rj3dB|img-ys011\.didistatic\.com\/static\/ad_oss\/|s3-hnapuhdd-cdn\.didistatic\.com\/zhunxing-creative\/)/i;
const BAD_RESOURCE_RE = /(?:pas_start_page|one_resource_start_page|casper_home_banner|na_home_marketing_card|home_marketing_card|home_banner_template|didipas_startpage_new_less_banner|bottom_marketing|marketing_banner|mult_home_banner|skyfall|popup)/i;
const AD_IMAGE_RE = /img-ys011\.didistatic\.com\/static\/ad_oss\//i;
const TOKEN_LIST_KEY_RE = /^(?:nav_id|bottom_menu_id|order_cards_list)$/i;
const BAD_RESOURCE_IDS = new Set([
  '18',
]);

function isDidiYksEndpoint(urlInfo) {
  if (urlInfo.host === 'as.xiaojukeji.com' && urlInfo.path === '/ep/as/toggles') {
    return true;
  }
  if (urlInfo.host === 'conf.diditaxi.com.cn' && urlInfo.path === '/homepage/v1/core') {
    return true;
  }
  if (urlInfo.host === 'yuantu.diditaxi.com.cn' && urlInfo.path === '/ota/miniapp/yuantu/infoList') {
    return true;
  }
  if (urlInfo.host === 'res.xiaojukeji.com' && /^\/resapi\/activity\/(?:mget|getValid)$/.test(urlInfo.path)) {
    return true;
  }
  if (urlInfo.host === 'api.udache.com' && /^\/gulfstream\/confucius\/webx\/(?:chapter\/product\/init|v[23]\/productInit)$/.test(urlInfo.path)) {
    return true;
  }
  return false;
}

function looksLikeDidiYksPayload(text) {
  return /ut-aggre-homepage|homepagemarketing|homepage\/v1\/core|homepageonestop|order_cards|order_cards_list|yuantu|didifinance|pas_start_page|pas_notice_webview|new_resource_sdk_toggle|ios_activity_download_config|activity_resource_15|valid_act_ids|na_home_marketing_card|home_marketing_card|resapi\/activity\/(?:mget|getValid)|com\.xiaojukeji\.didi/i.test(String(text || ''));
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

function itemText(item) {
  if (!item || typeof item !== 'object') {
    return stringValue(item);
  }
  const fields = [
    item.id,
    item.nav_id,
    item.card_id,
    item.name,
    item.text,
    item.title,
    item.link,
    item.url,
    item.file_url,
    item.fileUrl,
    item.resource_name,
    item.resourceName,
    item.component_name,
    item.componentName,
    item.template_name,
    item.templateName,
    item.api_tpl_name,
    item.apiTplName,
    item.o_url,
    item.o_mi,
    item.casper_id,
    item.casper_tpl,
    item.tpl,
    item.T,
  ];
  if (item.tag && typeof item.tag === 'object') {
    fields.push(item.tag.value);
  }
  return fields.map(stringValue).join(' ');
}

function isBadStringItem(value) {
  if (BAD_CARD_KEYS.has(value) || BAD_NAV_IDS.has(value)) {
    return true;
  }
  return BAD_LINK_RE.test(value) || BAD_RESOURCE_RE.test(value);
}

function cleanTokenList(text, state) {
  const value = String(text || '');
  if (/^\s*[\[{]/.test(value)) {
    return text;
  }
  if (value.indexOf(',') === -1) {
    if (isBadStringItem(value.trim())) {
      state.changed = true;
      return '';
    }
    return text;
  }
  const tokens = value.split(',');
  const kept = [];
  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed || isBadStringItem(trimmed)) {
      state.changed = true;
      continue;
    }
    kept.push(trimmed);
  }
  if (kept.length !== tokens.length) {
    state.changed = true;
    return kept.join(',');
  }
  return text;
}

function isBadObjectItem(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const id = stringValue(item.id || item.nav_id || item.card_id);
  const resourceId = stringValue(item.resource_id || item.resourceId || item.res);
  const name = stringValue(item.name || item.text || item.title);
  const link = stringValue(item.link || item.url || item.file_url || item.fileUrl);
  const resource = stringValue(
    item.resource_name ||
    item.resourceName ||
    item.component_name ||
    item.componentName ||
    item.tpl ||
    item.T ||
    item.template_name ||
    item.templateName ||
    item.api_tpl_name ||
    item.apiTplName ||
    item.o_url ||
    item.o_mi ||
    item.casper_id ||
    item.casper_tpl
  );

  if (BAD_CARD_KEYS.has(id) || BAD_CARD_KEYS.has(stringValue(item.name))) {
    return true;
  }
  if (BAD_RESOURCE_IDS.has(resourceId)) {
    return true;
  }
  if (BAD_NAV_IDS.has(id)) {
    return true;
  }
  if (/^借钱$/.test(name)) {
    return true;
  }
  if (BAD_LINK_RE.test(link)) {
    return true;
  }
  if (BAD_RESOURCE_RE.test(resource)) {
    return true;
  }
  return false;
}

function patchDidiToggleObject(object, state) {
  const name = stringValue(object && object.name);
  const assign = object && object.assign;
  const args = assign && assign.args;
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return;
  }

  if (name === 'new_resource_sdk_toggle') {
    for (const key of ['pas_start_page', 'pas_notice_webview']) {
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

  if (name === 'wyc_request_method_control' && args.addPopupTimes !== 0) {
    args.addPopupTimes = 0;
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
      const cleanedString = cleanStringifiedJson(item, state);
      if (isBadStringItem(cleanedString)) {
        state.changed = true;
        continue;
      }
      out.push(cleanedString);
      continue;
    }
    if (isBadObjectItem(item)) {
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
  patchDidiToggleObject(object, state);
  const out = {};
  for (const key of Object.keys(object)) {
    if (BAD_CARD_KEYS.has(key)) {
      state.changed = true;
      continue;
    }
    let value = object[key];

    if (isBadObjectItem(value)) {
      state.changed = true;
      continue;
    }

    if (/^(?:valid_act_ids|validActIds)$/.test(key) && Array.isArray(value)) {
      if (value.length !== 0) {
        state.changed = true;
      }
      out[key] = [];
      continue;
    }

    if (key === 'order_cards' || key === 'disorder_cards') {
      value = cleanObject(value && typeof value === 'object' && !Array.isArray(value) ? value : {}, state);
      out[key] = value;
      continue;
    }

    if (key === 'order_cards_list' && Array.isArray(value)) {
      out[key] = cleanArray(value, state);
      continue;
    }

    if ((key === 'bottom_menu' || key === 'nav_id_list' || TOKEN_LIST_KEY_RE.test(key)) && typeof value === 'string') {
      out[key] = cleanTokenList(cleanStringifiedJson(value, state), state);
      continue;
    }

    if (typeof value === 'string' && (BAD_LINK_RE.test(value) || BAD_RESOURCE_RE.test(value))) {
      if (/^(?:link|url|landing_url|schema|scheme|file_url|fileUrl|resource_name|resourceName|template_name|templateName|api_tpl_name|apiTplName|o_url|o_mi|casper_id|casper_tpl|tpl|T)$/i.test(key)) {
        out[key] = '';
        state.changed = true;
        continue;
      }
    }

    if (typeof value === 'string' && AD_IMAGE_RE.test(value)) {
      if (/^(?:search_button_adx_marker|search_button_adx_marker_text|search_button_image|image|img|icon|tag|value)$/i.test(key)) {
        out[key] = '';
        state.changed = true;
        continue;
      }
    }

    if (key === 'tag' && value && typeof value === 'object' && !Array.isArray(value) && AD_IMAGE_RE.test(itemText(value))) {
      out[key] = {};
      state.changed = true;
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
  if (typeof value === 'string') {
    return cleanStringifiedJson(value, state);
  }
  return value;
}

function finishJson(reason, value) {
  const headers = buildJsonHeaders($response && $response.headers, 'didi-yks-clean-1');
  console.log(`uBO DiDi ad clean: ${reason}`);
  done({
    status: 200,
    headers,
    body: JSON.stringify(value),
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const argument = typeof $argument === 'string' ? $argument : '';
  const urlInfo = parseUrl(request.url);
  let handled = false;

  if (
    /(?:^|&)phase=toggles-request(?:&|$)/.test(argument) &&
    urlInfo.host === 'as.xiaojukeji.com' &&
    urlInfo.path === '/ep/as/toggles'
  ) {
    const nextUrl = removeQueryParam(request.url, 'md5');
    if (nextUrl !== request.url) {
      console.log('uBO DiDi ad clean: toggles md5 cache key removed');
      done({ url: nextUrl });
    } else {
      done({});
    }
    handled = true;
  }

  if (handled === false && isDidiYksEndpoint(urlInfo)) {
    const responseText = bodyToText(response.body);
    const requestText = bodyToText(request.body);
    if (looksLikeDidiYksPayload(`${request.url}\n${requestText}\n${responseText}`)) {
      const payload = parseMaybeJson(responseText);
      if (payload !== undefined) {
        const state = { changed: false };
        const cleaned = cleanValue(payload, state);
        if (state.changed) {
          handled = true;
          finishJson('DiDi YKS homepage cards/resources cleaned', cleaned);
        }
      }
    }
  }

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO DiDi ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
