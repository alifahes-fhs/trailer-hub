/* ============================================================
   TRAILER HUB — enhancements.js
   Adds:
     1. Fullscreen trailer modal for home-page cards
     2. Actor filmography panel on cast card click (movie.html)
   Safe: does NOT overwrite any existing functions.
   Load AFTER script.js.
============================================================ */

(function () {
  'use strict';

  /* ── Constants (same as script.js) ── */
  const API_KEY  = 'afecc8075597c531e9aae083331172c6';
  const BASE_URL = 'https://api.themoviedb.org/3';
  const IMG_300  = 'https://image.tmdb.org/t/p/w300';
  const IMG_500  = 'https://image.tmdb.org/t/p/w500';

  /* ================================================================
     TASK 1 — FULLSCREEN TRAILER MODAL
     Intercepts "▶ WATCH TRAILER" clicks on home-page cards and
     opens a fixed full-viewport overlay with the YouTube embed.
     The original playTrailerInsideCard still exists but we redirect
     the click before it reaches it.
  ================================================================ */

  /* Build the modal DOM once */
  function buildTrailerModal() {
    if (document.getElementById('th-trailer-modal')) return;

    const style = document.createElement('style');
    style.textContent = `
      #th-trailer-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0,0,0,0.96);
        flex-direction: column;
        align-items: center;
        justify-content: center;
        animation: thModalIn .22s ease;
      }
      #th-trailer-modal.open { display: flex; }
      @keyframes thModalIn {
        from { opacity: 0; transform: scale(.97); }
        to   { opacity: 1; transform: scale(1); }
      }
      #th-modal-header {
        width: 100%;
        max-width: 960px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px 12px;
        gap: 12px;
        flex-shrink: 0;
      }
      #th-modal-title {
        font-family: var(--font-d, 'Barlow Condensed', sans-serif);
        font-size: clamp(16px, 2.5vw, 22px);
        font-weight: 700;
        color: #fff;
        letter-spacing: .04em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #th-modal-close {
        background: rgba(255,255,255,.12);
        border: none;
        color: #fff;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background .15s;
      }
      #th-modal-close:hover { background: rgba(255,255,255,.25); }
      #th-modal-video-wrap {
        width: 100%;
        max-width: 960px;
        position: relative;
        padding-bottom: min(54%, 540px);
        height: 0;
        border-radius: 14px;
        overflow: hidden;
        background: #000;
        flex-shrink: 0;
      }
      #th-modal-video-wrap iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
      }
      #th-modal-spinner {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
        border-radius: 14px;
      }
      #th-modal-spinner .th-spin {
        width: 44px;
        height: 44px;
        border: 3px solid #6C63FF;
        border-top-color: transparent;
        border-radius: 50%;
        animation: thSpin .8s linear infinite;
      }
      @keyframes thSpin { to { transform: rotate(360deg); } }
      #th-modal-no-trailer {
        position: absolute;
        inset: 0;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #888;
        gap: 10px;
        font-size: 13px;
      }
      #th-modal-no-trailer span { font-size: 36px; }
      #th-modal-footer {
        width: 100%;
        max-width: 960px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        color: rgba(255,255,255,.4);
        font-size: 11px;
        flex-shrink: 0;
      }
      @media (max-width: 600px) {
        #th-modal-video-wrap { padding-bottom: 56.25%; border-radius: 8px; }
        #th-modal-header { padding: 12px 14px 8px; }
      }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'th-trailer-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div id="th-modal-header">
        <div id="th-modal-title">Loading…</div>
        <button id="th-modal-close" title="Close (Esc)">✕</button>
      </div>
      <div id="th-modal-video-wrap">
        <div id="th-modal-spinner"><div class="th-spin"></div></div>
        <div id="th-modal-no-trailer">
          <span>🎬</span>
          <p>No trailer available for this title.</p>
        </div>
      </div>
      <div id="th-modal-footer">
        <span>TRAILER HUB</span>
        <span>Press <kbd style="background:rgba(255,255,255,.1);padding:2px 6px;border-radius:4px">Esc</kbd> to close</span>
      </div>
    `;
    document.body.appendChild(modal);

    /* Close handlers */
    document.getElementById('th-modal-close').addEventListener('click', closeTrailerModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeTrailerModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTrailerModal(); });
  }

  function closeTrailerModal() {
    const modal = document.getElementById('th-trailer-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    /* Kill iframe to stop audio */
    const wrap = document.getElementById('th-modal-video-wrap');
    const iframes = wrap.querySelectorAll('iframe');
    iframes.forEach(f => f.remove());
    document.getElementById('th-modal-spinner').style.display = 'flex';
    document.getElementById('th-modal-no-trailer').style.display = 'none';
  }

  async function openTrailerModal(item, type) {
    buildTrailerModal();
    const modal   = document.getElementById('th-trailer-modal');
    const titleEl = document.getElementById('th-modal-title');
    const wrap    = document.getElementById('th-modal-video-wrap');
    const spinner = document.getElementById('th-modal-spinner');
    const noTrailer = document.getElementById('th-modal-no-trailer');

    /* Reset state */
    wrap.querySelectorAll('iframe').forEach(f => f.remove());
    spinner.style.display = 'flex';
    noTrailer.style.display = 'none';
    titleEl.textContent = item.title || item.name || 'Trailer';

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    try {
      const endpoint = type === 'tv'
        ? `${BASE_URL}/tv/${item.id}/videos?api_key=${API_KEY}`
        : `${BASE_URL}/movie/${item.id}/videos?api_key=${API_KEY}`;
      const res  = await fetch(endpoint);
      const data = await res.json();
      const vids = data.results || [];
      const clip = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
        || vids.find(v => v.site === 'YouTube' && v.type === 'Trailer')
        || vids.find(v => v.site === 'YouTube' && v.type === 'Teaser')
        || vids.find(v => v.site === 'YouTube');

      spinner.style.display = 'none';
      if (!clip) {
        noTrailer.style.display = 'flex';
        return;
      }
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${clip.key}?autoplay=1&rel=0&modestbranding=1`;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      wrap.appendChild(iframe);
    } catch {
      spinner.style.display = 'none';
      noTrailer.style.display = 'flex';
    }
  }

  /* ── Intercept "▶ WATCH TRAILER" clicks on home-page cards ──
     We listen at the document level (delegation) so it catches
     dynamically added cards too.  Only intercepts on pages that
     are NOT movie.html (detail page keeps its own trailer logic). */
  const isDetailPage = window.location.pathname.includes('movie.html');

  if (!isDetailPage) {
    buildTrailerModal(); /* build early so no flash */

    document.addEventListener('click', e => {
      const btn = e.target.closest('.watch-trailer-btn');
      if (!btn) return;

      const card = btn.closest('[data-id][data-type]') || btn.closest('.movie-card, .trending-card');
      if (!card) return;

      const id   = card.getAttribute('data-id');
      const type = card.getAttribute('data-type') || 'movie';
      if (!id) return;

      /* Reconstruct minimal item object needed by openTrailerModal */
      const titleEl = card.querySelector('.card-title, .trending-title');
      const item = {
        id,
        title: titleEl ? titleEl.textContent.trim() : '',
        poster_path: '',
      };

      /* Prevent the original handler from also firing */
      e.stopImmediatePropagation();
      e.preventDefault();

      openTrailerModal(item, type);
    }, true /* capture phase — runs before bubble phase handlers */);
  }


  /* ================================================================
     TASK 3 — ACTOR FILMOGRAPHY PANEL
     Only active on movie.html.  We watch for the cast row to be
     rendered, then make each .cast-card clickable.
  ================================================================ */

  if (isDetailPage) {

    /* Build actor panel DOM once */
    function buildActorPanel() {
      if (document.getElementById('th-actor-panel')) return;

      const style = document.createElement('style');
      style.textContent = `
        #th-actor-panel {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(0,0,0,.88);
          align-items: flex-start;
          justify-content: center;
          padding: 24px 16px 32px;
          overflow-y: auto;
          animation: thModalIn .22s ease;
        }
        #th-actor-panel.open { display: flex; }
        #th-actor-box {
          background: var(--bg2, #1a1a2e);
          border: 1px solid var(--border, rgba(255,255,255,.08));
          border-radius: 20px;
          width: 100%;
          max-width: 900px;
          padding: 0 0 32px;
          position: relative;
        }
        #th-actor-header {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 24px 24px 20px;
          border-bottom: 1px solid var(--border, rgba(255,255,255,.08));
        }
        #th-actor-photo {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          object-fit: cover;
          background: var(--bg3, #2a2a3e);
          flex-shrink: 0;
          font-size: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--accent, #6C63FF);
        }
        #th-actor-photo img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        #th-actor-name-wrap { flex: 1; min-width: 0; }
        #th-actor-name {
          font-family: var(--font-d, sans-serif);
          font-size: clamp(18px, 3vw, 26px);
          font-weight: 700;
          color: var(--text, #fff);
          letter-spacing: .04em;
        }
        #th-actor-bio {
          font-size: 12px;
          color: var(--faint, #888);
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        #th-actor-close {
          background: rgba(255,255,255,.1);
          border: none;
          color: var(--text, #fff);
          width: 38px;
          height: 38px;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background .15s;
          align-self: flex-start;
        }
        #th-actor-close:hover { background: rgba(255,255,255,.22); }
        #th-actor-body { padding: 0 24px; }
        #th-actor-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          gap: 12px;
          color: var(--faint, #888);
          font-size: 13px;
        }
        .th-actor-spin {
          width: 32px; height: 32px;
          border: 3px solid var(--accent, #6C63FF);
          border-top-color: transparent;
          border-radius: 50%;
          animation: thSpin .8s linear infinite;
          flex-shrink: 0;
        }
        .th-filmography-section { margin-top: 24px; }
        .th-film-section-label {
          font-family: var(--font-d, sans-serif);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .12em;
          color: var(--accent, #6C63FF);
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .th-film-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 14px;
        }
        .th-film-card {
          background: var(--bg3, #111);
          border: 1px solid var(--border, rgba(255,255,255,.06));
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: transform .2s, border-color .2s;
        }
        .th-film-card:hover {
          transform: translateY(-3px);
          border-color: var(--accent, #6C63FF);
        }
        .th-film-poster {
          width: 100%;
          aspect-ratio: 2/3;
          object-fit: cover;
          display: block;
          background: var(--bg2, #1a1a2e);
        }
        .th-film-placeholder {
          width: 100%;
          aspect-ratio: 2/3;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg2, #1a1a2e);
          font-size: 32px;
        }
        .th-film-info {
          padding: 8px 10px 10px;
        }
        .th-film-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--text, #fff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 3px;
        }
        .th-film-meta {
          font-size: 10px;
          color: var(--faint, #888);
        }
        .th-actor-empty {
          text-align: center;
          padding: 40px 20px;
          color: var(--faint, #888);
          font-size: 13px;
        }
        /* Make cast cards obviously clickable */
        .cast-card {
          cursor: pointer;
          transition: transform .18s, box-shadow .18s;
          border-radius: 10px;
        }
        .cast-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(108,99,255,.35);
        }
        .cast-card::after {
          content: 'View Films';
          display: block;
          text-align: center;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: .06em;
          color: var(--accent, #6C63FF);
          margin-top: 2px;
          opacity: 0;
          transition: opacity .18s;
        }
        .cast-card:hover::after { opacity: 1; }
      `;
      document.head.appendChild(style);

      const panel = document.createElement('div');
      panel.id = 'th-actor-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.innerHTML = `
        <div id="th-actor-box">
          <div id="th-actor-header">
            <div id="th-actor-photo">👤</div>
            <div id="th-actor-name-wrap">
              <div id="th-actor-name">Loading…</div>
              <div id="th-actor-bio"></div>
            </div>
            <button id="th-actor-close" title="Close">✕</button>
          </div>
          <div id="th-actor-body">
            <div id="th-actor-loading">
              <div class="th-actor-spin"></div>
              <span>Loading filmography…</span>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(panel);

      document.getElementById('th-actor-close').addEventListener('click', closeActorPanel);
      panel.addEventListener('click', e => { if (e.target === panel) closeActorPanel(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeActorPanel(); });
    }

    function closeActorPanel() {
      const panel = document.getElementById('th-actor-panel');
      if (panel) panel.classList.remove('open');
      document.body.style.overflow = '';
    }

    async function openActorPanel(personId, personName) {
      buildActorPanel();
      const panel  = document.getElementById('th-actor-panel');
      const photo  = document.getElementById('th-actor-photo');
      const nameEl = document.getElementById('th-actor-name');
      const bioEl  = document.getElementById('th-actor-bio');
      const body   = document.getElementById('th-actor-body');
      const loading = document.getElementById('th-actor-loading');

      /* Reset */
      nameEl.textContent = personName || 'Loading…';
      bioEl.textContent  = '';
      photo.innerHTML    = '👤';
      body.innerHTML     = `<div id="th-actor-loading"><div class="th-actor-spin"></div><span>Loading filmography…</span></div>`;

      panel.classList.add('open');
      document.body.style.overflow = 'hidden';

      try {
        const [personRes, creditsRes] = await Promise.all([
          fetch(`${BASE_URL}/person/${personId}?api_key=${API_KEY}&language=en-US`),
          fetch(`${BASE_URL}/person/${personId}/combined_credits?api_key=${API_KEY}&language=en-US`)
        ]);
        const person  = await personRes.json();
        const credits = await creditsRes.json();

        /* Update header */
        nameEl.textContent = person.name || personName;
        if (person.biography) {
          bioEl.textContent = person.biography;
        }
        if (person.profile_path) {
          photo.innerHTML = `<img src="${IMG_300}${person.profile_path}" alt="${person.name}">`;
        }

        /* Split movies vs TV */
        const all = credits.cast || [];
        const movies = all
          .filter(c => c.media_type === 'movie' && c.poster_path)
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 20);
        const tv = all
          .filter(c => c.media_type === 'tv' && c.poster_path)
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 16);

        function buildFilmGrid(items, mediaType) {
          if (!items.length) return '';
          return items.map(c => {
            const title = c.title || c.name || 'Unknown';
            const year  = (c.release_date || c.first_air_date || '').slice(0, 4);
            const score = c.vote_average ? `★ ${Number(c.vote_average).toFixed(1)}` : '';
            const poster = c.poster_path
              ? `<img class="th-film-poster" src="${IMG_300}${c.poster_path}" alt="${title}" loading="lazy">`
              : `<div class="th-film-placeholder">🎬</div>`;
            return `
              <div class="th-film-card" data-id="${c.id}" data-type="${mediaType}" tabindex="0" title="${title}">
                ${poster}
                <div class="th-film-info">
                  <div class="th-film-title">${title}</div>
                  <div class="th-film-meta">${year}${score ? ` · ${score}` : ''}</div>
                </div>
              </div>`;
          }).join('');
        }

        let html = '';
        if (movies.length) {
          html += `<div class="th-filmography-section">
            <div class="th-film-section-label">Movies (${movies.length})</div>
            <div class="th-film-grid">${buildFilmGrid(movies, 'movie')}</div>
          </div>`;
        }
        if (tv.length) {
          html += `<div class="th-filmography-section">
            <div class="th-film-section-label">TV Series (${tv.length})</div>
            <div class="th-film-grid">${buildFilmGrid(tv, 'tv')}</div>
          </div>`;
        }
        if (!html) {
          html = `<div class="th-actor-empty"><p>No credits found for this actor.</p></div>`;
        }

        body.innerHTML = html;

        /* Click film card → navigate to movie detail */
        body.querySelectorAll('.th-film-card').forEach(card => {
          const navigate = () => {
            window.location.href = `movie.html?id=${card.dataset.id}&type=${card.dataset.type}`;
          };
          card.addEventListener('click', navigate);
          card.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(); });
        });

      } catch (err) {
        body.innerHTML = `<div class="th-actor-empty"><p>Could not load filmography. Please try again.</p></div>`;
      }
    }

    /* Watch for cast row to appear, then make cards clickable */
    function attachCastCardClicks() {
      const detail = document.getElementById('movie-detail');
      if (!detail) return;

      const observer = new MutationObserver(() => {
        const castRow = detail.querySelector('.cast-row');
        if (!castRow) return;

        castRow.querySelectorAll('.cast-card:not([data-actor-bound])').forEach(card => {
          card.setAttribute('data-actor-bound', '1');
          /* We need the person ID — it's in the credits array.
             The cast HTML is built without data-id, so we match by name. */
          const nameEl = card.querySelector('.cast-name');
          if (!nameEl) return;

          card.addEventListener('click', async () => {
            const actorName = nameEl.textContent.trim();
            /* Search TMDB for person by name to get their ID */
            try {
              const res = await fetch(`${BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(actorName)}&language=en-US`);
              const data = await res.json();
              const person = (data.results || [])[0];
              if (person) {
                openActorPanel(person.id, person.name);
              }
            } catch {
              /* silently ignore */
            }
          });
        });
      });

      observer.observe(detail, { childList: true, subtree: true });
    }

    attachCastCardClicks();
  }

})();