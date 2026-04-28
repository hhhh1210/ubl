# Surge Hosted Package

Upload these files to a GitHub repository and use the `raw.githubusercontent.com` URL to install them in Surge.

Files:
- `ublock-core-rules.sgmodule`: pure rules/header-rewrite/map-local export. No remote JS dependency.
- `ublock-core-scripted.sgmodule`: same core rules, but replaces the privacy-sandbox header rewrite section with remote Surge scripts and site-specific body cleaning hooks.
- `ublock-core-scripted_副本.sgmodule`: compatibility copy of `ublock-core-scripted.sgmodule` for existing installs that reference the old filename.
- `ublock-privacy-sandbox.js`: companion script used by the scripted module.
- `hjw01-clean.js`: companion site cleanup script for uBO HJW01 Clean v3.
- `html-style-clean.js`: companion site cleanup script for uBO myTVSUPER Live Clean.
- `youtube-page-clean.js`: companion site cleanup script for uBO YouTube Desktop Clean.
- `youtube-json-clean.js`: companion site cleanup script for uBO YouTube JSON Clean.

Recommended install order:
1. Upload all module and companion script files to GitHub.
2. Install `ublock-core-rules.sgmodule` first to verify the base rules load correctly.
3. If you want the script-enhanced version, install `ublock-core-scripted.sgmodule` after the companion `.js` files are reachable from GitHub raw URLs.

Example raw URLs after upload:
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/ublock-core-rules.sgmodule`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/ublock-core-scripted.sgmodule`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/ublock-core-scripted_副本.sgmodule`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/ublock-privacy-sandbox.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/hjw01-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/html-style-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/youtube-page-clean.js`
- `https://raw.githubusercontent.com/hhhh1210/ubl/refs/heads/main/youtube-json-clean.js`

Validation note:
- `surge-cli --check` validates files as full profiles and will complain that rules must end with `FINAL`. That warning also appears for already-installed third-party `.sgmodule` files, so do not use it as the final installability test for modules.

Note:
- `URL-REGEX`, `Map Local`, `Header Rewrite`, and scripted header mutations on HTTPS require MitM for target hosts.
- The scripted module auto-appends these cleanup hosts into `[MITM]`: hjw01.com, *.hjw01.com, hjwang9.com, *.hjwang9.com, mytvsuper.com, *.mytvsuper.com, youtube.com, *.youtube.com.
- Cosmetic filters, scriptlets, HTML filtering, `removeparam=`, `urlskip=`, and source-domain constrained rules are not part of this export, except for a small set of hand-authored or templated site-specific response scripts.
