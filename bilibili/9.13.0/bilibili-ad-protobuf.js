/* Local Bilibili 9.13.0 ad cleaner, 2026-09-24.
 * No network calls, storage, account access, or player/entitlement changes.
 * Schema provenance: see 分析报告.md. Preserve untouched wire bytes, including
 * unknown fields and 64-bit IDs. Unsupported framing/compression fails open.
 */
(function () {
  'use strict';
  const MAX = 1048576;
  function join(parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let pos = 0;
    for (const part of parts) { out.set(part, pos); pos += part.length; }
    return out;
  }
  function varint(bytes, pos, scalar) {
    let value = 0;
    for (let i = 0; i < 10; i++) {
      if (pos >= bytes.length) throw new Error('truncated varint');
      const b = bytes[pos++];
      if (i === 9 && b > 1) throw new Error('invalid uint64');
      if (!scalar) value += (b & 127) * Math.pow(2, 7 * i);
      if (!(b & 128)) {
        if (!scalar && !Number.isSafeInteger(value)) throw new Error('oversized tag/length');
        return { value, pos };
      }
    }
    throw new Error('invalid varint');
  }
  function encodeVarint(n) {
    const out = [];
    do { const b = n % 128; n = Math.floor(n / 128); out.push(b | (n ? 128 : 0)); } while (n);
    return new Uint8Array(out);
  }
  function fields(bytes) {
    if (bytes.length > MAX) throw new Error('oversized message');
    const out = [];
    let pos = 0;
    while (pos < bytes.length) {
      const start = pos;
      const tag = varint(bytes, pos, false); pos = tag.pos;
      const number = Math.floor(tag.value / 8), wire = tag.value % 8;
      if (!number || number > 536870911) throw new Error('invalid field number');
      let valueStart = pos;
      if (wire === 0) pos = varint(bytes, pos, true).pos;
      else if (wire === 1) pos += 8;
      else if (wire === 2) {
        const len = varint(bytes, pos, false); valueStart = len.pos; pos = len.pos + len.value;
      } else if (wire === 5) pos += 4;
      else throw new Error('unsupported wire type');
      if (pos > bytes.length) throw new Error('truncated field');
      out.push({ number, wire, raw: bytes.subarray(start, pos), value: bytes.subarray(valueStart, pos) });
    }
    return out;
  }
  function changedField(field, value) {
    if (value === field.value) return field.raw;
    return join([encodeVarint(field.number * 8 + 2), encodeVarint(value.length), value]);
  }
  function transform(bytes, visit) {
    let changed = false;
    const parts = [];
    for (const field of fields(bytes)) {
      const next = visit(field);
      if (next === null) { changed = true; continue; }
      if (next !== field.raw) changed = true;
      parts.push(next);
    }
    return changed ? join(parts) : bytes;
  }
  function isAdCard(bytes) {
    return fields(bytes).some(f =>
      (f.number === 1 && f.wire === 0 && f.value.length === 1 && f.value[0] === 5) ||
      (f.number === 11 && f.wire === 2 && f.value.length > 0));
  }
  function cleanCards(bytes) {
    return transform(bytes, f => f.number === 1 && f.wire === 2 && isAdCard(f.value) ? null : f.raw);
  }
  // ViewReply.tab(5) -> tab_module(1) -> introduction(2) -> modules(2)
  // -> relates(22) -> cards(1). Other tabs/modules remain byte-for-byte intact.
  function cleanTab(bytes, depth) {
    const route = [1, 2, 2, 22];
    return transform(bytes, f => {
      if (f.number !== route[depth] || f.wire !== 2) return f.raw;
      const value = depth === route.length - 1 ? cleanCards(f.value) : cleanTab(f.value, depth + 1);
      return changedField(f, value);
    });
  }
  function cleanMessage(bytes, method) {
    if (method === 'PlayPause') {
      fields(bytes); // Validate before clearing this dedicated pause-ad reply.
      return bytes.length ? new Uint8Array(0) : bytes;
    }
    if (method === 'RelatesFeed') return cleanCards(bytes);
    return transform(bytes, f => {
      if (f.number === 7 && f.wire === 2) return null; // ViewReply.cm
      if (f.number === 5 && f.wire === 2) return changedField(f, cleanTab(f.value, 0));
      return f.raw;
    });
  }
  function header(headers, name) {
    const key = Object.keys(headers).find(k => k.toLowerCase() === name);
    return key === undefined ? '' : String(headers[key]);
  }
  let result = {};
  try {
    const match = /^https:\/\/(?:grpc\.biliapi\.net|app\.bilibili\.com|app\.biliapi\.net)(?::443)?\/bilibili\.app\.viewunite\.v1\.View\/(View|RelatesFeed|PlayPause)\/?(?:\?.*)?$/.exec($request.url);
    const headers = $response.headers || {};
    const type = header(headers, 'content-type').toLowerCase();
    const status = header(headers, 'grpc-status');
    const body = $response.body;
    if (!match || $response.status !== 200 || !/^application\/grpc(?:\+proto)?(?:;|$)/.test(type) ||
        (status && status !== '0') || !(body instanceof Uint8Array) || body.length > MAX || body.length < 5) {
      $done({}); return;
    }
    // Unary gRPC: exactly one uncompressed frame. Streams, grpc-web trailers and
    // message-level gzip are deliberately left intact.
    const size = body[1] * 16777216 + body[2] * 65536 + body[3] * 256 + body[4];
    if (body[0] !== 0 || size !== body.length - 5) { $done({}); return; }
    const message = body.subarray(5);
    const cleaned = cleanMessage(message, match[1]);
    if (cleaned !== message) {
      const n = cleaned.length;
      const frame = join([new Uint8Array([0, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]), cleaned]);
      const updated = {};
      for (const k of Object.keys(headers)) {
        if (!['content-length', 'content-encoding', 'etag', 'x-bili-adclean'].includes(k.toLowerCase())) updated[k] = headers[k];
      }
      updated['X-Bili-AdClean'] = '20260924-protobuf-modified';
      result = { body: frame, headers: updated };
    }
  } catch (_) {
    // Parsing failure must never prevent playback or leak request contents.
    result = {};
  }
  $done(result);
})();
