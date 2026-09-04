/**
 * SelfTest Wiki — a small server-rendered wiki used as a test target.
 *
 * Pages: a dashboard with a recent-activity feed, a book list with create form,
 * a wiki page with a threaded comment section, and per-book detail pages.
 *
 * State is in-memory and deterministic. POST /__reset restores the seed data.
 * No dependencies; Node's http module only.
 *
 * NOTE: this file is deliberately free of any description of the evaluation
 * harness that uses it. Explaining the harness here would leak evaluation
 * context to an agent that reads the application source. See
 * src/general_agent_eval/webtestpilot/README.md instead.
 */
'use strict';

const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8099);

// --------------------------------------------------------------------- state

const seed = () => ({
  books: [
    { slug: 'book1', title: 'Book1', description: 'First seeded book' },
    { slug: 'book2', title: 'Book2', description: 'Second seeded book' },
    { slug: 'new-book', title: 'New Book', description: 'Original Description' },
  ],
  // Nested three deep so re-parenting the innermost branch is observable.
  comments: [
    {
      id: 1, author: 'Admin', body: 'Top level comment', children: [
        {
          id: 2, author: 'Admin', body: 'First reply', children: [
            { id: 3, author: 'Admin', body: 'Nested reply', children: [] },
          ],
        },
      ],
    },
  ],
  activity: [
    { href: '/books/book1', label: 'Book1', action: 'created book', when: '2 minutes ago' },
    { href: '/books/book2', label: 'Book2', action: 'updated book', when: '5 minutes ago' },
  ],
  nextCommentId: 4,
});

let state = seed();

// ---------------------------------------------------------------------- html

