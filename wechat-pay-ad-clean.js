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

function isWechatPayAdRequest(request) {
  const body = bodyToText(request && request.body);
  if (!body) {
    return true;
  }
  const decoded = decodeURIComponentSafe(body);
  return /from_wepay=1|export_key_type=wxpay_mchopenapp|wxpay_token|mch_ext_id|wpid[0-9a-f]{16,}/i.test(decoded);
}

function noAdPayload(originalPayload) {
  const payload = originalPayload && typeof originalPayload === 'object' && !Array.isArray(originalPayload)
    ? originalPayload
    : {};
  payload.ret = 0;
  payload.msg = payload.msg || 'OK';
  payload.ad_slot_data = [];
  payload.advertisement_info = [];
  payload.advertisement_num = 0;
  payload.no_ad_indicator_info = payload.no_ad_indicator_info || {};
  return payload;
}

function makeJsonHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'X-uBO-WeChatPay', marker);
  return headers;
}

function makeHtmlHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'text/html; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'X-uBO-WeChatPay', marker);
  return headers;
}

function finishJson(marker, value) {
  done({
    status: 200,
    headers: makeJsonHeaders($response && $response.headers, marker),
    body: JSON.stringify(value),
  });
}

function cleanServerData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }
  data.is_hide_ad = true;
  data.addata = JSON.stringify(noAdPayload({}));
  data.trans_ad_cat_id = '';
  if (data.order_info && typeof data.order_info === 'object') {
    data.order_info.pos_id = '';
  }
  return data;
}

function cleanPayPageHtml(html) {
  let text = String(html || '');
  text = text.replace(/SERVER_DATA\s*=\s*(\{[\s\S]*?\});\s*<\/script>/, function (whole, jsonText) {
    try {
      const payload = JSON.parse(jsonText);
      if (payload && payload.data) {
        cleanServerData(payload.data);
      }
      return 'SERVER_DATA = ' + JSON.stringify(payload) + ';</script>';
    } catch (error) {
      return whole;
    }
  });
  const css = '<style id="ubo-wechatpay-ad-clean">.ad-area,.ad-wrapper,.ad-box,iframe[src*="wxa.wxs.qq.com/tmpl"]{display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}</style>';
  if (text.indexOf('ubo-wechatpay-ad-clean') === -1) {
    text = text.replace('</head>', css + '</head>');
  }
  return text;
}

function cleanIcbcSubmitPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'ad_url')) {
    payload.ad_url = '';
  }
  return payload;
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const urlInfo = parseUrl(request.url);

  if (
    urlInfo.host === 'mp.weixin.qq.com' &&
    urlInfo.path === '/wapad/getaddata' &&
    /(?:^|&)action=getad(?:&|$)/.test(urlInfo.query) &&
    isWechatPayAdRequest(request)
  ) {
    const text = bodyToText(response.body);
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = {};
    }
    finishJson('wapad-empty-1', noAdPayload(payload));
  } else if (
    urlInfo.host === 'payapp.weixin.qq.com' &&
    urlInfo.path === '/mchopenapp/goldplan/adpage'
  ) {
    done({
      status: response.status || 200,
      headers: makeHtmlHeaders(response.headers, 'goldplan-page-1'),
      body: cleanPayPageHtml(bodyToText(response.body)),
    });
  } else if (
    urlInfo.host === 'acq.icbc.com.cn' &&
    urlInfo.path === '/servlet/wcqr/submit/order'
  ) {
    const text = bodyToText(response.body);
    const payload = JSON.parse(text);
    finishJson('icbc-ad-url-empty-1', cleanIcbcSubmitPayload(payload));
  } else {
    done({});
  }
} catch (error) {
  console.log('uBO WeChat Pay ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
