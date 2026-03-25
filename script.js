/* ============================================================
   TRAILER HUB — script.js (Full fixed with genre left of search)
   ============================================================ */

const API_KEY = 'afecc8075597c531e9aae083331172c6';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_500 = 'https://image.tmdb.org/t/p/w500';
const IMG_300 = 'https://image.tmdb.org/t/p/w300';

let activeGenre = '';
let activeRating = '';
let activeYear = '';
let activeSort = 'popularity.desc';
let lastQuery = '';
let lastType = 'movie';
let currentPage = 1;
let totalPages = 1;
let isLoading = false;

const $ = id => document.getElementById(id);

/* Storage */
const storage = {
  get: key => JSON.parse(localStorage.getItem(key) || '[]'),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  getObj: key => JSON.parse(localStorage.getItem(key) || '{}'),
  setObj: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  has: (key, id) => storage.get(key).some(i => i.id === id),
  add(key, item) { const list = this.get(key); if (!list.find(i => i.id === item.id)) { list.unshift(item); this.set(key, list); } },
  remove(key, id) { this.set(key, this.get(key).filter(i => i.id !== id)); }
};

/* Theme */
function initTheme() { const saved = localStorage.getItem('theme') || 'dark'; applyTheme(saved); }
function applyTheme(theme) { document.body.classList.toggle('light', theme === 'light'); localStorage.setItem('theme', theme); const icon = document.querySelector('.theme-icon'); if (icon) icon.textContent = theme === 'light' ? '🌙' : '☀️'; }
document.getElementById('theme-toggle')?.addEventListener('click', () => { const isLight = document.body.classList.contains('light'); applyTheme(isLight ? 'dark' : 'light'); });
initTheme();

/* Header scroll */
window.addEventListener('scroll', () => { document.getElementById('site-header')?.classList.toggle('scrolled', window.scrollY > 40); });

/* Recently Viewed - Simplified (no trailer button) */
function addRecentlyViewed(item) {
  const list = storage.get('recently');
  const filtered = list.filter(i => i.id !== item.id);
  filtered.unshift(item);
  storage.set('recently', filtered.slice(0, 20));
  renderRecentlyViewed();
}

