/*
 * Huya iOS Ad Clean helper for Surge
 * Standalone companion for huya-core-scripted.sgmodule.
 * Scope: neutralize ad SDK/config/log responses observed in Huya iOS 13.3.40 HAR captures.
 */

(function () {
  const url = ($request && $request.url) || "";
  const arg = typeof $argument === "string" ? $argument : "";

  function finish(obj) {
    if (typeof obj === "string") return $done({ body: obj });
    return $done({ body: JSON.stringify(obj) });
  }

  function finishJson(obj) {
    const headers = Object.assign({}, ($response && $response.headers) || {});
    headers["Content-Type"] = "application/json; charset=utf-8";
    return $done({ headers, body: JSON.stringify(obj) });
  }

  function finishText(text, contentType) {
    const headers = Object.assign({}, ($response && $response.headers) || {});
    if (contentType) headers["Content-Type"] = contentType;
    return $done({ headers, body: text });
  }

  function parseJson(text) {
    try { return JSON.parse(text || "{}"); } catch (_) { return {}; }
  }

  function b64EncodeUtf8(str) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    const bytes = [];
    str = unescape(encodeURIComponent(str));
    for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i];
      const b = i + 1 < bytes.length ? bytes[i + 1] : NaN;
      const c = i + 2 < bytes.length ? bytes[i + 2] : NaN;
      const triplet = (a << 16) | ((b || 0) << 8) | (c || 0);
      out += chars[(triplet >> 18) & 63];
      out += chars[(triplet >> 12) & 63];
      out += isNaN(b) ? "=" : chars[(triplet >> 6) & 63];
      out += isNaN(c) ? "=" : chars[triplet & 63];
    }
    return out;
  }

  function cleanGdtSetting() {
    const original = parseJson($response && $response.body);
    const cleanSdkSetting = {
      perfRate: 0,
      reportRate: 0,
      spsbt: 0,
      tpl: "",
      drdwl: "",
      spl_maxrn: 0,
      splashReqAdCount: 0,
      openSplashDynamic: 0,
      openSplashPreload: 0,
      lgtSplash_isDestroyInUIThread: 1,
      rewardH5EffectiveTime: 0,
      miniCardList: "",
      real_time_report_event_id_list: "",
      performance_js_url: "",
      rewardVideoUseJsCallbackJudgeWebSuccess: "",
      appstore_preload_sampling_rate: "0",
      transitionsstoreswitch: 0,
      maxImageStorageSize: 0,
      antiSpamTestRate: 0,
      buglyRate: 0,
      reqInterval: 86400,
      videoTopPortrait: 0
    };
    const cleaned = {
      ret: 0,
      seq: original.seq || 0,
      suid: original.suid || "",
      sig: original.sig || {},
      ebid: original.ebid || "",
      setting: { sdk: b64EncodeUtf8(JSON.stringify(cleanSdkSetting)) }
    };
    return finishJson(cleaned);
  }

  function cleanGdtExapp() {
    return finishJson({ ret: 0, msg: "no ad", data: [], ads: [], list: [] });
  }

  function cleanPangleRenderer() {
    return finishJson({ resources: [], templates: [], data: {}, code: 0, message: "success" });
  }

  function cleanPangleSettings() {
    return finishJson({ code: 20000, message: "success", data: {}, settings: {}, ad_slot_conf_list: [] });
  }

  function cleanByteDanceLog() {
    if (/\/service\/2\/log_settings\//.test(url)) {
      return finishJson({
        server_time: Math.floor(Date.now() / 1000),
        magic_tag: "ss_app_log",
        config: {
          bav_log_collect: false,
          bav_ab_config: false,
          bav_monitor_rate: 0,
          batch_event_interval: 86400,
          http_monitor_port: 0,
          real_time_events: [],
          send_launch_timely: 0,
          session_interval: 86400
        }
      });
    }
    if (/\/service\/2\/device_register_only\//.test(url)) {
      return finishJson({
        server_time: Math.floor(Date.now() / 1000),
        device_id: 0,
        device_id_str: "",
        install_id: 0,
        install_id_str: "",
        caid1: "",
        caid2: ""
      });
    }
    if (/\/service\/2\/app_alert_check\//.test(url)) {
      return finishJson({ message: "success", data: { is_activated: 0 } });
    }
    return finishJson({});
  }

  try {
    if (/tangram\.e\.qq\.com\/updateSetting/.test(url) || /phase=gdt-setting/.test(arg)) return cleanGdtSetting();
    if (/us\.l\.qq\.com\/exapp/.test(url) || /phase=gdt-exapp/.test(arg)) return cleanGdtExapp();
    if (/pglstatp-toutiao\.com\/obj\/ad-pattern\/renderer\/package\.json/.test(url) || /phase=pangle-renderer/.test(arg)) return cleanPangleRenderer();
    if (/api-access\.pangolin-sdk-toutiao\.com\/api\/ad\/union\/sdk\/settings\//.test(url) || /phase=pangle-settings/.test(arg)) return cleanPangleSettings();
    if (/toblog\.ctobsnssdk\.com\/service\/2\//.test(url) || /phase=bytedance-log/.test(arg)) return cleanByteDanceLog();
    return finish($response && $response.body ? $response.body : "");
  } catch (e) {
    return finishText("", "text/plain; charset=utf-8");
  }
})();
