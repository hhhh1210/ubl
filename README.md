# Surge Hosted Package

Upload these files to a GitHub repository and use the `raw.githubusercontent.com` URL to install them in Surge.

Files:
- `ublock-core-rules.sgmodule`: lightweight verified transport/header/map-local rules only. No JavaScript cleanup.
- `ublock-core-scripted.sgmodule`: lightweight verified module with site-specific body cleanup hooks.
- `ublock-core-scripted_副本.sgmodule`: compatibility copy of `ublock-core-scripted.sgmodule` for existing installs that reference the old filename.
- `hjw01-clean.js`: companion cleanup script for uBO HJW01 Clean v3.
- `html-style-clean.js`: companion cleanup script for uBO myTVSUPER Live Clean.
- `generic-page-clean.js`: companion cleanup script for uBO Generic Page Clean.
- `youtube-page-lite-clean.js`: companion cleanup script for uBO YouTube Page Lite Clean.
- `youtube-json-clean.js`: companion cleanup script for uBO YouTube JSON Clean.
- `youtube-player-request-clean.js`: companion cleanup script for uBO YouTube Player Request Clean.
- `youtube-player-clean.js`: companion cleanup script for uBO YouTube Player JSON Clean.
- `jetpack-joyride-ad-clean.js`: companion cleanup script for uBO Jetpack Joyride iOS Ad Clean and uBO Jetpack Joyride BidMachine Request Clean and uBO Jetpack Joyride BidMachine Response Clean and uBO Jetpack Joyride Chartboost Request Clean.
- `huaxiaozhu-ad-clean.js`: companion cleanup script for uBO Huaxiaozhu iOS GDT Request Marker, Response Empty Ads, App Marker, GDT Launch Guard, Safety Shield Promo Clean, Activity Resource Clean, and Bronzedoor resource Clean.
- `didi-ad-clean.js`: companion cleanup script for uBO DiDi iOS YKS Ad Clean.
- `wechat-pay-ad-clean.js`: companion cleanup script for uBO WeChat Pay Ad Data Empty, GoldPlan Page Clean, and ICBC Ad URL Clean.
- `huya-ad-clean.js`: companion cleanup script for uBO Huya iOS GDT Splash Setting Clean and Exapp Fill Clean.
- `gf-ytj-ad-clean.js`: companion cleanup script for uBO GF Yitaojin iOS Startup/Marketing Clean.

Recommended install order:
1. Upload all module and companion script files to GitHub.
2. Install `ublock-core-scripted.sgmodule` for the verified lightweight module.
3. Use `ublock-core-rules.sgmodule` only when scripts are not desired.

Example raw URLs after upload:
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/ublock-core-rules.sgmodule`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/ublock-core-scripted.sgmodule`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/ublock-core-scripted_副本.sgmodule`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/hjw01-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/html-style-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/generic-page-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/youtube-page-lite-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/youtube-json-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/youtube-player-request-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/youtube-player-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/jetpack-joyride-ad-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/ios/huaxiaozhu-ad-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/ios/didi-ad-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/ios/wechat-pay-ad-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/ios/huya-ad-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/ios/gf-ytj-ad-clean.js`

Validation note:
- `surge-cli --check` validates files as full profiles and will complain that rules must end with `FINAL`. That warning also appears for already-installed third-party `.sgmodule` files, so do not use it as the final installability test for modules.

Jetpack Joyride iOS summary:
- `Map Local` disables verified server-side ad toggles: Mintegral fill, Google ODF/AdMob config, Firebase Remote Config cache refresh, HalfbrickPlus promo redirects, and ByteDance `app_alert_check`.
- The response script returns 204 for verified Jetpack AppLovin and Unity ad-fill responses.
- The 2026-04-30 Jetpack pass also covers AppLovin fill aliases `a.applovin.com` and `a.applvn.com`, the AppLovin `vr`/`pix` follow-up chain, and Chartboost `install`/`config` only when the request body carries the Jetpack bundle marker.
- The request script short-circuits BidMachine only when the request body contains the Jetpack bundle marker, and the response script adds body-marker and Vungle metrics fallbacks for Surge iOS captures.
- Other pure telemetry observed in capture, such as AppsFlyer events, AppLovin SDK error, and Axon appkill, is intentionally not included.

