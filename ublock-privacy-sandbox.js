const DEFAULT_PERMISSIONS_POLICY =
  'attribution-reporting=(), browsing-topics=(), join-ad-interest-group=(), run-ad-auction=()';

const argumentValue = typeof $argument === 'string' ? $argument : '';
const phaseMatch = argumentValue.match(/(?:^|&)phase=(request|response)(?:&|$)/);
const phase = phaseMatch ? phaseMatch[1] : argumentValue;

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
  const targetLower = String(target).toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === targetLower) {
      delete headers[key];
    }
  }
}

function setHeaderCaseInsensitive(headers, name, value) {
  deleteHeaderCaseInsensitive(headers, name);
  headers[name] = value;
}

function extractHostname(url) {
  const match = String(url || '').match(/^[a-z]+:\/\/([^/:?#]+)/i);
  return match ? match[1] : '';
}

function isLocalHostname(hostname) {
  return /^(?:localhost|127(?:\.\d{1,3}){3}|(?:[^.]+\.)?local)$/i.test(hostname);
}

function done(payload) {
  $done(payload || {});
}

try {
  if (phase === 'request' || $script.type === 'http-request') {
    const headers = cloneHeaders($request.headers);
    deleteHeaderCaseInsensitive(headers, 'Attribution-Reporting-Eligible');
    deleteHeaderCaseInsensitive(headers, 'Sec-Browsing-Topics');
    done({ headers });
  }

  if (phase === 'response' || $script.type === 'http-response') {
    const hostname = extractHostname($request.url);
    if (isLocalHostname(hostname)) {
      done({});
    }
    const headers = cloneHeaders($response.headers);
    deleteHeaderCaseInsensitive(headers, 'Attribution-Reporting-Register-Source');
    deleteHeaderCaseInsensitive(headers, 'Attribution-Reporting-Register-Trigger');
    deleteHeaderCaseInsensitive(headers, 'Observe-Browsing-Topics');
    setHeaderCaseInsensitive(headers, 'Permissions-Policy', DEFAULT_PERMISSIONS_POLICY);
    done({ headers });
  }

  done({});
} catch (error) {
  console.log('uBO privacy sandbox script failed:', error && error.message ? error.message : String(error));
  done({});
}
