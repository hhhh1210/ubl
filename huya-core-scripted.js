/*
 * Huya iOS Ad Clean helper for Surge
 * Standalone companion for huya-core-scripted.sgmodule.
 * Scope: return request-stage no-fill responses for Huya iOS startup ad traffic.
 */

(function () {
  const url = ($request && $request.url) || "";
  const arg = typeof $argument === "string" ? $argument : "";

  function finishDirectJson(obj, marker) {
    return $done({
      response: {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-uBO-Huya": marker
        },
        body: JSON.stringify(obj)
      }
    });
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

  function noAdGdtSetting(original) {
    const cleanSdkSetting = {
      perfRate: 0,
      reportRate: 0,
      spsbt: 0,
      stop: 1,
      tpl: "",
      drdwl: "",
      spl_maxrn: 0,
      splashReqAdCount: 0,
      openSplashDynamic: 0,
      openSplashPreload: 0,
      tangram_splash_material_check: 0,
      enableDSDKBackgroundSaveTemplateDict: 0,
      newDeviceIntoFetch: 0,
      cookieForLastAds: 0,
      enableIdfaCache: 0,
      maxCount: 0,
      native_loadad_count_limit: 0,
      inter_loadad_count_limit: 0,
      sscaad: 0,
      pingLocalDnsList: "",
      srcap: 0,
      spl_exptime: 0,
      spl_ltime: 0,
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
    return {
      ret: 0,
      seq: original.seq || 0,
      suid: original.suid || "",
      sig: original.sig || {},
      ebid: original.ebid || "",
      setting: {
        sdk: b64EncodeUtf8(JSON.stringify(cleanSdkSetting)),
        app: b64EncodeUtf8(JSON.stringify({
          "5035917038257268": { dynamic_use_lgt: 0 }
        }))
      }
    };
  }

  function getRequestData() {
    const body = ($request && $request.body) || "";
    const queryIndex = url.indexOf("?");
    const query = queryIndex === -1 ? "" : url.slice(queryIndex + 1);
    return String(body && query ? body + "&" + query : body || query);
  }

  function isHuyaGdtSettingRequest() {
    const requestData = getRequestData();
    return /1112179873/.test(requestData) && /com(?:%2E|\.)yy(?:%2E|\.)kiwi/i.test(requestData);
  }

  function isHuyaGdtExappRequest() {
    const requestData = getRequestData();
    const hasSlot = /(?:^|&)posid=(?:3026774105282411|3096015588382074|4076515691155523|6076318568786637)(?:&|$)/.test(requestData);
    const hasApp = /hostappid%22%3A%221112179873|hostappid"?\s*[:=]\s*"?1112179873|com\.yy\.kiwi/i.test(requestData);
    return hasSlot && hasApp;
  }

  function cleanGdtExappRequest() {
    if (!isHuyaGdtExappRequest()) return $done({});
    return finishDirectJson(
      { ret: 0, rpt: 0, msg: "", reqinterval: 3600, last_ads: {}, data: {} },
      "gdt-exapp-request-nofill-1"
    );
  }

  try {
    if (/phase=gdt-setting-request/.test(arg)) {
      if (!isHuyaGdtSettingRequest()) return $done({});
      return finishDirectJson(noAdGdtSetting({}), "gdt-setting-request-clean-3");
    }
    if (/phase=gdt-exapp-request/.test(arg)) return cleanGdtExappRequest();
    return $done({});
  } catch (_) {
    return $done({});
  }
})();
