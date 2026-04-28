function done(payload) {
  $done(payload || {});
}

function shouldHandle(body, contentType) {
  return typeof body === 'string' &&
    body !== '' &&
    /html/i.test(String(contentType || ''));
}

function extractNonce(body) {
  const match = String(body).match(/\snonce="([^"]+)"/i);
  return match ? match[1] : '';
}

function injectBlock(body, block, marker) {
  if (body.includes(marker)) {
    return body;
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
    'ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-display-ad-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer',
    'ytd-video-masthead-ad-v3-renderer',
    '#masthead-ad',
    '.ytd-watch-flexy > .ytd-watch-next-secondary-results-renderer > ytd-ad-slot-renderer.ytd-watch-next-secondary-results-renderer',
    'ytd-item-section-renderer > .ytd-item-section-renderer > ytd-ad-slot-renderer.style-scope',
    '.video-ads',
    '.ytp-ad-module',
    '.ytp-ad-player-overlay',
    '.ytp-ad-overlay-container',
    '.ytp-ad-text-overlay',
    '.ytp-ad-image-overlay',
    '.ytp-ad-action-interstitial',
    '.ytp-ad-survey',
    '.ytp-featured-product',
    '.ytp-ad-preview-container',
    '.ytp-ad-message-container',
    '.ytp-ad-skip-button-container',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-player-overlay-layout',
    'ytd-player-legacy-desktop-watch-ads-renderer',
  ].join(', ') + ' { display: none !important; }';
}

