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

// Render inline markdown: bold, italic, inline code, links — in the right order
function renderInline(text) {
  // Split on backtick spans first to avoid escaping inside code
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // code span — escape then wrap, don't apply other transforms
      const inner = part.slice(1, -1);
      return '<code>' + escapeHtml(inner) + '</code>';
    }
    // Regular text — escape then apply inline formatting
    let s = escapeHtml(part);
    // bold
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }).join('');
}

/**
 * Proper line-by-line state machine Markdown renderer.
 * Handles: fenced code blocks, headings, blockquotes, horizontal rules,
 * ordered/unordered lists, images, paragraphs.
 * Emits data-language on <code> for highlight.js.
 */
function renderMarkdown(body, slug) {
  if (!body || !body.trim()) return '';

  const lines = body.split(/\r?\n/);
  let html = '';

  // State
  let inFence = false;
  let fenceLang = '';
  let fenceLines = [];

  let inList = false;       // ul
  let inOrderedList = false; // ol
  let listItems = [];

  let inBlockquote = false;
  let bqLines = [];

  let paraLines = [];

  function flushPara() {
    if (!paraLines.length) return;
    const text = paraLines.join(' ').trim();
    if (text) html += '<p>' + renderInline(text) + '</p>\n';
    paraLines = [];
  }

  function flushList() {
    if (!inList && !inOrderedList) return;
    const tag = inOrderedList ? 'ol' : 'ul';
    html += '<' + tag + '>' + listItems.map(function(li) {
      return '<li>' + renderInline(li) + '</li>';
    }).join('') + '</' + tag + '>\n';
    listItems = [];
    inList = false;
    inOrderedList = false;
  }

  function flushBlockquote() {
    if (!inBlockquote) return;
    html += '<blockquote>' + bqLines.map(function(l) {
      return '<p>' + renderInline(l) + '</p>';
    }).join('') + '</blockquote>\n';
    bqLines = [];
    inBlockquote = false;
  }

  function flushFence() {
    const code = fenceLines.join('\n');
    const langAttr = fenceLang ? ' class="language-' + escapeHtml(fenceLang) + '"' : '';
    html += '<pre><code' + langAttr + '>' + escapeHtml(code) + '</code></pre>\n';
    fenceLines = [];
    fenceLang = '';
    inFence = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\r$/, '');

    // ── Fenced code block ────────────────────────────────────────
    if (!inFence && /^```/.test(line)) {
      flushPara();
      flushList();
      flushBlockquote();
      fenceLang = line.replace(/^```/, '').trim();
      inFence = true;
      fenceLines = [];
      continue;
    }
    if (inFence) {
      if (/^```/.test(line)) {
        flushFence();
      } else {
        fenceLines.push(line);
      }
      continue;
    }

    // ── Blank line ────────────────────────────────────────────────
    if (!line.trim()) {
      flushPara();
      flushList();
      flushBlockquote();
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      flushList();
      flushBlockquote();
      html += '<hr>\n';
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────
    if (/^#{1,6}\s+/.test(line)) {
      flushPara();
      flushList();
      flushBlockquote();
      const depth = line.match(/^#+/)[0].length;
      const content = line.replace(/^#{1,6}\s+/, '').replace(/\s+#+\s*$/, '');
      html += '<h' + depth + '>' + renderInline(content) + '</h' + depth + '>\n';
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────
    if (/^>\s?/.test(line)) {
      flushPara();
      flushList();
      inBlockquote = true;
      bqLines.push(line.replace(/^>\s?/, ''));
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // ── Unordered list ────────────────────────────────────────────
    if (/^[-*+]\s+/.test(line)) {
      flushPara();
      if (inOrderedList) flushList();
      inList = true;
      listItems.push(line.replace(/^[-*+]\s+/, ''));
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────
    if (/^\d+\.\s+/.test(line)) {
      flushPara();
      if (inList) flushList();
      inOrderedList = true;
      listItems.push(line.replace(/^\d+\.\s+/, ''));
      continue;
    }

    // If we were building a list and hit non-list content, flush it
    if (inList || inOrderedList) {
      flushList();
    }

    // ── Standalone image ─────────────────────────────────────────
    const imgMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      flushPara();
      const alt = imgMatch[1];
      const src = resolveAssetPath(imgMatch[2], slug);
      html += '<figure><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async" /></figure>\n';
      continue;
    }

    // ── Table ─────────────────────────────────────────────────────
    if (line.includes('|')) {
      // Peek ahead — if next line is a separator row, this is a table header
      const nextLine = lines[i + 1] ? lines[i + 1].replace(/\r$/, '') : '';
      if (/^\|?[\s\-:]+\|/.test(nextLine)) {
        flushPara();
        flushList();
        flushBlockquote();
        // Collect table rows
        const tableRows = [line];
        i++; // skip separator
        while (i + 1 < lines.length && lines[i + 1] && lines[i + 1].replace(/\r$/, '').includes('|')) {
          i++;
          tableRows.push(lines[i].replace(/\r$/, ''));
        }
        const parseRow = (r) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const headers = parseRow(tableRows[0]);
        const dataRows = tableRows.slice(1);
        let table = '<table>\n<thead><tr>' + headers.map(h => '<th>' + renderInline(h) + '</th>').join('') + '</tr></thead>\n<tbody>\n';
        for (const row of dataRows) {
          const cells = parseRow(row);
          table += '<tr>' + cells.map(c => '<td>' + renderInline(c) + '</td>').join('') + '</tr>\n';
        }
        table += '</tbody></table>\n';
        html += table;
        continue;
      }
    }

    // ── Paragraph accumulator ─────────────────────────────────────
    paraLines.push(line);
  }

  // Flush anything remaining
  flushPara();
  flushList();
  flushBlockquote();
  if (inFence) flushFence(); // unclosed fence — emit anyway

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