Huaxiaozhu iOS summary:
- The request script only marks confirmed Huaxiaozhu Tencent GDT `server_bidding2` requests. It no longer short-circuits the request, so the SDK can receive its real timing/play-round metadata.
- The response script replaces only the ad `list` with no-fill while preserving GDT slot metadata from the real response, which is safer for hot launch and immediate relaunch behavior.
- The 2026-05-10 iOS pass removes the earlier guarded `sdk.e.qq.com/launch` suppressor. The SDK launch/init response is now allowed through, while the verified ad allocation still no-fills through `mi.gdt.qq.com/server_bidding2`; this avoids leaving a native dim overlay after the ad material has been removed.
- The 2026-05-02 HAR pass adds a narrow `sec-guard.hongyibo.com.cn/api/guard/psg/v2/getShieldStatus` cleanup that preserves the endpoint response but empties `data.shieldInfo`, removing rotating Safety Center / Safety Trip promo cards.
- The 2026-05-03 HAR pass adds MitM and recursive cleanup for `res-new.hongyibo.com.cn/resapi/activity/mget`, removing confirmed Bronzedoor marketing resources by stable position and component names such as `p_startpage`, `p_home_popup`, `p_super_banner`, `p_home_core_*`, `p_home_other_banner`, `p_home_page_upper_right`, `p_nav_new`, `homepage_pop_window`, `activity_cover_layer`, `marketing_bubble`, `banner_position_list`, `destination_promotion`, and `home_right_top_common`.
- The 2026-05-04 HAR pass adds the confirmed `p_home_popup` / `imk-kf-index` / `home_pop_manual` landing-page signature, with a narrow `prod.huaxz.cn/imk-kf-index` Map Local fallback for cached popup resources.
- The deeper startup path removes the `md5` cache validator from `as.hongyibo.com.cn/ep/as/toggles`, then clears only verified launch/home marketing toggles such as `is_fast_ad`, `kf_home_bronzedoor_enable`, `kf_hummer_home_top_remind_pop`, and related coupon/marketing popup bundles.
- The 2026-05-05 HAR pass confirms GDT and toggles cleanup are active, then adds a narrow `gift-static.hongyibo.com.cn/static/kfpub/6106/edu*` tiny-gif fallback for the remaining native direct-load promo images.
- The 2026-05-06 HAR pass disables the still-active `launch_advertising_display_interval` toggle so rotating startup ad scheduling is closed before daily material URLs are requested.
- The deeper 2026-05-06 pass follows the app's own Bronzedoor/Omega logs instead of daily image URLs: repeated `p_startpage` / `p_home_popup` reports line up with `api.hongyibo.com.cn/gulfstream/passenger-center/v1/other/pData`, so the module MitMs that exact path and recursively removes the same verified marketing resource positions before new daily material is cached.
- The 2026-05-07 HAR shows no new material leak but one empty `DSplashViewController` countdown; the launch toggle cleanup now also sets `is_resource=0` so the startup resource task does not create an empty splash shell after ad material has been removed.
- The later 2026-05-07 HAR shows the empty popup shell can still be triggered when cached `img-ys011.didistatic.com/static/ad_oss` material is mapped to a successful tiny GIF, so that verified material rule now returns `204` instead of a transparent image to make the app follow its no-material path.
- The 2026-05-07 23:31 HAR shows a remaining one-shot popup reported as `p_home_popup` / `youlianghui_external_commercial_ad` from the WebX NA/Bronzedoor path; the toggle cleanup now also sets `is_webxnasdk=0`, disables `kf_home_popup_req_remove_city`, and extends the same recursive cleanup to `pLayout`.
- The 2026-05-08 HAR identifies the next one-shot popup as `p_home_other_banner` / `kf_home_other_title_image` opening `kf-webx/pop-ups/upgrade-fission.html`; the 2026-05-10 follow-up changes that verified document from a 204 hard stop to a tiny 200 self-closing page, so the native WebX popup host can complete page load and dismiss the gray overlay.
- The 2026-05-11 HAR shows the self-closing `upgrade-fission` page is already executed but the native dim overlay can remain. The toggles cleanup now also clears `webx_get_prod_page_conf.webviewPage` while preserving `productPage`, preventing the verified marketing fullscreen WebX popup container from being created before the empty page loads.
- The 2026-05-12 HAR traces the remaining gray overlay to the cached `p_home_popup` / `home_pop_manual` landing page under `prod.huaxz.cn/imk-kf-index`; the Map Local fallback now returns the same transparent self-closing page used for `upgrade-fission` instead of a passive empty document.
- The 2026-05-13 HAR shows `p_home_popup` / `fullscreenWebview` still arrives from the Bronzedoor `pData` path while the app reports `api.hongyibo.com.cn` through its own `HTTP_DNS_KFLOWER_PSNGER` config. The toggles cleanup now removes only that API host from the app HTTPDNS list, so the existing domain-scoped MitM `pData` cleaner can see and strip the cached popup resource before the native gray overlay is created.
- The 2026-05-13 12:08 follow-up shows the API host also remains in `isUseHTTPDNS.core_hosts` and the OKNet switcher, and the current `p_home_popup` shell opens `cpc-coupon-new.html`. The toggles cleanup now removes the API host from those routing lists too, and the `cpc-coupon-new` Map Local fallback uses the same self-closing transparent page as the other verified popup landings.
- The Huaxiaozhu 1.13.14 IPA confirms the stable native popup entry is the travel component config: `KFResourceServiceCom` (`cid=14013`, quasi-resource popup manager) and `KFTravelPopupCom` (`cid=15004`, API popup manager). The cleaner now removes those verified component gates and related resource toggles in addition to daily-changing `p_home_popup` resource IDs.
- The same 2026-05-13 traces show `pData` using the Trans stack (`nt_coreLibLinks=Trans+URLSession`); the cleaner now removes `api.hongyibo.com.cn` from `psg_carrot_trans_toggle.whiteList` as well, so the popup resource API should no longer bypass the MitM cleaner through the Trans whitelist.
- The follow-up 2026-05-08 pass traces the remaining 3-second blank/ad container to `IsDaggerEnable.launch_config` still listing `DSplashViewController`; the toggles cleanup now removes only that splash controller from the launch monitor, sets launch delay to zero, and disables the verified launch-video close-delay / rights-upgrade popup switches.
- `Map Local` keeps only verified popup/material suppressions: `cpc-coupon-new` and `upgrade-fission` HTML/JS/CSS, the `home_pop_manual` popup landing page, Huaxiaozhu `6106/edu*` promo images, Didi ad images, and cached GDT media files observed in captures.
- Login, risk-control, Omega telemetry, update, weather/static UI assets, and ordinary GDT telemetry are intentionally allowed.