function renderRecentlyViewed() {
  const section = $('#recently-section');
  const row = $('#recently-row');
  if (!section || !row) return;
  const items = storage.get('recently');
  if (!items.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  row.innerHTML = '';
  const ratings = storage.getObj('ratings');
  items.slice(0, 12).forEach((item) => {
    const title = item.title || item.name || 'Unknown';
    const year = item.year || '';
    const mediaType = item._type || 'movie';
    const userRating = ratings[item.id] || 0;
    const thumbHtml = item.poster_path ? `<img class="recent-thumb" src="${IMG_300}${item.poster_path}" alt="${title}" loading="lazy">` : `<div class="recent-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--bg3);font-size:32px;">🎬</div>`;
    const card = document.createElement('div');
    card.className = 'recent-card-simple';
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-type', mediaType);
    card.innerHTML = `${thumbHtml}<div class="recent-info"><div class="recent-title">${title}</div><div class="recent-meta"><span>${mediaType === 'tv' ? 'TV' : 'Movie'}${year ? ` · ${year}` : ''}</span><span class="recent-rating">${userRating ? `★ ${userRating}/5` : '☆'}</span></div></div>`;
    card.addEventListener('click', () => { playTrailerById(item.id, title, year, mediaType, card); });
    row.appendChild(card);
  });
}
$('#clear-recent')?.addEventListener('click', () => { storage.set('recently', []); renderRecentlyViewed(); });

/* Trailer playing */
async function playTrailerById(id, title, year, type, containerCard) {
  let trailerContainer = containerCard?.querySelector('.card-trailer-container');
  if (!trailerContainer && containerCard) {
    trailerContainer = document.createElement('div');
    trailerContainer.className = 'card-trailer-container';
    containerCard.appendChild(trailerContainer);
  }
  if (!trailerContainer) return;
  if (trailerContainer.style.display === 'block') { trailerContainer.style.display = 'none'; trailerContainer.innerHTML = ''; return; }
  document.querySelectorAll('.card-trailer-container').forEach(c => { if (c !== trailerContainer) { c.style.display = 'none'; c.innerHTML = ''; } });
  trailerContainer.style.display = 'block';
  trailerContainer.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;"><div style="width:30px;height:30px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div></div>`;
  try {
    const url = type === 'tv' ? `${BASE_URL}/tv/${id}/videos?api_key=${API_KEY}` : `${BASE_URL}/movie/${id}/videos?api_key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    let clip = data.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer');
    if (!clip) clip = data.results?.find(v => v.site === 'YouTube');
    if (clip) {
      trailerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${clip.key}?autoplay=1&rel=0" allow="autoplay; fullscreen" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;border-radius:12px;"></iframe><button onclick="this.parentElement.style.display='none';this.parentElement.innerHTML=''" style="position:absolute;top:8px;right:8px;z-index:10;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;">✕</button>`;
      addRecentlyViewed({ id, title, year, poster_path: '', _type: type });
    } else { trailerContainer.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1a1a1a;color:#999;">No trailer available</div>`; }
  } catch { trailerContainer.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1a1a1a;">Error</div>`; }
}

async function playTrailerInsideCard(item, type, card) { playTrailerById(item.id, item.title || item.name, (item.release_date || item.first_air_date || '').slice(0,4), type, card); }
window.playTrailerInsideCard = playTrailerInsideCard;

/* Search & Filters */
function performSearch(reset = true) {
  if (isLoading) return;
  isLoading = true;
  const section = $('#results-section');
  if (reset) { section.classList.add('visible'); $('#results-grid').innerHTML = Array(8).fill().map(() => `<div class="skeleton-card"><div class="sk-shimmer" style="aspect-ratio:2/3"></div></div>`).join(''); currentPage = 1; }
  const yearParam = activeYear ? `&primary_release_year=${activeYear}` : '';
  const genreParam = activeGenre ? `&with_genres=${activeGenre}` : '';
  const certParam = activeRating ? `&certification_country=US&certification=${activeRating}` : '';
  let url;
  if (lastQuery) { url = `${BASE_URL}/search/${lastType}?api_key=${API_KEY}&query=${encodeURIComponent(lastQuery)}&page=${currentPage}`; } 
  else { url = `${BASE_URL}/discover/${lastType}?api_key=${API_KEY}&sort_by=${activeSort}&page=${currentPage}${genreParam}${yearParam}${certParam}`; }
  fetch(url).then(res => res.json()).then(data => {
    totalPages = Math.min(data.total_pages || 1, 500);
    let results = data.results || [];
    if (reset) $('#results-grid').innerHTML = '';
    if (results.length) { results.forEach((item, idx) => buildCard(item, idx, $('#results-grid'), lastType)); } 
    else if (reset) { $('#results-grid').innerHTML = `<div class="empty-state"><div class="icon">🎞️</div><h3>No results</h3></div>`; }
    isLoading = false;
  }).catch(() => { if (reset) $('#results-grid').innerHTML = `<div class="empty-state">Error loading</div>`; isLoading = false; });
}

function buildCard(item, idx, container, type) {
  const title = item.title || item.name || 'Unknown';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const score = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '';
  const overview = item.overview || '';
  const inWL = storage.has('watchlist', item.id);
  const inWLat = storage.has('watchlater', item.id);
  const ratings = storage.getObj('ratings');
  const userRating = ratings[item.id] || 0;
  const card = document.createElement('div');
  card.className = 'movie-card';
  card.dataset.id = item.id;
  const poster = item.poster_path ? `<img src="${IMG_500}${item.poster_path}" alt="${title}" loading="lazy">` : `<div class="no-poster">🎬</div>`;
  const stars = [1,2,3,4,5].map(n => `<button class="star ${n <= userRating ? 'active' : ''}" data-star="${n}">★</button>`).join('');
  card.innerHTML = `<div class="card-poster-wrap">${poster}${score ? `<div class="card-rating">${score}</div>` : ''}<div class="card-overlay"><p class="card-overview">${overview.substring(0, 100)}...</p><button class="watch-trailer-btn">▶ WATCH TRAILER</button></div></div><div class="card-info"><div class="card-title">${title}${year ? ` <span style="color:var(--faint)">(${year})</span>` : ''}</div><div class="star-rating">${stars}<span class="star-label">${userRating ? `${userRating}/5` : 'Rate'}</span></div></div><div class="card-actions"><button class="card-action-btn wl-btn ${inWL ? 'saved' : ''}">📋 ${inWL ? 'Saved' : 'Watchlist'}</button><button class="card-action-btn wlat-btn ${inWLat ? 'saved' : ''}">⏱️ ${inWLat ? 'Later' : 'Later'}</button><button class="card-action-btn detail-btn">ℹ️ Info</button></div><div class="card-trailer-container" id="trailer-${item.id}"></div>`;
  const storeItem = { id: item.id, title, year, poster_path: item.poster_path || '', _type: type };
  card.querySelector('.watch-trailer-btn').addEventListener('click', (e) => { e.stopPropagation(); playTrailerInsideCard(item, type, card); });
  card.querySelector('.wl-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleList('watchlist', storeItem); updateBadges(); const saved = storage.has('watchlist', item.id); e.currentTarget.classList.toggle('saved', saved); e.currentTarget.innerHTML = `📋 ${saved ? 'Saved' : 'Watchlist'}`; });
  card.querySelector('.wlat-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleList('watchlater', storeItem); updateBadges(); const added = storage.has('watchlater', item.id); e.currentTarget.classList.toggle('saved', added); e.currentTarget.innerHTML = `⏱️ ${added ? 'Later' : 'Later'}`; });
  card.querySelector('.detail-btn').addEventListener('click', () => { window.location.href = `movie.html?id=${item.id}&type=${type}`; });
  card.querySelectorAll('.star').forEach(star => { star.addEventListener('click', (e) => { e.stopPropagation(); const val = Number(star.dataset.star); const newRatings = storage.getObj('ratings'); newRatings[item.id] = val; storage.setObj('ratings', newRatings); card.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < val)); card.querySelector('.star-label').textContent = `${val}/5`; }); });
  container.appendChild(card);
}

function toggleList(key, item) { storage.has(key, item.id) ? storage.remove(key, item.id) : storage.add(key, item); }
function updateBadges() { ['watchlist', 'watchlater'].forEach(key => { const el = $(key === 'watchlist' ? 'watchlist-count' : 'watchlater-count'); if (el) el.textContent = storage.get(key).length; }); }

/* Trending */
async function loadTrending() {
  const row = $('#trending-row');
  if (!row) return;
  row.innerHTML = '<div style="padding:20px">Loading...</div>';
  try {
    const res = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}`);
    const data = await res.json();
    row.innerHTML = '';
    data.results.slice(0, 14).forEach((item, idx) => {
      const title = item.title || item.name;
      const type = item.media_type === 'tv' ? 'tv' : 'movie';
      const year = (item.release_date || item.first_air_date || '').slice(0,4);
      const thumb = item.backdrop_path || item.poster_path;
      const card = document.createElement('div');
      card.className = 'trending-card';
      card.innerHTML = `<div class="trending-num" style="position:absolute;top:6px;left:12px;font-size:48px;opacity:0.1">${idx+1}</div><img class="trending-thumb" src="${IMG_300}${thumb}" alt="${title}"><div class="trending-title">${title}</div><div class="trending-sub">${type === 'tv' ? 'TV' : 'Movie'}${year ? ` · ${year}` : ''}</div><div class="card-trailer-container" id="trend-trailer-${item.id}"></div>`;
      card.addEventListener('click', () => playTrailerById(item.id, title, year, type, card));
      row.appendChild(card);
    });
  } catch { row.innerHTML = '<p style="color:var(--faint)">Could not load trending</p>'; }
}

/* Autocomplete */
let acTimer = null;
$('#movie-search')?.addEventListener('input', e => { clearTimeout(acTimer); const q = e.target.value.trim(); if (q.length < 2) { closeAC(); return; } acTimer = setTimeout(() => fetchAC(q), 300); });
async function fetchAC(q) { try { const type = $('#search-type')?.value || 'movie'; const res = await fetch(`${BASE_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(q)}`); const data = await res.json(); renderAC(data.results?.slice(0,6) || [], type); } catch { closeAC(); } }
function renderAC(items, type) { const drop = $('#autocomplete-dropdown'); if (!drop || !items.length) { closeAC(); return; } drop.innerHTML = ''; items.forEach(item => { const title = item.title || item.name; const row = document.createElement('div'); row.className = 'ac-item'; row.innerHTML = `<img class="ac-thumb" src="${IMG_300}${item.poster_path || ''}" onerror="this.style.display='none'"><div class="ac-info"><div class="ac-title">${title}</div></div>`; row.addEventListener('mousedown', () => { $('#movie-search').value = title; closeAC(); lastQuery = title; lastType = type; performSearch(true); }); drop.appendChild(row); }); drop.classList.add('open'); }
function closeAC() { const drop = $('#autocomplete-dropdown'); if (drop) drop.classList.remove('open'); }

/* Event listeners */
$('#search-btn')?.addEventListener('click', () => { const q = $('#movie-search')?.value.trim(); if (q) { lastQuery = q; lastType = $('#search-type')?.value || 'movie'; performSearch(true); } else if (activeGenre || activeYear) { lastQuery = ''; performSearch(true); } else { $('#results-grid').innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>Enter a search term or select filters</h3></div>`; $('#results-section').classList.add('visible'); } });
$('#movie-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') { closeAC(); $('#search-btn').click(); } });
$('#clear-btn')?.addEventListener('click', () => { $('#results-section').classList.remove('visible'); $('#results-grid').innerHTML = ''; $('#movie-search').value = ''; lastQuery = ''; });
$('#rating-select')?.addEventListener('change', e => { activeRating = e.target.value; performSearch(true); });
$('#year-filter')?.addEventListener('change', e => { activeYear = e.target.value; performSearch(true); });
$('#sort-filter')?.addEventListener('change', e => { activeSort = e.target.value; performSearch(true); });
document.querySelectorAll('.fchip').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.fchip').forEach(b => b.classList.remove('active')); btn.classList.add('active'); activeGenre = btn.dataset.genre; performSearch(true); }); });

