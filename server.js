const http = require('http');
const fs = require('fs');
const path = require('path');
const postUtils = require('./static/post-utils');

const rootDir = __dirname;
const port = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendJson(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBlogPage(posts, selectedSlug) {
  const blogCards = posts.map((post) => {
    const tags = (post.tags || []).map((tag) => '<span class="post-card-tag">' + escapeHtml(tag) + '</span>').join('');
    return '<div class="post-card">' +
      '<a class="post-card-link" href="/blog/' + escapeHtml(post.slug) + '">' +
      '<div class="post-card-title">' + escapeHtml(post.title) + '</div>' +
      '<div class="post-card-meta">' + escapeHtml(post.date || 'draft') + '</div>' +
      '<div class="post-card-desc">' + escapeHtml(post.description || 'A short note from the kennel.') + '</div>' +
      (tags ? '<div class="post-card-tags">' + tags + '</div>' : '') +
      '</a></div>';
  }).join('');

  let content = '<div class="post-shell">' +
    '<div class="post-topbar">' +
    '<a class="lnk" href="/">← home</a>' +
    '</div>' +
    '<article class="post-article">' +
    '<div class="post-kicker">blog</div>' +
    '<div class="post-title">Blog</div>' +
    '<div class="post-meta">Notes, experiments, and the occasional systems rabbit hole.</div>' +
    '<div class="post-body">' + blogCards + '</div>' +
    '</article>' +
    '</div>';

  let pageTitle = "Blog · Saankhya's Kennel";

  if (selectedSlug) {
    const post = posts.find((item) => item.slug === selectedSlug);
    if (post) {
      const markdownPath = path.join(rootDir, 'content', 'posts', post.slug + '.md');
      const markdown = fs.readFileSync(markdownPath, 'utf8');
      const parsed = postUtils.parseMarkdownPost(markdown, post.slug);
      pageTitle = parsed.title + " · Saankhya's Kennel";
      content = '<div class="post-shell">' +
        '<div class="post-topbar">' +
        '<a class="lnk" href="/blog">← blog</a>' +
        '<a class="lnk" href="/">← home</a>' +
        '</div>' +
        '<article class="post-article">' +
        '<div class="post-kicker">blog</div>' +
        '<div class="post-title">' + escapeHtml(parsed.title) + '</div>' +
        '<div class="post-meta">' + escapeHtml(parsed.date || 'draft') + '</div>' +
        '<div class="post-body">' + parsed.html + '</div>' +
        '</article>' +
        '</div>';
    }
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${pageTitle}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root { --bg:#0c0c0a; --surface:#111110; --fg:#d6d0be; --muted:#7a7a68; --dim:#252520; --border:#2e2e28; --accent:#c9a55a; --accent2:#6b9e78; --glow:rgba(201,165,90,0.07); --mono:"JetBrains Mono","Fira Code",monospace; }
html, body { background: var(--bg); color: var(--fg); font-family: var(--mono); font-size: 18px; line-height: 1.9; min-height: 100vh; }
#pg { width: 100%; max-width: none; padding: 5rem clamp(2rem, 7vw, 6rem) 8rem; }
#home-shell { max-width: 900px; margin: 0 auto; }
#route-shell { width: 100%; max-width: 1180px; margin: 0 auto; }
body.route-page #pg { padding-left: clamp(1rem, 2vw, 2rem); padding-right: clamp(1rem, 2vw, 2rem); }
.post-shell { max-width: 100%; padding: 0.2rem 0 0.4rem; }
.post-topbar { display: flex; flex-wrap: wrap; gap: .6rem; margin-bottom: 1.4rem; }
.post-kicker { font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); margin-bottom: .85rem; font-weight: 700; }
.post-article { border: 1px solid var(--border); border-radius: 8px; width: 100%; padding: clamp(1.6rem, 3vw, 3rem); background: rgba(255,255,255,.015); box-shadow: 0 10px 30px rgba(0,0,0,.18); }
.post-article .post-title { color: var(--fg); font-size: clamp(1.35rem, 2.3vw, 2.15rem); margin-bottom: .65rem; line-height: 1.35; }
.post-article .post-meta { color: var(--muted); font-size: 13px; margin-bottom: 1.3rem; }
.post-article .post-body { color: var(--muted); font-size: clamp(17px, 1vw, 19px); line-height: 1.9; }
.post-article .post-body p, .post-article .post-body ul, .post-article .post-body ol, .post-article .post-body pre, .post-article .post-body figure { margin-bottom: 1.2rem; }
.post-article .post-body h1,
.post-article .post-body h2,
.post-article .post-body h3,
.post-article .post-body h4 { color: var(--fg); margin: 1.8rem 0 .75rem; line-height: 1.35; font-weight: 700; }
.post-article .post-body h1 { font-size: clamp(1.45rem, 2.2vw, 2.1rem); }
.post-article .post-body h2 { font-size: clamp(1.2rem, 1.7vw, 1.55rem); }
.post-article .post-body h3 { font-size: 1.05rem; }
.post-article .post-body h4 { font-size: 1rem; color: var(--muted); }
.post-article .post-body li { margin-bottom: .45rem; padding-left: .2rem; }
.post-article .post-body ul, .post-article .post-body ol { padding-left: 1.4rem; }
.post-article .post-body blockquote { margin: 1.4rem 0; padding: .9rem 1.1rem; border-left: 3px solid var(--accent); background: rgba(201,165,90,.04); color: var(--muted); }
.post-article .post-body blockquote p:last-child { margin-bottom: 0; }
.post-article .post-body hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
.post-article .post-body .table-wrap { overflow-x: auto; margin-bottom: 1.2rem; }
.post-article .post-body table { width: 100%; border-collapse: collapse; font-size: 14px; }
.post-article .post-body th, .post-article .post-body td { border: 1px solid var(--border); padding: .55rem .75rem; text-align: left; }
.post-article .post-body th { color: var(--fg); background: rgba(255,255,255,.03); }
.post-article .post-body pre { padding: 1rem 1.1rem; border: 1px solid var(--border); border-radius: 6px; overflow-x: auto; background: rgba(255,255,255,.02); margin-bottom: 1.2rem; }
.post-article .post-body pre code.hljs { display: block; padding: 0; background: transparent; border: none; font-size: 13px; line-height: 1.7; }
.post-article .post-body :not(pre) > code { font-family: var(--mono); font-size: 14px; background: rgba(255,255,255,.04); border: 1px solid var(--border); padding: .12em .4em; border-radius: 4px; color: var(--fg); }
.post-article .post-body .hljs { color: var(--fg); background: transparent; }
.post-article .post-body .hljs-keyword, .post-article .post-body .hljs-selector-tag, .post-article .post-body .hljs-title { color: var(--accent); }
.post-article .post-body .hljs-string, .post-article .post-body .hljs-number, .post-article .post-body .hljs-literal { color: var(--accent2); }
.post-article .post-body .hljs-comment, .post-article .post-body .hljs-quote { color: var(--muted); font-style: italic; }
.post-article .post-body .hljs-built_in, .post-article .post-body .hljs-name { color: #8cb4c9; }
.post-article .post-body .hljs-meta { color: var(--muted); }
.post-article .post-body figure { margin: 1.4rem 0; }
.post-article .post-body img { display: block; width: auto; max-width: 100%; height: auto; border: 1px solid var(--border); border-radius: 6px; image-rendering: auto; object-fit: contain; }
.post-article .post-body a { color: var(--accent); text-decoration: none; }
.post-article .post-body a:hover { text-decoration: underline; }
.post-article .post-body strong { color: var(--fg); font-weight: 700; }
.post-card { border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.1rem; background: rgba(255,255,255,.015); margin-bottom: 1rem; transition: border-color .15s, background .15s; }
.post-card:hover { border-color: var(--accent); background: rgba(201,165,90,0.05); }
.post-card-link { color: inherit; text-decoration: none; display: block; }
.post-card-title { color: var(--fg); font-size: 17px; margin-bottom: .35rem; line-height: 1.45; }
.post-card-meta { color: var(--muted); font-size: 13px; margin-bottom: .55rem; }
.post-card-desc { color: var(--muted); font-size: 16px; line-height: 1.85; }
.post-card-tags { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .65rem; }
.post-card-tag { font-size: 12px; color: var(--muted); border: 1px solid var(--border); padding: 2px 8px; border-radius: 2px; letter-spacing: .04em; }
.lnk { color: var(--muted); text-decoration: none; font-size: 15px; padding: 8px 22px; border: 1px solid var(--border); border-radius: 3px; transition: color .15s, border-color .15s, background .15s; letter-spacing: .04em; }
.lnk:hover { color: var(--fg); border-color: var(--accent); background: var(--glow); }
</style>
</head>
<body class="route-page">
<div id="pg">
  <div id="home-shell" style="display:none"></div>
  <div id="route-shell">${content}</div>
</div>
</body>
</html>`;
}

function readMarkdownPosts() {
  const postsDir = path.join(rootDir, 'content', 'posts');
  const files = fs.readdirSync(postsDir).filter((name) => name.endsWith('.md')).sort();
  return files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const fullPath = path.join(postsDir, file);
    const contents = fs.readFileSync(fullPath, 'utf8');
    const parsed = postUtils.parseMarkdownPost(contents, slug);
    return {
      slug,
      title: parsed.title,
      date: parsed.date,
      description: parsed.description,
      tags: parsed.tags
    };
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/posts') {
    sendJson(res, readMarkdownPosts());
    return;
  }

  if (pathname.startsWith('/api/post/')) {
    const slug = pathname.slice('/api/post/'.length);
    const posts = readMarkdownPosts();
    const post = posts.find((item) => item.slug === slug);
    if (!post) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Post not found' }));
      return;
    }

    const markdownPath = path.join(rootDir, 'content', 'posts', post.slug + '.md');
    try {
      const markdown = fs.readFileSync(markdownPath, 'utf8');
      sendJson(res, postUtils.parseMarkdownPost(markdown, post.slug));
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Post file missing' }));
    }
    return;
  }

  if (pathname === '/posts' || pathname === '/posts/' || pathname === '/blog' || pathname === '/blog/') {
    const posts = readMarkdownPosts();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderBlogPage(posts));
    return;
  }

  if (pathname.startsWith('/posts/') || pathname.startsWith('/blog/')) {
    const posts = readMarkdownPosts();
    const slug = pathname.split('/').filter(Boolean).pop();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderBlogPage(posts, slug));
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const filePath = path.join(rootDir, relativePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackPath = path.join(rootDir, 'index.html');
      fs.readFile(fallbackPath, 'utf8', (fallbackErr, data) => {
        if (fallbackErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
