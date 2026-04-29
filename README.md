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
- `youtube-ios-next-lite-clean.js`: companion cleanup script for uBO YouTube iOS Next Lite Clean.
- `youtube-ios-ad-lifecycle-clean.js`: companion cleanup script for uBO YouTube iOS Ad Stats State and uBO YouTube iOS Ad Signal State and uBO YouTube iOS Ad PTracking State and uBO YouTube iOS Initplayback State and uBO YouTube iOS Videoplayback State.
- `youtube-ios-watch-lite-clean.js`: companion cleanup script for uBO YouTube iOS Watch Lite Clean.
- `jetpack-joyride-ad-clean.js`: companion cleanup script for uBO Jetpack Joyride iOS Ad Clean and uBO Jetpack Joyride BidMachine Request Clean and uBO Jetpack Joyride BidMachine Response Clean.
- `huaxiaozhu-ad-clean.js`: companion cleanup script for uBO Huaxiaozhu iOS GDT Request Empty Ads and uBO Huaxiaozhu iOS GDT Response Empty Ads.

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
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/youtube-ios-next-lite-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/youtube-ios-ad-lifecycle-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/youtube-ios-watch-lite-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/jetpack-joyride-ad-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/huaxiaozhu-ad-clean.js`

Validation note:
- `surge-cli --check` validates files as full profiles and will complain that rules must end with `FINAL`. That warning also appears for already-installed third-party `.sgmodule` files, so do not use it as the final installability test for modules.

Jetpack Joyride iOS summary:
- `Map Local` disables verified server-side ad toggles: Mintegral fill, Google ODF/AdMob config, Firebase Remote Config cache refresh, HalfbrickPlus promo redirects, and ByteDance `app_alert_check`.
- The response script returns 204 for verified Jetpack AppLovin and Unity ad-fill responses.
- The request script short-circuits BidMachine only when the request body contains the Jetpack bundle marker, and the response script adds body-marker and Vungle metrics fallbacks for Surge iOS captures.
- Other pure telemetry observed in capture, such as AppsFlyer events, AppLovin SDK error, and Axon appkill, is intentionally not included.

Huaxiaozhu iOS summary:
- The request script short-circuits Tencent GDT `server_bidding2` only when the request body contains the Huaxiaozhu bundle marker, returning a successful empty-ad payload (`ret: 0`, `list: []`) with minimal GDT slot metadata so the SDK closes cleanly.
- The response script keeps the same empty-ad transform as a fallback for clients where request-body short-circuiting is unavailable.
- `Map Local` keeps only verified popup/material suppressions: `cpc-coupon-new` HTML/JS/CSS, Didi ad images, and cached GDT media files observed in captures.
- `sdk.e.qq.com/launch`, login, risk-control, Omega telemetry, safety shield, update, and weather/static UI assets are intentionally allowed. The remaining sub-4-second relaunch white screen is app cache lifecycle behavior, not an ad source.

Yidong iOS diagnostic summary:
- This test build only adds the verified startup surfaces seen in the iOS HAR/IPA pass: `multipleInterfaces/aggregationData`, toast rule/delay endpoints, toast pages, and detainment pages on `client.app.coc.10086.cn`.
- The second pass also returns empty PSIE ad-strategy payloads for `checkAppInfo`, `getSDKSwitch`, `getInitList`, `getOfflineFeature`, `getFeatures`, `getStrategyTouchcode`, and `getComplexCandidateColls` on `h.app.coc.10086.cn`, because the first diagnostic build already hit the toast endpoints but ads still appeared.
- It intentionally does not restore the broader PSIE scripts, CDN image blocks, homepage data blocks, or `startInit` rewriting, because those either had no effect or risked app white screens in earlier testing.

YouTube iOS playback note:
- The YouTube iOS protobuf cleanup uses a local lightweight `next`/`get_watch` handler after 2026-04-29 captures showed first-tap video pages stalling on a black/skeleton screen while large watch/next responses still carried ad allocation state. The local handler cleans player ad fields, removes individual `richItemContents` cards with observed ad markers, and narrowly strips ad-bearing child records from opaque `next` fields 14/15/42; deleting whole unknown fields is avoided because it caused black screens and gray placeholders on iOS.
- YouTube ad impression/stat endpoints are completed with local 204 responses instead of hard REJECT, matching the web spinner workaround and avoiding clients waiting on failed ad lifecycle requests. iOS ad `cpn` values from `api/stats/ads`, ad-marked `s.youtube.com/api/stats/*` signals, adhost `ptracking`, and duplicate googlevideo `initplayback` ids are stored briefly and used to complete only matching googlevideo `initplayback` and `videoplayback` requests; ad media streams receive an empty 200 UMP response instead of 204 to avoid iOS player error screens, and normal video initialization can still return its UMP body.

Note:
- `URL-REGEX`, `Map Local`, `Header Rewrite`, and scripted header mutations on HTTPS require MitM for target hosts.
- The scripted module auto-appends these cleanup hosts into `[MITM]`: hjw01.com, *.hjw01.com, hjwang9.com, *.hjwang9.com, mytvsuper.com, *.mytvsuper.com, coolinet.net, *.coolinet.net, www.youtube.com, youtubei.googleapis.com, s.youtube.com, *.googlevideo.com, vg-new-ssplib-hb.mtgglobals.com, a4.applovin.com, d.applovin.com, ms.applovin.com, gw1.mediation.unity3d.com, o-sdk.mediation.unity3d.com, gateway.unityads.unity3d.com, i-sdk.mediation.unity3d.com, i-adq.mediation.unity3d.com, toblog.tobsnssdk.com, odf.app-ads-services.com, googleads.g.doubleclick.net, logs.ads.vungle.com, firebaseremoteconfig.googleapis.com, halfbrickplus.com, *.halfbrickplus.com, api.bidmachine.io, mi.gdt.qq.com, pgdt.ugdtimg.com, adsmind.ugdtimg.com, page.hongyibo.com.cn, static.hongyibo.com.cn, s3-hnapuhdd-cdn.didistatic.com, img-ys011.didistatic.com, client.app.coc.10086.cn, h.app.coc.10086.cn.
- This package intentionally excludes the broad uBO-derived rule dump. It keeps only verified hjw01, mytvsuper, coolinet, YouTube Web, YouTube iOS App, googlevideo, and app-scoped Jetpack Joyride/Huaxiaozhu/Yidong handling.
- Cosmetic filters, scriptlets, HTML filtering, `removeparam=`, `urlskip=`, and source-domain constrained rules are not part of this lightweight export.
