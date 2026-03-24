/* ============================================================
   TRAILER HUB — script.js
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
let activePanel  = 'watchlist';
let focusedCardIdx = -1;

/* ── DOM shortcut ── */
const $ = id => document.getElementById(id);

/* ================================================================
   STORAGE HELPERS
================================================================ */
const storage = {
  get: key => JSON.parse(localStorage.getItem(key) || '[]'),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  getObj: key => JSON.parse(localStorage.getItem(key) || '{}'),
  setObj: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  has: (key, id) => storage.get(key).some(i => i.id === id),
  add(key, item) {
    const list = this.get(key);
    if (!list.find(i => i.id === item.id)) {
      list.unshift(item);
      this.set(key, list);
    }
  },
  remove(key, id) {
    this.set(key, this.get(key).filter(i => i.id !== id));
  }
};

/* ================================================================
   THEME
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
   AUTOCOMPLETE
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
    const res = await fetch(`${BASE_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(q)}&page=1&language=en-US`);
    const data = await res.json();
    renderAC(data.results?.slice(0, 6) || [], type);
  } catch { closeAC(); }
}

function renderAC(items, type) {
  const drop = $('autocomplete-dropdown');
  if (!drop) return;
  if (!items.length) { closeAC(); return; }

  drop.innerHTML = '';
  items.forEach((item) => {
    const title = item.title || item.name || '';
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    const rating = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '';
    const thumb = item.poster_path
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
      lastType = type;
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
});

function handleSearch() {
  const q = $('movie-search')?.value.trim();
  
  const searchGenre = $('genre-select')?.value || '';
  const searchYear = $('year-select')?.value || '';
  const searchType = $('search-type')?.value || 'movie';
  
  activeGenre = searchGenre;
  activeYear = searchYear;
  lastType = searchType;
  
  if (q) {
    lastQuery = q;
    currentPage = 1;
    pushState(q, lastType);
    doSearch(true);
  } 
  else if (activeGenre || activeYear) {
    lastQuery = '';
    currentPage = 1;
    pushState('', '');
    
    let filterText = '';
    if (activeGenre) filterText = 'Genre Filter';
    if (activeYear) filterText += filterText ? ` · ${activeYear}` : activeYear;
    
    if ($('results-heading')) $('results-heading').textContent = filterText || 'Discover';
    if ($('results-eyebrow')) $('results-eyebrow').textContent = 'Filtered Results';
    
    doSearch(true);
  }
  else {
    shake($('movie-search')?.closest('.search-box'));
    $('results-grid').innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>Enter a search term or select filters</h3><p>Try searching for a movie, TV show, or use genre/year filters above.</p></div>`;
    $('results-section').classList.add('visible');
  }
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
    currentPage = 1;
  }

  try {
    const yearParam = activeYear ? `&primary_release_year=${activeYear}` : '';
    const genreParam = activeGenre ? `&with_genres=${activeGenre}` : '';
    const certParam = activeRating ? `&certification_country=US&certification=${activeRating}` : '';
    
    let url;
    if (lastQuery) {
      url = `${BASE_URL}/search/${lastType}?api_key=${API_KEY}&query=${encodeURIComponent(lastQuery)}&language=en-US&page=${currentPage}&include_adult=false`;
    } else {
      url = `${BASE_URL}/discover/${lastType}?api_key=${API_KEY}&language=en-US&sort_by=${activeSort}&page=${currentPage}&include_adult=false${genreParam}${yearParam}${certParam}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    totalPages = Math.min(data.total_pages || 1, 500);
    let results = data.results || [];

    if (lastQuery && activeGenre) {
      results = results.filter(i => (i.genre_ids || []).includes(Number(activeGenre)));
    }
    if (lastQuery && activeYear) {
      results = results.filter(i => {
        const date = i.release_date || i.first_air_date || '';
        return date.startsWith(activeYear);
      });
    }
    
    if (reset) $('results-grid').innerHTML = '';

    if (results.length) {
      results.forEach((item, idx) => buildCard(item, (currentPage - 1) * 20 + idx, $('results-grid'), lastType));
    } else if (reset) {
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
  lastQuery = '';
  currentPage = 1;
  pushState('', '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function pushState(query, type) {
  const url = new URL(window.location);
  if (query) { url.searchParams.set('q', query); url.searchParams.set('type', type); }
  else { url.searchParams.delete('q'); url.searchParams.delete('type'); }
  history.pushState({}, '', url);
}

function readURLState() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  const type = params.get('type') || 'movie';
  if (q && $('movie-search')) {
    $('movie-search').value = q;
    if ($('search-type')) $('search-type').value = type;
    lastQuery = q;
    lastType = type;
    doSearch(true);
  }
}

/* ================================================================
   FILTERS
================================================================ */
$('rating-select')?.addEventListener('change', e => { activeRating = e.target.value; currentPage = 1; doSearch(true); });
$('year-filter')?.addEventListener('change', e => { activeYear = e.target.value; currentPage = 1; doSearch(true); });
$('sort-filter')?.addEventListener('change', e => { activeSort = e.target.value; currentPage = 1; doSearch(true); });
$('genre-select')?.addEventListener('change', e => { activeGenre = e.target.value; });
$('year-select')?.addEventListener('change', e => { activeYear = e.target.value; });