DiDi iOS summary:
- The 2026-04-30 IPA/HAR pass targets the YKS homepage/travel-card pipeline, not the core map, login, risk-control, update, or ride-order APIs.
- The response script removes confirmed homepage marketing cards: `super_banner_card`, `new_loss_banner_card`, `marketing_card`, YKS banner cards, the `didifinance` loan tile, and the `yuantu` ticket bottom-entry when they appear in JSON/stringified JSON payloads.
- The 2026-05-03 HAR pass adds the upstream `conf.diditaxi.com.cn/homepage/v1/core` and `res.xiaojukeji.com/resapi/activity/getValid` sources, cleaning stable `ut-aggre-homepage` / `homepagemarketing` card and token-list fields before rotating daily material IDs are rendered.
- The start-page popup path clears `valid_act_ids` from `resapi/activity/getValid` and removes `pas_start_page` resource objects, covering the observed home overlay without blocking core map or ride APIs.
- The 2026-05-04 HAR pass adds the upstream `as.xiaojukeji.com/ep/as/toggles` source, disabling only the verified `new_resource_sdk_toggle.pas_start_page` / `pas_notice_webview` and `ios_activity_download_config` activity package path used by cached start-page popups.
- The follow-up toggles pass strips the `md5` cache validator before `as.xiaojukeji.com/ep/as/toggles`, forcing a full config response so the popup toggle cleanup also applies when the app would otherwise reuse local `304 CACHED` settings.
- The 2026-05-09 Huaxiaozhu-style pass targets the remaining launch container instead of daily image URLs: `IsDaggerEnable.launch_config` now drops the splash controllers, `launch_advertising_display_interval` / `didipas_splash_mp4control` are disabled, and only the verified AI home popup / operation-banner flags are zeroed.
- The 2026-05-11 HAR mirrors the Huaxiaozhu gray-overlay behavior: ad material under `img-ys011.didistatic.com/static/ad_oss` is already 204, but the native WebX shell can remain. The toggles cleanup now clears `webx_get_prod_page_conf.webviewPage` while preserving `productPage`, so the generic marketing webview route is not pre-created as a blank overlay.
- The 2026-05-29 gray-overlay pass also disables verified popup/coupon/banner/xpanel toggles from `as.xiaojukeji.com/ep/as/toggles`, including the observed coupon, cashier, xbanner, xpanel, dialog, mask, and overlay-style switches.
- `Map Local` suppresses the observed `M5Rj3dB` ticket promo short-link/page chain and two verified `xjcfthanos` offline marketing bundles so they cannot reopen as promo webviews/offline popups.
- Generic DiDi static hosts such as `dpubstatic.udache.com` stay allowed except for the already verified `img-ys011.didistatic.com/static/ad_oss` material rule and the selected `xjcfthanos` bundles observed in captures.

