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

function decodeURIComponentSafe(text) {
  try {
    return decodeURIComponent(String(text || '').replace(/\+/g, ' '));
  } catch (error) {
    return String(text || '');
  }
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

function isHuaxiaozhuGdtBody(body) {
  const text = bodyToText(body);
  if (/com\.huaxiaozhu\.rider|c_pkgname=|appid=1210818176|posid=8156967880562298/i.test(text)) {
    return /com\.huaxiaozhu\.rider|appid=1210818176|posid=8156967880562298/i.test(text);
  }
  const decoded = decodeURIComponentSafe(text);
  return /com\.huaxiaozhu\.rider|"appid"\s*:\s*"1210818176"|posid=8156967880562298/i.test(decoded);
}

function isHuaxiaozhuGdtEndpoint(urlInfo) {
  return urlInfo.host === 'mi.gdt.qq.com' && urlInfo.path === '/server_bidding2';
}

function isGdtLaunchEndpoint(urlInfo) {
  return urlInfo.host === 'sdk.e.qq.com' && urlInfo.path === '/launch';
}

function isHuaxiaozhuMarkerEndpoint(urlInfo) {
  return urlInfo.host === 'omgup.hongyibo.com.cn' && (
    urlInfo.path === '/syncconfig/ios/com.huaxiaozhu.rider' ||
    urlInfo.path === '/api/realtime/stat/ios'
  );
}

function extractParam(text, key) {
  const match = new RegExp(`(?:^|&)${key}=([^&]*)`).exec(String(text || ''));
  return match ? decodeURIComponentSafe(match[1]) : '';
}

function extractGdtSlotId(body, payload) {
  const bodyText = bodyToText(body);
  const posid = extractParam(bodyText, 'posid');
  if (posid) {
    return posid;
  }
  const data = payload && payload.data;
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length !== 0) {
      return keys[0];
    }
  }
  return '8156967880562298';
}

const DEFAULT_GDT_SLOT_META = {
  cfg: {
    playcfg: {},
    playmod: 1,
  },
  ctrl_config: {
    app: {
      acr_cfg: '{"1":0,"2":4,"3":1,"4":1,"n":6,"t":4}',
    },
  },
  dr: 0,
  is_encrypted: 0,
};

function clonePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = value[key];
  }
  return out;
}

function buildNoAdSlot(originalSlot) {
  const slot = {};
  const cfg = clonePlainObject(originalSlot && originalSlot.cfg) || DEFAULT_GDT_SLOT_META.cfg;
  const ctrlConfig = clonePlainObject(originalSlot && originalSlot.ctrl_config) || DEFAULT_GDT_SLOT_META.ctrl_config;

  slot.cfg = cfg;
  slot.ctrl_config = ctrlConfig;
  slot.dr = originalSlot && originalSlot.dr !== undefined ? originalSlot.dr : DEFAULT_GDT_SLOT_META.dr;
  slot.is_encrypted = originalSlot && originalSlot.is_encrypted !== undefined
    ? originalSlot.is_encrypted
    : DEFAULT_GDT_SLOT_META.is_encrypted;
  slot.list = [];
  slot.msg = '';
  slot.ret = 0;
  return slot;
}

function buildNoFillGdtPayload(body, originalPayload) {
  const slotId = extractGdtSlotId(body, originalPayload);
  const payload = {
    ret: 0,
    msg: '',
    data: {},
    ip_ping_url: '',
    last_ads: {},
    reqinterval: 1,
  };
  if (originalPayload && originalPayload.seq !== undefined) {
    payload.seq = originalPayload.seq;
  }
  const originalSlot = originalPayload && originalPayload.data && originalPayload.data[slotId];
  payload.data[slotId] = buildNoAdSlot(originalSlot);
  return payload;
}

function buildNoFillHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'Content-Type', 'text/json; charset=utf-8');
  setHeaderCaseInsensitive(headers, 'X-uBO-Huaxiaozhu', marker);
  return headers;
}

function buildNoContentHeaders(baseHeaders, marker) {
  const headers = cloneHeaders(baseHeaders);
  deleteHeaderCaseInsensitive(headers, 'Content-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Length');
  deleteHeaderCaseInsensitive(headers, 'Transfer-Encoding');
  deleteHeaderCaseInsensitive(headers, 'Content-Type');
  setHeaderCaseInsensitive(headers, 'Cache-Control', 'no-store');
  setHeaderCaseInsensitive(headers, 'Pragma', 'no-cache');
  setHeaderCaseInsensitive(headers, 'Expires', '0');
  setHeaderCaseInsensitive(headers, 'X-uBO-Huaxiaozhu', marker);
  return headers;
}