/* ================================================================
   INLINE TRAILER PLAYER — opens below clicked item, page scrollable
================================================================ */
let currentItem = null;

// REPLACE the entire openTrailerModal function with this:
async function openTrailerModal(item, type, anchorEl) {
  // Find the trailer container inside the card
  let trailerContainer = null;
  let parentCard = null;
  
  // If anchor is a card element, find its trailer container
  if (anchorEl && anchorEl.classList && (anchorEl.classList.contains('movie-card') || anchorEl.classList.contains('trending-card'))) {
    parentCard = anchorEl;
    trailerContainer = parentCard.querySelector('.card-trailer-container');
  } 
  // If anchor is a button inside card, find parent card
  else if (anchorEl && anchorEl.closest) {
    parentCard = anchorEl.closest('.movie-card, .trending-card');
    if (parentCard) {
      trailerContainer = parentCard.querySelector('.card-trailer-container');
    }
  }
  
  // If no container found, create one
  if (!trailerContainer && parentCard) {
    trailerContainer = document.createElement('div');
    trailerContainer.className = 'card-trailer-container';
    trailerContainer.style.cssText = 'display: none; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin: 8px;';
    parentCard.appendChild(trailerContainer);
  }
  
  // If we have a container, toggle/play inside card
  if (trailerContainer) {
    // If already playing, close it
    if (trailerContainer.style.display === 'block') {
      trailerContainer.style.display = 'none';
      trailerContainer.innerHTML = '';
      return;
    }
    
    // Close any other open trailers in other cards
    document.querySelectorAll('.card-trailer-container').forEach(c => {
      if (c !== trailerContainer) {
        c.style.display = 'none';
        c.innerHTML = '';
      }
    });
    
    // Add to recently viewed
    const title = item.title || item.name || 'Unknown';
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    addRecentlyViewed({ id: item.id, title, year, poster_path: item.poster_path || '', _type: type });
    
    // Show loading inside card
    trailerContainer.style.display = 'block';
    trailerContainer.innerHTML = `
      <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #000; color: white;">
        <div style="text-align: center;">
          <div style="width: 30px; height: 30px; border: 2px solid var(--accent); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 10px;"></div>
          Loading trailer...
        </div>
      </div>
    `;
    
    // Scroll to card
    parentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    try {
      const videoUrl = type === 'tv'
        ? `${BASE_URL}/tv/${item.id}/videos?api_key=${API_KEY}`
        : `${BASE_URL}/movie/${item.id}/videos?api_key=${API_KEY}`;
      const res = await fetch(videoUrl);
      const data = await res.json();
      const vids = data.results || [];
      const clip = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer')
                 || vids.find(v => v.site === 'YouTube' && v.type === 'Teaser')
                 || vids.find(v => v.site === 'YouTube');
      
      if (clip) {
        trailerContainer.innerHTML = `
          <iframe 
            src="https://www.youtube.com/embed/${clip.key}?autoplay=1&rel=0&modestbranding=1&showinfo=0" 
            frameborder="0" 
            allow="autoplay; encrypted-media; picture-in-picture" 
            allowfullscreen
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 12px;">
          </iframe>
        `;
      } else {
        trailerContainer.innerHTML = `
          <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg3); color: var(--muted); flex-direction: column; gap: 8px;">
            <div style="font-size: 32px;">🎬</div>
            <p style="font-size: 12px;">No trailer available</p>
            <button onclick="this.parentElement.parentElement.style.display='none'" style="padding: 4px 12px; background: var(--accent); border: none; border-radius: 20px; color: white; font-size: 10px; cursor: pointer;">Close</button>
          </div>
        `;
      }
    } catch (error) {
      trailerContainer.innerHTML = `
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg3); color: var(--muted);">
          Error loading trailer
        </div>
      `;
    }
  }
}



