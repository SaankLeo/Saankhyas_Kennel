function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveAssetPath(assetPath, slug) {
  if (!assetPath) return assetPath;
  const trimmed = assetPath.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }

  return '/content/posts/' + trimmed;
}

function parseFrontMatter(source) {
  const fields = {};
  const lines = source.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || !line.includes(':')) continue;

    const separator = line.indexOf(':');
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      if (!inner) {
        fields[key] = [];
      } else {
        fields[key] = inner.split(',').map((item) => item.trim().replace(/^"|"$/g, ''));
      }
    } else {
      fields[key] = value.replace(/^"|"$/g, '');
    }
  }

  return fields;
}

function renderInline(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return safe;
}

function renderMarkdown(body, slug) {
  if (!body || !body.trim()) return '';

  const blocks = body.trim().split(/\n{2,}/);
  let html = '';

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (/^```/.test(trimmed)) {
      const codeLines = trimmed.replace(/^```[\w-]*\s*/, '').replace(/```$/, '').split('\n');
      html += '<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>';
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      const depth = trimmed.match(/^#+/)[0].length;
      const content = trimmed.replace(/^#{1,6}\s+/, '');
      html += '<h' + depth + '>' + renderInline(content) + '</h' + depth + '>';
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = trimmed.split(/\n/).filter(Boolean).map((line) => '<li>' + renderInline(line.replace(/^[-*]\s+/, '')) + '</li>');
      html += '<ul>' + items.join('') + '</ul>';
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = trimmed.split(/\n/).filter(Boolean).map((line) => '<li>' + renderInline(line.replace(/^\d+\.\s+/, '')) + '</li>');
      html += '<ol>' + items.join('') + '</ol>';
      continue;
    }

    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)/);
    if (imageMatch) {
      const assetPath = resolveAssetPath(imageMatch[2], slug);
      html += '<figure><img src="' + escapeHtml(assetPath) + '" alt="' + escapeHtml(imageMatch[1]) + '" loading="eager" decoding="async" /></figure>';
      continue;
    }

    const lines = trimmed.split(/\n/);
    const paragraphs = [];
    let current = [];

    for (const line of lines) {
      if (!line.trim()) {
        if (current.length) {
          paragraphs.push(current.join(' '));
          current = [];
        }
        continue;
      }
      current.push(line.trim());
    }

    if (current.length) {
      paragraphs.push(current.join(' '));
    }

    if (paragraphs.length) {
      html += paragraphs.map((paragraph) => '<p>' + renderInline(paragraph) + '</p>').join('');
    } else {
      html += '<p>' + renderInline(trimmed) + '</p>';
    }
  }

  return html;
}

function normalizeRoute(pathname) {
  const safePath = pathname || '/';
  const clean = safePath.replace(/\\/g, '/');
  const withoutTrailingSlash = clean === '/' ? '/' : clean.replace(/\/+$/, '');

  if (!withoutTrailingSlash || withoutTrailingSlash === '/') {
    return '/';
  }

  return withoutTrailingSlash;
}

function parseMarkdownPost(markdown, slug) {
  const frontMatterMatch = markdown.match(/^---\s*([\s\S]*?)\s*---\s*/);
  const frontMatter = frontMatterMatch ? parseFrontMatter(frontMatterMatch[1]) : {};
  const body = frontMatterMatch ? markdown.slice(frontMatterMatch[0].length) : markdown;

  const title = frontMatter.title || slug.replace(/-/g, ' ');
  const date = frontMatter.date || '';
  const description = frontMatter.description || '';
  const collections = Array.isArray(frontMatter.collections)
    ? frontMatter.collections
    : (frontMatter.collections ? frontMatter.collections.split(',').map((item) => item.trim()) : []);
  const tags = Array.isArray(frontMatter.tags)
    ? frontMatter.tags
    : (frontMatter.tags ? frontMatter.tags.split(',').map((item) => item.trim()) : []);

  return {
    slug,
    title,
    date,
    description,
    collections,
    tags,
    html: renderMarkdown(body, slug)
  };
}

const postUtils = {
  parseMarkdownPost,
  normalizeRoute
};

if (typeof window !== 'undefined') {
  window.parseMarkdownPost = parseMarkdownPost;
  window.normalizeRoute = normalizeRoute;
}

if (typeof module !== 'undefined') {
  module.exports = postUtils;
}
