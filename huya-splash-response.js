/* Huya native splash: WUP v3 mobileui/getMSplash responses only.
 * HUYAMSplashRsp metadata in decrypted 13.4.80:
 * 0=vInfo, 1=iNextId, 2=vContext, 5=iCurId, 9=iIsEnableShake.
 * Preserve all envelope metadata, context and unknown fields byte-for-byte.
 * This cannot erase a phone's existing offline cache or inspect private sockets.
 */
(function () {
  'use strict';
  const limit = 262144;
  function parse(bytes, start, stop) {
    let p = start;
    let budget = 8192;
    function need(n) {
      if (!Number.isSafeInteger(n) || n < 0 || p + n > stop) throw Error('length');
    }
    function uint(n) {
      need(n);
      let v = 0;
      for (let i = 0; i < n; i++) v = v * 256 + bytes[p++];
      return v;
    }
    function field(depth) {
      if (--budget < 0 || depth > 24) throw Error('budget');
      const begin = p;
      const h = uint(1);
      const tag = h >>> 4 === 15 ? uint(1) : h >>> 4;
      const type = h & 15;
      const f = { tag, type, start: begin };
      let n;
      function count() {
        const c = field(depth + 1);
        if (c.tag !== 0 || ![0, 1, 2, 12].includes(c.type) || c.value < 0 || c.value > 8192) throw Error('count');
        return c.value;
      }
      switch (type) {
        case 0: n = uint(1); f.value = n > 127 ? n - 256 : n; break;
        case 1: n = uint(2); f.value = n > 32767 ? n - 65536 : n; break;
        case 2: n = uint(4); f.value = n > 2147483647 ? n - 4294967296 : n; break;
        case 3: case 5: need(8); p += 8; break;
        case 4: need(4); p += 4; break;
        case 6: case 7:
          n = uint(type === 6 ? 1 : 4); need(n);
          f.dataStart = p; f.length = n; p += n; break;
        case 8: case 9:
          n = count(); f.children = [];
          for (let i = 0; i < n * (type === 8 ? 2 : 1); i++) f.children.push(field(depth + 1));
          break;
        case 10:
          f.children = [];
          for (;;) {
            const child = field(depth + 1);
            if (child.type === 11) { if (child.tag !== 0) throw Error('end tag'); break; }
            f.children.push(child);
          }
          break;
        case 11: case 12: f.value = 0; break;
        case 13: {
          const sub = uint(1);
          if (sub !== 0) throw Error('byte subtype');
          // Byte payloads can exceed the collection-count cap without creating nodes.
          const c = field(depth + 1);
          if (c.tag !== 0 || ![0, 1, 2, 12].includes(c.type)) throw Error('byte count');
          n = c.value; need(n); f.dataStart = p; f.length = n; p += n; break;
        }
        default: throw Error('type');
      }
      f.end = p;
      return f;
    }
    const result = [];
    while (p < stop) result.push(field(0));
    return result;
  }
  function ordered(fields) {
    const result = Object.create(null);
    let last = -1;
    for (const f of fields) {
      if (f.tag <= last || f.type === 11) throw Error('field order');
      result[f.tag] = f; last = f.tag;
    }
    return result;
  }
  function text(bytes, f) {
    if (!f || ![6, 7].includes(f.type) || f.length > 128) throw Error('string');
    let s = '';
    for (let i = 0; i < f.length; i++) {
      const b = bytes[f.dataStart + i];
      if (b < 32 || b > 126) throw Error('ASCII');
      s += String.fromCharCode(b);
    }
    return s;
  }
  function concat(parts) {
    const size = parts.reduce((n, part) => n + part.length, 0);
    if (size > limit) throw Error('output size');
    const out = new Uint8Array(size);
    let p = 0;
    for (const part of parts) { out.set(part, p); p += part.length; }
    return out;
  }
  function integer(tag, n) {
    if (n === 0) return new Uint8Array([(tag << 4) | 12]);
    return new Uint8Array([(tag << 4) | 2, n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255]);
  }
  function byteList(tag, data) {
    return concat([new Uint8Array([(tag << 4) | 13, 0]), integer(0, data.length), data]);
  }
  function splice(bytes, start, end, replacements) {
    const parts = [];
    let p = start;
    for (const r of replacements.sort((a, b) => a.start - b.start)) {
      if (r.start < p || r.end > end) throw Error('overlap');
      parts.push(bytes.subarray(p, r.start), r.data); p = r.end;
    }
    parts.push(bytes.subarray(p, end));
    return concat(parts);
  }
  function clean(bytes) {
    if (bytes.length < 20 || bytes.length > limit) return null;
    const length = bytes[0] * 16777216 + bytes[1] * 65536 + bytes[2] * 256 + bytes[3];
    if (length !== bytes.length) return null;
    const packet = ordered(parse(bytes, 4, length));
    if (packet[1]?.value !== 3 || packet[2]?.value !== 0 || !Number.isInteger(packet[4]?.value) ||
        text(bytes, packet[5]) !== 'mobileui' || text(bytes, packet[6]) !== 'getMSplash' ||
        packet[7]?.type !== 13 || packet[9]?.type !== 8 || packet[10]?.type !== 8) return null;
    const status = packet[10].children;
    for (let i = 0; i < status.length; i += 2) {
      const key = text(bytes, status[i]);
      if (key === 'STATUS_RESULT_CODE' && text(bytes, status[i + 1]) !== '0') return null;
    }
    const sb = packet[7];
    const container = parse(bytes, sb.dataStart, sb.dataStart + sb.length);
    if (container.length !== 1 || container[0].tag !== 0 || container[0].type !== 8) return null;
    const items = container[0].children;
    let rsp = null;
    const seen = new Set();
    for (let i = 0; i < items.length; i += 2) {
      if (items[i].tag !== 0 || items[i + 1].tag !== 1 || items[i + 1].type !== 13) return null;
      const key = text(bytes, items[i]);
      if (seen.has(key)) return null;
      seen.add(key);
      if (key === 'tRsp') rsp = items[i + 1];
      if (key === '') {
        const val = items[i + 1];
        const code = parse(bytes, val.dataStart, val.dataStart + val.length);
        if (code.length !== 1 || code[0].tag !== 0 || code[0].value !== 0 || ![0, 1, 2, 12].includes(code[0].type)) return null;
      }
    }
    if (!rsp) return null;
    const values = parse(bytes, rsp.dataStart, rsp.dataStart + rsp.length);
    if (values.length !== 1 || values[0].tag !== 0 || values[0].type !== 10) return null;
    const fields = ordered(values[0].children);
    if (fields[0]?.type !== 9 || fields[0].children.some(f => f.tag !== 0 || f.type !== 10)) return null;
    if (fields[2] && fields[2].type !== 13) return null;
    for (const tag of [1, 5, 9]) if (fields[tag] && ![0, 1, 2, 12].includes(fields[tag].type)) return null;
    const edits = [];
    if (fields[0].children.length) edits.push({ ...fields[0], data: new Uint8Array([9, 12]) });
    for (const tag of [1, 5, 9]) {
      const f = fields[tag];
      if (f && f.value !== 0) edits.push({ ...f, data: integer(tag, 0) });
    }
    if (!edits.length) return null;
    const cleanRsp = splice(bytes, rsp.dataStart, rsp.dataStart + rsp.length, edits);
    const cleanContainer = splice(bytes, sb.dataStart, sb.dataStart + sb.length,
      [{ ...rsp, data: byteList(1, cleanRsp) }]);
    const result = splice(bytes, 4, length, [{ ...sb, data: byteList(7, cleanContainer) }]);
    const n = result.length + 4;
    return concat([new Uint8Array([n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255]), result]);
  }
  try {
    if (typeof $request !== 'object' || typeof $response !== 'object' ||
        !/^https?:\/\/(?:wup\.huya\.com|cdn\.wup\.huya\.com|wsapi\.huya\.com)(?::(?:80|443))?\/(?:mobileui\/getMSplash)?(?:\?[^#]*)?$/.test($request.url || '') ||
        String($request.method || '').toUpperCase() !== 'POST' || Number($response.status) !== 200) return $done({});
    let bytes = $response.body;
    if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
    if (!(bytes instanceof Uint8Array)) return $done({});
    const result = clean(bytes);
    if (!result) return $done({});
    const headers = {};
    for (const key of Object.keys($response.headers || {})) {
      if (!/^(?:content-length|content-encoding|transfer-encoding|etag|last-modified|cache-control)$/i.test(key)) headers[key] = $response.headers[key];
    }
    headers['Cache-Control'] = 'no-store';
    headers['X-uBO-Huya'] = 'native-splash-empty-v1';
    return $done({ body: result, headers });
  } catch (_) {
    return $done({});
  }
})();
