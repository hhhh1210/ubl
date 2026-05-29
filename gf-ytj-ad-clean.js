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

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return undefined;
  }
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
  setHeaderCaseInsensitive(headers, 'X-uBO-GFYTJ', marker);
  return headers;
}

function emptyJsonPayload(urlInfo) {
  if (urlInfo.host === 'config.gf.com.cn' && urlInfo.path === '/ad/info') {
    return {
      code: 0,
      msg: 'success',
      data: null,
      result: null,
      list: [],
    };
  }
  if (urlInfo.host === 'config.gf.com.cn' && (
    urlInfo.path === '/ytj_config/sys_popup' ||
    urlInfo.path === '/ytj_config/info'
  )) {
    return {
      code: 0,
      msg: 'success',
      data: [],
      result: [],
      list: [],
    };
  }
  if (urlInfo.host === 'midend.gf.com.cn' && /^\/gfmiddle\/activity\/popup\/(?:v2|yzzz)$/.test(urlInfo.path)) {
    return {
      code: 0,
      msg: 'success',
      data: [],
      result: [],
      popupList: [],
      list: [],
    };
  }
  if (urlInfo.host === 'midend.gf.com.cn' && urlInfo.path === '/gfmiddle/activity/homepage_elements/v2') {
    return {
      retcode: 0,
      msg: 'ok',
      data: {
        banner2020: [],
        ten_grid_hp: [],
        ten_grid_all: [],
        find_tab: [],
      },
    };
  }
  if (urlInfo.host === 'midend.gf.com.cn' && urlInfo.path === '/gfmiddle/activity/find_marketing/list') {
    return {
      retcode: 0,
      msg: 'ok',
      data: [],
    };
  }
  if (urlInfo.host === 'midend.gf.com.cn' && /^\/gfmiddle\/activity\/cash\/yzzz(?:_in)?$/.test(urlInfo.path)) {
    return {
      code: 0,
      msg: 'success',
      data: null,
      result: null,
      popupList: [],
    };
  }
  return null;
}

const DROP_KEYS = new Set([
  'advertise',
  'advertisement',
  'advertisements',
  'adInfo',
  'adList',
  'ads',
  'banner',
  'banners',
  'bannerList',
  'popup',
  'popups',
  'popupList',
  'popList',
  'activityPopup',
  'middleActivityPopup',
  'marketing',
  'marketingList',
  'recommend',
  'recommendList',
  'operationList',
  'openAccountAdvertise',
  'banner2020',
  'find_recommend',
  'cdr_ads',
  'cdr_entrance',
  'fund_top_notice',
]);
const BAD_TEXT_RE = /(?:广告|弹窗|弹屏|开屏|启动页广告|运营位|活动弹窗|金股内参|易淘金APP年度功能大赏|ETF频道问大家|banner|advert|advertise|adInfo|adList|popup|pop_up|splash|marketing|campaign|promotion|recommend|holder_marketing|homepage_elements|find_marketing|smartassistant\/recommend|fund_ad|front\/get_ads|\/ad\/info|\/ad\/list|stock-service\/app|hd\.gf\.com\.cn|store\.gf\.com\.cn\/finance-etf)/i;

function shouldDropObject(object) {
  const text = JSON.stringify(object).slice(0, 8192);
  return BAD_TEXT_RE.test(text);
}

function cleanValue(value, state, key) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      const cleaned = cleanValue(item, state, key);
      if (cleaned === undefined) {
        state.changed = true;
        continue;
      }
      out.push(cleaned);
    }
    if (out.length !== value.length) {
      state.changed = true;
    }
    return out;
  }

  if (value && typeof value === 'object') {
    if (key && DROP_KEYS.has(key)) {
      state.changed = true;
      return Array.isArray(value) ? [] : null;
    }
    if (shouldDropObject(value)) {
      state.changed = true;
      return undefined;
    }
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      if (DROP_KEYS.has(childKey) || BAD_TEXT_RE.test(childKey)) {
        state.changed = true;
        if (Array.isArray(childValue)) {
          out[childKey] = [];
        } else if (childValue && typeof childValue === 'object') {
          out[childKey] = null;
        } else {
          out[childKey] = '';
        }
        continue;
      }
      const cleaned = cleanValue(childValue, state, childKey);
      if (cleaned !== undefined) {
        out[childKey] = cleaned;
      } else {
        state.changed = true;
      }
    }
    return out;
  }

  if (typeof value === 'string' && BAD_TEXT_RE.test(value)) {
    state.changed = true;
    return '';
  }

  return value;
}

function isGfYtjEndpoint(urlInfo) {
  if (urlInfo.host === 'config.gf.com.cn' && (
    urlInfo.path === '/ad/info' ||
    urlInfo.path === '/ytj_config/sys_popup' ||
    urlInfo.path === '/ytj_config/info' ||
    urlInfo.path === '/stock_index/publish/info' ||
    urlInfo.path === '/ad/list' ||
    urlInfo.path === '/front/get_ads' ||
    urlInfo.path === '/trade/card'
  )) {
    return true;
  }
  if (urlInfo.host === 'midend.gf.com.cn' && (
    /^\/gfmiddle\/activity\/popup\/(?:v2|yzzz)$/.test(urlInfo.path) ||
    urlInfo.path === '/gfmiddle/activity/homepage_elements/v2' ||
    urlInfo.path === '/gfmiddle/activity/find_marketing/list' ||
    /^\/gfmiddle\/activity\/cash\/yzzz(?:_in)?$/.test(urlInfo.path) ||
    urlInfo.path === '/gfmiddle/activity/holder_marketing' ||
    urlInfo.path === '/gfmiddle/ecss/activity/holder_marketing/list' ||
    urlInfo.path === '/gfmiddle/smartassistant/recommend' ||
    urlInfo.path === '/gfmiddle/activity/my_page/open_account_marketing'
  )) {
    return true;
  }
  if (urlInfo.host === 'qd.gf.com.cn' && urlInfo.path === '/api/v1/quote/fund_ad') {
    return true;
  }
  return false;
}

function finishJson(reason, value, marker) {
  const headers = buildJsonHeaders($response && $response.headers, marker);
  console.log(`uBO GFYTJ ad clean: ${reason}`);
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

  if (!isGfYtjEndpoint(urlInfo)) {
    done({});
  } else {
    const emptyPayload = emptyJsonPayload(urlInfo);
    if (emptyPayload !== null) {
      finishJson('startup/activity popup endpoint emptied', emptyPayload, 'gfytj-popup-empty-1');
    } else {
      const responseText = bodyToText(response.body);
      const payload = parseMaybeJson(responseText);
      if (payload === undefined) {
        done({});
      } else {
        const state = { changed: false };
        const cleaned = cleanValue(payload, state, '');
        if (state.changed) {
          finishJson('marketing/banner/recommend payload cleaned', cleaned, 'gfytj-marketing-clean-1');
        } else {
          done({});
        }
      }
    }
  }
} catch (error) {
  console.log('uBO GFYTJ ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
