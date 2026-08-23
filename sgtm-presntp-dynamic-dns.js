/**
 * Surge DNS script + cron refresher for sgtm.presntp.uk.
 *
 * DNS mode: return the last tested low-latency IP set.
 * Cron mode: resolve the hostname, query ping.pe from China, Lishui, China Unicom
 * (CN_113), and persist a temporary low-latency IP set for the next DNS lookup.
 */
const CONFIG = {
  host: 'sgtm.presntp.uk',
  stateKey: 'sgtm.presntp.uk.dynamic-dns.v1',
  dnsUrl: 'https://dns.google/resolve?name=sgtm.presntp.uk&type=A',
  pingPage: 'https://ping.pe/',
  pingNode: 'CN_113', // China, Lishui / China Unicom
  refreshSeconds: 1800,
  stateMaxAgeSeconds: 2100,
  maxKeep: 3,
  maxLatencyMs: 180,
  maxExtraLatencyMs: 100,
  pingTimeoutMs: 9000,
};

function readState() {
  try {
    return JSON.parse($persistentStore.read(CONFIG.stateKey) || '{}');
  } catch (_) {
    return {};
  }
}

function writeState(state) {
  $persistentStore.write(JSON.stringify(state), CONFIG.stateKey);
}

function doneDns(addresses) {
  const result = Array.isArray(addresses) && addresses.length ? addresses : undefined;
  // Never return an empty DNS-script result: Surge treats that as illegal.
  // The fallback resolver keeps the hostname usable until the first cron refresh.
  $done(result ? { addresses: result, ttl: 60 } : { server: '223.5.5.5' });
}

function listARecords(payload) {
  if (!payload || !Array.isArray(payload.Answer)) return [];
  return payload.Answer
    .filter((item) => item && item.type === 1)
    .map((item) => String(item.data || '').trim())
    .filter((ip) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip));
}

function httpGet(url, callback) {
  httpGetWithHeaders(url, {}, callback);
}

function httpGetWithHeaders(url, headers, callback) {
  $httpClient.get({ url, headers, timeout: 10 }, (error, response, body) => {
    if (error || !response || response.status < 200 || response.status >= 300) {
      callback(error || new Error(`HTTP ${response ? response.status : 0}`));
      return;
    }
    callback(null, body || '');
  });
}

function httpPost(url, body, headers, callback) {
  $httpClient.post({ url, body, headers, timeout: 10 }, (error, response, text) => {
    if (error || !response || response.status < 200 || response.status >= 300) {
      callback(error || new Error(`HTTP ${response ? response.status : 0}`));
      return;
    }
    callback(null, text || '');
  });
}

function resolveCandidates(callback) {
  httpGet(CONFIG.dnsUrl, (error, body) => {
    if (error) return callback(error);
    try {
      const ips = listARecords(JSON.parse(body));
      if (!ips.length) return callback(new Error('no A records'));
      callback(null, ips);
    } catch (parseError) {
      callback(parseError);
    }
  });
}

function firstMatch(text, regex) {
  const match = String(text || '').match(regex);
  return match ? match[1] : '';
}

function pingOne(ip, antiflood, callback) {
  const pageUrl = `${CONFIG.pingPage}${ip}?browsercheck=ok`;
  const browserHeaders = {
    Cookie: `antiflood=${antiflood}`,
    Referer: CONFIG.pingPage,
    'User-Agent': 'Mozilla/5.0',
  };
  httpGetWithHeaders(pageUrl, browserHeaders, (pageError, html) => {
    if (pageError) return callback(pageError);
    const token = firstMatch(html, /var taskStartToken\s*=\s*"([^"]+)"/);
    if (!token) return callback(new Error('ping.pe start token missing'));

    const headers = {
      Origin: 'https://ping.pe',
      Referer: pageUrl,
      Cookie: `antiflood=${antiflood}`,
      'User-Agent': 'Mozilla/5.0',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    };
    const form = `query=${encodeURIComponent(ip)}&interval_s=5&dense_mode=0&start_token=${encodeURIComponent(token)}`;
    httpPost('https://ping.pe/ajax_startTask_v1.php', form, headers, (startError, startText) => {
      if (startError) return callback(startError);
      let start;
      try {
        start = JSON.parse(startText);
      } catch (parseError) {
        return callback(parseError);
      }
      const streamId = start && start.data && start.data.stream_id;
      const mtrStreamId = start && start.data && start.data.stream_id_mtr;
      if (!streamId) return callback(new Error((start && start.error) || 'ping.pe task failed'));
      let completed = false;
      const finish = (error, latencyMs) => {
        if (completed) return;
        completed = true;
        httpGet(`https://ping.pe/ajax_stopTask.php?stream_id=${encodeURIComponent(streamId)}`, () => {});
        if (mtrStreamId) {
          httpGet(`https://ping.pe/ajax_stopTask.php?stream_id=${encodeURIComponent(mtrStreamId)}`, () => {});
        }
        callback(error, latencyMs);
      };

      const deadline = Date.now() + CONFIG.pingTimeoutMs;
      const poll = () => {
        httpGet(`https://ping.pe/ajax_getPingResults_v2.php?stream_id=${encodeURIComponent(streamId)}`, (pollError, pollText) => {
          if (pollError) return finish(pollError);
          let payload;
          try {
            payload = JSON.parse(pollText);
          } catch (parseError) {
            return finish(parseError);
          }
          const item = (payload.data || []).find((entry) => entry && entry.node_id === CONFIG.pingNode);
          if (item && Number(item.result) > 0) {
            finish(null, Number(item.result) / 1000);
            return;
          }
          if (Date.now() >= deadline) {
            finish(new Error('ping.pe node timeout'));
            return;
          }
          setTimeout(poll, 1200);
        });
      };
      poll();
    });
  });
}

