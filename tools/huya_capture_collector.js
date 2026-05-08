#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile, execFileSync } = require('child_process');

const config = {
  host: process.env.HUYA_CAPTURE_HOST || '0.0.0.0',
  port: Number(process.env.HUYA_CAPTURE_PORT || 6177),
  token: process.env.HUYA_CAPTURE_TOKEN || '',
  allowedRemote: process.env.HUYA_CAPTURE_ALLOWED_REMOTE || '192.168.0.102',
  sourceRepo: process.env.HUYA_CAPTURE_SOURCE_REPO || path.resolve(__dirname, '..'),
  worktree: process.env.HUYA_CAPTURE_WORKTREE || path.resolve(os.homedir(), 'Documents/ubl-huya-capture'),
  branch: process.env.HUYA_CAPTURE_BRANCH || 'huya-capture',
  commitIntervalMs: Number(process.env.HUYA_CAPTURE_COMMIT_INTERVAL_MS || 60000),
  maxBodyBytes: Number(process.env.HUYA_CAPTURE_MAX_BODY_BYTES || 512 * 1024),
};

let pendingRecords = 0;
let lastCommitAt = 0;
let pushing = false;
const seenIds = new Set();

function sh(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.cwd || config.sourceRepo,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });
  return output ? String(output).trim() : '';
}

function spawn(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, {
      cwd: options.cwd || config.sourceRepo,
      encoding: 'utf8',
      timeout: options.timeout || 120000,
    }, (error, stdout, stderr) => {
      resolve({ ok: !error, error, stdout, stderr });
    });
  });
}