Huya iOS summary:
- The 2026-05-10 13.2.80 IPA/HAR pass keeps this deliberately narrow after the earlier broad-reject attempts hurt正文 content. It targets only the verified GDT splash slot `3026774105282411` on `us.l.qq.com/exapp`, returning no-fill while preserving the response shape.
- `tangram.e.qq.com/updateSetting` is cleaned only when the response/request identifies Huya or the same splash slot, disabling dynamic splash/template reuse flags such as `openSplashDynamic`, `splashReqAdCount`, `tangram_splash_material_check`, `srcap`, and `dynamic_use_lgt`.
- `xs.gdt.qq.com/style_factory/template_list` and `module_list` are mapped to empty lists, and the confirmed `business.msstatic.com/ssp/material/*` Huya splash material is replaced with a tiny image. `business.msstatic.com/dsp/public/sdkconfig.xml` is reduced to a minimal config so cached monitor material is not reused.
- The 13.2.90 IPA analysis shows the stubborn live-room page ads are not just GDT/Pangle transport. The real local entry is Huya's own `LivePlugins + LizardTemplate + InAppConfig` stack: `HYLivePopupPlugin`, `HYLiveBizPopupPlugin`, `HYLiveBottomBannerPlugin`, `VideoWrapperHuyaAdvPlugin`, and `HYFloatBallPlugin` consume templates such as `LiveRoomFloatVideoAD`, `PubScreenVideoAd`, `SaharaBusiAdCpn`, `SaharaBusiAdList`, and `SaharaMyTabAdBanner`.
- Those templates carry Huya business events like `show/liveroom_universal_popup`, `show/ad_live_list`, `show/mytab_banner`, `popup_id`, and `littlewindmill_streamertrigger`, so the page ads are primarily a local live-room business component problem instead of a single remote material URL problem.
- The same IPA ships stable local config keys for that stack in `InAppConfig.json`: `EnableFloatBall`, `HYPopViewFeatureClose`, `RewardPlanAdConfig`, `bounty_ad_popup`, `KeyConfigBannerAdShowLimit`, `live_room_to_reward_ad_show_floating`, `liveroom_bottom_toolbar`, `liveroom_realtime_com_list`, and the registered `lz.*` template URLs for `LiveRoomFloatVideoAD`, `PubScreenVideoAd`, `RewardPlanAd`, `SaharaBusiAd*`, and `SaharaMyTabAdBanner`.
- `tools/patch-huya-ipa.js` is the first IPA-side helper for this path. It patches only `InAppConfig.json` inside an extracted Huya app directory, disabling the confirmed float-ball / popup / toolbar / reward-ad entry keys and removing the registered `lz.*` live-room ad templates. It intentionally does not rewrite signing, repackage the IPA, or modify `HYLiveRoom.bundle/LivePlugins.json` yet.
- Core Huya routes, including `cdn.wup.huya.com/launch/queryHttpDns`, `udbdf.huya.com`, `cloud.tgpa.qq.com`, `api-auth.zztfly.com`, `cfgc.zztfly.com`, live CDN hosts, and HTTPDNS IP fallbacks, are intentionally allowed because previous tests showed they can break正文 loading/playback.

