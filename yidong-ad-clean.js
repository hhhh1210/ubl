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

function getHeaderCaseInsensitive(headers, target) {
  const lower = String(target).toLowerCase();
  for (const key of Object.keys(headers || {})) {
    if (key.toLowerCase() === lower) {
      return headers[key];
    }
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

function isChinaMobileApp(headers) {
  const ua = String(getHeaderCaseInsensitive(headers, 'User-Agent') || '');
  if (/ChinaMobile\/|leadeon\/|CMCCIT/i.test(ua)) {
    return true;
  }
  return getHeaderCaseInsensitive(headers, 'equipmentinformation') !== '';
}

function isPsieAdStrategy(urlInfo) {
  if (urlInfo.host !== 'h.app.coc.10086.cn') {
    return false;
  }
  return /^\/ngpsie\/psieappaiddsdkserver\/(?:touchcode\/getStrategyTouchcode|product\/getComplexCandidateColls)$/.test(urlInfo.path);
}

function buildSuccessNoDataHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'application/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'X-uBO-Yidong', marker);
  return headers;
}

function buildNoDataPayload() {
  return {
    code: '000000',
    msg: '操作成功',
    info: null,
    data: null,
  };
}

function directNoData(reason) {
  console.log(`uBO Yidong ad clean: ${reason}`);
  done({
    response: {
      status: 200,
      headers: buildSuccessNoDataHeaders({}, 'psie-request-nodata-1'),
      body: JSON.stringify(buildNoDataPayload()),
    },
  });
}

function finishNoData(reason) {
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  console.log(`uBO Yidong ad clean: ${reason}`);
  done({
    status: 200,
    headers: buildSuccessNoDataHeaders(response.headers, 'psie-response-nodata-1'),
    body: JSON.stringify(buildNoDataPayload()),
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const headers = request.headers || {};
  const urlInfo = parseUrl(request.url);
  const argument = typeof $argument === 'string' ? $argument : '';

  if (!isPsieAdStrategy(urlInfo) || !isChinaMobileApp(headers)) {
    done({});
  } else if (/(?:^|&)phase=psie-request(?:&|$)/.test(argument)) {
    directNoData('PSIE strategy request short-circuited with no-data');
  } else {
    finishNoData('PSIE strategy response replaced with no-data');
  }
} catch (error) {
  console.log('uBO Yidong ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