function pingAll(ips, antiflood, callback) {
  const results = [];
  let cursor = 0;
  let active = 0;
  const concurrency = 4;
  if (!ips.length) return callback(results);

  const launch = () => {
    while (active < concurrency && cursor < ips.length) {
      const ip = ips[cursor];
      cursor += 1;
      active += 1;
    pingOne(ip, antiflood, (error, latencyMs) => {
      if (!error && Number.isFinite(latencyMs)) {
        results.push({ ip, latencyMs });
      } else {
        console.log(`sgtm DNS refresh: ${ip} probe failed: ${error ? error.message : 'invalid latency'}`);
      }
        active -= 1;
        if (cursor >= ips.length && active === 0) {
          callback(results);
          return;
        }
        launch();
    });
    }
  };
  launch();
}

function selectLowLatency(results) {
  const sorted = results.slice().sort((a, b) => a.latencyMs - b.latencyMs);
  if (!sorted.length) return [];
  const fastest = sorted[0].latencyMs;
  return sorted
    .filter((item) => item.latencyMs <= CONFIG.maxLatencyMs && item.latencyMs <= fastest + CONFIG.maxExtraLatencyMs)
    .slice(0, CONFIG.maxKeep)
    .map((item) => item.ip);
}

function refresh() {
  resolveCandidates((resolveError, ips) => {
    if (resolveError) {
      console.log(`sgtm DNS refresh: resolve failed: ${resolveError.message}`);
      $done();
      return;
    }
    httpGet(CONFIG.pingPage, (cookieError, landingPage) => {
      const antiflood = firstMatch(landingPage, /antiflood=([a-f0-9]+)/);
      if (cookieError || !antiflood) {
        console.log(`sgtm DNS refresh: ping.pe session failed: ${cookieError ? cookieError.message : 'cookie missing'}`);
        $done();
        return;
      }
      pingAll(ips, antiflood, (results) => {
        const selected = selectLowLatency(results);
        const usable = selected.length
          ? selected
          : results.sort((a, b) => a.latencyMs - b.latencyMs).slice(0, 1).map((item) => item.ip);
        if (!usable.length) {
          console.log('sgtm DNS refresh: all latency probes failed; keeping previous state');
          $done();
          return;
        }
        const state = {
          updatedAt: Date.now(),
          candidates: ips,
          results,
          addresses: usable,
        };
        writeState(state);
        console.log(`sgtm DNS refresh: ${JSON.stringify(results)} => ${usable.join(',')}`);
        $done();
      });
    });
  });
}

const state = readState();
const age = (Date.now() - Number(state.updatedAt || 0)) / 1000;
const argument = typeof $argument === 'undefined' ? '' : String($argument || '');
if (typeof $domain === 'undefined' && !argument.includes('mode=cron')) {
  // surge-cli script evaluate has no DNS context; keep it a harmless syntax smoke test.
  $done({});
}
const mode = argument.includes('mode=cron') ? 'cron' : 'dns';

if (mode === 'cron') {
  refresh();
} else if (String($domain || '').toLowerCase() !== CONFIG.host) {
  $done({ server: '223.5.5.5' });
} else if (Array.isArray(state.addresses) && state.addresses.length && age <= CONFIG.stateMaxAgeSeconds) {
  doneDns(state.addresses);
} else {
  // Do not block normal DNS resolution on a remote monitoring service.
  // The cron job will populate the tested set; this fallback keeps the host reachable.
  doneDns(Array.isArray(state.candidates) ? state.candidates : undefined);
}