function buildInlineScript() {
  const script = String.raw`(() => {
  if (window.__codexYouTubePageCleanInstalled) return;
  window.__codexYouTubePageCleanInstalled = true;

  const REMOVE_KEYS = new Set([
    'adPlacements',
    'playerAds',
    'adSlots',
    'adBreakHeartbeatParams',
  ]);
  const DROP_RENDERER_KEYS = new Set([
    'adSlotRenderer',
    'displayAdRenderer',
    'promotedSparklesWebRenderer',
    'promotedVideoRenderer',
    'videoMastheadAdV3Renderer',
    'mastheadAdRenderer',
    'playerLegacyDesktopWatchAdsRenderer',
    'inFeedAdLayoutRenderer',
  ]);
  const AD_SELECTORS = [
    'ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-display-ad-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer',
    'ytd-video-masthead-ad-v3-renderer',
    '#masthead-ad',
    '.video-ads',
    '.ytp-ad-module',
    '.ytp-ad-player-overlay',
    '.ytp-ad-overlay-container',
    '.ytp-ad-text-overlay',
    '.ytp-ad-image-overlay',
    '.ytp-ad-action-interstitial',
    '.ytp-ad-survey',
    '.ytp-featured-product',
    '.ytp-ad-preview-container',
    '.ytp-ad-message-container',
    '.ytp-ad-skip-button-container',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-player-overlay-layout',
    'ytd-player-legacy-desktop-watch-ads-renderer',
  ].join(',');
  const DROP = Symbol('drop');

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  function containsAdRenderer(container) {
    if (!isPlainObject(container)) return false;
    return Object.keys(container).some(key => DROP_RENDERER_KEYS.has(key));
  }

  function cleanNode(node) {
    if (Array.isArray(node)) {
      let changed = false;
      const out = [];
      for (const item of node) {
        const cleaned = cleanNode(item);
        if (cleaned === DROP) {
          changed = true;
          continue;
        }
        out.push(cleaned);
        if (cleaned !== item) changed = true;
      }
      return changed ? out : node;
    }

    if (!isPlainObject(node)) {
      return node;
    }

    if (node.adClientParams?.isAd === true) {
      return DROP;
    }
    if (node.command?.reelWatchEndpoint?.adClientParams?.isAd === true) {
      return DROP;
    }
    if (node.richItemRenderer?.content && containsAdRenderer(node.richItemRenderer.content)) {
      return DROP;
    }
    if (node.richSectionRenderer?.content && containsAdRenderer(node.richSectionRenderer.content)) {
      return DROP;
    }

    const keys = Object.keys(node);
    if (keys.length !== 0 && keys.every(key => DROP_RENDERER_KEYS.has(key))) {
      return DROP;
    }

    let out = null;
    for (const [key, value] of Object.entries(node)) {
      if (REMOVE_KEYS.has(key) || DROP_RENDERER_KEYS.has(key)) {
        if (out === null) out = { ...node };
        delete out[key];
        continue;
      }

      const cleaned = cleanNode(value);
      if (cleaned === DROP) {
        if (out === null) out = { ...node };
        delete out[key];
        continue;
      }
      if (cleaned !== value) {
        if (out === null) out = { ...node };
        out[key] = cleaned;
      }
    }

    const candidate = out === null ? node : out;
    if (candidate.richItemRenderer?.content && isPlainObject(candidate.richItemRenderer.content) &&
        Object.keys(candidate.richItemRenderer.content).length === 0) {
      return DROP;
    }
    if (candidate.richSectionRenderer?.content && isPlainObject(candidate.richSectionRenderer.content) &&
        Object.keys(candidate.richSectionRenderer.content).length === 0) {
      return DROP;
    }
    return candidate;
  }

  function cleanParsed(value) {
    try {
      const cleaned = cleanNode(value);
      return cleaned === DROP ? {} : cleaned;
    } catch (error) {
      return value;
    }
  }

  function shouldPatchUrl(url) {
    return /\/youtubei\/v1\/(?:browse|next|search|reel\/|reel_watch_sequence)|\/playlist\?|\/get_watch\?/i.test(String(url || ''));
  }

  function splitPrefix(text) {
    const match = String(text).match(/^\)\]\}'\n?/);
    if (!match) return { prefix: '', jsonText: String(text) };
    return { prefix: match[0], jsonText: String(text).slice(match[0].length) };
  }

  function cleanJsonText(text) {
    const { prefix, jsonText } = splitPrefix(text);
    const parsed = JSON.parse(jsonText);
    return prefix + JSON.stringify(cleanParsed(parsed));
  }

  function wrapResponse(response, url) {
    return new Proxy(response, {
      get(target, prop, receiver) {
        if (prop === 'clone') {
          return () => wrapResponse(target.clone(), url);
        }
        if (prop === 'json') {
          return async () => cleanParsed(await target.clone().json());
        }
        if (prop === 'text') {
          return async () => {
            const text = await target.clone().text();
            try {
              return shouldPatchUrl(url) ? cleanJsonText(text) : text;
            } catch (error) {
              return text;
            }
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const response = await origFetch.apply(this, arguments);
      return shouldPatchUrl(url) ? wrapResponse(response, url) : response;
    };
  }

  const OrigXHR = window.XMLHttpRequest;
  if (typeof OrigXHR === 'function') {
    const responseTextDesc = Object.getOwnPropertyDescriptor(OrigXHR.prototype, 'responseText');
    const responseDesc = Object.getOwnPropertyDescriptor(OrigXHR.prototype, 'response');
    class CleanXHR extends OrigXHR {
      open(method, url) {
        this.__codexUrl = String(url || '');
        return super.open.apply(this, arguments);
      }
    }
    if (responseTextDesc && typeof responseTextDesc.get === 'function') {
      Object.defineProperty(CleanXHR.prototype, 'responseText', {
        configurable: true,
        get() {
          const value = responseTextDesc.get.call(this);
          if (!shouldPatchUrl(this.__codexUrl)) return value;
          try {
            return cleanJsonText(value);
          } catch (error) {
            return value;
          }
        },
      });
    }
    if (responseDesc && typeof responseDesc.get === 'function') {
      Object.defineProperty(CleanXHR.prototype, 'response', {
        configurable: true,
        get() {
          const value = responseDesc.get.call(this);
          if (!shouldPatchUrl(this.__codexUrl)) return value;
          if (this.responseType === 'json') {
            return cleanParsed(value);
          }
          if (this.responseType === '' || this.responseType === 'text') {
            try {
              return cleanJsonText(value);
            } catch (error) {
              return value;
            }
          }
          return value;
        },
      });
    }
    window.XMLHttpRequest = CleanXHR;
  }

  function patchInitialObject(name) {
    let current = cleanParsed(window[name]);
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        return current;
      },
      set(value) {
        current = cleanParsed(value);
      },
    });
  }

  patchInitialObject('ytInitialData');

  function stripDomAds() {
    document.querySelectorAll(AD_SELECTORS).forEach(el => el.remove());
    const player = document.getElementById('movie_player');
    const video = document.querySelector('video');
    if (player) {
      player.classList.remove('ad-showing', 'ad-interrupting');
      player.removeAttribute('ad-showing');
    }
    if (video && video.paused && document.querySelector('.video-ads,.ytp-ad-module,.ytp-ad-player-overlay,.ytp-ad-preview-container')) {
      try {
        if (player && typeof player.playVideo === 'function') {
          player.playVideo();
        } else {
          video.play().catch(() => {});
        }
      } catch (error) {}
    }
  }

  stripDomAds();
  new MutationObserver(() => stripDomAds()).observe(document, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', stripDomAds, true);
  setInterval(stripDomAds, 1500);
})();`;

  return script.replace(/<\/script/gi, '<\\/script');
}

try {
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const headers = response.headers || {};
  const body = typeof response.body === 'string' ? response.body : '';
  const contentType = String(headers['Content-Type'] || headers['content-type'] || '');

  if (!shouldHandle(body, contentType)) {
    done({});
  }

  const nonce = extractNonce(body);
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  const marker = '<!-- codex-youtube-page-clean -->';
  const block = `${marker}<style id="codex-youtube-clean-style"${nonceAttr}>${buildCss()}</style><script id="codex-youtube-clean-script"${nonceAttr}>${buildInlineScript()}</script>`;
  const nextBody = injectBlock(body, block, marker);

  done(nextBody === body ? {} : { body: nextBody });
} catch (error) {
  console.log('uBO youtube page clean failed:', error && error.message ? error.message : String(error));
  done({});
}
