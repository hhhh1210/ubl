function done(payload) {
  $done(payload || {});
}

function toBytes(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === 'string') {
    const out = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      out[i] = value.charCodeAt(i) & 255;
    }
    return out;
  }
  return null;
}

function readBodyBytes() {
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  return toBytes(response.bodyBytes || response.body);
}

function containsAscii(bytes, text) {
  if (!bytes || bytes.length < text.length) {
    return false;
  }
  const first = text.charCodeAt(0);
  for (let offset = 0; offset <= bytes.length - text.length; offset += 1) {
    if (bytes[offset] !== first) {
      continue;
    }
    let index = 1;
    for (; index < text.length && bytes[offset + index] === text.charCodeAt(index); index += 1) {
    }
    if (index === text.length) {
      return true;
    }
  }
  return false;
}

function hasNextAdMarker(bytes) {
  return [
    'WATCH_NEXT_ADS_STATE',
    'ad_badge.eml-fe',
    'ad_button',
    'ad_avatar',
    'ad_image',
    'ad_details_line',
    'carousel_ad_card_metadata',
    'in_stream_ads_playback',
  ].some(marker => containsAscii(bytes, marker));
}

function hasAdTransportMarker(bytes) {
  return [
    'pagead',
    'googleads',
    'doubleclick',
    'googlesyndication',
    'adcontext',
  ].some(marker => containsAscii(bytes, marker));
}

function hasBrowseAdMarker(bytes) {
  return [
    'simgad',
    'googlesyndication',
    'carousel_ad_card_metadata',
  ].some(marker => containsAscii(bytes, marker));
}

function requestPath() {
  const request = typeof $request === 'object' && $request !== null ? $request : {};
  const match = String(request.url || '').match(/^https?:\/\/[^/?#]+([^?#]*)/i);
  return match ? match[1] : '';
}

function readVarint(bytes, offset = 0) {
  let value = 0;
  let multiplier = 1;
  for (let pos = offset; pos < bytes.length; pos += 1) {
    const byte = bytes[pos];
    value += (byte & 127) * multiplier;
    if ((byte & 128) === 0) {
      return { value, pos: pos + 1 };
    }
    multiplier *= 128;
    if (multiplier > 72057594037927936) {
      return null;
    }
  }
  return null;
}

function writeVarint(value) {
  const out = [];
  for (let next = value; next > 127; next = Math.floor(next / 128)) {
    out.push((next % 128) | 128);
  }
  out.push(value);
  return new Uint8Array(out);
}

function concat(chunks) {
  let length = 0;
  for (const chunk of chunks) {
    length += chunk.length;
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function parseMessage(bytes) {
  const fields = [];
  let offset = 0;
  while (offset < bytes.length) {
    const start = offset;
    const tag = readVarint(bytes, offset);
    if (!tag || !tag.value) {
      return null;
    }
    offset = tag.pos;
    const no = Math.floor(tag.value / 8);
    const wireType = tag.value & 7;
    let dataStart = offset;
    let dataEnd = offset;

    if (wireType === 0) {
      const value = readVarint(bytes, offset);
      if (!value) {
        return null;
      }
      offset = value.pos;
      dataEnd = offset;
    } else if (wireType === 1) {
      offset += 8;
      dataEnd = offset;
    } else if (wireType === 2) {
      const length = readVarint(bytes, offset);
      if (!length) {
        return null;
      }
      dataStart = length.pos;
      dataEnd = dataStart + length.value;
      if (dataEnd > bytes.length) {
        return null;
      }
      offset = dataEnd;
    } else if (wireType === 5) {
      offset += 4;
      dataEnd = offset;
    } else {
      return null;
    }

    if (offset > bytes.length) {
      return null;
    }
    fields.push({ no, wireType, start, end: offset, dataStart, dataEnd, length: dataEnd - dataStart });
  }
  return fields;
}

function cleanNextAds(bytes) {
  if (!bytes || !hasNextAdMarker(bytes)) {
    return null;
  }
  const fields = parseMessage(bytes);
  if (!fields) {
    return null;
  }
  const hasAdSchema = fields.some(field => {
    if (field.no !== 777 || field.wireType !== 2 || field.length < 1024) {
      return false;
    }
    return hasNextAdMarker(bytes.subarray(field.dataStart, field.dataEnd));
  });
  if (!hasAdSchema) {
    return null;
  }

  const chunks = [];
  let changed = false;
  for (const field of fields) {
    const data = field.wireType === 2 ? bytes.subarray(field.dataStart, field.dataEnd) : null;
    if (
      field.wireType === 2
      && field.length > 32
      && (
        (field.no === 7 && hasAdTransportMarker(data))
        ||
        ((field.no === 14 || field.no === 15 || field.no === 42) && (hasAdTransportMarker(data) || hasNextAdMarker(data)))
        || (field.no === 777 && hasNextAdMarker(data))
      )
    ) {
      changed = true;
      continue;
    }
    chunks.push(bytes.subarray(field.start, field.end));
  }
  return changed ? concat(chunks) : null;
}

function cleanBrowseAds(bytes) {
  if (!bytes || !hasBrowseAdMarker(bytes)) {
    return null;
  }
  const fields = parseMessage(bytes);
  if (!fields) {
    return null;
  }

  const chunks = [];
  let changed = false;
  for (const field of fields) {
    const data = field.wireType === 2 ? bytes.subarray(field.dataStart, field.dataEnd) : null;
    if (field.wireType === 2 && field.no === 50 && field.length > 32 && hasBrowseAdMarker(data)) {
      changed = true;
      continue;
    }
    chunks.push(bytes.subarray(field.start, field.end));
  }
  return changed ? concat(chunks) : null;
}

try {
  const body = readBodyBytes();
  const path = requestPath();
  const cleaned = /\/youtubei\/v1\/browse$/i.test(path) ? cleanBrowseAds(body) : cleanNextAds(body);
  if (cleaned) {
    console.log(`uBO YouTube iOS next lite: stripped ad state ${body.length} -> ${cleaned.length}`);
    done({ body: cleaned });
  } else {
    done({});
  }
} catch (error) {
  console.log('uBO YouTube iOS next lite failed:', error && error.message ? error.message : String(error));
  done({});
}
