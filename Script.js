/* ============================================================
   TRAILER HUB — script.js
   Features: Trailer Modal · Watchlist · Watch Later
             Genre/Rating/Year/Sort Filters · Daily Trending
             Autocomplete · Infinite Scroll · Star Ratings
             Recently Viewed · Dark/Light Mode · PWA
             Keyboard Navigation · URL State · Movie Detail
   ============================================================ */

const API_KEY  = 'afecc8075597c531e9aae083331172c6';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_500  = 'https://image.tmdb.org/t/p/w500';
const IMG_300  = 'https://image.tmdb.org/t/p/w300';
const IMG_ORI  = 'https://image.tmdb.org/t/p/original';

/* ── State ── */
let activeGenre  = '';
let activeRating = '';
let activeYear   = '';
let activeSort   = 'popularity.desc';
let lastQuery    = '';
let lastType     = 'movie';
let currentPage  = 1;
let totalPages   = 1;
let isLoading    = false;
let currentItem  = null;
let activePanel  = 'watchlist';
let focusedCardIdx = -1;

/* ── DOM shortcut ── */
const $ = id => document.getElementById(id);

/* ================================================================
   STORAGE HELPERS
================================================================ */
const storage = {
  get:  key      => JSON.parse(localStorage.getItem(key) || '[]'),
  set:  (k, v)   => localStorage.setItem(k, JSON.stringify(v)),
  getObj: key    => JSON.parse(localStorage.getItem(key) || '{}'),
  setObj: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  has:  (key, id)=> storage.get(key).some(i => i.id === id),
  add(key, item) {
    const list = this.get(key);
    if (!list.find(i => i.id === item.id)) { list.unshift(item); this.set(key, list); }
  },
  remove(key, id) { this.set(key, this.get(key).filter(i => i.id !== id)); }
};

/* ================================================================
   PWA — Register Service Worker
================================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ================================================================
   THEME — Dark / Light
================================================================ */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  localStorage.setItem('theme', theme);
  const icon = document.querySelector('.theme-icon');
  if (icon) icon.textContent = theme === 'light' ? '🌙' : '☀';
}

document.querySelectorAll('#theme-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light');
    applyTheme(isLight ? 'dark' : 'light');
  });
});

initTheme();

/* ================================================================
   HEADER SCROLL
================================================================ */
window.addEventListener('scroll', () => {
  $('site-header')?.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ================================================================
   SCROLL REVEAL
================================================================ */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const siblings = [...e.target.parentElement.querySelectorAll('[data-reveal]')];
    e.target.style.transitionDelay = `${siblings.indexOf(e.target) * 0.09}s`;
    e.target.classList.add('revealed');
    revealObs.unobserve(e.target);
  });
}, { threshold: 0.12 });
document.querySelectorAll('[data-reveal]').forEach(el => revealObs.observe(el));

/* ================================================================
   PAGE TRANSITIONS
================================================================ */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('http') ||
      href.startsWith('mailto') || href.startsWith('tel')) return;
  e.preventDefault();
  document.body.style.opacity    = '0';
  document.body.style.transition = 'opacity 0.25s';
  setTimeout(() => { window.location.href = href; }, 260);
});
window.addEventListener('pageshow', () => {
  document.body.style.opacity    = '1';
  document.body.style.transition = 'opacity 0.35s';
});

/* ================================================================
   URL STATE — sync search with URL
================================================================ */
function pushState(query, type) {
  const url = new URL(window.location);
  if (query) { url.searchParams.set('q', query); url.searchParams.set('type', type); }
  else { url.searchParams.delete('q'); url.searchParams.delete('type'); }
  history.pushState({}, '', url);
}

function readURLState() {
  const params = new URLSearchParams(window.location.search);
  const q    = params.get('q');
  const type = params.get('type') || 'movie';
  if (q && $('movie-search')) {
    $('movie-search').value = q;
    if ($('search-type')) $('search-type').value = type;
    lastQuery = q;
    lastType  = type;
    doSearch(true);
  }
}

/* ================================================================
   AUTOCOMPLETE — debounced, 300ms
================================================================ */
let acTimer = null;

$('movie-search')?.addEventListener('input', e => {
  clearTimeout(acTimer);
  const q = e.target.value.trim();
  if (!q || q.length < 2) { closeAC(); return; }
  acTimer = setTimeout(() => fetchAC(q), 300);
});

$('movie-search')?.addEventListener('blur', () => {
  setTimeout(closeAC, 200);
});

async function fetchAC(q) {
  try {
    const type = $('search-type')?.value || 'movie';
    const res  = await fetch(`${BASE_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1&language=en-US`);
    const data = await res.json();
    renderAC(data.results?.slice(0, 6) || [], type);
  } catch { closeAC(); }
}

