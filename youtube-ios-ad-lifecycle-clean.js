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

function hasQueryFlag(query, key) {
  return new RegExp(`(?:^|&)${key}(?:=|&|$)`).test(String(query || ''));
}

function isColdStartAdRedirect(urlInfo) {
  if (urlInfo.host !== 'redirector.googlevideo.com') {
    return false;
  }
  if (queryValue(urlInfo.query, 'id') === '000000000000266a') {
    return false;
  }
  if (!queryValue(urlInfo.query, 'cpn')) {
    return false;
  }
  return queryValue(urlInfo.query, 'rn') === '1'
    && queryValue(urlInfo.query, 'opr') === '1'
    && queryValue(urlInfo.query, 'ack') === '1'
    && (
      queryValue(urlInfo.query, 'por') === '1'
      || hasQueryFlag(urlInfo.query, 'oad')
      || hasQueryFlag(urlInfo.query, 'oaad')
      || hasQueryFlag(urlInfo.query, 'oavd')
    );
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
    if (!state[key] || now - Number(state[key]) > MAX_AGE_MS) {
      delete state[key];
    }
  }
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
const store = getStore();

try {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const urlInfo = parseUrl(request.url);
  const phase = String(typeof $argument === 'string' ? $argument : '');
  const now = Date.now();
  const state = readState();
  pruneState(state, now);

  if (phase === 'stats') {
    const cpn = queryValue(urlInfo.query, 'cpn');
    if (cpn) {
      state[cpn] = now;
      writeState(state);
    }
    noContent(cpn ? `stored ad cpn=${cpn}` : 'ads stats');
  } else if (phase === 'initplayback') {
    const cpn = queryValue(urlInfo.query, 'cpn');
    const id = queryValue(urlInfo.query, 'id');
    writeState(state);
    if (id === '000000000000266a') {
      noContent('blocked ad sentinel initplayback');
    } else if (isColdStartAdRedirect(urlInfo)) {
      if (cpn) {
        state[cpn] = now;
        writeState(state);
      }
      noContent(`blocked cold-start ad redirect cpn=${cpn || 'unknown'}`);
    } else if (cpn && state[cpn]) {
      noContent(`blocked ad initplayback cpn=${cpn}`);
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
