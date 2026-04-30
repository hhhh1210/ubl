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

function renameAdFields(body) {
  return String(body).replace(
    /"(?:adPlacements|adSlots|playerAds|adBreakHeartbeatParams|legacyImportant)"/g,
    '"no_ads"'
  );
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
    '#player-ads',
  ].join(', ') + ' { display: none !important; }';
}

function buildInlineScript() {
  const script = String.raw`(() => {
  if (window.__codexYouTubeLiteCleanInstalled) return;
  window.__codexYouTubeLiteCleanInstalled = true;
  if (location.href.startsWith('https://www.youtube.com/tv#/') ||
      location.href.startsWith('https://www.youtube.com/embed/')) {
    return;
  }

  const AD_KEYS = new Set([
    'adPlacements',
    'adSlots',
    'playerAds',
    'adBreakHeartbeatParams',
    'legacyImportant',
  ]);
  const AD_RENDERERS = new Set([
    'adSlotRenderer',
    'carouselAdRenderer',
    'displayAdRenderer',
    'inFeedAdLayoutRenderer',
    'mastheadAdRenderer',
    'playerLegacyDesktopWatchAdsRenderer',
    'promotedSparklesTextSearchRenderer',
    'promotedSparklesWebRenderer',
    'promotedVideoRenderer',
    'statementBannerRenderer',
    'videoMastheadAdV3Renderer',
  ]);
  const PAGE_AD_SELECTORS = [
    'ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-display-ad-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer',
    'ytd-video-masthead-ad-v3-renderer',
    '#masthead-ad',
    '#player-ads',
  ].join(',');
  const INTERRUPTION_TEXT_RE = /(?:\u6709\u4e2d\u65ad\u95ee\u9898|\u627e\u51fa\u539f\u56e0|Experiencing interruptions|Find out why)/i;
  const INTERRUPTION_SELECTORS = [
    'tp-yt-paper-toast',
    '#toast',
    'ytd-notification-action-renderer',
    'yt-notification-action-renderer',
    '[role="alert"]',
    '[role="status"]',
  ].join(',');
  const PLAYBACK_MARKERS = ['adunit', 'lactmilli', 'channel', 'instream', 'eafg'];

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  function hasAdRenderer(value) {
    return isPlainObject(value) && Object.keys(value).some(key => AD_RENDERERS.has(key));
  }

  function pruneAds(value) {
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) {
        if (pruneAds(value[i]) === false) value.splice(i, 1);
      }
      return true;
    }
    if (!isPlainObject(value)) return true;

    if (value.adClientParams?.isAd === true ||
        value.command?.reelWatchEndpoint?.adClientParams?.isAd === true ||
        value.richItemRenderer?.content && hasAdRenderer(value.richItemRenderer.content) ||
        value.richSectionRenderer?.content && hasAdRenderer(value.richSectionRenderer.content)) {
      return false;
    }

    const keys = Object.keys(value);
    if (keys.length !== 0 && keys.every(key => AD_RENDERERS.has(key))) return false;

    for (const key of keys) {
      if (AD_KEYS.has(key) || AD_RENDERERS.has(key)) {
        delete value[key];
        continue;
      }
      if (pruneAds(value[key]) === false) delete value[key];
    }

    if (value.richItemRenderer?.content && isPlainObject(value.richItemRenderer.content) &&
        Object.keys(value.richItemRenderer.content).length === 0) {
      return false;
    }
    if (value.richSectionRenderer?.content && isPlainObject(value.richSectionRenderer.content) &&
        Object.keys(value.richSectionRenderer.content).length === 0) {
      return false;
    }
    return true;
  }

  function cleanValue(value) {
    try {
      return pruneAds(value) === false ? {} : value;
    } catch (error) {
      return value;
    }
  }

  function patchInitialObject(name) {
    try {
      let current = cleanValue(window[name]);
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          return current;
        },
        set(value) {
          current = cleanValue(value);
        },
      });
    } catch (error) {}
  }

  function patchAdWaitTimer() {
    try {
      if (window.__codexYouTubeLiteCleanTimerPatched) return;
      Object.defineProperty(window, '__codexYouTubeLiteCleanTimerPatched', {
        value: true,
        configurable: true,
      });

      const originalSetTimeout = window.setTimeout;
      window.setTimeout = new Proxy(originalSetTimeout, {
        apply(target, thisArg, args) {
          try {
            const delay = Number(args[1]);
            const callbackText = String(args[0]);
            if (delay >= 16000 && delay <= 18000 && callbackText.includes('[native code]')) {
              args[1] = Math.max(1, Math.floor(delay * 0.001));
            }
          } catch (error) {}
          return Reflect.apply(target, thisArg, args);
        },
      });
    } catch (error) {}
  }

  function getInnertubeClient() {
    try {
      return window.ytcfg?.data_?.INNERTUBE_CONTEXT?.client || null;
    } catch (error) {
      return null;
    }
  }

  function hasChannelMarker(userAgent) {
    return /(^|[ ;])channel([ ;]|$)/i.test(String(userAgent || ''));
  }

  function hasPlaybackMarker(userAgent) {
    return /adunit|channel|lactmilli|instream|eafg/i.test(String(userAgent || ''));
  }

  function withChannelUserAgent(userAgent) {
    const text = String(userAgent || '');
    if (hasChannelMarker(text)) return text;
    if (/Mozilla\/5\.0 \([^)]+/.test(text)) {
      return text.replace(/(Mozilla\/5\.0 \([^)]+)/, '$1; channel');
    }
    return text ? text + ' channel' : 'channel';
  }

  function withReloadHash(value) {
    const text = String(value || '');
    if (text.includes('#reloadxhr')) return text;
    return text ? text + '#reloadxhr' : 'https://www.youtube.com/#reloadxhr';
  }

  let activeUserAgentMarker = '';
  let originalInnertubeUserAgent = '';
  function setUserAgentMarker(marker) {
    activeUserAgentMarker = marker || '';
    const client = getInnertubeClient();
    if (!client || typeof client.userAgent !== 'string') return;
    if (!originalInnertubeUserAgent) originalInnertubeUserAgent = client.userAgent;
    if (!activeUserAgentMarker) {
      client.userAgent = originalInnertubeUserAgent;
      return;
    }
    client.userAgent = activeUserAgentMarker === 'channel'
      ? withChannelUserAgent(originalInnertubeUserAgent)
      : originalInnertubeUserAgent + ' ' + activeUserAgentMarker;
  }

  function patchYtcfgObject() {
    const cfg = window.ytcfg;
    if (!cfg || typeof cfg !== 'object' || cfg.__codexYouTubeLiteCleanSetPatched) return;
    try {
      Object.defineProperty(cfg, '__codexYouTubeLiteCleanSetPatched', {
        value: true,
        configurable: true,
      });
    } catch (error) {}
    if (typeof cfg.set === 'function') {
      const originalSet = cfg.set;
      cfg.set = function() {
        const result = originalSet.apply(this, arguments);
        if (activeUserAgentMarker) setUserAgentMarker(activeUserAgentMarker);
        return result;
      };
    }
  }

  function patchYtcfgGlobal() {
    try {
      let current = window.ytcfg;
      Object.defineProperty(window, 'ytcfg', {
        configurable: true,
        get() {
          return current;
        },
        set(value) {
          current = value;
          patchYtcfgObject();
          if (activeUserAgentMarker) setUserAgentMarker(activeUserAgentMarker);
        },
      });
    } catch (error) {}
    patchYtcfgObject();
  }

  function getWatchGraftUrl(payload) {
    const graftUrl = payload?.context?.client?.mainAppWebInfo?.graftUrl;
    return typeof graftUrl === 'string' ? graftUrl : '';
  }

  function patchPlayerRequestObject(payload) {
    if (!isPlainObject(payload)) return;
    const playbackContext = payload.playbackContext;
    const contentPlaybackContext = playbackContext?.contentPlaybackContext;
    if (!isPlainObject(playbackContext) || !isPlainObject(contentPlaybackContext)) return;

    const client = payload.context?.client;
    const userAgent = isPlainObject(client)
      ? client.userAgent || getInnertubeClient()?.userAgent || navigator.userAgent
      : getInnertubeClient()?.userAgent || navigator.userAgent;

    if (isPlainObject(client)) {
      if (hasChannelMarker(userAgent) && client.clientName === 'WEB') client.clientScreen = 'CHANNEL';
      if (hasChannelMarker(userAgent)) client.userAgent = withChannelUserAgent(userAgent);
      if (hasPlaybackMarker(userAgent)) {
        contentPlaybackContext.referer = withReloadHash(contentPlaybackContext.referer || location.href);
        contentPlaybackContext.isInlinePlaybackNoAd = true;
      }
    }
    if (payload.attestationRequest && getWatchGraftUrl(payload).includes('/watch?') && hasPlaybackMarker(userAgent)) {
      contentPlaybackContext.lactMilliseconds = String(Date.now());
    }
    pruneAds(payload);
  }

  function patchJsonStringify() {
    if (JSON.__codexYouTubeLiteCleanStringifyPatched) return;
    const originalStringify = JSON.stringify;
    JSON.stringify = function(value) {
      try {
        patchPlayerRequestObject(value);
      } catch (error) {}
      return originalStringify.apply(this, arguments);
    };
    try {
      Object.defineProperty(JSON, '__codexYouTubeLiteCleanStringifyPatched', {
        value: true,
        configurable: true,
      });
    } catch (error) {}
  }

  function getMoviePlayer() {
    const player = document.getElementById('movie_player');
    return player && typeof player === 'object' ? player : null;
  }

  function isZeroBuffering(player) {
    try {
      const state = player.getPlayerStateObject?.();
      const stats = player.getStatsForNerds?.();
      return state?.isBuffering === true &&
        String(stats?.buffer_health_seconds || '') === '0.00 s' &&
        String(stats?.resolution || '') === '0x0';
    } catch (error) {
      return false;
    }
  }

  function isAdblockPlayabilityError(response) {
    try {
      if (response?.playabilityStatus?.status !== 'UNPLAYABLE') return false;
      if (response?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.playerCaptchaViewModel) {
        return false;
      }
      const runs = JSON.stringify(
        response?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.subreason?.runs || []
      );
      return runs.includes('WEB_PAGE_TYPE_UNKNOWN') &&
        runs.includes('https://support.google.com/youtube/answer/3037019');
    } catch (error) {
      return false;
    }
  }

  function installPlayerRecovery() {
    try {
      if (window.__codexYouTubeLiteCleanRecoveryInstalled) return;
      Object.defineProperty(window, '__codexYouTubeLiteCleanRecoveryInstalled', {
        value: true,
        configurable: true,
      });
    } catch (error) {
      return;
    }

    const reloadTimes = new Map();
    let sawInterruptionSnackbar = false;
    let usePlainReload = false;
    let markerQueue = PLAYBACK_MARKERS.slice();

    function markInterruptionIfRelevant() {
      const player = getMoviePlayer();
      if (!player || !isZeroBuffering(player)) return;
      try {
        const statsUrl = String(player.getPlayerResponse?.()?.playbackTracking?.videostatsPlaybackUrl?.baseUrl || '');
        usePlainReload = statsUrl.includes('reloadxhr');
      } catch (error) {}
      sawInterruptionSnackbar = true;
    }

    try {
      const originalHas = window.Map?.prototype?.has;
      if (typeof originalHas === 'function' && !window.__codexYouTubeLiteCleanMapHasPatched) {
        window.Map.prototype.has = new Proxy(originalHas, {
          apply(target, thisArg, args) {
            try {
              if (args?.[0] === 'onSnackbarMessage') markInterruptionIfRelevant();
            } catch (error) {}
            return Reflect.apply(target, thisArg, args);
          },
        });
        Object.defineProperty(window, '__codexYouTubeLiteCleanMapHasPatched', {
          value: true,
          configurable: true,
        });
      }
    } catch (error) {}

    try {
      const originalThen = window.Promise?.prototype?.then;
      if (typeof originalThen === 'function' && !window.__codexYouTubeLiteCleanPromisePatched) {
        window.Promise.prototype.then = new Proxy(originalThen, {
          apply(target, thisArg, args) {
            try {
              if (typeof args?.[0] === 'function' &&
                  String(args[0]).includes('onAbnormalityDetected')) {
                args[0] = function() {};
              }
            } catch (error) {}
            return Reflect.apply(target, thisArg, args);
          },
        });
        Object.defineProperty(window, '__codexYouTubeLiteCleanPromisePatched', {
          value: true,
          configurable: true,
        });
      }
    } catch (error) {}

    setInterval(() => {
      if (!location.href.includes('/watch?')) {
        sawInterruptionSnackbar = false;
        markerQueue = PLAYBACK_MARKERS.slice();
        return;
      }

      const player = getMoviePlayer();
      if (!player) return;

      let response;
      let progress;
      try {
        response = player.getPlayerResponse?.();
        progress = player.getProgressState?.();
      } catch (error) {
        return;
      }

      const videoId = response?.videoDetails?.videoId;
      if (!videoId || response?.videoDetails?.isLive) return;

      if (!isAdblockPlayabilityError(response) && !isZeroBuffering(player)) return;

      const current = Number(progress?.current || 0);
      if (!isAdblockPlayabilityError(response) &&
          !sawInterruptionSnackbar &&
          (!Number.isFinite(current) || current > 1.5)) return;

      const now = Date.now();
      if (now - (reloadTimes.get(videoId) || 0) < 30000) return;
      reloadTimes.set(videoId, now);
      sawInterruptionSnackbar = false;

      try {
        const marker = usePlainReload ? '' : markerQueue.shift();
        if (!markerQueue.length) markerQueue = PLAYBACK_MARKERS.slice();
        setUserAgentMarker(marker || '');
        usePlainReload = false;
        if (typeof player.loadVideoById === 'function') {
          const start = response?.playerConfig?.playbackStartConfig?.startSeconds ?? 0;
          player.loadVideoById(videoId, start);
        }
      } catch (error) {}
    }, 500);
  }

  function stripInterruptionSnackbar() {
    try {
      document.querySelectorAll(INTERRUPTION_SELECTORS).forEach(el => {
        const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!INTERRUPTION_TEXT_RE.test(text)) return;
        const toast = el.closest('tp-yt-paper-toast, #toast') ||
          el.closest('ytd-notification-action-renderer, yt-notification-action-renderer') ||
          el;
        toast.remove();
      });
    } catch (error) {}
  }

  function stripDomAds() {
    try {
      document.querySelectorAll(PAGE_AD_SELECTORS).forEach(el => el.remove());
    } catch (error) {}
    stripInterruptionSnackbar();
  }

  patchYtcfgGlobal();
  patchAdWaitTimer();
  patchJsonStringify();
  installPlayerRecovery();
  patchInitialObject('ytInitialPlayerResponse');
  patchInitialObject('playerResponse');
  patchInitialObject('ytInitialData');
  stripDomAds();
  new MutationObserver(stripDomAds).observe(document, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', () => {
    patchInitialObject('ytInitialPlayerResponse');
    patchInitialObject('playerResponse');
    patchInitialObject('ytInitialData');
    stripDomAds();
  }, true);
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
  } else {
    const nonce = extractNonce(body);
    const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
    const marker = '<!-- codex-youtube-page-lite-clean -->';
    const block = `${marker}<style id="codex-youtube-lite-clean-style"${nonceAttr}>${buildCss()}</style><script id="codex-youtube-lite-clean-script"${nonceAttr}>${buildInlineScript()}</script>`;
    const nextBody = injectBlock(renameAdFields(body), block, marker);
    console.log(`uBO youtube page lite clean: injected url=${$request.url}`);
    done(nextBody === body ? {} : { body: nextBody });
  }
} catch (error) {
  console.log('uBO youtube page lite clean failed:', error && error.message ? error.message : String(error));
  done({});
}
