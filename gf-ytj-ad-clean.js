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
  setHeaderCaseInsensitive(headers, 'X-uBO-GFYTJ', marker);
  return headers;
}

function isStartupAdEndpoint(urlInfo) {
  return urlInfo.host === 'config.gf.com.cn' && urlInfo.path === '/ad/info';
}

function isGatewayEndpoint(urlInfo) {
  return urlInfo.host === 'gw.gf.com.cn' && urlInfo.path === '/gateway';
}

function isCreditMenuEndpoint(urlInfo) {
  return urlInfo.host === 'config.gf.com.cn' && urlInfo.path === '/credit/menu';
}

function isYtjConfigEndpoint(urlInfo) {
  return urlInfo.host === 'config.gf.com.cn' && urlInfo.path === '/ytj_config/info';
}

function noAdPayload() {
  return {
    code: 0,
    msg: 'success',
    data: null,
    result: null,
    list: [],
  };
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

function finishDirectJson(reason, value, marker) {
  console.log(`uBO GFYTJ ad clean: ${reason}`);
  done({
    response: {
      status: 200,
      headers: buildJsonHeaders({}, marker),
      body: JSON.stringify(value),
    },
  });
}

function hasPhase(value) {
  return new RegExp(`(?:^|&)phase=${value}(?:&|$)`).test(String(typeof $argument === 'string' ? $argument : ''));
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

function cleanGatewayLaunchAdConfig(value, state) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = cleanGatewayLaunchAdConfig(value[i], state);
    }
    return value;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  for (const key of Object.keys(value)) {
    if (key === 'launch_ad_config' && Array.isArray(value[key]) && value[key].length !== 0) {
      value[key] = [];
      state.changed = true;
    } else {
      value[key] = cleanGatewayLaunchAdConfig(value[key], state);
    }
  }
  return value;
}

function cleanCreditMenu(value, state) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const data = value.data && typeof value.data === 'object' && !Array.isArray(value.data)
    ? value.data
    : null;
  if (!data) {
    return value;
  }
  if (Array.isArray(data.footerAd) && data.footerAd.length !== 0) {
    data.footerAd = [];
    state.changed = true;
  }
  if (Array.isArray(data.middle)) {
    const kept = data.middle.filter((item) => !item || item.id !== 'credit_middle_ad');
    if (kept.length !== data.middle.length) {
      data.middle = kept;
      state.changed = true;
    }
  }
  return value;
}

function emptyNoticeData(data) {
  if (Array.isArray(data)) {
    return [];
  }
  if (data && typeof data === 'object') {
    return {
      id: 0,
      title: '',
      url: '',
      content: '',
      frequency: '',
      source: '',
      sub_source: '',
      data_id: '',
      strategy_id: '',
    };
  }
  return data;
}

function isPromoNoticeId(id) {
  return id === 'diagnostic_report' ||
    id === 'zxg_top' ||
    id === 'gg_notice' ||
    id === 'cash_notice' ||
    /_(?:top|bottom)_notice$/.test(id);
}

function cleanYtjConfigInfo(value, state) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.data)) {
    return value;
  }
  for (const item of value.data) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const id = String(item.id || '');
    if (!isPromoNoticeId(id)) {
      continue;
    }
    const before = JSON.stringify(item.data);
    item.data = emptyNoticeData(item.data);
    if (JSON.stringify(item.data) !== before) {
      state.changed = true;
    }
  }
  return value;
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);

  if (isStartupAdEndpoint(urlInfo)) {
    if (hasPhase('startup-ad-request')) {
      finishDirectJson('startup ad request emptied', noAdPayload(), 'gfytj-startup-ad-request-empty-1');
    } else {
      finishJson('startup ad endpoint emptied', noAdPayload(), 'gfytj-startup-ad-empty-3');
    }
  } else if (isGatewayEndpoint(urlInfo)) {
    const payload = parseMaybeJson(bodyToText($response && $response.body));
    if (payload && typeof payload === 'object') {
      const state = { changed: false };
      cleanGatewayLaunchAdConfig(payload, state);
      if (state.changed) {
        finishJson('gateway launch ad config emptied', payload, 'gfytj-gateway-launch-ad-empty-1');
      } else {
        done({});
      }
    } else {
      done({});
    }
  } else if (isCreditMenuEndpoint(urlInfo)) {
    const payload = parseMaybeJson(bodyToText($response && $response.body));
    if (payload && typeof payload === 'object') {
      const state = { changed: false };
      cleanCreditMenu(payload, state);
      if (state.changed) {
        finishJson('credit menu ads emptied', payload, 'gfytj-credit-menu-ad-empty-1');
      } else {
        done({});
      }
    } else {
      done({});
    }
  } else if (isYtjConfigEndpoint(urlInfo)) {
    const payload = parseMaybeJson(bodyToText($response && $response.body));
    if (payload && typeof payload === 'object') {
      const state = { changed: false };
      cleanYtjConfigInfo(payload, state);
      if (state.changed) {
        finishJson('ytj config promo notices emptied', payload, 'gfytj-config-notice-empty-1');
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
  console.log('uBO GFYTJ ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
