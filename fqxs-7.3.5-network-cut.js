'use strict';

(function () {
  let result = {};
  try {
    const request = typeof $request === 'object' && $request !== null ? $request : {};
    const match = String(request.url || '').match(/^https?:\/\/([^/?#:]+)(?::\d+)?([^?#]*)(?:\?([^#]*))?$/i);
    const method = String(request.method || 'GET').toUpperCase();
    if (match && /^(?:GET|POST)$/.test(method)) {
      const host = match[1].toLowerCase();
      const path = match[2] || '/';
      const query = match[3] || '';
      const isAPI = /^api(?:-(?:hl|lq)|[35]-normal(?:-[a-z0-9-]+)?)?\.fqnovel\.com$/.test(host);
      if (isAPI && /^\/luckycat\/novel\/v1\/task\/(?:get_ad_info|get_single_ad_info|get_excitation_info)\/?$/.test(path)) {
        // Synthetic no-fill; never impersonate reward or membership endpoints.
        result = { response: {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-FQXS-735': 'no-fill' },
          body: JSON.stringify({ err_no: 0, err_tips: 'success', data: {
            is_ad_preload: false, has_ad: false, ad_info: null, ad_list: [],
            incentive_ad_info: null, read_gain_ad_info: null,
          } }),
        } };
        console.log('FQXS735 request: synthetic ad no-fill');
      } else if (/^i(?:-(?:hl|lq))?\.snssdk\.com$/.test(host) && /^\/video\/play\//.test(path) && /(?:^|&)ad_id=0*[1-9]\d*(?:&|$)/.test(query)) {
        result = { response: { status: 204, headers: { 'Cache-Control': 'no-store', 'X-FQXS-735': 'ad-video-block' }, body: '' } };
        console.log('FQXS735 request: ad video blocked');
      }
    }
  } catch (_) {
    console.log('FQXS735 request: passthrough on error');
  }
  $done(result);
})();
