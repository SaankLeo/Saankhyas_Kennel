const fs = require('fs');
const path = require('path');
const postUtils = require('../static/post-utils');

const rootDir = path.join(__dirname, '..');
const postsDir = path.join(rootDir, 'content', 'posts');
const staticDir = path.join(rootDir, 'static');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readMarkdownPosts() {
  const files = fs.readdirSync(postsDir)
    .filter((name) => name.endsWith('.md'))
    .sort();

  return files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const markdown = fs.readFileSync(path.join(postsDir, file), 'utf8');
    const parsed = postUtils.parseMarkdownPost(markdown, slug);

    return {
      slug,
      title: parsed.title,
      date: parsed.date,
      description: parsed.description,
      tags: parsed.tags,
      html: parsed.html
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function pageTemplate(scriptPrefix) {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  return html
    .replace(/src="\.\/static\/post-utils\.js"/g, 'src="' + scriptPrefix + 'static/post-utils.js"')
    .replace(/src="\.\/static\/app\.js"/g, 'src="' + scriptPrefix + 'static/app.js"');
}

function writeRoutePage(routePath, scriptPrefix) {
  const outDir = path.join(rootDir, routePath);
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, 'index.html'), pageTemplate(scriptPrefix));
}

function main() {
  ensureDir(staticDir);

  const posts = readMarkdownPosts();
  fs.writeFileSync(
    path.join(staticDir, 'posts.json'),
    JSON.stringify(posts, null, 2) + '\n'
  );

  writeRoutePage('blog', '../');
  writeRoutePage('posts', '../');

  posts.forEach((post) => {
    writeRoutePage(path.join('blog', post.slug), '../../');
    writeRoutePage(path.join('posts', post.slug), '../../');
  });

  console.log('Built ' + posts.length + ' post(s) for static hosting.');
}

main();
