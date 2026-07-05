(function () {
  var feed = document.getElementById('writing-feed');
  var routeShell = document.getElementById('route-shell');
  var homeShell = document.getElementById('home-shell');
  var state = { posts: [], ready: false };
  var basePath = getBasePath();

  function getBasePath() {
    var script = document.currentScript && document.currentScript.src;
    if (!script) return '';

    try {
      var pathname = new URL(script).pathname;
      var marker = '/static/app.js';
      var markerIndex = pathname.lastIndexOf(marker);
      if (markerIndex <= 0) return '';
      return pathname.slice(0, markerIndex).replace(/\/+$/, '');
    } catch (error) {
      return '';
    }
  }

  function withBase(path) {
    if (!path || /^(https?:|mailto:|tel:|#)/i.test(path)) return path;
    if (path.charAt(0) !== '/') return path;
    return (basePath + path) || '/';
  }

  function stripBase(pathname) {
    if (!basePath) return pathname || '/';
    if (pathname === basePath) return '/';
    if (pathname.indexOf(basePath + '/') === 0) return pathname.slice(basePath.length) || '/';
    return pathname || '/';
  }

  function rewriteRootRelativeUrls(html) {
    return String(html || '').replace(/\b(src|href)="\/(content|static)\//g, function (_match, attr, folder) {
      return attr + '="' + withBase('/' + folder + '/');
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getRoute(pathname) {
    var normalized = window.normalizeRoute(stripBase(pathname || window.location.pathname));
    if (normalized === '/blog' || normalized === '/posts') {
      return { type: 'blog' };
    }
    if (normalized.indexOf('/blog/') === 0) {
      return { type: 'post', slug: normalized.slice('/blog/'.length) };
    }
    if (normalized.indexOf('/posts/') === 0) {
      return { type: 'post', slug: normalized.slice('/posts/'.length) };
    }
    return { type: 'home' };
  }

  function showHomeView() {
    document.body.classList.remove('route-page');
    homeShell.style.display = 'block';
    routeShell.innerHTML = '';
  }

  function showRouteView() {
    document.body.classList.add('route-page');
    homeShell.style.display = 'none';
  }

  function renderHome(posts) {
    showHomeView();

    if (!posts.length) {
      feed.innerHTML = '<div class="blog-soon">Nothing here yet — but soon.</div>';
      return;
    }

    var html = '<div class="sh">recent posts</div>';
    html += posts.slice(0, 3).map(function (post) {
      var tags = (post.tags || []).map(function (tag) {
        return '<span class="post-card-tag">' + escapeHtml(tag) + '</span>';
      }).join('');

      return '<div class="post-card">' +
        '<a class="post-card-link" href="' + escapeHtml(withBase('/blog/' + post.slug)) + '" data-route="/blog/' + escapeHtml(post.slug) + '">' +
        '<div class="post-card-title">' + escapeHtml(post.title) + '</div>' +
        '<div class="post-card-meta">' + escapeHtml(post.date || 'draft') + '</div>' +
        '<div class="post-card-desc">' + escapeHtml(post.description || 'A short note from the kennel.') + '</div>' +
        (tags ? '<div class="post-card-tags">' + tags + '</div>' : '') +
        '</a></div>';
    }).join('');

    feed.innerHTML = html;
    document.title = "Saankhya's Kennel";
  }

  function renderBlogIndex(posts) {
    if (!posts.length) {
      showRouteView();
      routeShell.innerHTML = '<div class="post-shell"><div class="post-article"><div class="post-kicker">blog</div><div class="post-title">Blog</div><div class="post-body"><p>No posts yet.</p></div></div></div>';
      return;
    }

    var cards = posts.map(function (post) {
      var tags = (post.tags || []).map(function (tag) {
        return '<span class="post-card-tag">' + escapeHtml(tag) + '</span>';
      }).join('');

      return '<div class="post-card">' +
        '<a class="post-card-link" href="' + escapeHtml(withBase('/blog/' + post.slug)) + '" data-route="/blog/' + escapeHtml(post.slug) + '">' +
        '<div class="post-card-title">' + escapeHtml(post.title) + '</div>' +
        '<div class="post-card-meta">' + escapeHtml(post.date || 'draft') + '</div>' +
        '<div class="post-card-desc">' + escapeHtml(post.description || 'A short note from the kennel.') + '</div>' +
        (tags ? '<div class="post-card-tags">' + tags + '</div>' : '') +
        '</a></div>';
    }).join('');

    showRouteView();
    routeShell.innerHTML = '<div class="post-shell">' +
      '<div class="post-topbar">' +
      '<a class="lnk" href="' + escapeHtml(withBase('/')) + '" data-route="/">← home</a>' +
      '</div>' +
      '<article class="post-article">' +
      '<div class="post-kicker">blog</div>' +
      '<div class="post-title">Blog</div>' +
      '<div class="post-meta">Notes, experiments, and the occasional systems rabbit hole.</div>' +
      '<div class="post-body">' + cards + '</div>' +
      '</article>' +
      '</div>';

    document.title = 'Blog · Saankhya\'s Kennel';
  }

  function renderPostView(post, parsed) {
    showRouteView();
    routeShell.innerHTML = '<div class="post-shell">' +
      '<div class="post-topbar">' +
      '<a class="lnk" href="' + escapeHtml(withBase('/blog')) + '" data-route="/blog">← blog</a>' +
      '<a class="lnk" href="' + escapeHtml(withBase('/')) + '" data-route="/">← home</a>' +
      '</div>' +
      '<article class="post-article">' +
      '<div class="post-kicker">blog</div>' +
      '<div class="post-title">' + escapeHtml(parsed.title) + '</div>' +
      '<div class="post-meta">' + escapeHtml(parsed.date || 'draft') + '</div>' +
      '<div class="post-body">' + rewriteRootRelativeUrls(parsed.html) + '</div>' +
      '</article>' +
      '</div>';

    document.title = parsed.title + ' · Saankhya\'s Kennel';

    // Trigger syntax highlighting on injected code blocks
    if (window.hljs) {
      routeShell.querySelectorAll('pre code').forEach(function (block) {
        window.hljs.highlightElement(block);
      });
    }
  }

  async function loadPosts() {
    if (state.ready) return state.posts;

    try {
      var response = await fetch(withBase('/static/posts.json'));
      var contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.indexOf('application/json') !== -1) {
        var posts = await response.json();
        posts.sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });
        state.posts = posts;
        state.ready = true;
        return state.posts;
      }
    } catch (e) {
      console.warn('Failed to load posts from static/posts.json, trying fallback', e);
    }

    var response = await fetch(withBase('/api/posts'));
    var contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.indexOf('application/json') === -1) throw new Error('Unable to load posts');
    state.posts = await response.json();
    state.ready = true;
    return state.posts;
  }

  async function renderRoute(pathname) {
    var route = getRoute(pathname);

    if (route.type === 'post') {
      try {
        await loadPosts();
        var post = state.posts.find(function (item) {
          return item.slug === route.slug;
        });

        if (!post) {
          showRouteView();
          routeShell.innerHTML = '<div class="t-err">That post could not be found.</div>';
          return;
        }

        var parsed = post.html ? post : null;
        try {
          if (!parsed) {
            var postResponse = await fetch(withBase('/api/post/' + post.slug));
            var contentType = postResponse.headers.get('content-type') || '';
            if (postResponse.ok && contentType.indexOf('application/json') !== -1) {
              parsed = await postResponse.json();
            }
          }
        } catch (e) {
          console.warn('Failed to fetch post from API, trying markdown file', e);
        }

        if (!parsed) {
          var markdownResponse = await fetch(withBase('/content/posts/' + post.slug + '.md'));
          if (!markdownResponse.ok) {
            showRouteView();
            routeShell.innerHTML = '<div class="t-err">The markdown file for this post is missing.</div>';
            return;
          }
          var markdownText = await markdownResponse.text();
          parsed = window.parseMarkdownPost(markdownText, post.slug);
        }

        renderPostView(post, parsed);
      } catch (error) {
        showRouteView();
        routeShell.innerHTML = '<div class="t-err">Unable to render this post right now.</div>';
      }
      return;
    }

    if (route.type === 'blog') {
      try {
        await loadPosts();
        renderBlogIndex(state.posts);
      } catch (error) {
        showRouteView();
        routeShell.innerHTML = '<div class="t-err">Unable to load the blog right now.</div>';
      }
      return;
    }

    try {
      await loadPosts();
      renderHome(state.posts);
    } catch (error) {
      if (feed) {
        feed.innerHTML = '<div class="t-err">Unable to load posts right now.</div>';
      }
    }
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-route]');
    if (!link) return;

    var target = link.getAttribute('data-route');
    if (!target) return;

    event.preventDefault();
    history.pushState(null, '', withBase(target));
    renderRoute(target);
  });

  window.addEventListener('popstate', function () {
    renderRoute(window.location.pathname);
  });

  renderRoute(window.location.pathname);
})();