function renderInlineActions() {
  const el = document.getElementById('inline-player-actions');
  if (!el || !currentItem) return;
  const item = currentItem;
  const inWL   = storage.has('watchlist',  item.id);
  const inWLat = storage.has('watchlater', item.id);
  const store  = { id: item.id, title: item.title||item.name, year: (item.release_date||item.first_air_date||'').slice(0,4), poster_path: item.poster_path||'', _type: item._type };
  el.innerHTML = `
    <button class="modal-action ${inWL?'saved':''}" id="ipl-wl">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      ${inWL ? 'Saved' : '+ Watchlist'}
    </button>
    <button class="modal-action ${inWLat?'saved':''}" id="ipl-wlat">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      ${inWLat ? 'Added' : '+ Watch Later'}
    </button>
    <button class="modal-action" id="ipl-detail">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v5M8 5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Full Details
    </button>`;
  document.getElementById('ipl-wl').onclick    = () => { toggleList('watchlist',  store); updateBadges(); renderInlineActions(); };
  document.getElementById('ipl-wlat').onclick  = () => { toggleList('watchlater', store); updateBadges(); renderInlineActions(); };
  document.getElementById('ipl-detail').onclick = () => { closeInlinePlayer(); window.location.href = `movie.html?id=${item.id}&type=${item._type||'movie'}`; };
}

document.addEventListener('click', e => {
  if (e.target.id === 'inline-player-close') closeInlinePlayer();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInlinePlayer(); });

