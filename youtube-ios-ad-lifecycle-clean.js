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
    const timestamp = Number(String(state[key] || '').split('|')[0]);
    if (!timestamp || now - timestamp > MAX_AGE_MS) {
      delete state[key];
    }
  }
}

function rememberAdCpn(state, now, cpn) {
  if (cpn) {
    state[`ad:${cpn}`] = now;
  }
}

function rememberMediaCpn(state, now, cpn) {
  if (cpn) {
    state[`media:${cpn}`] = now;
  }
}

function isAdCpn(state, cpn) {
  return Boolean(cpn && (state[`ad:${cpn}`] || state[cpn]));
}

function hasMediaStarted(state, cpn) {
  return Boolean(cpn && state[`media:${cpn}`]);
}

function rememberInitCpn(state, now, id, cpn) {
  if (!id || !cpn || id === '000000000000266a') {
    return '';
  }
  const key = `init:${id}`;
  const raw = String(state[key] || '');
  const prior = raw.includes('|') ? raw.slice(raw.indexOf('|') + 1) : '';
  if (!prior) {
    state[key] = `${now}|${cpn}`;
  }
  return prior;
}

function isSecondInitCpn(state, id, cpn) {
  if (!id || !cpn || id === '000000000000266a') {
    return false;
  }
  const raw = String(state[`init:${id}`] || '');
  const prior = raw.includes('|') ? raw.slice(raw.indexOf('|') + 1) : '';
  return Boolean(prior && prior !== cpn);
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

function emptyMedia(reason) {
  console.log(`uBO youtube iOS ad lifecycle: ${reason}`);
  done({
    response: {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.yt-ump',
        'Cache-Control': 'no-store',
      },
      body: '',
    },
  });
}

const STORE_KEY = 'uBOYouTubeIOSAdCpns';
const MAX_AGE_MS = 120000;
const store = getStore();

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);
  const phase = String(typeof $argument === 'string' ? $argument : '');
  const now = Date.now();
  const state = readState();
  pruneState(state, now);

  if (phase === 'stats' || phase === 'adstats') {
    const cpn = queryValue(urlInfo.query, 'cpn');
    const hostCpn = queryValue(urlInfo.query, 'host_cpn');
    rememberAdCpn(state, now, cpn);
    rememberAdCpn(state, now, hostCpn);
    writeState(state);
    noContent(cpn ? `stored ad cpn=${cpn}` : 'ads stats');
  } else if (phase === 'initplayback') {
    const cpn = queryValue(urlInfo.query, 'cpn');
    const id = queryValue(urlInfo.query, 'id');
    const duplicateInitCpn = isSecondInitCpn(state, id, cpn);
    rememberInitCpn(state, now, id, cpn);
    if (id === '000000000000266a') {
      writeState(state);
      noContent('blocked ad sentinel initplayback');
    } else if (duplicateInitCpn) {
      rememberAdCpn(state, now, cpn);
      writeState(state);
      noContent(`blocked duplicate ad initplayback cpn=${cpn}`);
    } else if (isAdCpn(state, cpn) && !hasMediaStarted(state, cpn)) {
      writeState(state);
      noContent(`blocked ad initplayback cpn=${cpn}`);
    } else {
      writeState(state);
      done({});
    }
  } else if (phase === 'videoplayback') {
    const cpn = queryValue(urlInfo.query, 'cpn');
    writeState(state);
    if (isAdCpn(state, cpn) && !hasMediaStarted(state, cpn)) {
      emptyMedia(`emptied ad videoplayback cpn=${cpn}`);
    } else {
      rememberMediaCpn(state, now, cpn);
      writeState(state);
      done({});
    }
  } else {
    done({});
  }
} catch (error) {
  console.log('uBO youtube iOS ad lifecycle failed:', error && error.message ? error.message : String(error));
  done({});
}