WeChat Pay iOS summary:
- The 2026-05-01 HAR pass targets the payment-complete GoldPlan ad page shown after WeChat Pay, not chat, Moments, or mini-program core traffic.
- `mp.weixin.qq.com/wapad/getaddata?action=getad` is emptied when it carries the WeChat Pay ad request shape, removing the observed bottom card ad such as the Blue Moon/JD creative.
- The GoldPlan HTML `SERVER_DATA` is rewritten with `is_hide_ad=true`, empty ad data, and no ad position, with a small CSS fallback for the iframe ad area.
- The ICBC payment submit response keeps `pay_data` intact and only clears `ad_url`; the observed ICBC `weixin_payment.htm` promo landing page is mapped to an empty page.
- The 2026-05-01 17:32 HAR pass adds exact `mmbiz.qpic.cn` material mappings for the remaining WeChat Pay promo entrance images that are visible outside mmtls.

GF Yitaojin iOS summary:
- The IPA gateway config identifies explicit startup/activity popup endpoints including `config.gf.com.cn/ad/info`, `midend.gf.com.cn/gfmiddle/activity/popup/v2`, and `config.gf.com.cn/ytj_config/sys_popup`.
- The response script empties confirmed startup/CMS popup endpoints and prunes selected banner, homepage grid, find-page marketing, account-open ad, holder-marketing, smart-assistant recommendation, trade-card, config promo, stock-index promo, and fund-ad payloads while avoiding broad `gf.com.cn` domain blocking.
- The 2026-05-29 HAR pass confirmed active boot ad `/ad/info` plus additional active marketing surfaces `/gfmiddle/activity/homepage_elements/v2`, `/gfmiddle/activity/find_marketing/list`, `/ytj_config/info`, and `/stock_index/publish/info`.
- Core login, quote, trading, account, and general config domains are intentionally not blocked; the module targets only named ad/marketing paths from the app gateway config and HAR capture.

Note:
- `URL-REGEX`, `Map Local`, `Header Rewrite`, and scripted header mutations on HTTPS require MitM for target hosts.
- The scripted module auto-appends these cleanup hosts into `[MITM]`: hjw01.com, *.hjw01.com, hjwang9.com, *.hjwang9.com, mytvsuper.com, *.mytvsuper.com, coolinet.net, *.coolinet.net, www.youtube.com, youtubei.googleapis.com, vg-new-ssplib-hb.mtgglobals.com, a.applovin.com, a.applvn.com, a4.applovin.com, d.applovin.com, ms.applovin.com, rt.applovin.com, gw1.mediation.unity3d.com, o-sdk.mediation.unity3d.com, gateway.unityads.unity3d.com, i-sdk.mediation.unity3d.com, i-adq.mediation.unity3d.com, toblog.tobsnssdk.com, odf.app-ads-services.com, googleads.g.doubleclick.net, logs.ads.vungle.com, firebaseremoteconfig.googleapis.com, halfbrickplus.com, *.halfbrickplus.com, api.bidmachine.io, install.monetization-sdk.chartboost.com, config.monetization-sdk.chartboost.com, mi.gdt.qq.com, pgdt.ugdtimg.com, adsmind.ugdtimg.com, page.hongyibo.com.cn, static.hongyibo.com.cn, gift-static.hongyibo.com.cn, s3-hnapuhdd-cdn.didistatic.com, img-ys011.didistatic.com, omgup.hongyibo.com.cn, sec-guard.hongyibo.com.cn, res-new.hongyibo.com.cn, as.hongyibo.com.cn, api.hongyibo.com.cn, as.xiaojukeji.com, conf.diditaxi.com.cn, yuantu.diditaxi.com.cn, res.xiaojukeji.com, api.udache.com, v.didi.cn, dtrip.xiaojukeji.com, payapp.weixin.qq.com, mp.weixin.qq.com, acq.icbc.com.cn, m.icbc.com.cn, mmbiz.qpic.cn, prod.huaxz.cn, api.didi.cn, us.l.qq.com, tangram.e.qq.com, xs.gdt.qq.com, business.msstatic.com, config.gf.com.cn, midend.gf.com.cn, qd.gf.com.cn, *.googlevideo.com.
- This package intentionally excludes the broad uBO-derived rule dump. It keeps only verified hjw01, mytvsuper, coolinet, YouTube Web, YouTube iOS App, googlevideo, and app-scoped Jetpack Joyride/Huaxiaozhu/DiDi/WeChat Pay/Huya/GF Yitaojin handling.
- Cosmetic filters, scriptlets, HTML filtering, `removeparam=`, `urlskip=`, and source-domain constrained rules are not part of this lightweight export.