/* ================================================================
   BUILD MOVIE CARD
================================================================ */
function buildCard(item, idx, container, type) {
  const title = item.title || item.name || 'Unknown';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const score = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '';
  const overview = item.overview || 'No description available.';
  const inWL = storage.has('watchlist', item.id);
  const inWLat = storage.has('watchlater', item.id);
  const userRating = getUserRating(item.id);

  const card = document.createElement('div');
  card.className = 'movie-card';
  card.tabIndex = 0;
  card.dataset.id = item.id;
  card.style.animationDelay = `${(idx % 20) * 0.05}s`;

  const poster = item.poster_path
    ? `<img src="${IMG_500}${item.poster_path}" alt="${title}" loading="lazy">`
    : `<div class="no-poster">🎬</div>`;

  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="star ${n <= userRating ? 'active' : ''}" data-star="${n}">★</button>`
  ).join('');

  card.innerHTML = `
    <div class="card-poster-wrap">
      ${poster}
      ${score ? `<div class="card-rating">${score}</div>` : ''}
      <div class="card-overlay">
        <p class="card-overview">${overview.substring(0, 100)}...</p>
        <button class="watch-trailer-btn">▶ WATCH TRAILER</button>
      </div>
    </div>
    <div class="card-info">
      <div class="card-title">${title}${year ? ` <span style="color:var(--faint);font-weight:300">(${year})</span>` : ''}</div>
      <div class="star-rating">${stars}<span class="star-label">${userRating ? `${userRating}/5` : 'Rate'}</span></div>
    </div>
    <div class="card-actions" style="display: flex; gap: 6px; padding: 10px 12px 14px; border-top: 1px solid var(--border); margin-top: 4px;">
      <button class="card-action-btn wl-btn ${inWL ? 'saved' : ''}" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 4px; border-radius: 8px; background: var(--glass); border: 1px solid var(--border); cursor: pointer; font-size: 10px; font-weight: 500; color: var(--text);">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        ${inWL ? 'Saved' : 'Watchlist'}
      </button>
      <button class="card-action-btn wlat-btn ${inWLat ? 'saved' : ''}" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 4px; border-radius: 8px; background: var(--glass); border: 1px solid var(--border); cursor: pointer; font-size: 10px; font-weight: 500; color: var(--text);">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        ${inWLat ? 'Later' : 'Later'}
      </button>
      <button class="card-action-btn detail-btn" style="flex: 0.8; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 4px; border-radius: 8px; background: var(--accent); border: 1px solid var(--accent); cursor: pointer; font-size: 10px; font-weight: 600; color: white;">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="white" stroke-width="1.5"/><path d="M8 7v5M8 5v.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>
        Info
      </button>
    </div>
    <div class="card-trailer-container" id="trailer-${item.id}" style="display: none; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin: 0 8px 8px 8px;"></div>`;

  const storeItem = { id: item.id, title, year, poster_path: item.poster_path || '', _type: type };

  // Watch Trailer button - plays inside the card
  const trailerBtn = card.querySelector('.watch-trailer-btn');
  trailerBtn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    playTrailerInsideCard(item, type, card);
  });

  // Watchlist button
  card.querySelector('.wl-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleList('watchlist', storeItem);
    updateBadges();
    const saved = storage.has('watchlist', item.id);
    e.currentTarget.classList.toggle('saved', saved);
    e.currentTarget.style.background = saved ? 'var(--accent-dim)' : 'var(--glass)';
    e.currentTarget.innerHTML = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${saved ? 'Saved' : 'Watchlist'}`;
  });

  // Watch Later button
  card.querySelector('.wlat-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleList('watchlater', storeItem);
    updateBadges();
    const added = storage.has('watchlater', item.id);
    e.currentTarget.classList.toggle('saved', added);
    e.currentTarget.style.background = added ? 'var(--accent-dim)' : 'var(--glass)';
    e.currentTarget.innerHTML = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>${added ? 'Later' : 'Later'}`;
  });

  // Info button - VISIBLE NOW
  const infoBtn = card.querySelector('.detail-btn');
  infoBtn.addEventListener('click', e => {
    e.stopPropagation();
    window.location.href = `movie.html?id=${item.id}&type=${type}`;
  });

  // Enter key opens trailer inside card
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      playTrailerInsideCard(item, type, card);
    }
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

  container.appendChild(card);
}

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
  const row = $('recently-row');
  if (!section || !row) return;

  const items = storage.get('recently');
  if (!items.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  row.innerHTML = '';

  items.slice(0, 12).forEach((item, idx) => {
    const title = item.title || item.name || 'Unknown';
    const year = item.year || '';
    const mediaType = item._type || 'movie';
    const inWL = storage.has('watchlist', item.id);
    const inWLat = storage.has('watchlater', item.id);
    
    const card = document.createElement('div');
    card.className = 'trending-card';
    card.style.cursor = 'pointer';
    card.style.background = 'var(--bg2)';
    card.style.borderRadius = '16px';
    card.style.overflow = 'hidden';
    card.style.border = '1px solid var(--border)';
    card.style.transition = 'transform 0.3s, border-color 0.2s';
    card.style.minWidth = '180px';
    card.style.flexShrink = '0';
    card.style.width = '180px';
    card.style.animationDelay = `${idx * 0.03}s`;

    const thumb = item.poster_path
      ? `<img class="trending-thumb" src="${IMG_300}${item.poster_path}" alt="${title}" style="width: 100%; height: 114px; object-fit: cover;" loading="lazy">`
      : `<div class="trending-thumb" style="width:100%; height:114px; display:flex; align-items:center; justify-content:center; background: var(--bg3); font-size:28px;">🎬</div>`;

    card.innerHTML = `
      ${thumb}
      <div style="padding: 10px 12px;">
        <div class="trending-title" style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
        <div class="trending-sub" style="font-size: 11px; color: var(--faint); margin: 4px 0;">${mediaType === 'tv' ? 'TV Show' : 'Movie'}${year ? ` · ${year}` : ''}</div>
        <button class="recent-watch-trailer-btn" style="margin: 8px 0 6px; width: 100%; padding: 8px; background: var(--accent); border: none; border-radius: 8px; color: white; font-size: 11px; font-weight: 500; cursor: pointer;">▶ WATCH TRAILER</button>
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button class="recent-wl-btn ${inWL ? 'saved' : ''}" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px; border-radius: 8px; background: var(--glass); border: 1px solid var(--border); cursor: pointer; font-size: 10px; font-weight: 500; color: var(--text);">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            ${inWL ? 'Saved' : 'Watchlist'}
          </button>
          <button class="recent-wlat-btn ${inWLat ? 'saved' : ''}" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px; border-radius: 8px; background: var(--glass); border: 1px solid var(--border); cursor: pointer; font-size: 10px; font-weight: 500; color: var(--text);">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            ${inWLat ? 'Later' : 'Later'}
          </button>
          <button class="recent-detail-btn" style="flex: 0.7; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px; border-radius: 8px; background: var(--accent); border: 1px solid var(--accent); cursor: pointer; font-size: 10px; font-weight: 600; color: white;">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="white" stroke-width="1.5"/><path d="M8 7v5M8 5v.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>
            Info
          </button>
        </div>
      </div>
      <div class="card-trailer-container" id="recent-trailer-${item.id}" style="display: none; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin: 0 8px 8px 8px;"></div>`;

    const storeItem = { id: item.id, title, year, poster_path: item.poster_path || '', _type: mediaType };
    
    // IMPORTANT: Get the trailer button with the correct class
    const trailerBtn = card.querySelector('.recent-watch-trailer-btn');
    
    // Make sure the button exists before adding event
    if (trailerBtn) {
      trailerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Trailer button clicked for:', title);
        playTrailerInsideCard(item, mediaType, card);
      });
    } else {
      console.log('Trailer button not found for:', title);
    }
    
    // Watchlist button
    const wlBtn = card.querySelector('.recent-wl-btn');
    if (wlBtn) {
      wlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleList('watchlist', storeItem);
        updateBadges();
        const saved = storage.has('watchlist', item.id);
        wlBtn.classList.toggle('saved', saved);
        wlBtn.style.background = saved ? 'var(--accent-dim)' : 'var(--glass)';
        wlBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${saved ? 'Saved' : 'Watchlist'}`;
      });
    }
    
    // Watch Later button
    const wlatBtn = card.querySelector('.recent-wlat-btn');
    if (wlatBtn) {
      wlatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleList('watchlater', storeItem);
        updateBadges();
        const added = storage.has('watchlater', item.id);
        wlatBtn.classList.toggle('saved', added);
        wlatBtn.style.background = added ? 'var(--accent-dim)' : 'var(--glass)';
        wlatBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>${added ? 'Later' : 'Later'}`;
      });
    }
    
    // Info button
    const detailBtn = card.querySelector('.recent-detail-btn');
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `movie.html?id=${item.id}&type=${mediaType}`;
      });
    }
    
    // Click on card also plays trailer (but not on buttons)
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking any button
      if (e.target.tagName === 'BUTTON') return;
      if (e.target.closest('button')) return;
      playTrailerInsideCard(item, mediaType, card);
    });
    
    row.appendChild(card);
  });
}

$('clear-recent')?.addEventListener('click', () => {
  storage.set('recently', []);
  renderRecentlyViewed();
});

/* ================================================================
   WATCHLIST / WATCH LATER
================================================================ */
function toggleList(key, item) {
  storage.has(key, item.id) ? storage.remove(key, item.id) : storage.add(key, item);
}

function updateBadges() {
  ['watchlist', 'watchlater'].forEach(key => {
    const count = storage.get(key).length;
    const el = $(key === 'watchlist' ? 'watchlist-count' : 'watchlater-count');
    if (el) {
      el.textContent = count;
      el.classList.toggle('zero', count === 0);
    }
  });
}

document.querySelectorAll('#nav-watchlist-btn').forEach(b => b.addEventListener('click', () => openPanel('watchlist')));
document.querySelectorAll('#nav-watchlater-btn').forEach(b => b.addEventListener('click', () => openPanel('watchlater')));
document.querySelectorAll('#panel-close').forEach(b => b.addEventListener('click', closePanel));
document.querySelectorAll('#list-panel').forEach(el => el.addEventListener('click', e => { if (e.target === el) closePanel(); }));

function openPanel(tab) {
  activePanel = tab;
  renderPanel();
  document.querySelectorAll('#list-panel').forEach(el => el.classList.add('open'));
  document.body.style.overflow = 'hidden';
}

function closePanel() {
  document.querySelectorAll('#list-panel').forEach(el => el.classList.remove('open'));
  document.body.style.overflow = '';
}

function renderPanel() {
  const key = activePanel;
  const items = storage.get(key);
  document.querySelectorAll('#panel-body').forEach(body => {
    if (!items.length) {
      body.innerHTML = `<div class="panel-empty"><div class="icon">${key === 'watchlist' ? '🔖' : '🕐'}</div><p>Your ${key === 'watchlist' ? 'watchlist' : 'watch later list'} is empty.</p></div>`;
      return;
    }
    body.innerHTML = '';
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'panel-item';
      const thumb = item.poster_path
        ? `<img class="panel-thumb" src="${IMG_300}${item.poster_path}" alt="${item.title}">`
        : `<div class="panel-thumb-placeholder">🎬</div>`;
      row.innerHTML = `${thumb}<div class="panel-info"><div class="panel-item-title">${item.title || item.name}</div><div class="panel-item-meta">${item.year || ''} · ${item._type === 'tv' ? 'TV Show' : 'Movie'}</div></div><div class="panel-item-actions"><button class="panel-item-btn play-btn">▶</button><button class="panel-item-btn remove-btn">✕</button></div>`;
      
      row.querySelector('.play-btn').addEventListener('click', () => {
        closePanel();
        openTrailerModal(item, item._type || 'movie');
      });
      
      row.querySelector('.remove-btn').addEventListener('click', () => {
        storage.remove(key, item.id);
        updateBadges();
        renderPanel();
      });
      body.appendChild(row);
    });
  });
}

/* ================================================================
   TRENDING
================================================================ */
async function loadTrending() {
  const row = $('trending-row');
  if (!row) return;

  row.innerHTML = '<div style="text-align:center;padding:20px">Loading trending...</div>';

  try {
    const res = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}&language=en-US`);
    const data = await res.json();
    const items = data.results || [];
    row.innerHTML = '';

    items.slice(0, 14).forEach((item, idx) => {
      const title = item.title || item.name || 'Unknown';
      const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
      const year = (item.release_date || item.first_air_date || '').slice(0, 4);
      const score = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '';
      const inWL = storage.has('watchlist', item.id);
      const inWLat = storage.has('watchlater', item.id);
      
      const card = document.createElement('div');
      card.className = 'trending-card';
      card.style.cursor = 'pointer';
      card.style.background = 'var(--bg2)';
      card.style.borderRadius = '16px';
      card.style.overflow = 'hidden';
      card.style.border = '1px solid var(--border)';
      card.style.transition = 'transform 0.3s, border-color 0.2s';
      
      const thumb = item.backdrop_path || item.poster_path
        ? `<img class="trending-thumb" src="${IMG_300}${item.backdrop_path || item.poster_path}" alt="${title}" loading="lazy" style="width: 100%; height: 114px; object-fit: cover;">`
        : `<div class="trending-thumb" style="width:100%; height:114px; display:flex; align-items:center; justify-content:center; background: var(--bg3); font-size:28px;">🎬</div>`;
      
      card.innerHTML = `
        <div class="trending-num" style="position: absolute; top: 6px; left: 12px; font-family: var(--font-d); font-size: 64px; line-height: 1; color: rgba(255,255,255,0.1); pointer-events: none; z-index: 1;">${idx + 1}</div>
        ${thumb}
        <div style="padding: 10px 12px;">
          <div class="trending-title" style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
          <div class="trending-sub" style="font-size: 11px; color: var(--faint); margin: 4px 0;">${mediaType === 'tv' ? 'TV Show' : 'Movie'}${year ? ` · ${year}` : ''}${score ? ` · ${score}` : ''}</div>
          <button class="watch-trailer-btn" style="margin: 8px 0 6px; width: 100%; padding: 8px; background: var(--accent); border: none; border-radius: 8px; color: white; font-size: 11px; font-weight: 500; cursor: pointer;">▶ WATCH TRAILER</button>
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <button class="trending-wl-btn ${inWL ? 'saved' : ''}" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px; border-radius: 8px; background: var(--glass); border: 1px solid var(--border); cursor: pointer; font-size: 10px; font-weight: 500; color: var(--text);">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
              ${inWL ? 'Saved' : 'Watchlist'}
            </button>
            <button class="trending-wlat-btn ${inWLat ? 'saved' : ''}" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px; border-radius: 8px; background: var(--glass); border: 1px solid var(--border); cursor: pointer; font-size: 10px; font-weight: 500; color: var(--text);">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              ${inWLat ? 'Later' : 'Later'}
            </button>
           <button class="trending-detail-btn" style="flex: 0.7; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px; border-radius: 8px; background: var(--accent); border: 1px solid var(--accent); cursor: pointer; font-size: 10px; font-weight: 600; color: white;">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v5M8 5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Info
            </button>
          </div>
        </div>
        <div class="card-trailer-container" id="trending-trailer-${item.id}" style="display: none; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin: 0 8px 8px 8px;"></div>`;
      
      const storeItem = { id: item.id, title, year, poster_path: item.poster_path || '', _type: mediaType };
      
      // Watch Trailer button
      const trailerBtn = card.querySelector('.watch-trailer-btn');
      trailerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playTrailerInsideCard(item, mediaType, card);
      });
      
      // Watchlist button
      card.querySelector('.trending-wl-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleList('watchlist', storeItem);
        updateBadges();
        const saved = storage.has('watchlist', item.id);
        const btn = card.querySelector('.trending-wl-btn');
        btn.classList.toggle('saved', saved);
        btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${saved ? 'Saved' : 'Watchlist'}`;
      });
      
      // Watch Later button
      card.querySelector('.trending-wlat-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleList('watchlater', storeItem);
        updateBadges();
        const added = storage.has('watchlater', item.id);
        const btn = card.querySelector('.trending-wlat-btn');
        btn.classList.toggle('saved', added);
        btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>${added ? 'Later' : 'Later'}`;
      });
      
      // Info button
      card.querySelector('.trending-detail-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `movie.html?id=${item.id}&type=${mediaType}`;
      });
      
      // Click on card also plays trailer (but not on buttons)
      card.addEventListener('click', (e) => {
        if (e.target === trailerBtn || trailerBtn.contains(e.target)) return;
        if (e.target.classList?.contains('trending-wl-btn') || e.target.classList?.contains('trending-wlat-btn') || e.target.classList?.contains('trending-detail-btn')) return;
        playTrailerInsideCard(item, mediaType, card);
      });
      
      row.appendChild(card);
    });

    const t = $('trending-time');
    if (t) t.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    row.innerHTML = '<p style="color:var(--faint);font-size:13px;padding:20px 0">Could not load trending titles.</p>';
  }
}