/* Panel */
document.querySelectorAll('#nav-watchlist-btn, #nav-watchlater-btn').forEach(btn => btn.addEventListener('click', () => openPanel(btn.id.includes('watchlist') ? 'watchlist' : 'watchlater')));
function openPanel(tab) { activePanel = tab; renderPanel(); $('#list-panel').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closePanel() { $('#list-panel').classList.remove('open'); document.body.style.overflow = ''; }
$('#panel-close')?.addEventListener('click', closePanel);
$('#list-panel')?.addEventListener('click', e => { if (e.target === $('#list-panel')) closePanel(); });
let activePanel = 'watchlist';
function renderPanel() { const items = storage.get(activePanel); const body = $('#panel-body'); if (!body) return; if (!items.length) { body.innerHTML = `<div class="panel-empty"><p>Empty</p></div>`; return; } body.innerHTML = ''; items.forEach(item => { const row = document.createElement('div'); row.className = 'panel-item'; row.innerHTML = `<img class="panel-thumb" src="${IMG_300}${item.poster_path || ''}" onerror="this.style.display='none'"><div class="panel-info"><div class="panel-item-title">${item.title}</div><div class="panel-item-meta">${item.year || ''}</div></div><div class="panel-item-actions"><button class="panel-item-btn play-btn">▶</button><button class="panel-item-btn remove-btn">✕</button></div>`; row.querySelector('.play-btn').addEventListener('click', () => { closePanel(); playTrailerById(item.id, item.title, item.year, item._type || 'movie', null); }); row.querySelector('.remove-btn').addEventListener('click', () => { storage.remove(activePanel, item.id); updateBadges(); renderPanel(); }); body.appendChild(row); }); }
document.querySelectorAll('#tab-watchlist, #tab-watchlater').forEach(tab => { tab.addEventListener('click', () => { activePanel = tab.id === 'tab-watchlist' ? 'watchlist' : 'watchlater'; document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); renderPanel(); }); });

/* Infinite scroll */
const sentinelObs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting && !isLoading && currentPage < totalPages && lastQuery) { currentPage++; performSearch(false); } }); }, { rootMargin: '200px' });
sentinelObs.observe($('#scroll-sentinel'));

/* Init */
updateBadges();
renderRecentlyViewed();
loadTrending();
performSearch(false);