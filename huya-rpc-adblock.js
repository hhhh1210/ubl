/* Huya 13.4.80: only verified advertising WUP service/method pairs.
 * Optional request script. Unknown, encrypted, malformed and batched bodies pass.
 * Surge's request max-size is a REJECTION limit, not a fail-open size limit.
 */
(function () {
  'use strict';
  const allowed = {
    mobileui: ['queryAd'],
    adextui: ['getAdMaterial', 'iosAdid'],
    adui: ['getUnionPositionList', 'impression', 'landingImpression', 'click', 'close',
      'negativeFeedback', 'play', 'log', 'elementImpression', 'elementClick', 'elementClose'],
    ad_report: ['impression', 'landingImpression', 'iosConversion', 'click', 'landingClick',
      'close', 'negativeFeedback', 'play', 'log', 'materialReport', 'elementImpression',
      'elementClick', 'elementClose', 'elementPlay'],
    ad_monitor_report: ['adMonitorReceive', 'adPresenterMonitorReceive']
  };
  function inspect(bytes) {
    let p = 0;
    let budget = 4096;
    function need(n) {
      if (!Number.isSafeInteger(n) || n < 0 || p + n > bytes.length) throw Error('length');
    }
    function uint(n) {
      need(n);
      let v = 0;
      for (let i = 0; i < n; i++) v = v * 256 + bytes[p++];
      return v;
    }
    function head() {
      if (--budget < 0) throw Error('budget');
      const value = uint(1);
      return { tag: value >>> 4 === 15 ? uint(1) : value >>> 4, type: value & 15 };
    }
    function count() {
      const h = head();
      if (h.tag !== 0 || ![0, 1, 2, 12].includes(h.type)) throw Error('count type');
      const value = read(h, 0);
      if (value < 0 || value > bytes.length) throw Error('count');
      return value;
    }
    function read(h, depth) {
      if (depth > 16) throw Error('depth');
      let n;
      switch (h.type) {
        case 0: n = uint(1); return n > 127 ? n - 256 : n;
        case 1: n = uint(2); return n > 32767 ? n - 65536 : n;
        case 2: n = uint(4); return n > 2147483647 ? n - 4294967296 : n;
        case 3: case 5: need(8); p += 8; return null;
        case 4: need(4); p += 4; return null;
        case 6: case 7: {
          n = uint(h.type === 6 ? 1 : 4); need(n);
          // Only the short ASCII envelope names are materialized.
          let text = '';
          if (depth === 0 && (h.tag === 5 || h.tag === 6) && n <= 128) {
            for (let i = 0; i < n; i++) {
              const b = bytes[p + i];
              if (b < 32 || b > 126) throw Error('name');
              text += String.fromCharCode(b);
            }
          }
          p += n;
          return text;
        }
        case 8:
          n = count();
          for (let i = 0; i < n * 2; i++) read(head(), depth + 1);
          return null;
        case 9:
          n = count();
          for (let i = 0; i < n; i++) read(head(), depth + 1);
          return null;
        case 10:
          for (;;) {
            const field = head();
            if (field.type === 11) break;
            read(field, depth + 1);
          }
          return null;
        case 12: return 0;
        case 13: {
          const subtype = head();
          if (subtype.tag !== 0 || subtype.type !== 0) throw Error('byte list');
          n = count(); need(n); p += n; return null;
        }
        default: throw Error('type');
      }
    }
    // WUP packets have one BE32 length prefix, including the prefix itself.
    if (bytes.length < 16 || uint(4) !== bytes.length) return null;
    const fields = Object.create(null);
    const types = Object.create(null);
    let previous = -1;
    while (p < bytes.length) {
      const h = head();
      if (h.tag <= previous) throw Error('duplicate or unordered field');
      previous = h.tag;
      types[h.tag] = h.type;
      fields[h.tag] = read(h, 0);
    }
    if (![1, 3].includes(fields[1]) || fields[2] !== 0 || !Number.isInteger(fields[4]) ||
        ![6, 7].includes(types[5]) || ![6, 7].includes(types[6]) ||
        types[7] !== 13 || !Number.isInteger(fields[8]) ||
        types[9] !== 8 || types[10] !== 8) return null;
    const service = fields[5];
    const method = fields[6];
    return Object.prototype.hasOwnProperty.call(allowed, service) &&
      allowed[service].includes(method) ? { service, method } : null;
  }
  try {
    if (typeof $request !== 'object' || !$request ||
        !/^https?:\/\/(?:wup\.huya\.com|cdn\.wup\.huya\.com|wsapi\.huya\.com)(?::(?:80|443))?\/(?:\?[^#]*)?$/.test($request.url || '') ||
        String($request.method || '').toUpperCase() !== 'POST') return $done({});
    const headers = $request.headers || {};
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-encoding' &&
          !/^identity$/i.test(String(headers[key]))) return $done({});
    }
    let bytes = $request.body;
    if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
    if (!(bytes instanceof Uint8Array) || bytes.length > 1048576) return $done({});
    const match = inspect(bytes);
    if (!match) return $done({});
    // Let the native ad failure path run; never forge reward success or a WUP schema.
    return $done({ response: { status: 204, headers: { 'Cache-Control': 'no-store' }, body: '' } });
  } catch (_) {
    return $done({});
  }
})();
