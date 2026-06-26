function done(payload) {
  $done(payload || {});
}

function parseUrl(url) {
  const match = String(url || '').match(/^https?:\/\/([^/?#:]+)([^?#]*)(?:\?([^#]*))?/i);
  if (!match) {
    return { host: '', path: '/' };
  }
  return {
    host: match[1].toLowerCase(),
    path: match[2] || '/',
  };
}

function isStartupConfig(urlInfo) {
  if (urlInfo.host !== 'client.app.coc.10086.cn') {
    return false;
  }
  return /^\/biz-orange\/(?:DN\/(?:homepagePopup\/getSortInfo|searchWord\/getSearchWordInfo|multipleInterfaces\/aggregationData|homePage\/getTopAreaList|init\/(?:getNavigation|startInit))|DH\/(?:homeSkin\/getHomeSkin|hotupdate\/getHotupdateList)|BN\/sscrz\/getProvSwitchConf)$/.test(urlInfo.path);
}

function finishFastServiceUnavailable(urlInfo) {
  console.log(`uBO ZGYD startup ad clean: fast 503 ${urlInfo.path}`);
  done({
    response: {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'close',
        'X-uBO-ZGYD': 'startup-fast-503-1',
      },
      body: 'Service Unavailable',
    },
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);
  if (isStartupConfig(urlInfo)) {
    finishFastServiceUnavailable(urlInfo);
  } else {
    done({});
  }
} catch (error) {
  done({});
}