function ensureWorktree() {
  const gitDir = path.join(config.worktree, '.git');
  if (fs.existsSync(gitDir)) {
    return;
  }

  fs.rmSync(config.worktree, { recursive: true, force: true });
  const branches = sh('git', ['branch', '--list', config.branch], { cwd: config.sourceRepo });
  if (branches) {
    sh('git', ['worktree', 'add', config.worktree, config.branch], { cwd: config.sourceRepo, stdio: 'inherit' });
  } else if (sh('git', ['ls-remote', '--heads', 'origin', config.branch], { cwd: config.sourceRepo })) {
    sh('git', ['fetch', 'origin', `${config.branch}:${config.branch}`], { cwd: config.sourceRepo, stdio: 'inherit' });
    sh('git', ['worktree', 'add', config.worktree, config.branch], { cwd: config.sourceRepo, stdio: 'inherit' });
  } else {
    sh('git', ['worktree', 'add', '-b', config.branch, config.worktree, 'HEAD'], { cwd: config.sourceRepo, stdio: 'inherit' });
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function dayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function logPathFor(record) {
  const day = dayStamp(record.createdAt ? new Date(record.createdAt) : new Date());
  return path.join(config.worktree, 'captures', 'huya', day, 'requests.jsonl');
}

function nowIso() {
  return new Date().toISOString();
}

function stableHash(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16);
}

const SENSITIVE_RE = /(?:cookie|authorization|access[_-]?token|refresh[_-]?token|session|openid|open_id|idfa|idfv|imei|oaid|qimei|qimei36|device[_-]?id|deviceid|duid|guid|dckey|signature|x-signature|lk3s)/i;

function deepRedact(value) {
  if (Array.isArray(value)) {
    return value.map(deepRedact);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = SENSITIVE_RE.test(key) ? '<redacted>' : deepRedact(value[key]);
    }
    return out;
  }
  if (typeof value === 'string') {
    return value
      .replace(/([?&](?:access[_-]?token|refresh[_-]?token|session|openid|open_id|idfa|idfv|imei|oaid|qimei|qimei36|device[_-]?id|deviceid|duid|guid|dckey|signature|x-signature|lk3s)=)[^&#]*/ig, '$1<redacted>')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/ig, '<uuid>');
  }
  return value;
}

function normalizeRecord(body, req) {
  const parsed = JSON.parse(body);
  const record = deepRedact(parsed);
  delete record.token;
  record.receivedAt = nowIso();
  record.collector = {
    schema: 1,
    remoteAddress: req.socket.remoteAddress,
  };
  record.id = record.id || `${Date.now().toString(36)}-${stableHash(JSON.stringify(record))}`;
  return record;
}

function remoteIp(req) {
  return String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function appendRecord(record) {
  if (seenIds.has(record.id)) {
    return false;
  }
  seenIds.add(record.id);
  if (seenIds.size > 20000) {
    const first = seenIds.values().next().value;
    seenIds.delete(first);
  }
  const file = logPathFor(record);
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
  pendingRecords += 1;
  return true;
}

async function pushIfNeeded(force = false) {
  if (pushing) {
    return;
  }
  const now = Date.now();
  if (!force && (pendingRecords === 0 || now - lastCommitAt < config.commitIntervalMs)) {
    return;
  }

  pushing = true;
  try {
    await spawn('git', ['add', 'captures/huya'], { cwd: config.worktree });
    const diff = await spawn('git', ['diff', '--cached', '--quiet'], { cwd: config.worktree });
    if (diff.ok) {
      pendingRecords = 0;
      lastCommitAt = now;
      return;
    }

    const subject = `Capture Huya iOS requests ${nowIso().replace(/[:.]/g, '-')}`;
    const commit = await spawn('git', ['commit', '-m', subject], { cwd: config.worktree });
    if (!commit.ok) {
      console.error('[huya-capture] commit failed:', commit.stderr || commit.stdout);
      return;
    }

    const push = await spawn('git', ['push', '-u', 'origin', config.branch], { cwd: config.worktree, timeout: 180000 });
    if (!push.ok) {
      console.error('[huya-capture] push failed:', push.stderr || push.stdout);
      return;
    }

    pendingRecords = 0;
    lastCommitAt = now;
    console.log(`[huya-capture] pushed ${config.branch} at ${nowIso()}`);
  } finally {
    pushing = false;
  }
}

function unauthorized(res) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
}

function handlePost(req, res) {
  const sourceIp = remoteIp(req);
  if (config.allowedRemote && sourceIp !== config.allowedRemote) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'forbidden_source', sourceIp }));
    req.resume();
    return;
  }

  const token = req.headers['x-huya-capture-token'] || '';
  if (config.token && token !== config.token) {
    unauthorized(res);
    req.resume();
    return;
  }

  let size = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size <= config.maxBodyBytes) {
      chunks.push(chunk);
    }
    if (size > config.maxBodyBytes) {
      req.destroy();
    }
  });
  req.on('end', () => {
    try {
      const body = Buffer.concat(chunks).toString('utf8');
      const record = normalizeRecord(body, req);
      const appended = appendRecord(record);
      res.writeHead(204);
      res.end();
      if (appended) {
        pushIfNeeded(false).catch((error) => console.error('[huya-capture] push error:', error));
      }
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(error && error.message || error) }));
    }
  });
}

function handleRequest(req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, branch: config.branch, pendingRecords, allowedRemote: config.allowedRemote, now: nowIso() }));
    return;
  }
  if (req.method === 'POST' && req.url === '/huya-capture') {
    handlePost(req, res);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
}

ensureWorktree();
ensureDir(path.join(config.worktree, 'captures', 'huya'));

const server = http.createServer(handleRequest);

function listen(host) {
  server.listen(config.port, host, () => {
    console.log(`[huya-capture] listening on http://${host}:${config.port}/huya-capture`);
    if (host !== config.host) {
      console.log(`[huya-capture] requested host ${config.host} was unavailable; using ${host}`);
    }
    console.log(`[huya-capture] worktree ${config.worktree} branch ${config.branch}`);
  });
}

server.on('error', (error) => {
  if (error && error.code === 'EADDRNOTAVAIL' && config.host !== '0.0.0.0') {
    console.error(`[huya-capture] ${config.host} is not assigned to this Mac, falling back to 0.0.0.0`);
    listen('0.0.0.0');
    return;
  }
  console.error('[huya-capture] server error:', error);
  process.exit(1);
});

listen(config.host);

setInterval(() => pushIfNeeded(false).catch((error) => console.error('[huya-capture] push error:', error)), config.commitIntervalMs).unref();

async function shutdown() {
  console.log('[huya-capture] stopping, flushing records...');
  await pushIfNeeded(true);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