function renderAC(items, type) {
  const drop = $('autocomplete-dropdown');
  if (!drop) return;
  if (!items.length) { closeAC(); return; }

  drop.innerHTML = '';
  items.forEach((item, i) => {
    const title  = item.title || item.name || '';
    const year   = (item.release_date || item.first_air_date || '').slice(0, 4);
    const rating = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '';
    const thumb  = item.poster_path
      ? `<img class="ac-thumb" src="${IMG_300}${item.poster_path}" alt="${title}">`
      : `<div class="ac-thumb-placeholder">🎬</div>`;

    const row = document.createElement('div');
    row.className = 'ac-item';
    row.tabIndex = -1;
    row.innerHTML = `${thumb}<div class="ac-info"><div class="ac-title">${title}</div><div class="ac-meta">${year} · ${type === 'tv' ? 'TV Show' : 'Movie'}</div></div>${rating ? `<div class="ac-rating">${rating}</div>` : ''}`;

    row.addEventListener('mousedown', () => {
      $('movie-search').value = title;
      closeAC();
      lastQuery = title;
      lastType  = type;
      doSearch(true);
    });

    drop.appendChild(row);
  });
  drop.classList.add('open');
}

function closeAC() {
  const drop = $('autocomplete-dropdown');
  if (drop) drop.classList.remove('open');
}

/* ================================================================
   SEARCH
================================================================ */
$('search-btn')?.addEventListener('click', handleSearch);
$('movie-search')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { closeAC(); handleSearch(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); focusAcItem(0); }
});

function handleSearch() {
  const q = $('movie-search')?.value.trim();
  if (!q) { shake($('movie-search')?.closest('.search-box')); return; }
  lastQuery    = q;
  lastType     = $('search-type')?.value || 'movie';
  currentPage  = 1;
  totalPages   = 1;
  pushState(q, lastType);
  doSearch(true);
}

function focusAcItem(idx) {
  const items = document.querySelectorAll('.ac-item');
  if (items[idx]) items[idx].focus();
}

async function doSearch(reset = false) {
  if (isLoading) return;
  isLoading = true;

  const section = $('results-section');
  if (!section) { isLoading = false; return; }

  if (reset) {
    section.classList.add('visible');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('results-grid').innerHTML = skeletons(8);
    // Only update heading if we have a text query — genre chips set their own heading
    if (lastQuery) {
      $('results-heading').textContent = `"${lastQuery}"`;
      $('results-eyebrow').textContent = lastType === 'tv' ? 'TV Shows' : 'Movies';
    }
    currentPage = 1;
  }

  try {
    const yearParam  = activeYear   ? `&primary_release_year=${activeYear}` : '';
    const genreParam = activeGenre  ? `&with_genres=${activeGenre}` : '';
    const certParam  = activeRating ? `&certification_country=US&certification=${activeRating}` : '';
    const url = lastQuery
      ? `${BASE_URL}/search/${lastType}?api_key=${API_KEY}&query=${encodeURIComponent(lastQuery)}&language=en-US&page=${currentPage}&include_adult=false`
      : `${BASE_URL}/discover/${lastType}?api_key=${API_KEY}&language=en-US&sort_by=${activeSort}&page=${currentPage}&include_adult=false${genreParam}${yearParam}${certParam}`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    totalPages = Math.min(data.total_pages || 1, 500);
    let results = data.results || [];

    if (lastQuery && activeGenre) {
      results = results.filter(i => (i.genre_ids || []).includes(Number(activeGenre)));
    }

    if (reset) {
      $('results-grid').innerHTML = '';
    }

    results.forEach((item, idx) => buildCard(item, (currentPage - 1) * 20 + idx, $('results-grid'), lastType));

    if (!results.length && reset) {
      $('results-grid').innerHTML = `<div class="empty-state"><div class="icon">🎞️</div><h3>No results found</h3><p>Try adjusting your filters or search term.</p></div>`;
    }
  } catch {
    if (reset) $('results-grid').innerHTML = `<div class="empty-state"><div class="icon">⚡</div><h3>Something went wrong</h3><p>Check your connection and try again.</p></div>`;
  }

  isLoading = false;
}

/* ── Infinite scroll ── */
const sentinelObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting && !isLoading && currentPage < totalPages && lastQuery) {
      currentPage++;
      doSearch(false);
    }
  });
}, { rootMargin: '200px' });

const sentinel = $('scroll-sentinel');
if (sentinel) sentinelObs.observe(sentinel);

