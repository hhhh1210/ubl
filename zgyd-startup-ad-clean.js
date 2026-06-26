function done(payload) {
  $done(payload || {});
}

function parseUrl(url) {
  const match = String(url || '').match(/^https?:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?/i);
  if (!match) {
    return { host: '', path: '/', query: '' };
  }
  return {
    host: match[1].toLowerCase(),
    path: match[2] || '/',
    query: match[3] || '',
  };
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

function buildHeaders(marker, contentType) {
  const headers = cloneHeaders({});
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'X-uBO-ZGYD', marker);
  if (contentType) {
    setHeaderCaseInsensitive(headers, 'Content-Type', contentType);
  }
  return headers;
}

function directJson(reason, value, marker) {
  console.log(`uBO ZGYD startup ad clean: ${reason}`);
  done({
    response: {
      status: 200,
      headers: buildHeaders(marker, 'application/json; charset=utf-8'),
      body: JSON.stringify(value),
    },
  });
}

function directNoContent(reason, marker) {
  console.log(`uBO ZGYD startup ad clean: ${reason}`);
  done({
    response: {
      status: 204,
      headers: buildHeaders(marker, ''),
      body: '',
    },
  });
}

function miguNoAdPayload() {
  return {
    code: 0,
    ret: 0,
    result: 0,
    status: 0,
    msg: '',
    message: 'success',
    reqinterval: 3600,
    data: {
      ads: [],
      adList: [],
      list: [],
      materialList: [],
      materials: [],
      resources: [],
    },
    ads: [],
    adList: [],
    list: [],
    materialList: [],
    materials: [],
    resources: [],
  };
}

function miguConfigPayload() {
  return {
    code: 0,
    msg: 'success',
    data: {
      enable: false,
      splash: false,
      bootScreen: false,
      cache: false,
      preload: false,
      requestInterval: 86400,
      adSwitch: 0,
      splashSwitch: 0,
      bootScreenSwitch: 0,
    },
  };
}

function mcloudNoAdPayload() {
  return {
    code: 0,
    msg: 'success',
    message: 'success',
    success: true,
    data: [],
    result: [],
    adInfos: [],
    adInfoList: [],
    list: [],
  };
}

function isMiguSdk15(urlInfo) {
  return (
    /^(?:ggx\d+\.miguvideo\.com|gginvasdk\.miguvideo\.com|36\.155\.98\.104:2084)$/i.test(urlInfo.host) &&
    /^\/(?:request|invalidsdk)\/sdk15$/i.test(urlInfo.path)
  );
}

function isMiguConfig(urlInfo) {
  return urlInfo.host === 'ggstaticcache.miguvideo.com' &&
    urlInfo.path === '/v1/ggconf/bb_wl.json';
}

function isMcloudAdInfo(urlInfo) {
  return urlInfo.host === 'ad.mcloud.139.com' &&
    /^\/advertapi\/(?:adv-config|adv-filter)\/.*\/(?:batchGetAdInfos|batchGetAdInfoList|getAdInfos)$/i.test(urlInfo.path);
}

function isMcloudAdReport(urlInfo) {
  return urlInfo.host === 'ad.mcloud.139.com' &&
    /^\/advertapi\/(?:.*\/)?(?:adReport|advertReported)\/(?:click|exposure|reported|batchReported|batchClick)$/i.test(urlInfo.path);
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);

  if (isMiguSdk15(urlInfo)) {
    directJson('Migu sdk15 startup ad request suppressed', miguNoAdPayload(), 'migu-sdk15-request-nofill-1');
  } else if (isMiguConfig(urlInfo)) {
    directJson('Migu ad config disabled', miguConfigPayload(), 'migu-config-disable-1');
  } else if (isMcloudAdInfo(urlInfo)) {
    directJson('China Mobile mcloud ad info request suppressed', mcloudNoAdPayload(), 'mcloud-adinfo-nofill-1');
  } else if (isMcloudAdReport(urlInfo)) {
    directNoContent('China Mobile mcloud ad report suppressed', 'mcloud-report-204-1');
  } else {
    done({});
  }
} catch (error) {
  done({});
}
