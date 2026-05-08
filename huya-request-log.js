function done(payload) {
  $done(payload || {});
}

function parseArgs(text) {
  const out = {};
  const source = String(text || '');
  for (const part of source.split('&')) {
    if (!part) {
      continue;
    }
    const index = part.indexOf('=');
    const key = index === -1 ? part : part.slice(0, index);
    const value = index === -1 ? '' : part.slice(index + 1);
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch (error) {
      out[key] = value;
    }
  }
  return out;
}

function cloneHeaders(headers) {
  const out = {};
  if (headers && typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      out[key] = redactHeader(key, headers[key]);
    }
  }
  return out;
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

function parseUrl(url) {
  const match = String(url || '').match(/^(https?):\/\/([^/?#:]+)([^?#]*)(?:\?([^#]*))?/i);
  if (!match) {
    return { scheme: '', host: '', path: '', query: '' };
  }
  return {
    scheme: match[1].toLowerCase(),
    host: match[2].toLowerCase(),
    path: match[3] || '/',
    query: match[4] || '',
  };
}

const SENSITIVE_HEADER_RE = /^(?:authorization|cookie|set-cookie|x-token|x-auth|proxy-authorization)$/i;
const SENSITIVE_KEY_RE = /^(?:qimei|qimei36|taid|td|idfa|imei|oaid|androidid|duid|guid|iv|dckey|rsa|sc|sr|openid|open_id|session|sessionid|device_id|deviceid|idfv|access_token|refresh_token|x-signature|signature)$/i;
const SENSITIVE_QUERY_RE = /([?&](?:qimei|qimei36|taid|td|idfa|imei|oaid|androidid|duid|guid|iv|dckey|rsa|sc|sr|openid|open_id|session|sessionid|device_id|deviceid|idfv|access_token|refresh_token|x-signature|signature|lk3s)=)[^&#]*/ig;

function redactHeader(name, value) {
  if (SENSITIVE_HEADER_RE.test(String(name || ''))) {
    return '<redacted>';
  }
  return redactText(String(value || ''));
}

function redactJson(value) {
  if (Array.isArray(value)) {
    return value.map(redactJson);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '<redacted>';
      } else {
        out[key] = redactJson(value[key]);
      }
    }
    return out;
  }
  if (typeof value === 'string') {
    return redactText(value);
  }
  return value;
}

function redactText(text) {
  return String(text || '')
    .replace(SENSITIVE_QUERY_RE, '$1<redacted>')
    .replace(/("(?:qimei|qimei36|taid|td|idfa|imei|oaid|androidid|duid|guid|iv|dckey|rsa|sc|sr|openid|open_id|session|sessionid|device_id|deviceid|idfv|access_token|refresh_token|x-signature|signature)"\s*:\s*")[^"]*(")/ig, '$1<redacted>$2')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/ig, '<uuid>');
}

function makePreview(body, limit) {
  const text = bodyToText(body);
  if (!text) {
    return { text: '', bytes: 0, truncated: false };
  }
  let redacted = '';
  try {
    redacted = JSON.stringify(redactJson(JSON.parse(text)));
  } catch (error) {
    redacted = redactText(text);
  }
  const truncated = redacted.length > limit;
  return {
    text: truncated ? redacted.slice(0, limit) : redacted,
    bytes: text.length,
    truncated,
  };
}

function extractHints(text) {
  const source = String(text || '');
  const hints = {};
  const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keys = [
    'pid',
    'aid',
    'traceid',
    'templateId',
    'template_id',
    'posid',
    'pos_scene',
    'error_code',
    'ad_type',
    'splashPreloadGap',
  ];
  for (const key of keys) {
    const safeKey = escapeRegExp(key);
    const match = new RegExp(`"${safeKey}"\\s*:\\s*"?([^,"}\\s]+)`, 'i').exec(source)
      || new RegExp(`[?&]${safeKey}=([^&#\\s]+)`, 'i').exec(source)
      || new RegExp(`(?:^|[&\\s])${safeKey}=([^&\\s]+)`, 'i').exec(source);
    if (match) {
      hints[key] = redactText(match[1]).replace(/^"|"$/g, '');
    }
  }
  if (/GDTTangramSplash|splash|LaunchAlert|adsmind|pgdt|pangle|pangolin|csj/i.test(source)) {
    hints.hasAdMarkers = true;
  }
  return hints;
}

function makeId(record) {
  const source = [
    record.createdAt,
    record.phase,
    record.method,
    record.url,
    record.status || '',
    record.requestBodyPreview || '',
    record.responseBodyPreview || '',
  ].join('|');
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return `${Date.now().toString(36)}-${Math.abs(hash).toString(36)}`;
}

function currentRequest() {
  return typeof $request !== 'undefined' && $request ? $request : {};
}

function currentResponse() {
  return typeof $response !== 'undefined' && $response ? $response : null;
}

function buildRecord(args) {
  const request = currentRequest();
  const response = currentResponse();
  const requestPreview = makePreview(request.body, Number(args.bodyLimit || 12000));
  const responsePreview = makePreview(response && response.body, Number(args.bodyLimit || 12000));
  const url = String(request.url || '');
  const parsed = parseUrl(url);
  const status = response && response.status ? Number(response.status) : undefined;
  const hintText = `${url}\n${requestPreview.text}\n${responsePreview.text}`;
  const record = {
    schema: 1,
    token: args.token || '',
    createdAt: new Date().toISOString(),
    phase: args.phase || (status ? 'response' : 'request'),
    method: String(request.method || ''),
    url: redactText(url),
    host: parsed.host,
    path: parsed.path,
    status,
    requestHeaders: cloneHeaders(request.headers),
    responseHeaders: cloneHeaders(response && response.headers),
    requestBodyPreview: requestPreview.text,
    requestBodyBytes: requestPreview.bytes,
    requestBodyTruncated: requestPreview.truncated,
    responseBodyPreview: responsePreview.text,
    responseBodyBytes: responsePreview.bytes,
    responseBodyTruncated: responsePreview.truncated,
    hints: extractHints(hintText),
  };
  record.id = makeId(record);
  return record;
}

function sendRecord(record, collectors, timeoutMs) {
  if (!collectors.length || typeof $httpClient === 'undefined') {
    done({});
    return;
  }

  let pending = collectors.length;
  let finished = false;
  const body = JSON.stringify(record);
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    done({});
  };
  const timer = typeof setTimeout === 'function' ? setTimeout(finish, timeoutMs) : null;
  for (const collector of collectors) {
    $httpClient.post({
      url: collector,
      headers: {
        'Content-Type': 'application/json',
        'X-Huya-Capture-Token': record.token,
      },
      body,
    }, function () {
      pending -= 1;
      if (pending <= 0) {
        if (timer && typeof clearTimeout === 'function') {
          clearTimeout(timer);
        }
        finish();
      }
    });
  }
}

try {
  const args = parseArgs(typeof $argument === 'string' ? $argument : '');
  const collectors = String(args.collectors || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  sendRecord(buildRecord(args), collectors, Number(args.timeoutMs || 900));
} catch (error) {
  done({});
}