/* ── Clear ── */
$('clear-btn')?.addEventListener('click', () => {
  $('results-section').classList.remove('visible');
  $('results-grid').innerHTML = '';
  $('movie-search').value = '';
  lastQuery   = '';
  currentPage = 1;
  pushState('', '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ================================================================
   FILTERS
================================================================ */
// Genre chips (sticky bar)
document.querySelectorAll('#genre-chips .fchip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#genre-chips .fchip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeGenre = btn.dataset.genre;
    lastQuery = '';
    if ($('movie-search')) $('movie-search').value = '';
    currentPage = 1;
    lastType = $('search-type')?.value || 'movie';
    const label = btn.textContent.trim();
    if ($('results-heading')) $('results-heading').textContent = activeGenre ? label : 'Popular';
    if ($('results-eyebrow')) $('results-eyebrow').textContent = 'Browse by Genre';
    doSearch(true);
    // scroll to results
    setTimeout(() => $('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  });
});

// Also support old .chip class in case filter-bar still exists
document.querySelectorAll('#genre-chips .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#genre-chips .chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeGenre = btn.dataset.genre;
    lastQuery = '';
    if ($('movie-search')) $('movie-search').value = '';
    currentPage = 1;
    lastType = $('search-type')?.value || 'movie';
    const label = btn.textContent.trim();
    if ($('results-heading')) $('results-heading').textContent = activeGenre ? label : 'Popular';
    if ($('results-eyebrow')) $('results-eyebrow').textContent = 'Browse by Genre';
    doSearch(true);
  });
});

// Rating select (sticky bar)
$('rating-select')?.addEventListener('change', e => { activeRating = e.target.value; currentPage = 1; doSearch(true); });
// Old rating chips fallback
document.querySelectorAll('#rating-chips .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#rating-chips .chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeRating = btn.dataset.rating;
    currentPage = 1;
    doSearch(true);
  });
});

$('year-filter')?.addEventListener('change',  e => { activeYear  = e.target.value; currentPage = 1; doSearch(true); });
$('sort-filter')?.addEventListener('change',  e => { activeSort  = e.target.value; currentPage = 1; doSearch(true); });

/* ================================================================
   BUILD MOVIE CARD
================================================================ */
function buildCard(item, idx, container, type) {
  const title    = item.title || item.name || 'Unknown';
  const year     = (item.release_date || item.first_air_date || '').slice(0, 4);
  const score    = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '';
  const overview = item.overview || 'No description available.';
  const inWL     = storage.has('watchlist',  item.id);
  const inWLat   = storage.has('watchlater', item.id);
  const userRating = getUserRating(item.id);

  const card = document.createElement('div');
  card.className  = 'movie-card';
  card.tabIndex   = 0;
  card.dataset.id = item.id;
  card.style.animationDelay = `${(idx % 20) * 0.05}s`;

  const poster = item.poster_path
    ? `<img src="${IMG_500}${item.poster_path}" alt="${title}" loading="lazy">`
    : `<div class="no-poster">🎬</div>`;

  const stars = [1,2,3,4,5].map(n =>
    `<button class="star ${n <= userRating ? 'active' : ''}" data-star="${n}" title="${n} star${n>1?'s':''}">★</button>`
  ).join('');

  card.innerHTML = `
    <div class="card-poster-wrap">
      ${poster}
      ${score ? `<div class="card-rating">${score}</div>` : ''}
      <div class="card-overlay">
        <p class="card-overview">${overview}</p>
        <button class="watch-trailer-btn">▶ Watch Trailer</button>
      </div>
    </div>
    <div class="card-info">
      <div class="card-title">${title}${year ? ` <span style="color:var(--faint);font-weight:300">(${year})</span>` : ''}</div>
      <div class="star-rating">${stars}<span class="star-label">${userRating ? `${userRating}/5` : 'Rate'}</span></div>
    </div>
    <div class="card-actions">
      <button class="card-action-btn wl-btn ${inWL ? 'saved' : ''}">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        ${inWL ? 'Saved' : 'Watchlist'}
      </button>
      <button class="card-action-btn wlat-btn ${inWLat ? 'saved' : ''}">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        ${inWLat ? 'Added' : 'Watch Later'}
      </button>
      <button class="card-action-btn detail-btn" style="flex:0.8">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v5M8 5.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Info
      </button>
    </div>`;

  const storeItem = { id: item.id, title, year, poster_path: item.poster_path || '', _type: type };

  card.querySelector('.watch-trailer-btn').addEventListener('click', e => { e.stopPropagation(); openTrailerModal(item, type, card); });

  card.querySelector('.wl-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleList('watchlist', storeItem);
    const saved = storage.has('watchlist', item.id);
    e.currentTarget.classList.toggle('saved', saved);
    e.currentTarget.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${saved ? 'Saved' : 'Watchlist'}`;
  });

  card.querySelector('.wlat-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleList('watchlater', storeItem);
    const added = storage.has('watchlater', item.id);
    e.currentTarget.classList.toggle('saved', added);
    e.currentTarget.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>${added ? 'Added' : 'Watch Later'}`;
  });

  card.querySelector('.detail-btn').addEventListener('click', e => {
    e.stopPropagation();
    window.location.href = `movie.html?id=${item.id}&type=${type}`;
  });

  // Star rating
  card.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', e => {
      e.stopPropagation();
      const val = Number(star.dataset.star);
      saveUserRating(item.id, val);
      card.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < val));
      card.querySelector('.star-label').textContent = `${val}/5`;
    });
  });

  // Card keyboard: Enter = open trailer
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter') openTrailerModal(item, type, card);
  });

  container.appendChild(card);
}

