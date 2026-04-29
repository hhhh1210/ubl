function done(payload) {
  $done(payload || {});
}

const APPLOVIN_ZONES = new Set([
  'fefd0ed62d92b552',
  '12b834430e9590d3',
  'fd6ee7c7f687f053',
  '4bcfd6d6696cd2a9',
]);

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

function hasQueryValue(query, key, value) {
  return new RegExp(`(?:^|&)${key}=${value}(?:&|$)`).test(String(query || ''));
}

function isJetpackUserAgent(headers) {
  return /^jetpack\/1\./i.test(String(getHeaderCaseInsensitive(headers, 'User-Agent') || ''));
}

function bodyHasJetpackMarker(body) {
  return /com\.halfbrick\.jetpack|halfbrick-jetpack-joyride|id457446957/.test(String(body || ''));
}

function isJetpackApplovin(headers) {
  const zone = String(getHeaderCaseInsensitive(headers, 'applovin-zone-id') || '');
  return APPLOVIN_ZONES.has(zone) || isJetpackUserAgent(headers);
}

function isJetpackUnity(urlInfo, headers) {
  return isJetpackUserAgent(headers) ||
    hasQueryValue(urlInfo.query, 'appKey', '5a253905');
}

function isAppLovinEndpoint(urlInfo) {
  if (urlInfo.host === 'a4.applovin.com' && urlInfo.path === '/4.0/ad') {
    return true;
  }
  if (urlInfo.host === 'd.applovin.com' && urlInfo.path === '/2.0/device') {
    return true;
  }
  if (urlInfo.host === 'ms.applovin.com' && (
    urlInfo.path === '/5.0/i' ||
    urlInfo.path === '/1.0/sdk/error'
  )) {
    return true;
  }
  if (urlInfo.host === 'prod-e.axon.ai' && /^\/1\.0\/event\//.test(urlInfo.path)) {
    return true;
  }
  return false;
}

function isBidMachineEndpoint(urlInfo) {
  if (urlInfo.host === 'api.bidmachine.io' && urlInfo.path === '/auction/init') {
    return true;
  }
  if (/^api-[^.]+\.bidmachine\.io$/.test(urlInfo.host) && (
    urlInfo.path === '/auction/rtb/v3' ||
    urlInfo.path === '/track/sdk-event'
  )) {
    return true;
  }
  return false;
}

function isVungleEndpoint(urlInfo) {
  return urlInfo.host === 'logs.ads.vungle.com' && urlInfo.path === '/sdk/metrics';
}

function noContent(reason) {
  const headers = cloneHeaders($response && $response.headers);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Type');
  console.log(`uBO Jetpack Joyride ad clean: ${reason}`);
  done({ status: 204, headers, body: '' });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const headers = request.headers || {};
  const urlInfo = parseUrl(request.url);
  const requestBody = typeof request.body === 'string' ? request.body : '';
  const responseBody = typeof $response === 'object' && $response !== null && typeof $response.body === 'string'
    ? $response.body
    : '';
  let handled = false;

  if (
    isAppLovinEndpoint(urlInfo) &&
    isJetpackApplovin(headers)
  ) {
    noContent('AppLovin ad lifecycle response suppressed');
    handled = true;
  }

  if (handled === false && (
    (
      urlInfo.host === 'gw1.mediation.unity3d.com' ||
      urlInfo.host === 'o-sdk.mediation.unity3d.com' ||
      urlInfo.host === 'gateway.unityads.unity3d.com' ||
      urlInfo.host === 'i-sdk.mediation.unity3d.com' ||
      urlInfo.host === 'i-adq.mediation.unity3d.com'
    ) &&
    isJetpackUnity(urlInfo, headers)
  )) {
    noContent('Unity mediation ad response suppressed');
    handled = true;
  }

  if (handled === false && isBidMachineEndpoint(urlInfo)) {
    noContent('BidMachine auction response suppressed');
    handled = true;
  }

  if (
    handled === false &&
    isVungleEndpoint(urlInfo) &&
    (isJetpackUserAgent(headers) || bodyHasJetpackMarker(requestBody) || bodyHasJetpackMarker(responseBody))
  ) {
    noContent('Vungle ad metrics response suppressed');
    handled = true;
  }

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO Jetpack Joyride ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