const layout = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | SelfTest Wiki</title>
<style>
 body{font-family:system-ui,sans-serif;margin:0;color:#222;background:#fff}
 header{background:#206ea7;color:#fff;padding:.75rem 1.25rem}
 header a{color:#fff;margin-right:1rem;text-decoration:none}
 main{padding:1.25rem;max-width:60rem}
 .grid{display:flex;flex-wrap:wrap;gap:1rem}
 .grid-card{border:1px solid #ddd;border-radius:4px;padding:1rem;width:16rem}
 .text-muted{color:#666}
 .comment-branch{margin:.5rem 0}
 .comment-branch-children{margin-left:2rem;border-left:2px solid #eee;padding-left:1rem}
 .comment-box{border:1px solid #eee;border-radius:4px;padding:.5rem}
 .activity-list-item{padding:.35rem 0}
 label{display:block;margin:.5rem 0 .2rem}
 input,textarea{padding:.4rem;width:22rem}
 button{padding:.45rem .9rem;cursor:pointer}
</style></head>
<body>
<header>
  <a href="/">Dashboard</a><a href="/books">Books</a><a href="/page/template">Page Template</a>
</header>
<main>${body}</main>
</body></html>`;

const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const renderComment = (comment) => `
<div class="comment-branch">
  <div class="comment-box" id="comment${comment.id}">
    <div class="header">
      <a href="/user/admin">${escape(comment.author)}</a> <span class="text-muted">commented</span>
    </div>
    <div class="content"><p>${escape(comment.body)}</p></div>
    <form method="POST" action="/comments" style="margin-top:.35rem">
      <input type="hidden" name="parent" value="${comment.id}">
      <input type="text" name="body" aria-label="Reply to comment ${comment.id}" placeholder="Reply">
      <button type="submit">Reply</button>
    </form>
  </div>
  ${comment.children.length
    ? `<div class="comment-branch-children">${comment.children.map(renderComment).join('')}</div>`
    : ''}
</div>`;

const dashboard = () => layout('Dashboard', `
<h1 class="list-heading">Dashboard</h1>
<div id="recent-user-activity">
  <h5>Recent Activity</h5>
  <div class="activity-list">
    ${state.activity.map((item) => `
    <div class="activity-list-item">
      <a href="${item.href}">${escape(item.label)}</a>
      <span>${escape(item.action)}</span>
      <span class="text-muted"><svg width="12" height="12"></svg><small> ${escape(item.when)}</small></span>
    </div>`).join('')}
  </div>
</div>`);

const booksPage = () => layout('Books', `
<h1 class="list-heading">Books</h1>
<p><a href="/books/new">Create a book</a></p>
<div class="grid">
  ${state.books.map((book) => `
  <div class="grid-card">
    <div class="grid-card-content">
      <h2>${escape(book.title)}</h2>
      <p class="text-muted">${escape(book.description)}</p>
    </div>
  </div>`).join('')}
</div>`);

const newBookPage = () => layout('Create Book', `
<h1 class="list-heading">Create Book</h1>
<form method="POST" action="/books">
  <label for="title">Title</label><input id="title" name="title" type="text" required>
  <label for="description">Description</label><textarea id="description" name="description"></textarea>
  <p><button type="submit">Save Book</button></p>
</form>`);

const pageTemplate = () => layout('Page Template', `
<h1 id="bkmrk-page-title">Page Template</h1>
<p>A seeded wiki page used for comment-thread testing.</p>
<section id="comments">
  <h5>Comments</h5>
  <div class="comment-container">${state.comments.map(renderComment).join('')}</div>
  <form method="POST" action="/comments">
    <label for="new-comment">Leave a comment here</label>
    <textarea id="new-comment" name="body" required></textarea>
    <p><button type="submit">Save Comment</button></p>
  </form>
</section>`);

// -------------------------------------------------------------------- server

const readBody = (request) =>
  new Promise((resolve) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => resolve(new URLSearchParams(raw)));
  });

const addReply = (nodes, parentId, comment) => {
  for (const node of nodes) {
    if (node.id === parentId) { node.children.push(comment); return true; }
    if (addReply(node.children, parentId, comment)) return true;
  }
  return false;
};

const send = (response, status, body, type = 'text/html; charset=utf-8') => {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  response.end(body);
};

const redirect = (response, location) => {
  response.writeHead(303, { Location: location, 'Cache-Control': 'no-store' });
  response.end();
};

http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (request.method === 'POST' && path === '/__reset') {
    state = seed();
    return send(response, 200, JSON.stringify({ reset: true }), 'application/json');
  }
  if (path === '/health') return send(response, 200, 'SELFTEST OK', 'text/plain');

  if (request.method === 'POST' && path === '/books') {
    const form = await readBody(request);
    const title = (form.get('title') || '').trim();
    if (title) {
      state.books.push({
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title,
        description: (form.get('description') || '').trim(),
      });
      state.activity.unshift({
        href: `/books/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: title, action: 'created book', when: 'just now',
      });
    }
    return redirect(response, '/books');
  }

  if (request.method === 'POST' && path === '/comments') {
    const form = await readBody(request);
    const body = (form.get('body') || '').trim();
    const parent = Number(form.get('parent') || 0);
    if (body) {
      const comment = { id: state.nextCommentId++, author: 'Admin', body, children: [] };
      if (!parent || !addReply(state.comments, parent, comment)) state.comments.push(comment);
    }
    return redirect(response, '/page/template');
  }

  if (request.method === 'GET') {
    if (path === '/') return send(response, 200, dashboard());
    if (path === '/books') return send(response, 200, booksPage());
    if (path === '/books/new') return send(response, 200, newBookPage());
    if (path === '/page/template') return send(response, 200, pageTemplate());
    if (path.startsWith('/books/')) {
      const book = state.books.find((item) => item.slug === path.split('/')[2]);
      if (book) {
        return send(response, 200, layout(book.title,
          `<h1 class="break-text">${escape(book.title)}</h1>
           <p class="text-muted">${escape(book.description)}</p>
           <h4 class="entity-list-item-name break-text">Page 1</h4>`));
      }
    }
  }

  send(response, 404, layout('Not found', '<h1>Not found</h1>'));
}).listen(PORT, '127.0.0.1', () => {
  console.log(`selftest app listening on http://127.0.0.1:${PORT}`);
});