/* ================================================================
   STAR RATINGS (localStorage)
================================================================ */
function getUserRating(id) {
  return storage.getObj('ratings')[id] || 0;
}

function saveUserRating(id, val) {
  const ratings = storage.getObj('ratings');
  ratings[id] = val;
  storage.setObj('ratings', ratings);
}

/* ================================================================
   RECENTLY VIEWED
================================================================ */
function addRecentlyViewed(item) {
  const list = storage.get('recently');
  const filtered = list.filter(i => i.id !== item.id);
  filtered.unshift(item);
  storage.set('recently', filtered.slice(0, 20));
  renderRecentlyViewed();
}

function renderRecentlyViewed() {
  const section = $('recently-section');
  const row     = $('recently-row');
  if (!section || !row) return;

  const items = storage.get('recently');
  if (!items.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  row.innerHTML = '';

  items.slice(0, 12).forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'trending-card';
    card.style.cursor = 'pointer';
    card.style.animationDelay = `${idx * 0.03}s`;

    const thumb = item.poster_path
      ? `<img class="trending-thumb" src="${IMG_300}${item.poster_path}" alt="${item.title}" style="object-fit:cover" loading="lazy">`
      : `<div class="trending-thumb" style="display:flex;align-items:center;justify-content:center;font-size:28px">🎬</div>`;

    card.innerHTML = `
      ${thumb}
      <div class="trending-info">
        <div class="trending-title">${item.title || item.name}</div>
        <div class="trending-sub">${item.year || ''} · ${item._type === 'tv' ? 'TV' : 'Movie'}</div>
      </div>`;

    card.addEventListener('click', () => openTrailerModal(item, item._type || 'movie', card));
    row.appendChild(card);
  });
}

$('clear-recent')?.addEventListener('click', () => {
  storage.set('recently', []);
  renderRecentlyViewed();
});