//helper func 
// Add this function after your other functions
async function playTrailerInsideCard(item, type, card) {
  // Find the trailer container inside the card
  const trailerContainer = card.querySelector('.card-trailer-container');
  if (!trailerContainer) return;
  
  // If already playing, close it
  if (trailerContainer.style.display === 'block') {
    trailerContainer.style.display = 'none';
    trailerContainer.innerHTML = '';
    return;
  }
  
  // Close any other open trailers in other cards
  document.querySelectorAll('.card-trailer-container').forEach(c => {
    if (c !== trailerContainer) {
      c.style.display = 'none';
      c.innerHTML = '';
    }
  });
  
  // Add to recently viewed
  const title = item.title || item.name || 'Unknown';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  addRecentlyViewed({ id: item.id, title, year, poster_path: item.poster_path || '', _type: type });
  
  // Show loading inside card
  trailerContainer.style.display = 'block';
  trailerContainer.innerHTML = `
    <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #000; color: white;">
      <div style="text-align: center;">
        <div style="width: 30px; height: 30px; border: 2px solid var(--accent); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 10px;"></div>
        Loading trailer...
      </div>
    </div>
  `;
  
  // Scroll to card
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  try {
    const videoUrl = type === 'tv'
      ? `${BASE_URL}/tv/${item.id}/videos?api_key=${API_KEY}`
      : `${BASE_URL}/movie/${item.id}/videos?api_key=${API_KEY}`;
    const res = await fetch(videoUrl);
    const data = await res.json();
    const vids = data.results || [];
    const clip = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer')
               || vids.find(v => v.site === 'YouTube' && v.type === 'Teaser')
               || vids.find(v => v.site === 'YouTube');
    
    if (clip) {
      trailerContainer.innerHTML = `
        <iframe 
          src="https://www.youtube.com/embed/${clip.key}?autoplay=1&rel=0&modestbranding=1&showinfo=0" 
          frameborder="0" 
          allow="autoplay; encrypted-media; picture-in-picture" 
          allowfullscreen
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 12px;">
        </iframe>
      `;
    } else {
      trailerContainer.innerHTML = `
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg3); color: var(--muted); flex-direction: column; gap: 8px;">
          <div style="font-size: 32px;">🎬</div>
          <p style="font-size: 12px;">No trailer available</p>
          <button onclick="this.parentElement.parentElement.style.display='none'" style="padding: 4px 12px; background: var(--accent); border: none; border-radius: 20px; color: white; font-size: 10px; cursor: pointer;">Close</button>
        </div>
      `;
    }
  } catch (error) {
    trailerContainer.innerHTML = `
      <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg3); color: var(--muted);">
        Error loading trailer
      </div>
    `;
  }
}

