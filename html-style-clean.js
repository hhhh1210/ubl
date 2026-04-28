function done(payload) {
  $done(payload || {});
}

function parseArgument(raw) {
  const params = new URLSearchParams(typeof raw === 'string' ? raw : '');
  const selectors = (params.get('selectors') || '')
    .split('||')
    .map(s => s.trim())
    .filter(Boolean);
  return {
    styleId: params.get('styleId') || 'codex-html-style-clean',
    selectors,
    css: params.get('css') || '',
  };
}

function injectStyle(body, css, styleId) {
  if (body.includes(`id="${styleId}"`)) {
    return body;
  }

  const styleBlock = `<!-- ${styleId} --><style id="${styleId}">${css}</style>`;

  if (body.includes('</head>')) {
    return body.replace('</head>', `${styleBlock}</head>`);
  }
  if (/<body[^>]*>/i.test(body)) {
    return body.replace(/<body([^>]*)>/i, `<body$1>${styleBlock}`);
  }
  return `${styleBlock}${body}`;
}

try {
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const headers = response.headers || {};
  const body = typeof response.body === 'string' ? response.body : '';
  const contentType = String(headers['Content-Type'] || headers['content-type'] || '');

  if (body === '' || /html/i.test(contentType) === false) {
    done({});
  }

  const { styleId, selectors, css } = parseArgument($argument);
  const blocks = [];

  if (selectors.length !== 0) {
    blocks.push(`${selectors.join(', ')} { display: none !important; }`);
  }
  if (css) {
    blocks.push(css);
  }
  if (blocks.length === 0) {
    done({});
  }

  const nextBody = injectStyle(body, blocks.join('\n'), styleId);
  done(nextBody === body ? {} : { body: nextBody });
} catch (error) {
  console.log('uBO html style clean script failed:', error && error.message ? error.message : String(error));
  done({});
}