/* ================================================================
   TRAILER MODAL
================================================================ */
/* ================================================================
   INLINE TRAILER PLAYER — slides in below clicked card
================================================================ */
async function openTrailerModal(item, type, anchorEl) {
  const wrap = $('inline-player-wrap');
  if (!wrap) return;

  const title = item.title || item.name || 'Unknown';
  const year  = (item.release_date || item.first_air_date || '').slice(0, 4);
  const score = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '';

  currentItem = { ...item, _type: type };

  // Add to recently viewed
  addRecentlyViewed({ id: item.id, title, year, poster_path: item.poster_path || '', _type: type });

  // Insert player wrap right after the anchor element (or results section)
  const anchor = anchorEl || $('results-section') || $('trending-row');
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
  }

  $('inline-player-title').textContent = title;
  $('inline-player-meta').textContent  = [year, score, type === 'tv' ? 'TV Show' : 'Movie'].filter(Boolean).join(' · ');
  $('inline-player-video').innerHTML   = `<div class="inline-loading"><div class="modal-spinner"></div><span>Fetching trailer…</span></div>`;

  renderInlineActions();
  wrap.style.display = 'block';
  requestAnimationFrame(() => wrap.classList.add('open'));

  // Scroll player into view smoothly
  setTimeout(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

  try {
    const endpoint = type === 'tv'
      ? `${BASE_URL}/tv/${item.id}/videos?api_key=${API_KEY}`
      : `${BASE_URL}/movie/${item.id}/videos?api_key=${API_KEY}`;
    const res    = await fetch(endpoint);
    const data   = await res.json();
    const videos = data.results || [];
    const clip   =
      videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
      videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')  ||
      videos.find(v => v.site === 'YouTube');

    if (clip) {
      $('inline-player-video').innerHTML = `<iframe src="https://www.youtube.com/embed/${clip.key}?autoplay=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      $('inline-player-video').innerHTML = `<div class="inline-no-trailer"><div class="icon">🎞️</div><p>No trailer available yet</p></div>`;
    }
  } catch {
    $('inline-player-video').innerHTML = `<div class="inline-no-trailer"><div class="icon">⚡</div><p>Could not load trailer</p></div>`;
  }
}

function closeModal() {
  const wrap = $('inline-player-wrap');
  if (!wrap) return;
  wrap.classList.remove('open');
  setTimeout(() => {
    wrap.style.display = 'none';
    $('inline-player-video').innerHTML = '';
  }, 400);
}

$('inline-player-close')?.addEventListener('click', closeModal);

function renderInlineActions() {
  if (!currentItem || !$('inline-player-actions')) return;
  const item   = currentItem;
  const inWL   = storage.has('watchlist',  item.id);
  const inWLat = storage.has('watchlater', item.id);
  const storeItem = {
    id: item.id,
    title: item.title || item.name,
    year: (item.release_date || item.first_air_date || '').slice(0, 4),
    poster_path: item.poster_path || '',
    _type: item._type
  };

  $('inline-player-actions').innerHTML = `
    <button class="modal-action ${inWL ? 'saved' : ''}" id="modal-wl-btn">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      ${inWL ? 'Saved' : '+ Watchlist'}
    </button>
    <button class="modal-action ${inWLat ? 'saved' : ''}" id="modal-wlat-btn">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      ${inWLat ? 'Added' : '+ Watch Later'}
    </button>
    <button class="modal-action" id="modal-detail-btn">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v5M8 5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Full Details
    </button>`;

  $('modal-wl-btn').addEventListener('click',     () => { toggleList('watchlist',  storeItem); renderInlineActions(); });
  $('modal-wlat-btn').addEventListener('click',   () => { toggleList('watchlater', storeItem); renderInlineActions(); });
  $('modal-detail-btn').addEventListener('click', () => { closeModal(); window.location.href = `movie.html?id=${item.id}&type=${item._type || 'movie'}`; });
}

// keep renderModalActions as alias so detail page works
const renderModalActions = renderInlineActions;

/* ================================================================
   KEYBOARD NAVIGATION
================================================================ */
document.addEventListener('keydown', e => {
  // Escape — close modal or panel
  if (e.key === 'Escape') { closeModal(); closePanel(); closeAC(); return; }

  // Only arrow nav when no input focused
  if (document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA' ||
      document.activeElement?.tagName === 'SELECT') return;

  const cards = [...document.querySelectorAll('#results-grid .movie-card')];
  if (!cards.length) return;

  const cols = Math.round(document.querySelector('#results-grid').offsetWidth / (cards[0].offsetWidth + 18)) || 4;

  if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(cards, focusedCardIdx + 1); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); moveFocus(cards, focusedCardIdx - 1); }
  if (e.key === 'ArrowDown')  { e.preventDefault(); moveFocus(cards, focusedCardIdx + cols); }
  if (e.key === 'ArrowUp')    { e.preventDefault(); moveFocus(cards, focusedCardIdx - cols); }
  if (e.key === 'Enter' && focusedCardIdx >= 0) cards[focusedCardIdx]?.click();
  if (e.key === '/') { e.preventDefault(); $('movie-search')?.focus(); }
});

function moveFocus(cards, idx) {
  const clamped = Math.max(0, Math.min(cards.length - 1, idx));
  focusedCardIdx = clamped;
  cards[clamped]?.focus();
  showKbdHint();
}

function showKbdHint() {
  let hint = document.querySelector('.kbd-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'kbd-hint';
    hint.innerHTML = `<kbd>↑↓←→</kbd> navigate &nbsp; <kbd>Enter</kbd> play trailer &nbsp; <kbd>/</kbd> search`;
    document.body.appendChild(hint);
  }
  hint.classList.add('show');
  clearTimeout(hint._timer);
  hint._timer = setTimeout(() => hint.classList.remove('show'), 3000);
}

document.querySelectorAll('#results-grid').forEach(grid => {
  grid.addEventListener('focusin', e => {
    const card = e.target.closest('.movie-card');
    if (card) focusedCardIdx = [...grid.querySelectorAll('.movie-card')].indexOf(card);
  });
});

/* ================================================================
   WATCHLIST / WATCH LATER
================================================================ */
function toggleList(key, item) {
  storage.has(key, item.id) ? storage.remove(key, item.id) : storage.add(key, item);
  updateBadges();
}

function updateBadges() {
  ['watchlist', 'watchlater'].forEach(key => {
    const count = storage.get(key).length;
    const el    = $(key === 'watchlist' ? 'watchlist-count' : 'watchlater-count');
    if (!el) return;
    el.textContent = count;
    el.classList.toggle('zero', count === 0);
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 300);
  });
}

document.querySelectorAll('#nav-watchlist-btn').forEach(b  => b.addEventListener('click', () => openPanel('watchlist')));
document.querySelectorAll('#nav-watchlater-btn').forEach(b => b.addEventListener('click', () => openPanel('watchlater')));
document.querySelectorAll('#panel-close').forEach(b        => b.addEventListener('click', closePanel));
document.querySelectorAll('#list-panel').forEach(el        => el.addEventListener('click', e => { if (e.target === el) closePanel(); }));

document.querySelectorAll('#tab-watchlist').forEach(b  => b.addEventListener('click', () => { activePanel = 'watchlist';  syncPanelTabs(); renderPanel(); }));
document.querySelectorAll('#tab-watchlater').forEach(b => b.addEventListener('click', () => { activePanel = 'watchlater'; syncPanelTabs(); renderPanel(); }));

function syncPanelTabs() {
  document.querySelectorAll('#tab-watchlist').forEach(b  => b.classList.toggle('active', activePanel === 'watchlist'));
  document.querySelectorAll('#tab-watchlater').forEach(b => b.classList.toggle('active', activePanel === 'watchlater'));
}

function openPanel(tab) {
  activePanel = tab;
  syncPanelTabs();
  renderPanel();
  document.querySelectorAll('#list-panel').forEach(el => el.classList.add('open'));
  document.body.style.overflow = 'hidden';
}

function closePanel() {
  document.querySelectorAll('#list-panel').forEach(el => el.classList.remove('open'));
  document.body.style.overflow = '';
}

function renderPanel() {
  const key   = activePanel;
  const items = storage.get(key);
  document.querySelectorAll('#panel-body').forEach(body => {
    if (!body) return;
    if (!items.length) {
      body.innerHTML = `<div class="panel-empty"><div class="icon">${key === 'watchlist' ? '🔖' : '🕐'}</div><p>Your ${key === 'watchlist' ? 'watchlist' : 'watch later list'} is empty.<br>Add movies while browsing!</p></div>`;
      return;
    }
    body.innerHTML = '';
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'panel-item';
      row.style.animationDelay = `${idx * 0.04}s`;
      const thumb = item.poster_path
        ? `<img class="panel-thumb" src="${IMG_300}${item.poster_path}" alt="${item.title}">`
        : `<div class="panel-thumb-placeholder">🎬</div>`;
      row.innerHTML = `${thumb}<div class="panel-info"><div class="panel-item-title">${item.title||item.name}</div><div class="panel-item-meta">${item.year||''} · ${item._type==='tv'?'TV Show':'Movie'}</div></div><div class="panel-item-actions"><button class="panel-item-btn play-btn" title="Trailer">▶</button><button class="panel-item-btn" title="Details" style="font-size:11px">ℹ</button><button class="panel-item-btn remove-btn" title="Remove">✕</button></div>`;
      row.querySelector('.play-btn').addEventListener('click', () => { closePanel(); openTrailerModal(item, item._type||'movie'); });
      row.querySelectorAll('.panel-item-btn')[1].addEventListener('click', () => { closePanel(); window.location.href=`movie.html?id=${item.id}&type=${item._type||'movie'}`; });
      row.querySelector('.remove-btn').addEventListener('click', () => { storage.remove(key,item.id); updateBadges(); renderPanel(); });
      body.appendChild(row);
    });
  });
}

/* ================================================================
   TRENDING — Daily, every page load
================================================================ */
async function loadTrending() {
  const row = $('trending-row');
  if (!row) return;

  row.innerHTML = Array.from({ length: 8 }, () => `
    <div class="trending-card" style="pointer-events:none">
      <div class="sk-shimmer" style="width:100%;height:114px"></div>
      <div style="padding:10px 12px">
        <div class="sk-shimmer sk-bar" style="height:11px;border-radius:4px;margin:0 0 6px"></div>
        <div class="sk-shimmer sk-bar" style="height:9px;border-radius:4px;width:55%"></div>
      </div>
    </div>`).join('');

  try {
    const res  = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}&language=en-US`);
    if (!res.ok) throw new Error();
    const data  = await res.json();
    const items = data.results || [];
    row.innerHTML = '';

    items.slice(0, 14).forEach((item, idx) => {
      const title = item.title || item.name || 'Unknown';
      const type  = item.media_type === 'tv' ? 'TV Show' : 'Movie';
      const year  = (item.release_date || item.first_air_date || '').slice(0, 4);
      const card  = document.createElement('div');
      card.className = 'trending-card';
      card.style.cursor = 'pointer';
      card.style.animationDelay = `${idx * 0.04}s`;
      const thumb = item.backdrop_path
        ? `<img class="trending-thumb" src="${IMG_300}${item.backdrop_path}" alt="${title}" loading="lazy">`
        : `<div class="trending-thumb" style="display:flex;align-items:center;justify-content:center;font-size:28px">🎬</div>`;
      card.innerHTML = `<div class="trending-num">${idx + 1}</div>${thumb}<div class="trending-info"><div class="trending-title">${title}</div><div class="trending-sub">${type}${year?` · ${year}`:''}</div></div>`;
      card.addEventListener('click', () => openTrailerModal(item, item.media_type || 'movie', card));
      row.appendChild(card);
    });

    const t = $('trending-time');
    if (t) t.textContent = `Updated ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
  } catch {
    row.innerHTML = '<p style="color:var(--faint);font-size:13px;padding:20px 0">Could not load trending titles.</p>';
  }
}

/* ================================================================
   MOVIE DETAIL PAGE (movie.html)
================================================================ */
async function loadMovieDetail() {
  if (!$('movie-detail')) return;
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  const type   = params.get('type') || 'movie';
  if (!id) { window.location.href = 'index.html'; return; }

  try {
    const [detailRes, creditsRes] = await Promise.all([
      fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=en-US`),
      fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${API_KEY}&language=en-US`)
    ]);
    const detail  = await detailRes.json();
    const credits = await creditsRes.json();

    document.title = `${detail.title || detail.name} — Trailer Hub`;
    renderDetail(detail, credits, type);
    loadSimilar(id, type);
  } catch {
    $('movie-detail').innerHTML = `<div style="text-align:center;padding:120px 20px;color:var(--faint)"><div style="font-size:48px;margin-bottom:16px">⚡</div><p>Could not load movie details.</p><a href="index.html" class="btn-pill" style="margin-top:20px;display:inline-block">← Back</a></div>`;
  }
}

function renderDetail(d, credits, type) {
  const title    = d.title || d.name || 'Unknown';
  const year     = (d.release_date || d.first_air_date || '').slice(0, 4);
  const runtime  = d.runtime ? `${Math.floor(d.runtime/60)}h ${d.runtime%60}m` : (d.episode_run_time?.[0] ? `${d.episode_run_time[0]}m/ep` : '');
  const score    = d.vote_average ? d.vote_average.toFixed(1) : '';
  const votes    = d.vote_count  ? d.vote_count.toLocaleString() : '';
  const genres   = (d.genres || []).map(g => `<span class="detail-genre-tag">${g.name}</span>`).join('');
  const director = (credits.crew || []).find(c => c.job === 'Director');
  const cast     = (credits.cast || []).slice(0, 12);
  const inWL     = storage.has('watchlist',  d.id);
  const inWLat   = storage.has('watchlater', d.id);
  const budget   = d.budget   ? `$${(d.budget/1e6).toFixed(0)}M`   : '—';
  const revenue  = d.revenue  ? `$${(d.revenue/1e6).toFixed(0)}M`  : '—';
  const status   = d.status   || '—';
  const lang     = d.original_language?.toUpperCase() || '—';

  const backdropStyle = d.backdrop_path
    ? `background-image:url(${IMG_ORI}${d.backdrop_path})`
    : `background:var(--bg3)`;

  const posterHTML = d.poster_path
    ? `<img class="detail-poster" src="${IMG_500}${d.poster_path}" alt="${title}">`
    : `<div class="detail-poster-placeholder">🎬</div>`;

  const castHTML = cast.map(p => {
    const photo = p.profile_path
      ? `<img class="cast-photo" src="${IMG_300}${p.profile_path}" alt="${p.name}" loading="lazy">`
      : `<div class="cast-photo-placeholder">👤</div>`;
    return `<div class="cast-card">${photo}<div class="cast-name">${p.name}</div><div class="cast-role">${p.character}</div></div>`;
  }).join('');

  const storeItem = { id: d.id, title, year, poster_path: d.poster_path||'', _type: type };

  $('movie-detail').innerHTML = `
    <div class="detail-backdrop">
      <div class="detail-backdrop-img" style="${backdropStyle}"></div>
      <div class="detail-content">
        <div>
          ${posterHTML}
        </div>
        <div class="detail-info">
          ${genres ? `<div class="detail-genres">${genres}</div>` : ''}
          <h1 class="detail-title">${title}</h1>
          <div class="detail-meta-row">
            ${year ? `<span>${year}</span><span class="detail-meta-sep">·</span>` : ''}
            ${runtime ? `<span>${runtime}</span><span class="detail-meta-sep">·</span>` : ''}
            ${score ? `<span class="detail-tmdb-score">★ ${score} <span style="color:var(--faint);font-size:10px">(${votes})</span></span>` : ''}
            ${director ? `<span class="detail-meta-sep">·</span><span>Dir. ${director.name}</span>` : ''}
          </div>
          ${d.tagline ? `<div class="detail-tagline">"${d.tagline}"</div>` : ''}
          ${d.overview ? `<div class="detail-overview">${d.overview}</div>` : ''}
          <div class="detail-actions">
            <button class="detail-action primary" id="detail-trailer-btn">▶ Watch Trailer</button>
            <button class="detail-action secondary ${inWL ? 'saved' : ''}" id="detail-wl-btn">
              ${inWL ? '✓ In Watchlist' : '+ Watchlist'}
            </button>
            <button class="detail-action secondary ${inWLat ? 'saved' : ''}" id="detail-wlat-btn">
              ${inWLat ? '✓ Watch Later' : '+ Watch Later'}
            </button>
          </div>
          <div class="detail-stats">
            <div class="detail-stat"><div class="detail-stat-label">Status</div><div class="detail-stat-value">${status}</div></div>
            <div class="detail-stat"><div class="detail-stat-label">Language</div><div class="detail-stat-value">${lang}</div></div>
            ${d.budget ? `<div class="detail-stat"><div class="detail-stat-label">Budget</div><div class="detail-stat-value">${budget}</div></div>` : ''}
            ${d.revenue ? `<div class="detail-stat"><div class="detail-stat-label">Revenue</div><div class="detail-stat-value">${revenue}</div></div>` : ''}
          </div>
          ${cast.length ? `<div class="detail-cast-title">CAST</div><div class="cast-row">${castHTML}</div>` : ''}
        </div>
      </div>
    </div>`;

  $('detail-trailer-btn')?.addEventListener('click', () => openTrailerModal(d, type, $('movie-detail')));
  $('detail-wl-btn')?.addEventListener('click', () => {
    toggleList('watchlist', storeItem);
    const saved = storage.has('watchlist', d.id);
    const btn = $('detail-wl-btn');
    btn.classList.toggle('saved', saved);
    btn.textContent = saved ? '✓ In Watchlist' : '+ Watchlist';
  });
  $('detail-wlat-btn')?.addEventListener('click', () => {
    toggleList('watchlater', storeItem);
    const added = storage.has('watchlater', d.id);
    const btn = $('detail-wlat-btn');
    btn.classList.toggle('saved', added);
    btn.textContent = added ? '✓ Watch Later' : '+ Watch Later';
  });

  // Add to recently viewed
  addRecentlyViewed(storeItem);
}

async function loadSimilar(id, type) {
  try {
    const res  = await fetch(`${BASE_URL}/${type}/${id}/similar?api_key=${API_KEY}&language=en-US&page=1`);
    const data = await res.json();
    const items = (data.results || []).filter(i => i.poster_path).slice(0, 10);
    if (!items.length) return;

    const section = $('similar-section');
    const grid    = $('similar-grid');
    if (!section || !grid) return;

    section.style.display = 'block';
    items.forEach((item, idx) => buildCard(item, idx, grid, type));

    // Re-observe reveal elements
    section.querySelectorAll('[data-reveal]').forEach(el => revealObs.observe(el));
  } catch {}
}

/* ================================================================
   SKELETON HELPER
================================================================ */
function skeletons(n) {
  return Array.from({ length: n }, () => `
    <div class="skeleton-card">
      <div class="sk-shimmer sk-poster"></div>
      <div class="sk-shimmer sk-bar"></div>
      <div class="sk-shimmer sk-bar s"></div>
    </div>`).join('');
}

/* ================================================================
   SHAKE
================================================================ */
function shake(el) {
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shakeField 0.45s ease';
  el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `@keyframes shakeField{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`;
document.head.appendChild(shakeStyle);

/* ================================================================
   CONTACT FORM
================================================================ */
const contactForm = $('suggestions-form');
const submitBtn   = $('submit-btn');
const toast       = $('toast');

contactForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const name = contactForm.name?.value.trim();
  const email = contactForm.email?.value.trim();
  const msg   = contactForm.suggestion?.value.trim();
  if (!name || !email || !msg) {
    [contactForm.name, contactForm.email, contactForm.suggestion].forEach(el => { if (el && !el.value.trim()) shake(el); });
    return;
  }
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>Sending…';
  await new Promise(r => setTimeout(r, 1400));
  submitBtn.innerHTML = 'Message sent ✓';
  contactForm.reset();
  toast?.classList.add('show');
  setTimeout(() => toast?.classList.remove('show'), 4000);
  setTimeout(() => { submitBtn.disabled = false; submitBtn.innerHTML = 'Send Message →'; }, 3500);
});

/* ================================================================
   INIT
================================================================ */
updateBadges();
renderRecentlyViewed();
loadTrending();
readURLState();
loadMovieDetail(); // only runs on movie.html