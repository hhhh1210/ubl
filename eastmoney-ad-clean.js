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

function buildJsonHeaders(marker) {
  const headers = cloneHeaders($response && $response.headers);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'X-uBO-EastMoney', marker);
  return headers;
}

function getPhase() {
  const arg = String(typeof $argument === 'string' ? $argument : '');
  const match = arg.match(/(?:^|&)phase=([^&]+)/);
  return match ? match[1] : '';
}

function parseJson(text) {
  return JSON.parse(text || '{}');
}

function isCfwIosRequest(request) {
  return request
    && request.appKey === 'cfw'
    && request.client === 'ios'
    && request.clientType === 'cfw';
}

function cleanInfoService(requestText, responseText) {
  const payload = parseJson(responseText);
  const data = payload && payload.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const request = requestText ? parseJson(requestText) : null;
  const hasRequestMarker = isCfwIosRequest(request)
    && /^(?:marketad|bubblead)$/.test(String(request.method || ''));
  const hasAdPayload = Array.isArray(data.adpositionidlist)
    || Array.isArray(data.fundPositionList)
    || data.isMarketingAd === true;
  if (!hasRequestMarker && !hasAdPayload) {
    return null;
  }

  payload.code = 0;
  payload.message = payload.message || 'Success';
  data.adpositionidlist = [];
  data.fundPositionList = [];
  data.isMarketingAd = false;
  data.cacheExpire = Math.max(Number(data.cacheExpire) || 0, 3600);
  data.cacheDataExpireMin = Math.max(Number(data.cacheDataExpireMin) || 0, 4320);
  return payload;
}

function hasMxAdMarker(data) {
  const text = JSON.stringify(data || {});
  return /sceneKey=AD|sceneKey=PopupMX|PopupMX/i.test(text);
}

function cleanMxEntrance(responseText) {
  const payload = parseJson(responseText);
  const data = payload && payload.data;
  if (!data || typeof data !== 'object' || !hasMxAdMarker(data)) {
    return null;
  }

  data.questions = [];
  data.tired = [];
  data.androidJumpUrl = '';
  data.androidBaseJumpUrl = '';
  data.iosJumpUrl = '';
  data.iosBaseJumpUrl = '';
  return payload;
}

const EASTMONEY_AD_PAGES = [
  'app_lanuchpop',
  'dlqp_index',
  'app_sydty_1025',
  'app_newhomepage',
  'jggqp_index',
  'app_index_dbqp',
];

const EASTMONEY_AD_POSITIONS = [
  '5409146774515076242',
  '4832686022211652752',
  '4832686022211682682',
  '2238612636846247049',
  '6850298655273664882',
  '3391534141453123891',
  '3103303765301412211',
  '6562068279121923010',
  '4544455646059940804',
  '1950382260694535114',
  '4256225269908229059',
  '8867911288335616969',
  '1662151884542823365',
  '8003220159880481734',
  '2238612636846246855',
  '1662151884542823368',
  '221000003784264780',
];

const EASTMONEY_POPUP_ABTESTS = {
  event_notification_pop: '0',
  comment_popup_switch: '0',
  popup1_signin: '0',
  popup2_news: '0',
};

function mergeUnique(existing, extra) {
  const seen = {};
  const out = [];
  for (const item of (Array.isArray(existing) ? existing : []).concat(extra)) {
    const value = String(item || '');
    if (!value || seen[value]) {
      continue;
    }
    seen[value] = true;
    out.push(value);
  }
  return out;
}

function cleanUserConfig(responseText) {
  const payload = parseJson(responseText);
  const data = payload && payload.Data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const adBlackList = data.AdBlackList && typeof data.AdBlackList === 'object'
    ? data.AdBlackList
    : {};
  adBlackList.pageList = mergeUnique(adBlackList.pageList, EASTMONEY_AD_PAGES);
  adBlackList.positionList = mergeUnique(adBlackList.positionList, EASTMONEY_AD_POSITIONS);
  data.AdBlackList = adBlackList;

  if (Array.isArray(data.ABTest)) {
    for (const group of data.ABTest) {
      const options = group && group.Options;
      if (!Array.isArray(options)) {
        continue;
      }
      for (const option of options) {
        if (option && Object.prototype.hasOwnProperty.call(EASTMONEY_POPUP_ABTESTS, option.ID)) {
          option.Value = EASTMONEY_POPUP_ABTESTS[option.ID];
        }
      }
    }
  }

  return payload;
}

try {
  const phase = getPhase();
  const requestText = bodyToText($request && $request.body);
  const responseText = bodyToText($response && $response.body);
  let body = null;
  let marker = phase || 'ad-service';
  if (phase === 'mx-entrance') {
    body = cleanMxEntrance(responseText);
  } else if (phase === 'user-config') {
    body = cleanUserConfig(responseText);
    marker = 'user-config';
  } else {
    body = cleanInfoService(requestText, responseText);
  }

  if (!body) {
    done({});
  } else {
    done({
      status: 200,
      headers: buildJsonHeaders(marker),
      body: JSON.stringify(body),
    });
  }
} catch (error) {
  done({});
}
