'use strict';

const TARGET = /^https?:\/\/(?:az[1-4]-api\.ksapisrv\.com|az[1-4]-api-js\.gifshow\.com)\/rest\/n\/system\/realtime\/startup(?:[?#]|$)/i;
const SPLASH_KEYS = ['splash', 'splashInfo', 'realtimeSplashInfo', 'splashLlsid'];

function cleanHeaders(headers) {
  const cleaned = {};
  Object.keys(headers || {}).forEach((key) => {
    if (!/^(?:content-encoding|content-length|transfer-encoding)$/i.test(key)) {
      cleaned[key] = headers[key];
    }
  });
  cleaned['Content-Type'] = 'application/json; charset=utf-8';
  cleaned['Cache-Control'] = 'no-store';
  cleaned['X-uBO-Kuaishou'] = 'kuaishou-realtime-splash-empty-1';
  return cleaned;
}

try {
  if (!TARGET.test(($request && $request.url) || '')) {
    $done({});
  } else {
    const payload = JSON.parse(($response && $response.body) || '{}');
    let changed = false;

    SPLASH_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        delete payload[key];
        changed = true;
      }
    });

    $done(changed ? {
      status: 200,
      headers: cleanHeaders($response && $response.headers),
      body: JSON.stringify(payload),
    } : {});
  }
} catch (error) {
  console.log('uBO Kuaishou ad clean failed: ' + (error && error.message ? error.message : String(error)));
  $done({});
}
