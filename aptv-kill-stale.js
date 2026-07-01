const DEFAULTS = {
  host: 'o11.163189.xyz',
  path: '/stream/tvb/fct4k/',
  domain: '163189.xyz',
  pathPrefixes: '/stream/,/api/,/163189/',
  extensions: 'm3u8,ts,m4s,mp4,jpg,jpeg,aac,mp3,key',
  stale: 5,
  maxAge: 10,
  activeWindow: 30,
};

function parseArgument(input) {
  const args = Object.assign({}, DEFAULTS);
  String(input || '')
    .split('&')
    .filter(Boolean)
    .forEach((part) => {
      const pos = part.indexOf('=');
      const key = decodeURIComponent(pos >= 0 ? part.slice(0, pos) : part);
      const value = decodeURIComponent(pos >= 0 ? part.slice(pos + 1) : '');
      if (key) args[key] = value;
    });

  args.stale = Math.max(1, Number(args.stale) || DEFAULTS.stale);
  args.maxAge = Math.max(args.stale + 1, Number(args.maxAge) || DEFAULTS.maxAge);
  args.activeWindow = Math.max(args.stale + 1, Number(args.activeWindow) || DEFAULTS.activeWindow);
  args.always = String(args.always || '') === '1';
  args.pathPrefixes = splitList(args.pathPrefixes || DEFAULTS.pathPrefixes);
  args.extensions = splitList(args.extensions || DEFAULTS.extensions);
  return args;
}

function splitList(input) {
  return String(input || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requestList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.requests)) return payload.requests;
  if (Array.isArray(payload.active)) return payload.active;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.result)) return payload.result;
  return [];
}

function requestUrl(item) {
  return String(item.url || item.URL || item.requestURL || item.requestUrl || item.resource || '');
}

function parseRequestUrl(raw) {
  try {
    return new URL(raw);
  } catch (_) {
    return null;
  }
}

function hostMatches(hostname, domain) {
  const host = String(hostname || '').toLowerCase();
  const suffix = String(domain || '').toLowerCase();
  return host === suffix || host.endsWith(`.${suffix}`);
}

function pathHasMediaExtension(pathname, extensions) {
  const cleanPath = String(pathname || '').toLowerCase();
  const lastPart = cleanPath.slice(cleanPath.lastIndexOf('/') + 1);
  return extensions.some((ext) => lastPart.endsWith(`.${ext.toLowerCase()}`));
}

function isStreamUrl(raw, args) {
  if (raw.startsWith(`http://${args.host}:80${args.path}`) || raw.startsWith(`https://${args.host}${args.path}`)) {
    return true;
  }

  const parsed = parseRequestUrl(raw);
  if (!parsed || !hostMatches(parsed.hostname, args.domain)) return false;
  if (args.pathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix))) return true;
  return pathHasMediaExtension(parsed.pathname, args.extensions);
}

function requestId(item) {
  return item.id || item.ID || item.requestId || item.requestID;
}

function requestAgeSeconds(item, now) {
  const durationFields = [
    'duration',
    'durationSeconds',
    'elapsed',
    'elapsedSeconds',
    'activeDuration',
    'timeElapsed',
    'requestDuration',
  ];

  for (let i = 0; i < durationFields.length; i += 1) {
    const value = Number(item[durationFields[i]]);
    if (Number.isFinite(value) && value >= 0) return value > 1000 ? value / 1000 : value;
  }

  const raw = item.startTime || item.startDate || item.createdAt || item.timestamp || item.time;
  if (typeof raw === 'number') {
    const ms = raw > 1000000000000 ? raw : raw * 1000;
    return Math.max(0, (now - ms) / 1000);
  }
  if (typeof raw === 'string') {
    const ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return Math.max(0, (now - ms) / 1000);
  }
  return null;
}

function byteScore(item) {
  const keys = [
    'bytesIn',
    'bytesOut',
    'inBytes',
    'outBytes',
    'uploadBytes',
    'downloadBytes',
    'receivedBytes',
    'sentBytes',
    'rxBytes',
    'txBytes',
    'size',
  ];

  let seen = false;
  const value = keys.reduce((sum, key) => {
    const value = Number(item[key]);
    if (!Number.isFinite(value)) return sum;
    seen = true;
    return sum + value;
  }, 0);

  return seen ? value : null;
}

function loadState() {
  try {
    return JSON.parse($persistentStore.read('aptv.stale.state') || '{}');
  } catch (_) {
    return {};
  }
}

function saveState(state) {
  $persistentStore.write(JSON.stringify(state), 'aptv.stale.state');
}

function finish(message) {
  if (message) console.log(message);
  $done();
}

function saveIdleState() {
  saveState({
    activeUntil: 0,
    requests: {},
  });
}

const args = parseArgument($argument);
const now = Date.now();
const state = loadState();
const requestState = state.requests || {};

if (args.mode === 'mark' || (typeof $request !== 'undefined' && $request.url)) {
  state.activeUntil = now + args.activeWindow * 1000;
  saveState(state);
  $done();
} else if (!args.always && Number(state.activeUntil || 0) < now) {
  $done();
} else {
  $httpAPI('GET', '/v1/requests/active', null, (result) => {
    const active = requestList(result);
    const nextState = {};
    const kills = [];
    let matched = 0;

    active.forEach((item) => {
      const url = requestUrl(item);
      const id = requestId(item);
      if (!id || !isStreamUrl(url, args)) return;
      matched += 1;

      const score = byteScore(item);
      const previous = requestState[id] || {};
      const changed = score !== null && previous.score !== score;
      const lastChangedAt = changed ? now : Number(previous.lastChangedAt || now);
      const firstSeenAt = Number(previous.firstSeenAt || now);
      const idleSeconds = Math.max(0, (now - lastChangedAt) / 1000);
      const reportedAgeSeconds = requestAgeSeconds(item, now);
      const observedAgeSeconds = Math.max(0, (now - firstSeenAt) / 1000);
      const ageSeconds = reportedAgeSeconds === null ? observedAgeSeconds : Math.max(reportedAgeSeconds, observedAgeSeconds);

      nextState[id] = { score, lastChangedAt, firstSeenAt };

      if ((score !== null && idleSeconds >= args.stale) || (ageSeconds !== null && ageSeconds >= args.maxAge)) {
        kills.push({ id, idleSeconds, ageSeconds });
      }
    });

    if (matched === 0) {
      saveIdleState();
      $done();
      return;
    }

    saveState({
      activeUntil: now + args.activeWindow * 1000,
      requests: nextState,
    });

    if (!kills.length) {
      finish(`APTV stale stream killer: checked ${active.length} active request(s), no stale stream.`);
      return;
    }

    let pending = kills.length;
    kills.forEach((target) => {
      $httpAPI('POST', '/v1/requests/kill', { id: target.id }, () => {
        console.log(
          `APTV stale stream killer: killed request ${target.id}, idle=${target.idleSeconds.toFixed(1)}s, age=${
            target.ageSeconds === null ? 'unknown' : target.ageSeconds.toFixed(1) + 's'
          }.`
        );
        pending -= 1;
        if (pending === 0) $done();
      });
    });
  });
}
