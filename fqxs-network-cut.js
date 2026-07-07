function done(payload) {
  $done(payload || {});
}

function parseUrl(url) {
  const match = String(url || '').match(/^https?:\/\/([^/?#:]+)([^?#]*)(?:\?([^#]*))?/i);
  if (!match) return { host: '', path: '/' };
  return {
    host: match[1].toLowerCase(),
    path: match[2] || '/',
  };
}

function shouldCut(urlInfo) {
  const host = urlInfo.host;
  const path = urlInfo.path;

  if (/^api-access\.pangolin-sdk-toutiao(?:1|-b)?\.com$/.test(host)) {
    return /^\/api\/ad\/union\/sdk\/(?:settings|stats\/batch|get_ads|material\/check|app_log)\/?$/.test(path);
  }

  if (/^(?:sf3|sf6)-fe-tos\.pglstatp-toutiao\.com$/.test(host)) {
    return /^\/obj\/ad-pattern\//.test(path);
  }

  if (host === 'lf-cdn-tos.bytescm.com') {
    return /^\/obj\/static\/ad\//.test(path);
  }

  if (/^(?:ad|ads|ads3-normal(?:-[a-z]{2})?|ads5-normal(?:-[a-z]{2})?)\.zijieapi\.com$/.test(host)) {
    return true;
  }

  if (/^(?:pangolin|pangolin16)\.snssdk\.com$/.test(host)) {
    return true;
  }

  if (host === 'mon.zijieapi.com') {
    return /^\/monitor\/collect\/c\/cloudcontrol\/get\/?$/.test(path);
  }

  if (host === 'tnc3-alisc1.zijieapi.com') {
    return /^\/get_domains\/v4\/?$/.test(path);
  }

  if (host === 'toblog.ctobsnssdk.com') {
    return /^\/service\/2\/(?:log_settings|device_register|device_register_only|app_alert_check)\//.test(path);
  }

  if (/^mssdk\.(?:zijieapi|snssdk|bytedance)\.com$/.test(host)) {
    return true;
  }

  return false;
}

function localRefuse(request, urlInfo) {
  const sourceUrl = String(request.url || '');
  const rewrittenUrl = sourceUrl.replace(/^https?:\/\/[^/?#:]+(?::\d+)?/i, 'http://127.0.0.1:9');
  console.log('uBO FQXS 6.0.9 strict network-cut: ' + urlInfo.host + urlInfo.path);
  done({
    url: rewrittenUrl,
    headers: Object.assign({}, request.headers || {}, {
      Host: '127.0.0.1',
      'X-uBO-FQXS': 'strict-network-cut-1',
    }),
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);
  if (shouldCut(urlInfo)) {
    localRefuse(request, urlInfo);
  } else {
    done({});
  }
} catch (error) {
  done({});
}
