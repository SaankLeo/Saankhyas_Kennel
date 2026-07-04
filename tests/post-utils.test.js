const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMarkdownPost, normalizeRoute } = require('../static/post-utils.js');

test('parseMarkdownPost extracts frontmatter and body content', () => {
  const markdown = `---\ntitle: "Building Mocker"\ndate: 2025-06-01\ndescription: "A short note"\ncollections: ["posts"]\ntags: ["systems", "C++"]\n---\n\n# Hello world\n\nThis is a paragraph.`;

  const post = parseMarkdownPost(markdown, 'mocker-cpu-emulator');
  assert.equal(post.title, 'Building Mocker');
  assert.equal(post.slug, 'mocker-cpu-emulator');
  assert.match(post.html, /Hello world/);
  assert.match(post.html, /This is a paragraph/);
});

test('normalizeRoute resolves post URLs', () => {
  assert.equal(normalizeRoute('/'), '/');
  assert.equal(normalizeRoute('/posts'), '/posts');
  assert.equal(normalizeRoute('/posts/'), '/posts');
  assert.equal(normalizeRoute('/posts/mocker-cpu-emulator'), '/posts/mocker-cpu-emulator');
});

test('parseMarkdownPost resolves relative images against the posts directory', () => {
  const markdown = 'Here is an image:\n\n![diagram](image1.png)';
  const post = parseMarkdownPost(markdown, 'mocker-cpu-emulator');
  assert.match(post.html, /src="\/content\/posts\/image1\.png"/);
});
