function done(payload) {
  $done(payload || {});
}

const DEFAULT_PERMISSIONS_POLICY =
  'attribution-reporting=(), browsing-topics=(), join-ad-interest-group=(), run-ad-auction=()';

function cloneHeaders(headers) {
  const out = {};
  if (headers && typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      out[key] = headers[key];
    }
  }
  return out;
}

function deleteHeaderCaseInsensitive(headers, target) {
  const targetLower = String(target).toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === targetLower) {
      delete headers[key];
    }
  }
}

function setHeaderCaseInsensitive(headers, name, value) {
  deleteHeaderCaseInsensitive(headers, name);
  headers[name] = value;
}

function shouldHandle(body, contentType) {
  return typeof body === 'string' &&
    body !== '' &&
    /html/i.test(String(contentType || ''));
}

function hostnameFromUrl(url) {
  const match = String(url || '').match(/^[a-z]+:\/\/([^/:?#]+)/i);
  return match ? match[1].toLowerCase() : '';
}

function isLocalHostname(hostname) {
  return /^(?:localhost|127(?:\.\d{1,3}){3}|(?:[^.]+\.)?local)$/i.test(hostname);
}

function buildPrivacyHeaders(headers, url) {
  const hostname = hostnameFromUrl(url);
  if (hostname === '' || isLocalHostname(hostname)) return null;

  const next = cloneHeaders(headers);
  deleteHeaderCaseInsensitive(next, 'Attribution-Reporting-Register-Source');
  deleteHeaderCaseInsensitive(next, 'Attribution-Reporting-Register-Trigger');
  deleteHeaderCaseInsensitive(next, 'Observe-Browsing-Topics');
  setHeaderCaseInsensitive(next, 'Permissions-Policy', DEFAULT_PERMISSIONS_POLICY);
  return next;
}

function shouldSkipUrl(url) {
  const hostname = hostnameFromUrl(url).replace(/^www\./, '');
  if (hostname === '') return true;

  const skipSuffixes = [
    'apple.com',
    'icloud.com',
    'mzstatic.com',
    'microsoft.com',
    'windows.net',
    'github.com',
    'githubusercontent.com',
    'openai.com',
    'youtube.com',
    'google.com',
    'googleapis.com',
    'gstatic.com',
    'googlevideo.com',
    'ytimg.com',
  ];

  return skipSuffixes.some(suffix => (
    hostname === suffix || hostname.endsWith(`.${suffix}`)
  ));
}

function extractNonce(body) {
  const match = String(body).match(/\snonce="([^"]+)"/i);
  return match ? match[1] : '';
}

function injectBlock(body, block, marker) {
  if (body.includes(marker)) return body;
  if (/<head[^>]*>/i.test(body)) {
    return body.replace(/<head([^>]*)>/i, `<head$1>${block}`);
  }
  if (body.includes('</head>')) {
    return body.replace('</head>', `${block}</head>`);
  }
  if (/<body[^>]*>/i.test(body)) {
    return body.replace(/<body([^>]*)>/i, `<body$1>${block}`);
  }
  return `${block}${body}`;
}

function buildCss() {
  return [
    'ins.adsbygoogle',
    '[id^="google_ads_iframe_"]',
    'iframe[id^="google_ads_iframe_"]',
    '#google_ads_top_frame',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="googleadservices.com"]',
    'iframe[src*="juicyads"]',
    'iframe[src*="popcash"]',
    'iframe[src*="popads"]',
    'iframe[src*="adsterra"]',
    'iframe[src*="exoclick"]',
    'iframe[src*="propellerads"]',
    'iframe[src*="monetag"]',
    'iframe[src*="trafficjunky"]',
    'iframe[src*="xlviiirdr.com"]',
    'iframe[src*="rmhfrtnd.com"]',
    'iframe[src*="mnaspm.com"]',
    'iframe[src*="curoax.com"]',
    'iframe[src*="52av.one"]',
    'iframe[src*="52papa.tv/download"]',
    'iframe[src*="sitetag.us"]',
    'iframe[src*="waust.at"]',
    'a[href^="https://go.xlviiirdr.com"]',
    'a[href^="https://go.rmhfrtnd.com"]',
    'a[href^="https://go.mnaspm.com"]',
    'a[href*="sitetag.us"]',
    'a[href*="i349.com"]',
    'a[href^="https://popcash.net/"]',
    'a[href^="https://www.onclickperformance.com/"]',
    'li:has(> a[href*="/smartpop/"])',
    'li:has(> a[href*="i349.com"])',
    'center:has(> iframe[src*="/ad/"])',
    '.adsbygoogle',
    '.adsbygoogle-wrapper',
    '.adsbygoogle-box',
    '.ad-container',
    '.ad-wrapper',
    '.ad-banner',
    '.banner-ad',
    '.banner_ads',
    '.videoSideAds',
    '.videoAd300',
    '#footerAds',
    '#bannerAd728',
    '.ad728',
    '.advertisement',
    '.advertising',
    '.sponsor-box',
  ].join(', ') + ' { display: none !important; visibility: hidden !important; }';
}

function removeAdMarkup(body) {
  const adUrl = '(?:' +
    'ad\\.52av\\.one|' +
    "file\\.52papa\\.tv\\/download\\/dl[^\"'<>\\s]*\\.php|" +
    '(?:go\\.)?(?:xlviiirdr|rmhfrtnd|mnaspm)\\.com\\/smartpop\\/?|' +
    'adserver\\.juicyads\\.com|' +
    'xapi\\.juicyads\\.com|' +
    'curoax\\.com\\/na\\/|' +
    '(?:pub\\.|track\\.)?sitetag\\.us|' +
    'waust\\.at\\/d\\.js|' +
    '(?:[^.\\/]+\\.)?i349\\.com(?:\\/|$)' +
  ')';
  const adUrlRe = new RegExp(adUrl, 'i');
  const tagAttrRe = new RegExp(String.raw`\s(?:src|href|data)=["'][^"']*` + adUrl + String.raw`[^"']*["']`, 'i');
  const patterns = [
    new RegExp(String.raw`<script\b[^>]*(?:src=["'][^"']*` + adUrl + String.raw`[^"']*["'][^>]*)?>[\s\S]*?<\/script>\s*`, 'gi'),
    new RegExp(String.raw`<script\b[^>]*>[\s\S]*?(?:smartpop|adsbyjuicy|_wau|juicyads|popunder)[\s\S]*?<\/script>\s*`, 'gi'),
    new RegExp(String.raw`<iframe\b[^>]*src=["'][^"']*` + adUrl + String.raw`[^"']*["'][\s\S]*?<\/iframe>\s*`, 'gi'),
    new RegExp(String.raw`<(?:embed|object|img)\b[^>]*` + adUrl + String.raw`[^>]*>\s*`, 'gi'),
    new RegExp(String.raw`<a\b[^>]*href=["'][^"']*` + adUrl + String.raw`[^"']*["'][\s\S]*?<\/a>\s*`, 'gi'),
  ];

  let next = body;
  for (const pattern of patterns) {
    next = next.replace(pattern, '');
  }

  next = next.replace(/<div\b[^>]*(?:id|class)=["'][^"']*(?:bannerAd|footerAds|videoSideAds|videoAd\d+|ad728|adsbygoogle|advertisement|advertising|sponsor)[^"']*["'][\s\S]*?<\/div>\s*/gi, block => {
    return adUrlRe.test(block) || tagAttrRe.test(block) ? '' : block;
  });

  return next;
}

function buildInlineScript() {
  const script = String.raw`(() => {
  if (window.__codexGenericAdCleanInstalled) return;
  window.__codexGenericAdCleanInstalled = true;

  const AD_HOST_RE = /(?:^|\.)((?:adserver|adsrv|adservice|adsterra|doubleclick|googlesyndication|googleadservices|juicyads|exoclick|popads|popcash|propellerads|monetag|trafficjunky|trafficshop|hilltopads|ad-maven|curoax|xlviiirdr|rmhfrtnd|mnaspm|sitetag|waust|i349|52av|onclickads|onclickperformance|popunder|smartpop)\.[a-z0-9.-]+)$/i;
  const AD_PATH_RE = /(?:\/(?:ad|ads|adserver|advert|banner|banners|popunder|smartpop)(?:[/?#._-]|$)|\/download\/dl[^/?#]*\.php(?:[?#]|$)|[?&](?:adsterra_|zoneid|popunder|smartpop|utm_campaign=ad))/i;
  const AD_TEXT_RE = /(?:close ad|advertisement|\bad\b|\bads\b|sponsored|sponsor|promoted)/i;
  const AD_NAME_RE = /(?:^|[-_\s])(?:ad|ads|adv|advert|advertise|advertisement|banner|banners|sponsor|sponsored|promo|popunder|popup|float|floating|google_ads|adsbygoogle|juicyads|exoclick)(?:$|[-_\s])/i;
  const SAFE_NAME_RE = /(?:header|download|breadcrumb|avatar|admin|admission|address|reader|article|shadow|modal-open|badge|radio|road|upload)/i;
  const SCAN_SELECTOR = [
    'a[href]',
    'area[href]',
    'iframe[src]',
    'img[src]',
    'script[src]',
    'embed[src]',
    'object[data]',
    'source[src]',
    '[onclick*="window.open"]',
    '[onclick*="smartpop"]',
    '[onclick*="popunder"]',
  ].join(',');

  function toUrl(value) {
    try {
      return new URL(String(value || ''), location.href);
    } catch (error) {
      return null;
    }
  }

  function isFirstParty(url) {
    const host = url.hostname.replace(/^www\./i, '');
    const pageHost = location.hostname.replace(/^www\./i, '');
    return host === pageHost || host.endsWith('.' + pageHost);
  }

  function isAdUrl(value) {
    const url = toUrl(value);
    if (!url) return false;
    const host = url.hostname;
    if (AD_HOST_RE.test(host)) return true;
    return !isFirstParty(url) && AD_PATH_RE.test(url.href);
  }

  function isAdNamed(el) {
    const text = String(el.id || '') + ' ' +
      String(el.className || '') + ' ' +
      String(el.getAttribute?.('aria-label') || '');
    return AD_NAME_RE.test(text) && !SAFE_NAME_RE.test(text);
  }

  function isImportantRoot(el) {
    return !el || el === document.documentElement || el === document.body ||
      /^(?:HTML|BODY|MAIN|ARTICLE|HEADER|FOOTER|NAV)$/i.test(el.tagName || '');
  }

  function elementArea(el) {
    try {
      const rect = el.getBoundingClientRect();
      return Math.max(0, rect.width) * Math.max(0, rect.height);
    } catch (error) {
      return 0;
    }
  }

  function findAdRoot(el) {
    let current = el;
    for (let i = 0; current && i < 4; i++, current = current.parentElement) {
      if (isImportantRoot(current)) break;
      if (isAdNamed(current)) return current;
      const area = elementArea(current);
      if (area > 5000 && current.querySelector?.(SCAN_SELECTOR)) {
        const links = Array.from(current.querySelectorAll(SCAN_SELECTOR));
        if (links.some(child => {
          const url = child.getAttribute('href') || child.getAttribute('src') || child.getAttribute('data') || child.getAttribute('onclick');
          return isAdUrl(url);
        })) {
          return current;
        }
      }
    }
    return isImportantRoot(el) ? null : el;
  }

  function removeAdElement(el) {
    const root = findAdRoot(el);
    if (!root || isImportantRoot(root)) return;
    root.remove();
  }

  function scanUrlElements(root = document) {
    try {
      root.querySelectorAll(SCAN_SELECTOR).forEach(el => {
        const value = el.getAttribute('href') ||
          el.getAttribute('src') ||
          el.getAttribute('data') ||
          el.getAttribute('onclick') ||
          '';
        if (isAdUrl(value)) removeAdElement(el);
      });
    } catch (error) {}
  }

  function scanNamedElements(root = document) {
    try {
      root.querySelectorAll('[id], [class]').forEach(el => {
        if (!isAdNamed(el)) return;
        const style = getComputedStyle(el);
        const positioned = /^(?:fixed|sticky|absolute)$/i.test(style.position);
        const area = elementArea(el);
        if (positioned || area >= 12000 || el.querySelector?.(SCAN_SELECTOR)) {
          removeAdElement(el);
        }
      });
    } catch (error) {}
  }

  function scanFloatingElements(root = document) {
    try {
      root.querySelectorAll('body *').forEach(el => {
        const style = getComputedStyle(el);
        if (!/^(?:fixed|sticky)$/i.test(style.position)) return;
        const zIndex = Number.parseInt(style.zIndex || '0', 10);
        if (Number.isFinite(zIndex) && zIndex < 10) return;
        const area = elementArea(el);
        if (area < 2500) return;
        const text = String(el.textContent || '').slice(0, 200);
        if (AD_TEXT_RE.test(text) || el.querySelector?.(SCAN_SELECTOR)) {
          const childUrls = Array.from(el.querySelectorAll(SCAN_SELECTOR)).some(child => {
            const value = child.getAttribute('href') || child.getAttribute('src') || child.getAttribute('data') || '';
            return isAdUrl(value);
          });
          if (childUrls || AD_TEXT_RE.test(text) || isAdNamed(el)) removeAdElement(el);
        }
      });
    } catch (error) {}
  }

  function cleanup(root = document) {
    scanUrlElements(root);
    scanNamedElements(root);
    scanFloatingElements(root);
  }

  try {
    const originalOpen = window.open;
    if (typeof originalOpen === 'function') {
      window.open = new Proxy(originalOpen, {
        apply(target, thisArg, args) {
          try {
            if (isAdUrl(args?.[0])) return null;
          } catch (error) {}
          return Reflect.apply(target, thisArg, args);
        },
      });
    }
  } catch (error) {}

  document.addEventListener('click', event => {
    try {
      const link = event.target?.closest?.('a[href], area[href]');
      if (!link || !isAdUrl(link.getAttribute('href'))) return;
      event.preventDefault();
      event.stopPropagation();
      removeAdElement(link);
    } catch (error) {}
  }, true);

  cleanup();
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes || []) {
        if (node?.nodeType === 1) cleanup(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(cleanup, 1500);
})();`;

  return script.replace(/<\/script/gi, '<\\/script');
}

try {
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const headers = response.headers || {};
  const body = typeof response.body === 'string' ? response.body : '';
  const contentType = String(headers['Content-Type'] || headers['content-type'] || '');
  const nextHeaders = buildPrivacyHeaders(headers, $request && $request.url);

  if (shouldSkipUrl($request && $request.url) || !shouldHandle(body, contentType)) {
    done(nextHeaders ? { headers: nextHeaders } : {});
  } else {
    const nonce = extractNonce(body);
    const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
    const marker = '<!-- codex-generic-ad-clean -->';
    const block = `${marker}<style id="codex-generic-ad-clean-style"${nonceAttr}>${buildCss()}</style><script id="codex-generic-ad-clean-script"${nonceAttr}>${buildInlineScript()}</script>`;
    const nextBody = injectBlock(removeAdMarkup(body), block, marker);
    const payload = nextHeaders ? { headers: nextHeaders } : {};
    if (nextBody !== body) {
      payload.body = nextBody;
    }
    done(Object.keys(payload).length === 0 ? {} : payload);
  }
} catch (error) {
  console.log('uBO generic page clean failed:', error && error.message ? error.message : String(error));
  done({});
}
