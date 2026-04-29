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

function decodeBase64Text(text) {
  try {
    if (typeof atob !== 'function') {
      return '';
    }
    const compact = String(text || '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (compact.length < 16 || /[^A-Za-z0-9+/=]/.test(compact)) {
      return '';
    }
    return atob(compact + '==='.slice((compact.length + 3) % 4));
  } catch (error) {
    return '';
  }
}

function bodyHasJetpackMarker(body) {
  const text = bodyToText(body);
  if (/com\.halfbrick\.jetpack|halfbrick-jetpack-joyride|id457446957/i.test(text)) {
    return true;
  }
  if (/Y29tLmhhbGZicmljay5qZXRwYWNr|aGFsZmJyaWNrLWpldHBhY2stam95cmlkZQ|aWQ0NTc0NDY5NTc|ImJ1bmRsZSI6ImNvbS5oYWxmYnJpY2suamV0cGFjay/i.test(text)) {
    return true;
  }
  const decoded = decodeBase64Text(text);
  return /com\.halfbrick\.jetpack|halfbrick-jetpack-joyride|id457446957|Y29tLmhhbGZicmljay5qZXRwYWNr|ImJ1bmRsZSI6ImNvbS5oYWxmYnJpY2suamV0cGFjay/i.test(decoded);
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
    urlInfo.path === '/5.0/i'
  )) {
    return true;
  }
  return false;
}

function isBidMachineInit(urlInfo) {
  return urlInfo.host === 'api.bidmachine.io' && urlInfo.path === '/auction/init';
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

function directNoContent(reason) {
  console.log(`uBO Jetpack Joyride ad clean: ${reason}`);
  done({
    response: {
      status: 204,
      headers: {},
      body: '',
    },
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const headers = request.headers || {};
  const urlInfo = parseUrl(request.url);
  const argument = typeof $argument === 'string' ? $argument : '';
  let handled = false;

  if (/(?:^|&)phase=bidmachine-request(?:&|$)/.test(argument)) {
    if (isBidMachineInit(urlInfo) && bodyHasJetpackMarker(request.body)) {
      directNoContent('BidMachine Jetpack auction request suppressed');
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    isBidMachineInit(urlInfo) &&
    (bodyHasJetpackMarker(request.body) || bodyHasJetpackMarker(response.body))
  ) {
    noContent('BidMachine Jetpack auction response suppressed');
    handled = true;
  }

  if (
    handled === false &&
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

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO Jetpack Joyride ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
