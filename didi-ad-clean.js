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

const BAD_LINK_RE = /(?:manhattan\.webapp\.xiaojukeji\.com\/heranew|v\.didi\.cn\/prs\/M5Rj3dB|img-ys011\.didistatic\.com\/static\/ad_oss\/)/i;
const BAD_RESOURCE_RE = /(?:casper_home_banner|home_marketing_card|home_banner_template|didipas_startpage_new_less_banner|bottom_marketing|marketing_banner|skyfall|popup)/i;
const AD_IMAGE_RE = /img-ys011\.didistatic\.com\/static\/ad_oss\//i;

function isDidiYksEndpoint(urlInfo) {
  if (urlInfo.host === 'yuantu.diditaxi.com.cn' && urlInfo.path === '/ota/miniapp/yuantu/infoList') {
    return true;
  }
  if (urlInfo.host === 'res.xiaojukeji.com' && urlInfo.path === '/resapi/activity/mget') {
    return true;
  }
  if (urlInfo.host === 'api.udache.com' && /^\/gulfstream\/confucius\/webx\/(?:chapter\/product\/init|v[23]\/productInit)$/.test(urlInfo.path)) {
    return true;
  }
  return false;
}

function looksLikeDidiYksPayload(text) {
  return /ut-aggre-homepage|homepagemarketing|order_cards|order_cards_list|yuantu|didifinance|resapi\/activity\/mget|com\.xiaojukeji\.didi/i.test(String(text || ''));
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
    item.resource_name,
    item.resourceName,
    item.template_name,
    item.tpl,
    item.T,
  ];
  if (item.tag && typeof item.tag === 'object') {
    fields.push(item.tag.value);
  }
  return fields.map(stringValue).join(' ');
}

function isBadStringItem(value) {
  if (BAD_CARD_KEYS.has(value)) {
    return true;
  }
  return BAD_LINK_RE.test(value) || BAD_RESOURCE_RE.test(value);
}

function isBadObjectItem(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const id = stringValue(item.id || item.nav_id || item.card_id);
  const name = stringValue(item.name || item.text || item.title);
  const link = stringValue(item.link || item.url);
  const resource = stringValue(item.resource_name || item.resourceName || item.tpl || item.T || item.template_name);

  if (BAD_CARD_KEYS.has(id) || BAD_CARD_KEYS.has(stringValue(item.name))) {
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
  const out = {};
  for (const key of Object.keys(object)) {
    if (BAD_CARD_KEYS.has(key)) {
      state.changed = true;
      continue;
    }
    let value = object[key];

    if (key === 'order_cards' || key === 'disorder_cards') {
      value = cleanObject(value && typeof value === 'object' && !Array.isArray(value) ? value : {}, state);
      out[key] = value;
      continue;
    }

    if (key === 'order_cards_list' && Array.isArray(value)) {
      out[key] = cleanArray(value, state);
      continue;
    }

    if ((key === 'bottom_menu' || key === 'nav_id_list') && typeof value === 'string') {
      out[key] = cleanStringifiedJson(value, state);
      continue;
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
  const urlInfo = parseUrl(request.url);
  let handled = false;

  if (isDidiYksEndpoint(urlInfo)) {
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
