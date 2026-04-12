const KNSComments = (() => {

  // ── Storage helpers ───────────────────────────────────────
  const RATINGS_KEY  = 'kns_ratings';   // { cocktailId: { username: 1-5 } }
  const COMMENTS_KEY = 'kns_comments';  // { cocktailId: [ { user, text, ts } ] }

  function getRatings() {
    return JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}');
  }
  function getComments() {
    return JSON.parse(localStorage.getItem(COMMENTS_KEY) || '{}');
  }
  function saveRatings(data) {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(data));
  }
  function saveComments(data) {
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(data));
  }
  function currentUser() {
    // Handles both plain string ("bob") AND JSON object ({username:"bob"})
    const raw = localStorage.getItem('kns_user');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // If it parsed to a plain string e.g. JSON.parse('"bob"')
      if (typeof parsed === 'string') return parsed;
      // If it parsed to an object e.g. {username:"bob"}
      return parsed.username || parsed.name || 'Guest';
    } catch {
      // raw is a plain unquoted string like "bob" — use it directly
      return raw;
    }
  }

  // ── Rating helpers ────────────────────────────────────────
  function getUserRating(cocktailId) {
    const u = currentUser();
    if (!u) return 0;
    return (getRatings()[cocktailId] || {})[u] || 0;
  }
  function setUserRating(cocktailId, stars) {
    const u = currentUser();
    if (!u) return;
    const all = getRatings();
    if (!all[cocktailId]) all[cocktailId] = {};
    all[cocktailId][u] = stars;
    saveRatings(all);
  }
  function getAverageRating(cocktailId) {
    const byUser = getRatings()[cocktailId] || {};
    const vals = Object.values(byUser);
    if (!vals.length) return { avg: 0, count: 0 };
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { avg: Math.round(avg * 10) / 10, count: vals.length };
  }

  // ── Comment helpers ───────────────────────────────────────
  function getCommentsFor(cocktailId) {
    return (getComments()[cocktailId] || []).slice().reverse(); // newest first
  }
  function addComment(cocktailId, text) {
    const u = currentUser();
    if (!u || !text.trim()) return false;
    const all = getComments();
    if (!all[cocktailId]) all[cocktailId] = [];
    all[cocktailId].push({ user: u, text: text.trim(), ts: Date.now() });
    saveComments(all);
    return true;
  }
  function deleteComment(cocktailId, ts) {
    const u = currentUser();
    const all = getComments();
    if (!all[cocktailId]) return;
    all[cocktailId] = all[cocktailId].filter(c => !(c.ts === ts && c.user === u));
    saveComments(all);
  }

  // ── Time formatter ────────────────────────────────────────
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // ── Star SVG ──────────────────────────────────────────────
  function starSVG(filled, half = false) {
    const color = filled ? '#c9a84c' : '#2a2d40';
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>`;
  }

  // ── Render stars (interactive) ────────────────────────────
  function renderStarPicker(cocktailId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const current = getUserRating(cocktailId);

    container.innerHTML = `
      <div class="kns-star-picker" aria-label="Rate this cocktail">
        ${[1,2,3,4,5].map(n => `
          <button class="kns-star-btn ${n <= current ? 'active' : ''}"
                  data-star="${n}"
                  aria-label="${n} star${n > 1 ? 's' : ''}"
                  title="${n} star${n > 1 ? 's' : ''}">
            ${starSVG(n <= current)}
          </button>
        `).join('')}
        <span class="kns-your-rating">${current ? `Your rating: ${current}/5` : 'Rate this cocktail'}</span>
      </div>`;

    container.querySelectorAll('.kns-star-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        const hover = +btn.dataset.star;
        container.querySelectorAll('.kns-star-btn').forEach(b => {
          b.innerHTML = starSVG(+b.dataset.star <= hover);
          b.classList.toggle('active', +b.dataset.star <= hover);
        });
      });
      btn.addEventListener('mouseleave', () => {
        const cur = getUserRating(cocktailId);
        container.querySelectorAll('.kns-star-btn').forEach(b => {
          b.innerHTML = starSVG(+b.dataset.star <= cur);
          b.classList.toggle('active', +b.dataset.star <= cur);
        });
      });
      btn.addEventListener('click', () => {
        const stars = +btn.dataset.star;
        setUserRating(cocktailId, stars);
        renderStarPicker(cocktailId, containerId);
        renderAverageRating(cocktailId, 'kns-avg-rating');
        showToast(`You rated this ${stars} star${stars > 1 ? 's' : ''}!`);
      });
    });
  }

  // ── Render average rating display ─────────────────────────
  function renderAverageRating(cocktailId, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const { avg, count } = getAverageRating(cocktailId);
    if (!count) {
      el.innerHTML = `<span class="kns-no-ratings">No ratings yet — be the first!</span>`;
      return;
    }
    const fullStars = Math.floor(avg);
    const halfStar  = avg - fullStars >= 0.5;
    el.innerHTML = `
      <div class="kns-avg-display">
        <span class="kns-avg-number">${avg}</span>
        <div class="kns-avg-stars">
          ${[1,2,3,4,5].map(n => starSVG(n <= fullStars)).join('')}
        </div>
        <span class="kns-avg-count">(${count} rating${count !== 1 ? 's' : ''})</span>
      </div>`;
  }

  // ── Render comments list ──────────────────────────────────
  function renderCommentsList(cocktailId) {
    const list = document.getElementById('kns-comments-list');
    if (!list) return;
    const comments = getCommentsFor(cocktailId);
    const u = currentUser();

    if (!comments.length) {
      list.innerHTML = `<div class="kns-no-comments">No comments yet. Be the first to share your thoughts!</div>`;
      return;
    }

    list.innerHTML = comments.map(c => `
      <div class="kns-comment-card" data-ts="${c.ts}">
        <div class="kns-comment-header">
          <div class="kns-comment-avatar">${c.user.charAt(0).toUpperCase()}</div>
          <div class="kns-comment-meta">
            <span class="kns-comment-user">${escapeHtml(c.user)}</span>
            <span class="kns-comment-time">${timeAgo(c.ts)}</span>
          </div>
          ${c.user === u ? `<button class="kns-delete-btn" data-ts="${c.ts}" title="Delete comment">✕</button>` : ''}
        </div>
        <p class="kns-comment-text">${escapeHtml(c.text)}</p>
      </div>
    `).join('');

    list.querySelectorAll('.kns-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteComment(cocktailId, +btn.dataset.ts);
        renderCommentsList(cocktailId);
        updateCommentCount(cocktailId);
      });
    });
  }

  // ── Update count badge ────────────────────────────────────
  function updateCommentCount(cocktailId) {
    const el = document.getElementById('kns-comment-count');
    const count = getCommentsFor(cocktailId).length;
    if (el) el.textContent = count;
  }

  // ── Toast notification ────────────────────────────────────
  function showToast(msg) {
    let toast = document.getElementById('kns-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'kns-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('kns-toast-show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('kns-toast-show'), 2500);
  }

  // ── Escape HTML ───────────────────────────────────────────
  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Build full section HTML ───────────────────────────────
  function buildSectionHTML(cocktailName) {
    const u = currentUser();
    const isLoggedIn = !!u;

    return `
    <section class="kns-community-section">
      <div class="kns-section-header">
        <h2 class="kns-section-title">Community</h2>
        <span class="kns-section-subtitle">Ratings &amp; Reviews</span>
      </div>

      <!-- RATINGS ROW -->
      <div class="kns-ratings-row">
        <div class="kns-avg-block">
          <p class="kns-block-label">COMMUNITY RATING</p>
          <div id="kns-avg-rating"></div>
        </div>
        <div class="kns-divider-v"></div>
        <div class="kns-rate-block">
          <p class="kns-block-label">YOUR RATING</p>
          ${isLoggedIn
            ? `<div id="kns-star-picker"></div>`
            : `<p class="kns-login-prompt"><a href="login.html">Sign in</a> to rate this cocktail</p>`}
        </div>
      </div>

      <!-- COMMENTS -->
      <div class="kns-comments-block">
        <div class="kns-comments-header">
          <h3 class="kns-comments-title">Comments <span class="kns-count-badge" id="kns-comment-count">0</span></h3>
        </div>

        ${isLoggedIn ? `
        <div class="kns-add-comment">
          <div class="kns-comment-avatar kns-my-avatar">${u.charAt(0).toUpperCase()}</div>
          <div class="kns-comment-input-wrap">
            <textarea id="kns-comment-input"
                      placeholder="Share your thoughts on ${cocktailName}..."
                      maxlength="400"
                      rows="3"></textarea>
            <div class="kns-input-footer">
              <span class="kns-char-count"><span id="kns-chars">0</span>/400</span>
              <button id="kns-submit-btn" class="kns-submit-btn">Post Comment</button>
            </div>
          </div>
        </div>` : `
        <div class="kns-login-banner">
          <a href="login.html">Sign in</a> to leave a comment
        </div>`}

        <div id="kns-comments-list" class="kns-comments-list"></div>
      </div>
    </section>`;
  }

  // ── Public init ───────────────────────────────────────────
  function init(cocktailId, cocktailName = 'this cocktail') {
    // Find or create mount point
    let mount = document.getElementById('kns-community-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'kns-community-mount';
      // Append after ingredients/instructions section if possible
      const main = document.querySelector('main') || document.body;
      main.appendChild(mount);
    }

    mount.innerHTML = buildSectionHTML(cocktailName);

    // Render dynamic parts
    renderAverageRating(cocktailId, 'kns-avg-rating');
    if (currentUser()) {
      renderStarPicker(cocktailId, 'kns-star-picker');
    }
    renderCommentsList(cocktailId);
    updateCommentCount(cocktailId);

    // Wire up comment submission
    const input  = document.getElementById('kns-comment-input');
    const submit = document.getElementById('kns-submit-btn');
    const chars  = document.getElementById('kns-chars');

    if (input) {
      input.addEventListener('input', () => {
        if (chars) chars.textContent = input.value.length;
        if (submit) submit.disabled = !input.value.trim();
      });
    }
    if (submit) {
      submit.disabled = true;
      submit.addEventListener('click', () => {
        const ok = addComment(cocktailId, input.value);
        if (ok) {
          input.value = '';
          if (chars) chars.textContent = '0';
          submit.disabled = true;
          renderCommentsList(cocktailId);
          updateCommentCount(cocktailId);
          showToast('Comment posted!');
        }
      });
    }
  }

  return { init };
})();

