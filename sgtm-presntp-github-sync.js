#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const C = {
  host: 'sgtm.presntp.uk',
  dns: 'https://dns.google/resolve?name=sgtm.presntp.uk&type=A',
  page: 'https://ping.pe/',
  node: 'CN_113',
  repo: process.env.SGTM_REPO || '/Users/aa/Documents/ubl-sync',
  branch: process.env.SGTM_BRANCH || 'ios',
  output: process.env.SGTM_OUTPUT || 'sgtm-presntp-host.sgmodule',
  interval: 30 * 60 * 1000,
};

const log = (s) => console.log('[' + new Date().toISOString() + '] ' + s);

async function request(url, options) {
  const response = await fetch(url, { headers: { 'User-Agent': 'sgtm-local-sync/1.0' }, ...(options || {}) });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + url);
  return response;
}

async function candidates() {
  const payload = await (await request(C.dns)).json();
  const ips = (payload.Answer || []).filter((x) => x && x.type === 1).map((x) => String(x.data || '').trim()).filter((x) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(x));
  if (!ips.length) throw new Error('DNS returned no A records');
  return [...new Set(ips)];
}

function cookie(response, html) {
  const list = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  const found = list.map((x) => x.match(/antiflood=([^;]+)/)).find(Boolean);
  return (found && found[1]) || ((html.match(/antiflood=([a-f0-9]+)/) || [])[1] || '');
}

async function ping(ip, flood) {
  const pageUrl = C.page + ip + '?browsercheck=ok';
  const page = await request(pageUrl, { headers: { Cookie: 'antiflood=' + flood, Referer: C.page } });
  const html = await page.text();
  const token = (html.match(/var taskStartToken\s*=\s*["']([^"']+)["']/) || [])[1] || '';
  if (!token) throw new Error('ping.pe task token missing for ' + ip);
  const headers = { Cookie: 'antiflood=' + flood, Referer: pageUrl, Origin: C.page.slice(0, -1), 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };
  const body = new URLSearchParams({ query: ip, interval_s: '5', dense_mode: '0', start_token: token });
  const start = await (await request('https://ping.pe/ajax_startTask_v1.php', { method: 'POST', headers, body })).json();
  const stream = start && start.data && start.data.stream_id;
  if (!stream) throw new Error((start && start.error) || 'ping task failed');
  const deadline = Date.now() + 9000;
  try {
    while (Date.now() < deadline) {
      const data = await (await request('https://ping.pe/ajax_getPingResults_v2.php?stream_id=' + encodeURIComponent(stream), { headers })).json();
      const row = (data.data || []).find((x) => x && x.node_id === C.node);
      if (row && Number(row.result) > 0) return Number(row.result) / 1000;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  } finally {
    fetch('https://ping.pe/ajax_stopTask.php?stream_id=' + encodeURIComponent(stream), { headers }).catch(() => {});
  }
  throw new Error('ping node timeout');
}

async function measure(ips) {
  const landing = await request(C.page);
  const html = await landing.text();
  const flood = cookie(landing, html);
  if (!flood) throw new Error('ping.pe antiflood cookie missing');
  const output = [];
  for (let i = 0; i < ips.length; i += 3) {
    const batch = await Promise.all(ips.slice(i, i + 3).map(async (ip) => {
      try { return { ip, latencyMs: await ping(ip, flood) }; }
      catch (e) { log(ip + ' failed: ' + e.message); return null; }
    }));
    output.push(...batch.filter(Boolean));
  }
  return output;
}

function select(results) {
  const sorted = results.slice().sort((a, b) => a.latencyMs - b.latencyMs);
  if (!sorted.length) throw new Error('all probes failed');
  const fastest = sorted[0].latencyMs;
  const selected = sorted.filter((x) => x.latencyMs <= 180 && x.latencyMs <= fastest + 100).slice(0, 3).map((x) => x.ip);
  return selected.length ? selected : [sorted[0].ip];
}

function moduleText(addresses, results) {
  return ['#!name=SGTM PRESNTP Dynamic Host', '#!desc=本地服务每30分钟通过 ping.pe 丽水联通 CN_113 测速后更新。', '#!system=mac', '#!update-interval=1800', '', '[General]', 'use-local-host-item-for-proxy = true', 'always-real-ip = %APPEND% ' + C.host, '', '[Host]', C.host + ' = ' + addresses.join(', '), '', '# updated=' + new Date().toISOString(), '# results=' + JSON.stringify(results), ''].join('\n');
}

function publish(text) {
  const file = path.join(C.repo, C.output);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return log('unchanged; skip push');
  fs.writeFileSync(file, text);
  execFileSync('git', ['add', '--', C.output], { cwd: C.repo, stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', 'Update SGTM low-latency host addresses'], { cwd: C.repo, stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', C.branch], { cwd: C.repo, stdio: 'inherit' });
  log('published ' + C.output + ' to origin/' + C.branch);
}

async function once() {
  const ips = await candidates();
  log('candidates: ' + ips.join(', '));
  const results = await measure(ips);
  const selected = select(results);
  log('selected: ' + selected.join(', ') + ' results=' + JSON.stringify(results));
  const text = moduleText(selected, results);
  if (process.argv.includes('--no-push')) fs.writeFileSync(path.join(C.repo, C.output), text);
  else publish(text);
}

(async () => {
  do {
    try { await once(); } catch (e) { log('ERROR: ' + (e.stack || e.message)); }
    if (process.argv.includes('--once')) break;
    await new Promise((resolve) => setTimeout(resolve, C.interval));
  } while (true);
})();