/* ================================================================
   MOVIE DETAIL PAGE
================================================================ */
async function loadMovieDetail() {
  if (!$('movie-detail')) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const type = params.get('type') || 'movie';
  if (!id) { window.location.href = 'index.html'; return; }

  try {
    const [detailRes, creditsRes] = await Promise.all([
      fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=en-US`),
      fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${API_KEY}&language=en-US`)
    ]);
    const detail = await detailRes.json();
    const credits = await creditsRes.json();
    document.title = `${detail.title || detail.name} — Trailer Hub`;
    renderDetail(detail, credits, type);
    loadSimilar(id, type);
  } catch {
    $('movie-detail').innerHTML = `<div style="text-align:center;padding:120px 20px;color:var(--faint)"><div style="font-size:48px;margin-bottom:16px">⚡</div><p>Could not load movie details.</p><a href="index.html" class="btn-pill" style="margin-top:20px;display:inline-block">← Back</a></div>`;
  }
}

function renderDetail(d, credits, type) {
  const title = d.title || d.name || 'Unknown';
  const year = (d.release_date || d.first_air_date || '').slice(0, 4);
  const runtime = d.runtime ? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m` : (d.episode_run_time?.[0] ? `${d.episode_run_time[0]}m/ep` : '');
  const score = d.vote_average ? d.vote_average.toFixed(1) : '';
  const votes = d.vote_count ? d.vote_count.toLocaleString() : '';
  const genres = (d.genres || []).map(g => `<span class="detail-genre-tag">${g.name}</span>`).join('');
  const director = (credits.crew || []).find(c => c.job === 'Director');
  const cast = (credits.cast || []).slice(0, 12);
  const inWL = storage.has('watchlist', d.id);
  const inWLat = storage.has('watchlater', d.id);
  const budget = d.budget ? `$${(d.budget / 1e6).toFixed(0)}M` : '—';
  const revenue = d.revenue ? `$${(d.revenue / 1e6).toFixed(0)}M` : '—';
  const status = d.status || '—';
  const lang = d.original_language?.toUpperCase() || '—';

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

  const storeItem = { id: d.id, title, year, poster_path: d.poster_path || '', _type: type };

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

  $('detail-trailer-btn')?.addEventListener('click', () => {
    openTrailerModal(d, type, document.getElementById('movie-detail'));
  });
  
  $('detail-wl-btn')?.addEventListener('click', () => {
    toggleList('watchlist', storeItem);
    const saved = storage.has('watchlist', d.id);
    const btn = $('detail-wl-btn');
    btn.classList.toggle('saved', saved);
    btn.textContent = saved ? '✓ In Watchlist' : '+ Watchlist';
    updateBadges();
  });
  
  $('detail-wlat-btn')?.addEventListener('click', () => {
    toggleList('watchlater', storeItem);
    const added = storage.has('watchlater', d.id);
    const btn = $('detail-wlat-btn');
    btn.classList.toggle('saved', added);
    btn.textContent = added ? '✓ Watch Later' : '+ Watch Later';
    updateBadges();
  });

  addRecentlyViewed(storeItem);
}

async function loadSimilar(id, type) {
  try {
    const res = await fetch(`${BASE_URL}/${type}/${id}/similar?api_key=${API_KEY}&language=en-US&page=1`);
    const data = await res.json();
    const items = (data.results || []).filter(i => i.poster_path).slice(0, 10);
    if (!items.length) return;

    const section = $('similar-section');
    const grid = $('similar-grid');
    section.querySelectorAll('[data-reveal]').forEach(el => revealObs.observe(el));
  } catch {}
}

/* ================================================================
   HELPER FUNCTIONS
================================================================ */
function skeletons(n) {
  return Array.from({ length: n }, () => `
    <div class="skeleton-card">
      <div class="sk-shimmer sk-poster"></div>
      <div class="sk-shimmer sk-bar"></div>
      <div class="sk-shimmer sk-bar s"></div>
    </div>`).join('');
}

function shake(el) {
  if (!el) return;
  el.style.animation = 'shakeField 0.45s ease';
  el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}

/* ================================================================
   INIT
================================================================ */
updateBadges();
renderRecentlyViewed();
loadTrending();
readURLState();
loadMovieDetail();

// Add shake animation style
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `@keyframes shakeField{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`;
document.head.appendChild(shakeStyle);

// Genre dropdown toggle
const toggle = document.getElementById("genre-toggle");
const dropdown = document.getElementById("genre-dropdown");

if (toggle && dropdown) {
  toggle.addEventListener("click", () => {
    dropdown.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove("show");
    }
  });
}