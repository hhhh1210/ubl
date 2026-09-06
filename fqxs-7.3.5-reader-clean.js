'use strict';

(function () {
  let result = {};
  try {
    result = rewrite();
  } catch (_) {
    console.log('FQXS735 response: passthrough on invalid/unsupported payload');
  }
  $done(result);

  function rewrite() {
    const request = typeof $request === 'object' && $request !== null ? $request : {};
    const response = typeof $response === 'object' && $response !== null ? $response : {};
    const url = String(request.url || '');
    const match = url.match(/^https?:\/\/([^/?#:]+)(?::\d+)?([^?#]*)(?:\?([^#]*))?$/i);
    if (!match) return {};
    const host = match[1].toLowerCase();
    const path = match[2] || '/';
    const query = match[3] || '';
    const isAPI = /^api(?:-(?:hl|lq)|[35]-normal(?:-[a-z0-9-]+)?)?\.fqnovel\.com$/.test(host);
    const isReading = /^reading(?:-(?:hl|lq))?\.snssdk\.com$/.test(host);
    const isSettings = /^(?:is|ib|i(?:-(?:hl|lq))?)\.snssdk\.com$/.test(host) && /^\/service\/settings\/v[23]\/?$/.test(path);
    const config = isSettings || ((isAPI || isReading) && /^\/(?:reading\/ugc\/ab\/config\/v\d+|luckycat\/novel\/v1\/v_lab\/get_ab_info)\/?$/.test(path));
    const content = (isAPI || isReading) && /^\/(?:reading\/reader\/batch_full\/v\d+|reading\/commerceapi\/commerce\/tab\/v\d+|luckycat\/novel\/v[12]\/(?:task\/page|resource\/(?:resource_plan|resource_detail|detail_popup|popup_show)))\/?$/.test(path);
    if (isSettings && !/(?:^|&)(?:aid=1967|caller_name=[^&]*novelapp)(?:&|$)/.test(query)) return {};
    if (!config && !content) return {};
    const body = typeof response.body === 'string' ? response.body : '';
    if (!body || body.length > 2097152 || !/^\s*[\[{]/.test(body)) {
      console.log('FQXS735 response: skipped empty/non-JSON/oversized body');
      return {};
    }
    if (response.status && (Number(response.status) < 200 || Number(response.status) >= 300)) return {};

    // Avoid JSON round-tripping payloads containing unquoted 64-bit IDs.
    function unsafeIntegers(text) {
      const tokens = /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
      let token;
      while ((token = tokens.exec(text))) {
        if (/^-?\d+$/.test(token[0])) {
          const digits = token[0].replace(/^-/, '');
          if (digits.length > 16 || (digits.length === 16 && digits > '9007199254740991')) return true;
        }
      }
      return false;
    }
    if (unsafeIntegers(body)) {
      console.log('FQXS735 response: skipped to preserve 64-bit IDs');
      return {};
    }

    const configKeys = /^(?:ad_config|chapter_middle_ad_config|novel_ad_config|libra_ad_config|inspire_dynamic_add_config|reading_ad_lynx|reading_ad_ssr_optimize_config|splash_ad_sdk_json|splash_ad_config_v\d+|gold_coin_patch_ad_config_v\d+|reader_front_ad_slide_config_v\d+|video_patch_ad_config)$/i;
    const payloadKeys = /^(?:ad_context|ad_url_data|ad_info|ad_infos|ad_list|ad_lists|ad_json|game_ad|chapter_ad|chapter_end_ad|feed_ad|feed_ads|reader_ad|reader_ads|banner_ad|banner_ads|incentive_ad_info|read_gain_ad_info)$/i;
    const flagKeys = /^(?:has_ad|is_ad|is_ad_preload|show_ad|ad_enable|ad_enabled|enable_ad|read_ad_enable|reader_ad_enable|video_ad_enable|feed_ad_enable|splash_ad_enable)$/i;
    const configFlags = /^(?:enable|enabled|show|visible|preload|preload_enable|enable_preload)$/i;
    const adTypes = /^(?:ad|ads|advertisement|chapter_ad|chapter_end_ad|feed_ad|reader_ad|reward_ad|game_ad|splash_ad)$/i;
    const json = JSON.parse(body);
    let changed = 0;
    let visited = 0;

    function isAdCard(item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      if (['content', 'chapter_id', 'item_id', 'book_id'].some((key) => Object.prototype.hasOwnProperty.call(item, key))) return false;
      if (item.is_ad === true || item.is_ad === 1 || item.is_ad === '1') return true;
      return ['type', 'item_type', 'card_type', 'module_type'].some((key) => typeof item[key] === 'string' && adTypes.test(item[key]));
    }

    function empty(value) {
      if (Array.isArray(value)) return [];
      if (value && typeof value === 'object') return {};
      if (typeof value === 'string') return /^\s*\{/.test(value) ? '{}' : /^\s*\[/.test(value) ? '[]' : '';
      return value;
    }

    function visit(value, inAdConfig, depth) {
      if (++visited > 50000 || depth > 48) throw new Error('Traversal limit');
      if (Array.isArray(value)) {
        const output = [];
        for (const item of value) {
          if (content && !inAdConfig && isAdCard(item)) { changed += 1; continue; }
          output.push(visit(item, inAdConfig, depth + 1));
        }
        return output;
      }
      if (!value || typeof value !== 'object') return value;
      for (const key of Object.keys(value)) {
        const original = value[key];
        if (configKeys.test(key)) {
          if (typeof original === 'string') {
            if (unsafeIntegers(original)) continue;
            let parsed;
            try {
              parsed = JSON.parse(original);
            } catch (_) { continue; }
            const before = changed;
            const next = visit(parsed, true, depth + 1);
            if (changed !== before) value[key] = JSON.stringify(next);
          } else {
            value[key] = visit(original, true, depth + 1);
          }
        } else if (payloadKeys.test(key) && (content || inAdConfig)) {
          const next = empty(original);
          if (JSON.stringify(original) !== JSON.stringify(next)) { value[key] = next; changed += 1; }
        } else if ((flagKeys.test(key) && (content || inAdConfig)) || (inAdConfig && configFlags.test(key))) {
          if (original === true || original === 1 || original === '1') {
            value[key] = typeof original === 'string' ? '0' : typeof original === 'number' ? 0 : false;
            changed += 1;
          }
        } else {
          value[key] = visit(original, inAdConfig, depth + 1);
        }
      }
      return value;
    }

    const cleaned = visit(json, false, 0);
    console.log('FQXS735 response: changed=' + changed);
    return changed ? { body: JSON.stringify(cleaned) } : {};
  }
})();
