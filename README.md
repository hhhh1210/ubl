# Surge Hosted Package

Upload these files to a GitHub repository and use the `raw.githubusercontent.com` URL to install them in Surge.

Files:
- `ublock-core-rules.sgmodule`: lightweight verified transport/header/map-local rules only. No JavaScript cleanup.
- `ublock-core-scripted.sgmodule`: lightweight verified module with site-specific body cleanup hooks.
- `ublock-core-scripted_副本.sgmodule`: compatibility copy of `ublock-core-scripted.sgmodule` for existing installs that reference the old filename.
- `hjw01-clean.js`: companion site cleanup script for uBO HJW01 Clean v3.
- `html-style-clean.js`: companion site cleanup script for uBO myTVSUPER Live Clean.
- `generic-page-clean.js`: companion site cleanup script for uBO Generic Page Clean.
- `youtube-page-lite-clean.js`: companion site cleanup script for uBO YouTube Page Lite Clean.
- `youtube-json-clean.js`: companion site cleanup script for uBO YouTube JSON Clean.
- `youtube-player-request-clean.js`: companion site cleanup script for uBO YouTube Player Request Clean.
- `youtube-player-clean.js`: companion site cleanup script for uBO YouTube Player JSON Clean.

Recommended install order:
1. Upload all module and companion script files to GitHub.
2. Install `ublock-core-scripted.sgmodule` for the verified lightweight module.
3. Use `ublock-core-rules.sgmodule` only when scripts are not desired.

Example raw URLs after upload:
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/ublock-core-rules.sgmodule`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/ublock-core-scripted.sgmodule`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/ublock-core-scripted_副本.sgmodule`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/hjw01-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/html-style-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/generic-page-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/youtube-page-lite-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/youtube-json-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/youtube-player-request-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/youtube-player-clean.js`

Validation note:
- `surge-cli --check` validates files as full profiles and will complain that rules must end with `FINAL`. That warning also appears for already-installed third-party `.sgmodule` files, so do not use it as the final installability test for modules.

Note:
- `URL-REGEX`, `Map Local`, `Header Rewrite`, and scripted header mutations on HTTPS require MitM for target hosts.
- The scripted module auto-appends these cleanup hosts into `[MITM]`: hjw01.com, *.hjw01.com, hjwang9.com, *.hjwang9.com, mytvsuper.com, *.mytvsuper.com, coolinet.net, *.coolinet.net, www.youtube.com, youtubei.googleapis.com, *.googlevideo.com.
- This package intentionally excludes the broad uBO-derived rule dump. It keeps only verified hjw01, mytvsuper, coolinet, YouTube Web, YouTube iOS App, and googlevideo handling.
- Cosmetic filters, scriptlets, HTML filtering, `removeparam=`, `urlskip=`, and source-domain constrained rules are not part of this lightweight export.
