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
- `huaxiaozhu-ad-clean.js`: companion cleanup script for uBO Huaxiaozhu iOS GDT Request Marker, Response Empty Ads, App Marker, and GDT Launch Guard.
- `didi-ad-clean.js`: companion cleanup script for uBO DiDi iOS YKS Ad Clean.

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
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/huaxiaozhu-ad-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/main/didi-ad-clean.js`

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
- The 2026-05-01 iOS pass adds a guarded `sdk.e.qq.com/launch` suppressor only after Huaxiaozhu has been fingerprinted in Surge persistent storage, covering the next-day first launch path without broad GDT blocking.
- `Map Local` keeps only verified popup/material suppressions: `cpc-coupon-new` HTML/JS/CSS, Didi ad images, and cached GDT media files observed in captures.
- Login, risk-control, Omega telemetry, safety shield, update, weather/static UI assets, and ordinary GDT telemetry are intentionally allowed.

DiDi iOS summary:
- The 2026-04-30 IPA/HAR pass targets the YKS homepage/travel-card pipeline, not the core map, login, risk-control, update, or ride-order APIs.
- The response script removes confirmed homepage marketing cards: `super_banner_card`, `new_loss_banner_card`, `marketing_card`, YKS banner cards, the `didifinance` loan tile, and the `yuantu` ticket bottom-entry when they appear in JSON/stringified JSON payloads.
- `Map Local` suppresses only the observed `M5Rj3dB` ticket promo short-link/page chain so it cannot reopen as a full promo webview.
- Generic DiDi static hosts such as `dpubstatic.udache.com` stay allowed except for the already verified `img-ys011.didistatic.com/static/ad_oss` material rule shared with Huaxiaozhu.

Note:
- `URL-REGEX`, `Map Local`, `Header Rewrite`, and scripted header mutations on HTTPS require MitM for target hosts.
- The scripted module auto-appends these cleanup hosts into `[MITM]`: hjw01.com, *.hjw01.com, hjwang9.com, *.hjwang9.com, mytvsuper.com, *.mytvsuper.com, coolinet.net, *.coolinet.net, www.youtube.com, youtubei.googleapis.com, vg-new-ssplib-hb.mtgglobals.com, a.applovin.com, a.applvn.com, a4.applovin.com, d.applovin.com, ms.applovin.com, rt.applovin.com, gw1.mediation.unity3d.com, o-sdk.mediation.unity3d.com, gateway.unityads.unity3d.com, i-sdk.mediation.unity3d.com, i-adq.mediation.unity3d.com, toblog.tobsnssdk.com, odf.app-ads-services.com, googleads.g.doubleclick.net, logs.ads.vungle.com, firebaseremoteconfig.googleapis.com, halfbrickplus.com, *.halfbrickplus.com, api.bidmachine.io, install.monetization-sdk.chartboost.com, config.monetization-sdk.chartboost.com, mi.gdt.qq.com, pgdt.ugdtimg.com, adsmind.ugdtimg.com, page.hongyibo.com.cn, static.hongyibo.com.cn, s3-hnapuhdd-cdn.didistatic.com, img-ys011.didistatic.com, omgup.hongyibo.com.cn, yuantu.diditaxi.com.cn, res.xiaojukeji.com, api.udache.com, v.didi.cn, dtrip.xiaojukeji.com, *.googlevideo.com.
- This package intentionally excludes the broad uBO-derived rule dump. It keeps only verified hjw01, mytvsuper, coolinet, YouTube Web, YouTube iOS App, googlevideo, and app-scoped Jetpack Joyride/Huaxiaozhu/DiDi handling.
- Cosmetic filters, scriptlets, HTML filtering, `removeparam=`, `urlskip=`, and source-domain constrained rules are not part of this lightweight export.
