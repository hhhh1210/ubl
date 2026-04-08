function done(payload) {
  $done(payload || {});
}

function removeBlocks(body, patterns) {
  let next = body;
  for (const pattern of patterns) {
    next = next.replace(pattern, '');
  }
  return next;
}

try {
  const response = typeof $response === 'object' && $response !== null ? $response : {};
  const headers = response.headers || {};
  const contentType = String(headers['Content-Type'] || headers['content-type'] || '');
  const body = typeof response.body === 'string' ? response.body : '';

  if (body === '' || /html/i.test(contentType) === false) {
    done({});
  }

  const patterns = [
    /<!--\s*广告banner start\s*-->[\s\S]*?<!--\s*广告banner end\s*-->\s*/g,
    /<div class="tags-group">[\s\S]*?<\/div>\s*<!--\s*标签组 end\s*-->/g,
    /<div class="text-wrap">\s*<blockquote>[\s\S]*?海角网最新地址[\s\S]*?<\/blockquote>\s*<\/div>\s*/g,
    /<div class="text-wrap mr-bom">\s*<blockquote>[\s\S]*?(?:官方公告|成人App导航站|51爆料)[\s\S]*?<\/blockquote>\s*<\/div>\s*/g,
    /<div class="xqbj-component-advertises">[\s\S]*?<\/div>\s*<!--\s*公共部分\/页面底部\s*-->/g,
    /<!--\s*单图片 start\s*-->[\s\S]*?<!--\s*单图片 end\s*-->\s*/g,
    /<!--\s*精品格 start\s*-->[\s\S]*?<!--\s*精品格 end\s*-->\s*/g,
    /<!--\s*遮罩层 start\s*-->[\s\S]*?<!--\s*遮罩层 end\s*-->\s*/g,
    /<div class="van-overlay hidden"><\/div>\s*/g,
  ];

  const nextBody = removeBlocks(body, patterns)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/>\s{2,}</g, '><');

  done(nextBody === body ? {} : { body: nextBody });
} catch (error) {
  console.log('uBO HJW01 clean script failed:', error && error.message ? error.message : String(error));
  done({});
}
