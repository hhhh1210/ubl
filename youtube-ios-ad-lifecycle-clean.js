function done(payload) {
  $done(payload || {});
}

function getStore() {
  if (typeof $persistentStore !== 'undefined' && $persistentStore) {
    return {
      read: key => $persistentStore.read(key),
      write: (value, key) => $persistentStore.write(value, key),
    };
  }
  if (typeof $prefs !== 'undefined' && $prefs) {
    return {
      read: key => $prefs.valueForKey(key),
      write: (value, key) => $prefs.setValueForKey(value, key),
    };
  }
  return {
    read: () => '',
    write: () => false,
  };
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

function queryValue(query, key) {
  const match = new RegExp(`(?:^|&)${key}=([^&#]*)`).exec(String(query || ''));
  if (!match) {
    return '';
  }
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch (error) {
    return match[1];
  }
}

function readState() {
  try {
    const raw = store.read(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeState(state) {
  try {
    store.write(JSON.stringify(state), STORE_KEY);
  } catch (error) {
  }
}

function pruneState(state, now) {
  for (const key of Object.keys(state)) {
    if (key.indexOf('__') === 0) {
      continue;
    }
    const timestamp = Number(String(state[key] || '').split('|')[0]);
    if (!timestamp || now - timestamp > MAX_AGE_MS) {
      delete state[key];
    }
  }
}

function rememberAdCpn(state, now, cpn) {
  if (cpn) {
    state[cpn] = now;
    state[`ad:${cpn}`] = now;
  }
}

function isAdCpn(state, cpn) {
  return Boolean(cpn && (state[`ad:${cpn}`] || state[cpn]));
}

function resetSession(state, now) {
  state.__session = {
    openedAt: now,
    updatedAt: now,
    initCount: 0,
    initKeys: {},
  };
}

function currentSession(state, now) {
  const session = state.__session && typeof state.__session === 'object' ? state.__session : null;
  if (!session || !session.openedAt || now - Number(session.updatedAt || session.openedAt) > SESSION_IDLE_MS) {
    resetSession(state, now);
  }
  state.__session.updatedAt = now;
  if (!state.__session.initKeys || typeof state.__session.initKeys !== 'object') {
    state.__session.initKeys = {};
  }
  if (!Number.isFinite(Number(state.__session.initCount))) {
    state.__session.initCount = 0;
  }
  return state.__session;
}

function countInitplayback(state, now, urlInfo, cpn, id) {
  const session = currentSession(state, now);
  if (urlInfo.path !== '/initplayback' || queryValue(urlInfo.query, 'rn') !== '1') {
    return session.initCount;
  }
  const key = id || cpn;
  if (key && !session.initKeys[key]) {
    session.initKeys[key] = now;
    session.initCount = Number(session.initCount || 0) + 1;
  }
  return session.initCount;
}

function inCompatWindow(state) {
  const session = state.__session && typeof state.__session === 'object' ? state.__session : {};
  return Number(session.initCount || 0) <= COMPAT_INITPLAYBACKS;
}

function noContent(reason) {
  console.log(`uBO youtube iOS ad lifecycle: ${reason}`);
  done({
    response: {
      status: 204,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      body: '',
    },
  });
}

const STORE_KEY = 'uBOYouTubeIOSAdCpns';
const MAX_AGE_MS = 120000;
const SESSION_IDLE_MS = 300000;
const COMPAT_INITPLAYBACKS = 3;
const store = getStore();

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);
  const phase = String(typeof $argument === 'string' ? $argument : '');
  const now = Date.now();
  const state = readState();
  pruneState(state, now);

  if (phase === 'session') {
    resetSession(state, now);
    writeState(state);
    done({});
  } else if (phase === 'stats' || phase === 'adstats') {
    const cpn = queryValue(urlInfo.query, 'cpn');
    const hostCpn = queryValue(urlInfo.query, 'host_cpn');
    const adCpn = queryValue(urlInfo.query, 'ad_cpn');
    rememberAdCpn(state, now, cpn);
    rememberAdCpn(state, now, hostCpn);
    rememberAdCpn(state, now, adCpn);
    writeState(state);
    noContent(cpn ? `stored ad cpn=${cpn}` : 'ads stats');
  } else if (phase === 'initplayback') {
    const cpn = queryValue(urlInfo.query, 'cpn');
    const id = queryValue(urlInfo.query, 'id');
    countInitplayback(state, now, urlInfo, cpn, id);
    if (id === '000000000000266a') {
      writeState(state);
      noContent('blocked ad sentinel initplayback');
    } else if (isAdCpn(state, cpn) && inCompatWindow(state)) {
      writeState(state);
      noContent(`compat blocked ad initplayback cpn=${cpn}`);
    } else {
      writeState(state);
      done({});
    }
  } else if (phase === 'videoplayback') {
    const cpn = queryValue(urlInfo.query, 'cpn');
    writeState(state);
    if (isAdCpn(state, cpn)) {
      noContent(`blocked ad videoplayback cpn=${cpn}`);
    } else {
      done({});
    }
  } else {
    done({});
  }
} catch (error) {
  console.log('uBO youtube iOS ad lifecycle failed:', error && error.message ? error.message : String(error));
  done({});
}