const APP_MARKER_KEY = 'ubo.huaxiaozhu.recent';
const APP_MARKER_TTL_MS = 20000;
const APP_KNOWN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function nowMs() {
  return Date.now ? Date.now() : new Date().getTime();
}

function hasPersistentStore() {
  return typeof $persistentStore === 'object' &&
    $persistentStore !== null &&
    typeof $persistentStore.read === 'function' &&
    typeof $persistentStore.write === 'function';
}

function markHuaxiaozhuApp(reason) {
  if (!hasPersistentStore()) {
    return;
  }
  $persistentStore.write(String(nowMs()), APP_MARKER_KEY);
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
}

function hasRecentHuaxiaozhuMarker() {
  if (!hasPersistentStore()) {
    return false;
  }
  const value = Number($persistentStore.read(APP_MARKER_KEY) || 0);
  return Number.isFinite(value) && value > 0 && nowMs() - value < APP_MARKER_TTL_MS;
}

function hasKnownHuaxiaozhuApp() {
  if (!hasPersistentStore()) {
    return false;
  }
  const value = Number($persistentStore.read(APP_MARKER_KEY) || 0);
  return Number.isFinite(value) && value > 0 && nowMs() - value < APP_KNOWN_TTL_MS;
}

function finishJson(reason, value) {
  const headers = buildNoFillHeaders($response && $response.headers, 'gdt-response-nofill-1');
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
  done({
    status: 200,
    headers,
    body: JSON.stringify(value),
  });
}

function finishNoContent(reason, marker) {
  const headers = buildNoContentHeaders($response && $response.headers, marker);
  console.log(`uBO Huaxiaozhu ad clean: ${reason}`);
  done({
    status: 204,
    headers,
    body: '',
  });
}

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);
  const argument = typeof $argument === 'string' ? $argument : '';
  let handled = false;

  if (/(?:^|&)phase=app-marker(?:&|$)/.test(argument)) {
    if (
      isHuaxiaozhuMarkerEndpoint(urlInfo) &&
      (
        urlInfo.path === '/syncconfig/ios/com.huaxiaozhu.rider' ||
        /com\.huaxiaozhu\.rider|DSplashViewController|kf-passenger-app/i.test(bodyToText(request.body))
      )
    ) {
      markHuaxiaozhuApp('Huaxiaozhu app marker refreshed');
    }
    done({});
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=gdt-request(?:&|$)/.test(argument) &&
    isHuaxiaozhuGdtEndpoint(urlInfo)
  ) {
    if (isHuaxiaozhuGdtBody(request.body)) {
      markHuaxiaozhuApp('Huaxiaozhu GDT bidding marker refreshed');
    }
    done({});
    handled = true;
  }

  if (
    handled === false &&
    /(?:^|&)phase=gdt-launch(?:&|$)/.test(argument) &&
    isGdtLaunchEndpoint(urlInfo)
  ) {
    if (hasKnownHuaxiaozhuApp()) {
      finishNoContent('Tencent GDT Huaxiaozhu launch response suppressed by known app marker', 'gdt-launch-known-1');
    } else {
      done({});
    }
    handled = true;
  }

  if (
    handled === false &&
    isHuaxiaozhuGdtEndpoint(urlInfo) &&
    (isHuaxiaozhuGdtBody(request.body) || hasRecentHuaxiaozhuMarker())
  ) {
    markHuaxiaozhuApp('Huaxiaozhu GDT bidding marker refreshed');
    const response = typeof $response === 'object' && $response !== null ? $response : {};
    const text = bodyToText(response.body);
    const payload = JSON.parse(text);
    finishJson(
      'Tencent GDT Huaxiaozhu bidding response replaced with no-fill',
      buildNoFillGdtPayload(request.body, payload)
    );
    handled = true;
  }

  if (handled === false) {
    done({});
  }
} catch (error) {
  console.log('uBO Huaxiaozhu ad clean failed:', error && error.message ? error.message : String(error));
  done({});
}
