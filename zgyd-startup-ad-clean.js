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

function finishFastNetworkFailure(request, urlInfo) {
  const sourceUrl = String(request.url || '');
  const localPath = urlInfo.path || '/';
  const rewrittenUrl = sourceUrl.replace(
    /^https?:\/\/client\.app\.coc\.10086\.cn(?::\d+)?/i,
    'http://127.0.0.1:9'
  );
  console.log(`uBO ZGYD startup ad clean: fast local refusal ${localPath}`);
  done({
    url: rewrittenUrl,
    headers: Object.assign({}, request.headers || {}, {
      Host: '127.0.0.1',
      'X-uBO-ZGYD': 'startup-fast-refused-1',
    }),
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);
  if (isStartupConfig(urlInfo)) {
    finishFastNetworkFailure(request, urlInfo);
  } else {
    done({});
  }
} catch (error) {
  done({});
}
