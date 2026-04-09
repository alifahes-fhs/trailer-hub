/* ============================================================
   TRAILER HUB — script.js (FULL FIXED VERSION)
   ============================================================ */

   const API_KEY  = 'afecc8075597c531e9aae083331172c6';
   const BASE_URL = 'https://api.themoviedb.org/3';
   const IMG_500  = 'https://image.tmdb.org/t/p/w500';
   const IMG_300  = 'https://image.tmdb.org/t/p/w300';
   const IMG_ORI  = 'https://image.tmdb.org/t/p/original';

   
   /* ── State ── */
   let activeGenre  = '';
   let activeRating = '';
   let activeAgeGroup = '';
   let activeMinScore = '';
   let activeMood = '';
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
   const auth = window.TrailerAuth;
   const providerCache = new Map();
   
   const MOOD_MAP = {
     laugh: { label: 'Laugh', genres: [35, 10751] },
     heartbreak: { label: 'Heartbreak', genres: [18, 10749] },
     thrill: { label: 'Thrill', genres: [53, 28, 80, 27] },
     romance: { label: 'Romance', genres: [10749, 35] },
     mindbend: { label: 'Mind-Bending', genres: [878, 9648, 53, 14] },
     family: { label: 'Family Time', genres: [10751, 16, 12] }
   };
   
   const PROVIDER_REGIONS = ['US', 'AE', 'GB'];
   
   async function getProviderNames(id, type) {
     const key = `${type}:${id}`;
     if (providerCache.has(key)) return providerCache.get(key);
     const p = (async () => {
       try {
         const res = await fetch(`${BASE_URL}/${type}/${id}/watch/providers?api_key=${API_KEY}`);
         const data = await res.json();
         const results = data.results || {};
         let regionData = null;
         for (const r of PROVIDER_REGIONS) {
           if (results[r]) { regionData = results[r]; break; }
         }
         if (!regionData) return [];
         const pool = [...(regionData.flatrate || []), ...(regionData.buy || []), ...(regionData.rent || [])];
         const unique = [];
         for (const pvd of pool) {
           if (!unique.includes(pvd.provider_name)) unique.push(pvd.provider_name);
         }
         return unique.slice(0, 3);
       } catch {
         return [];
       }
     })();
     providerCache.set(key, p);
     return p;
   }
   
   function attachPlatformInfo(card, id, type) {
     const el = card.querySelector('.platform-tags');
     if (!el) return;
     el.textContent = 'Platforms: ...';
     getProviderNames(id, type).then(names => {
       el.textContent = names.length ? `On: ${names.join(' · ')}` : 'On: Unavailable';
     });
   }
   
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
     if (icon) icon.textContent = theme === 'light' ? '🌙' : '☀️';
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
       const moodGenres = activeMood && MOOD_MAP[activeMood] ? MOOD_MAP[activeMood].genres.join(',') : '';
       const effectiveGenres = moodGenres || activeGenre;
       const genreParam = effectiveGenres ? `&with_genres=${effectiveGenres}` : '';
       // Age/certification filtering only applies cleanly to Movie discover.
       const ageCertParam = (() => {
         if (lastType !== 'movie') return '';
         if (!activeAgeGroup) return '';
         // Approximate mapping to US certs:
         // 5–9 -> G, 10–12 -> PG, 13–15 -> PG-13, Under 18 -> PG-13, 18+ -> R+
         if (activeAgeGroup === 'a5_9') return `&certification_country=US&certification.lte=G`;
         if (activeAgeGroup === 'a10_12') return `&certification_country=US&certification.lte=PG`;
         if (activeAgeGroup === 'a13_15') return `&certification_country=US&certification.lte=PG-13`;
         if (activeAgeGroup === 'u18') return `&certification_country=US&certification.lte=PG-13`;
         if (activeAgeGroup === 'a18') return `&certification_country=US&certification.gte=R`;
         return '';
       })();
       const certParam = activeRating ? `&certification_country=US&certification=${activeRating}` : '';
       const scoreParam = activeMinScore ? `&vote_average.gte=${activeMinScore}&vote_count.gte=150` : '';
       
       let url;
       if (lastQuery) {
         url = `${BASE_URL}/search/${lastType}?api_key=${API_KEY}&query=${encodeURIComponent(lastQuery)}&language=en-US&page=${currentPage}&include_adult=false`;
       } else {
         url = `${BASE_URL}/discover/${lastType}?api_key=${API_KEY}&language=en-US&sort_by=${activeSort}&page=${currentPage}&include_adult=false${genreParam}${yearParam}${ageCertParam}${certParam}${scoreParam}`;
       }
   
       const res = await fetch(url);
       if (!res.ok) throw new Error('API error');
       const data = await res.json();
       totalPages = Math.min(data.total_pages || 1, 500);
       let results = data.results || [];
   
       if (lastQuery && effectiveGenres) {
         const wanted = effectiveGenres.split(',').map(n => Number(n));
         results = results.filter(i => (i.genre_ids || []).some(g => wanted.includes(g)));
       }
       if (lastQuery && activeYear) {
         results = results.filter(i => {
           const date = i.release_date || i.first_air_date || '';
           return date.startsWith(activeYear);
         });
       }
       if (activeMinScore) {
         const minScore = Number(activeMinScore);
         results = results.filter(i => Number(i.vote_average || 0) >= minScore);
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
      BUILD MOVIE CARD
   ================================================================ */
   function buildCard(item, idx, container, type) {
     const title = item.title || item.name || 'Unknown';
     const year = (item.release_date || item.first_air_date || '').slice(0, 4);
     const score = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : '';
     const overview = item.overview || 'No description available.';
     const inWL = storage.has('watchlist', item.id);
    const inWLat = storage.has('watchlater', item.id)
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
         <div class="platform-tags"></div>
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
   
     const storeItem = { id: item.id, title, year, poster_path: item.poster_path || '', _type: type, score: item.vote_average || 0 };
   
     const trailerBtn = card.querySelector('.watch-trailer-btn');
     trailerBtn.addEventListener('click', e => {
       e.stopPropagation();
       e.preventDefault();
       playTrailerInsideCard(item, type, card);
     });
   
     card.querySelector('.wl-btn').addEventListener('click', e => {
       e.stopPropagation();
       toggleList('watchlist', storeItem);
       updateBadges();
       const saved = storage.has('watchlist', item.id);
       e.currentTarget.classList.toggle('saved', saved);
       e.currentTarget.style.background = saved ? 'var(--accent-dim)' : 'var(--glass)';
       e.currentTarget.innerHTML = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${saved ? 'Saved' : 'Watchlist'}`;
     });
   
    card.querySelector('.wlat-btn').addEventListener('click', e => {
      e.stopPropagation();
      toggleList('watchlater', storeItem);
      updateBadges();
      const wlatSaved = storage.has('watchlater', item.id);
      e.currentTarget.classList.toggle('saved', wlatSaved);
      e.currentTarget.style.background = wlatSaved ? 'var(--accent-dim)' : 'var(--glass)';
      e.currentTarget.innerHTML = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' + (wlatSaved ? 'Saved' : 'Later');
    });
   
     const infoBtn = card.querySelector('.detail-btn');
     infoBtn.addEventListener('click', e => {
       e.stopPropagation();
       window.location.href = `movie.html?id=${item.id}&type=${type}`;
     });
   
     card.addEventListener('keydown', e => {
       if (e.key === 'Enter') {
         playTrailerInsideCard(item, type, card);
       }
     });
   
     card.querySelectorAll('.star').forEach(star => {
       star.addEventListener('click', e => {
         e.stopPropagation();
         const val = Number(star.dataset.star);
         saveUserRating(item.id, val);
         card.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < val));
         card.querySelector('.star-label').textContent = `${val}/5`;
       });
     });
   
     attachPlatformInfo(card, item.id, type);
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
      RECENTLY VIEWED - FIXED VERSION
   ================================================================ */
   function addRecentlyViewed(item) {
     if (!auth?.canUsePersonalFeatures?.()) return;
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
   
     if (!auth?.canUsePersonalFeatures?.()) {
       section.style.display = 'block';
       row.innerHTML = `<div class="empty-state"><div class="icon">🔒</div><h3>Login to unlock Recently Viewed</h3><p>Guests can browse trailers, but history sync is for signed-in users.</p></div>`;
       return;
     }
   
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
       const scoreNum = Number(item.score || 0);
       const score = scoreNum ? `★ ${scoreNum.toFixed(1)}` : '';
       
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
       card.setAttribute('data-id', item.id);
       card.setAttribute('data-type', mediaType);
   
       const thumb = item.poster_path
         ? `<img class="trending-thumb" src="${IMG_300}${item.poster_path}" alt="${title}" style="width: 100%; height: 114px; object-fit: cover;" loading="lazy">`
         : `<div class="trending-thumb" style="width:100%; height:114px; display:flex; align-items:center; justify-content:center; background: var(--bg3); font-size:28px;">🎬</div>`;
       
       card.innerHTML = `
         ${thumb}
         <div style="padding: 10px 12px;">
           <div class="trending-title" style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${title}</div>
           <div class="trending-sub" style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size: 11px; color: var(--faint); margin: 2px 0 0;">
             <span>${mediaType === 'tv' ? 'TV Show' : 'Movie'}${year ? ` · ${year}` : ''}</span>
             ${score ? `<span style="font-family:var(--font-m);color:var(--gold);font-size:11px;background:rgba(0,0,0,.45);border:1px solid rgba(245,197,24,.2);padding:3px 8px;border-radius:999px;">${score}</span>` : ''}
           </div>
           <div class="platform-tags"></div>
         </div>`;
   
       card.addEventListener('click', () => {
         window.location.href = `movie.html?id=${item.id}&type=${mediaType}`;
       });
       attachPlatformInfo(card, item.id, mediaType);
       
       row.appendChild(card);
     });
   }
   
   /* ================================================================
      GENRE CHIPS (inline near search)
   ================================================================ */
   // (removed) old inline chip handler
   
   /* ================================================================
      FILTER DROPDOWNS (Genre / Age / Top 10)
   ================================================================ */
   function initFilterDropdowns() {
     const closeAllMenus = () => {
       document.querySelectorAll('.filter-dd.open').forEach(dd => dd.classList.remove('open'));
     };
   
     document.addEventListener('click', (e) => {
       const inside = e.target.closest?.('.filter-dd');
       if (!inside) closeAllMenus();
     });
   
     const genreDd = $('genre-dd');
     const genreBtn = $('genre-btn');
     const genreMenu = $('genre-menu');
     if (genreDd && genreBtn && genreMenu) {
       genreBtn.addEventListener('click', (e) => {
         e.stopPropagation();
         const isOpen = genreDd.classList.contains('open');
         closeAllMenus();
         genreDd.classList.toggle('open', !isOpen);
       });
       genreMenu.querySelectorAll('.filter-item').forEach(item => {
         item.addEventListener('click', () => {
           genreMenu.querySelectorAll('.filter-item').forEach(b => b.classList.remove('active'));
           item.classList.add('active');
           activeGenre = item.dataset.genre ?? '';
           const genreLabel = item.dataset.label || 'Any';
           genreBtn.innerHTML = `${activeGenre ? `Genre: ${genreLabel}` : 'Genre'} <span class="caret">▾</span>`;
           const label = item.dataset.label || 'Discover';
           lastQuery = '';
           currentPage = 1;
           lastType = $('search-type')?.value || lastType || 'movie';
           if ($('movie-search')) $('movie-search').value = '';
   
           if ($('results-heading')) $('results-heading').textContent = label;
           if ($('results-eyebrow')) $('results-eyebrow').textContent = activeGenre ? 'Genre Results' : 'Discover';
           pushState('', '');
           doSearch(true);
           closeAllMenus();
         });
       });
     }
   
     const moodDd = $('mood-dd');
     const moodBtn = $('mood-btn');
     const moodMenu = $('mood-menu');
     if (moodDd && moodBtn && moodMenu) {
       moodBtn.addEventListener('click', (e) => {
         e.stopPropagation();
         const isOpen = moodDd.classList.contains('open');
         closeAllMenus();
         moodDd.classList.toggle('open', !isOpen);
       });
       moodMenu.querySelectorAll('.filter-item').forEach(item => {
         item.addEventListener('click', () => {
           moodMenu.querySelectorAll('.filter-item').forEach(b => b.classList.remove('active'));
           item.classList.add('active');
           applyMood(item.dataset.mood ?? '');
           closeAllMenus();
         });
       });
     }
   
     const ageDd = $('age-dd');
     const ageBtn = $('age-btn');
     const ageMenu = $('age-menu');
     if (ageDd && ageBtn && ageMenu) {
       ageBtn.addEventListener('click', (e) => {
         e.stopPropagation();
         const isOpen = ageDd.classList.contains('open');
         closeAllMenus();
         ageDd.classList.toggle('open', !isOpen);
       });
       ageMenu.querySelectorAll('.filter-item').forEach(item => {
         item.addEventListener('click', () => {
           ageMenu.querySelectorAll('.filter-item').forEach(b => b.classList.remove('active'));
           item.classList.add('active');
           activeAgeGroup = item.dataset.age ?? '';
           const ageLabel = item.dataset.label || 'Any Age';
           ageBtn.innerHTML = `${activeAgeGroup ? `Age: ${ageLabel}` : 'Age'} <span class="caret">▾</span>`;
           const label = item.dataset.label || 'Discover';
           lastQuery = '';
           currentPage = 1;
           lastType = $('search-type')?.value || lastType || 'movie';
           if ($('movie-search')) $('movie-search').value = '';
   
           if ($('results-heading')) $('results-heading').textContent = label;
           if ($('results-eyebrow')) $('results-eyebrow').textContent = activeAgeGroup ? 'Age Filter' : 'Discover';
           pushState('', '');
           doSearch(true);
           closeAllMenus();
         });
       });
     }
   
     const ratingDd = $('rating-dd');
     const ratingBtn = $('rating-btn');
     const ratingMenu = $('rating-menu');
     if (ratingDd && ratingBtn && ratingMenu) {
       ratingBtn.addEventListener('click', (e) => {
         e.stopPropagation();
         const isOpen = ratingDd.classList.contains('open');
         closeAllMenus();
         ratingDd.classList.toggle('open', !isOpen);
       });
       ratingMenu.querySelectorAll('.filter-item').forEach(item => {
         item.addEventListener('click', () => {
           ratingMenu.querySelectorAll('.filter-item').forEach(b => b.classList.remove('active'));
           item.classList.add('active');
           activeMinScore = item.dataset.score ?? '';
           const ratingLabel = item.dataset.label || 'Any Rating';
           ratingBtn.innerHTML = `${activeMinScore ? `Rating: ${ratingLabel}` : 'Rating'} <span class="caret">▾</span>`;
   
           lastQuery = '';
           currentPage = 1;
           lastType = $('search-type')?.value || lastType || 'movie';
           if ($('movie-search')) $('movie-search').value = '';
   
           if ($('results-heading')) $('results-heading').textContent = ratingLabel;
           if ($('results-eyebrow')) $('results-eyebrow').textContent = activeMinScore ? 'Rating Filter' : 'Discover';
           pushState('', '');
           doSearch(true);
           closeAllMenus();
         });
       });
     }
   }
   
   function recordMoodPreference(moodKey) {
     if (!moodKey) return;
     const prefs = storage.getObj('moodPrefs');
     prefs[moodKey] = (prefs[moodKey] || 0) + 1;
     storage.setObj('moodPrefs', prefs);
   }
   
   function applyMood(moodKey) {
     activeMood = moodKey;
     recordMoodPreference(moodKey);
   
     // Sync mood chips
     document.querySelectorAll('.mood-chip').forEach(btn => {
       btn.classList.toggle('active', (btn.dataset.mood || '') === moodKey);
     });
   
     // Sync mood dropdown button
     const label = moodKey && MOOD_MAP[moodKey] ? MOOD_MAP[moodKey].label : 'Mood';
     const moodBtn = $('mood-btn');
     if (moodBtn) moodBtn.innerHTML = `${moodKey ? `Mood: ${label}` : 'Mood'} <span class="caret">▾</span>`;
   
     // Sync dropdown item highlight
     document.querySelectorAll('#mood-menu .filter-item').forEach(item => {
       item.classList.toggle('active', (item.dataset.mood || '') === moodKey);
     });
   
     // Run discover search with selected mood
     lastQuery = '';
     currentPage = 1;
     lastType = $('search-type')?.value || lastType || 'movie';
     if ($('movie-search')) $('movie-search').value = '';
     if ($('results-heading')) $('results-heading').textContent = moodKey ? label : 'Discover';
     if ($('results-eyebrow')) $('results-eyebrow').textContent = moodKey ? 'Mood Discovery' : 'Discover';
     pushState('', '');
     doSearch(true);
     loadTonightPicks();
   }
   
   function initMoodChips() {
     document.querySelectorAll('.mood-chip').forEach(btn => {
       btn.addEventListener('click', () => {
         applyMood(btn.dataset.mood || '');
       });
     });
   }
   
   function getPreferredMood() {
     if (activeMood) return activeMood;
     const prefs = storage.getObj('moodPrefs');
     const entries = Object.entries(prefs);
     if (!entries.length) return '';
     entries.sort((a, b) => Number(b[1]) - Number(a[1]));
     return entries[0][0];
   }
   
   async function loadTonightPicks() {
     const row = $('tonight-row');
     if (!row) return;
     if (!auth?.canUsePersonalFeatures?.()) {
       row.innerHTML = `<div class="empty-state"><div class="icon">✨</div><h3>Login to unlock Tonight Picks</h3><p>Sign in for one-tap personalized recommendations.</p></div>`;
       return;
     }
     row.innerHTML = skeletons(6);
   
     const preferredMood = getPreferredMood();
     const moodGenres = preferredMood && MOOD_MAP[preferredMood] ? MOOD_MAP[preferredMood].genres.join(',') : '';
     const type = $('search-type')?.value || 'movie';
     const baseDiscover = `${BASE_URL}/discover/${type}?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&vote_count.gte=120&page=1`;
     const url = `${baseDiscover}${moodGenres ? `&with_genres=${moodGenres}` : ''}`;
   
     try {
       const res = await fetch(url);
       const data = await res.json();
       const items = (data.results || []).slice(0, 8);
       row.innerHTML = '';
       if (!items.length) {
         row.innerHTML = `<div class="empty-state"><div class="icon">🍿</div><h3>No picks yet</h3><p>Watch a few trailers and pick a mood to get smarter picks.</p></div>`;
         return;
       }
       items.forEach((item, idx) => buildCard(item, idx, row, type));
     } catch {
       row.innerHTML = `<div class="empty-state"><div class="icon">⚡</div><h3>Picks unavailable</h3><p>Try again in a moment.</p></div>`;
     }
   }
   
   async function loadHypeTimeline() {
     const list = $('hype-list');
     if (!list) return;
     list.innerHTML = `<div style="color:var(--faint);font-size:13px;">Loading hype meter...</div>`;
     try {
       const res = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}&language=en-US`);
       const data = await res.json();
       const items = (data.results || []).slice(0, 10);
       const prevRanks = storage.getObj('hypePrevRanks');
       const nextRanks = {};
   
       list.innerHTML = '';
       items.forEach((item, idx) => {
         const rank = idx + 1;
         nextRanks[item.id] = rank;
         const prev = Number(prevRanks[item.id] || 0);
         const move = prev ? prev - rank : 0;
         const moveText = !prev ? 'NEW' : move > 0 ? `↑ ${move}` : move < 0 ? `↓ ${Math.abs(move)}` : '→';
         const moveClass = !prev || move > 0 ? 'up' : move < 0 ? 'down' : 'flat';
         const title = item.title || item.name || 'Unknown';
         const hype = Math.min(100, Math.max(8, Math.round((Number(item.popularity || 0) / 400) * 100)));
         const type = item.media_type === 'tv' ? 'tv' : 'movie';
   
         const row = document.createElement('div');
         row.className = 'hype-item';
         row.innerHTML = `
           <div class="hype-left">
             <div class="hype-rank">#${rank}</div>
             <div class="hype-title-wrap">
               <div class="hype-title">${title}</div>
               <div class="hype-move ${moveClass}">${moveText}</div>
             </div>
           </div>
           <div class="hype-bar"><span style="width:${hype}%"></span></div>
         `;
         row.addEventListener('click', () => {
           window.location.href = `movie.html?id=${item.id}&type=${type}`;
         });
         list.appendChild(row);
       });
   
       storage.setObj('hypePrevRanks', nextRanks);
     } catch {
       list.innerHTML = `<div style="color:var(--faint);font-size:13px;">Could not load hype timeline.</div>`;
     }
   }
   
   $('clear-recent')?.addEventListener('click', () => {
     storage.set('recently', []);
     renderRecentlyViewed();
   });
   
   /* ================================================================
      WATCHLIST / WATCH LATER
   ================================================================ */
   function toggleList(key, item) {
     if (!auth?.canUsePersonalFeatures?.()) {
       auth?.requirePersonalFeature?.('Login required to save favorites/watchlist.');
       return;
     }
     storage.has(key, item.id) ? storage.remove(key, item.id) : storage.add(key, item);
   }
function updateBadges() {
  const count = storage.get('watchlist').length;
  const el = $('watchlist-count');
  if (el) {
    el.textContent = count;
    el.classList.toggle('zero', count === 0);
  }
}
   
   document.querySelectorAll('#nav-watchlist-btn').forEach(b => b.addEventListener('click', () => openPanel('watchlist')));

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
         card.style.position = 'relative';
         card.setAttribute('data-id', item.id);
         card.setAttribute('data-type', mediaType);
         
         const thumb = item.backdrop_path || item.poster_path
           ? `<img class="trending-thumb" src="${IMG_300}${item.backdrop_path || item.poster_path}" alt="${title}" loading="lazy" style="width: 100%; height: 114px; object-fit: cover;">`
           : `<div class="trending-thumb" style="width:100%; height:114px; display:flex; align-items:center; justify-content:center; background: var(--bg3); font-size:28px;">🎬</div>`;
         
         card.innerHTML = `
           <div class="trending-num" style="position: absolute; top: 6px; left: 12px; font-family: var(--font-d); font-size: 64px; line-height: 1; color: rgba(255,255,255,0.1); pointer-events: none; z-index: 1;">${idx + 1}</div>
           ${thumb}
           <div style="padding: 10px 12px;">
             <div class="trending-title" style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
             <div class="trending-sub" style="font-size: 11px; color: var(--faint); margin: 4px 0;">${mediaType === 'tv' ? 'TV Show' : 'Movie'}${year ? ` · ${year}` : ''}${score ? ` · ${score}` : ''}</div>
             <div class="platform-tags"></div>
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
         
         const storeItem = { id: item.id, title, year, poster_path: item.poster_path || '', _type: mediaType, score: item.vote_average || 0 };
         
         const trailerBtn = card.querySelector('.watch-trailer-btn');
         trailerBtn.addEventListener('click', (e) => {
           e.stopPropagation();
           playTrailerInsideCard(item, mediaType, card);
         });
         
         card.querySelector('.trending-wl-btn').addEventListener('click', (e) => {
           e.stopPropagation();
           toggleList('watchlist', storeItem);
           updateBadges();
           const saved = storage.has('watchlist', item.id);
           const btn = card.querySelector('.trending-wl-btn');
           btn.classList.toggle('saved', saved);
           btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v11l-5-3-5 3V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${saved ? 'Saved' : 'Watchlist'}`;
         });
         
         card.querySelector('.trending-wlat-btn').addEventListener('click', (e) => {
           e.stopPropagation();
           toggleList('watchlater', storeItem);
           updateBadges();
           const saved = storage.has('watchlater', item.id);
           const btn = card.querySelector('.trending-wlat-btn');
           btn.classList.toggle('saved', saved);
           btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>${saved ? 'Saved' : 'Later'}`;
         });
         
         card.querySelector('.trending-detail-btn').addEventListener('click', (e) => {
           e.stopPropagation();
           window.location.href = `movie.html?id=${item.id}&type=${mediaType}`;
         });
         
         card.addEventListener('click', (e) => {
           if (e.target === trailerBtn || trailerBtn.contains(e.target)) return;
           if (e.target.classList?.contains('trending-wl-btn') || e.target.classList?.contains('trending-wlat-btn') || e.target.classList?.contains('trending-detail-btn')) return;
           playTrailerInsideCard(item, mediaType, card);
         });
         attachPlatformInfo(card, item.id, mediaType);
         
         row.appendChild(card);
       });
   
       const t = $('trending-time');
       if (t) t.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
     } catch {
       row.innerHTML = '<p style="color:var(--faint);font-size:13px;padding:20px 0">Could not load trending titles.</p>';
     }
   }
   
   /* ================================================================
      MAIN TRAILER FUNCTIONS
   ================================================================ */
   
   // New function specifically for playing trailers in a given container (used by recently viewed)
   async function _plainPlayTrailer(item, type, trailerContainer, card) {
     console.log('=== playTrailerInContainer START ===');
     console.log('Item:', item.title || item.name);
     console.log('Trailer container:', trailerContainer);
     console.log('Container ID:', trailerContainer?.id);
     
     if (!trailerContainer) {
       console.error('No trailer container provided');
       return;
     }
     
     // If already playing, close it
     if (trailerContainer.style.display === 'block' && trailerContainer.innerHTML !== '') {
       console.log('Closing existing trailer');
       trailerContainer.style.display = 'none';
       trailerContainer.innerHTML = '';
       return;
     }
     
     // Close any other open trailers
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
     
     // Show loading state
     trailerContainer.style.display = 'block';
     trailerContainer.style.position = 'relative';
     trailerContainer.style.paddingBottom = '56.25%';
     trailerContainer.style.height = '0';
     trailerContainer.style.overflow = 'hidden';
     trailerContainer.innerHTML = `
       <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #000; color: white; flex-direction: column; gap: 10px;">
         <div style="width: 40px; height: 40px; border: 3px solid var(--accent); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
         <div style="font-size: 12px;">Loading trailer...</div>
       </div>
     `;
     
     // Scroll to card
     if (card) {
       card.scrollIntoView({ behavior: 'smooth', block: 'center' });
     }
     
     try {
       const videoUrl = type === 'tv'
         ? `${BASE_URL}/tv/${item.id}/videos?api_key=${API_KEY}`
         : `${BASE_URL}/movie/${item.id}/videos?api_key=${API_KEY}`;
       
       console.log('Fetching from:', videoUrl);
       const res = await fetch(videoUrl);
       const data = await res.json();
       const vids = data.results || [];
       console.log('Videos found:', vids.length);
       
       // Find the best trailer
       let clip = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official === true);
       if (!clip) clip = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer');
       if (!clip) clip = vids.find(v => v.site === 'YouTube' && v.type === 'Teaser');
       if (!clip) clip = vids.find(v => v.site === 'YouTube');
       
       if (clip) {
         console.log('Playing trailer:', clip.key);
         
         // Clear container
         trailerContainer.innerHTML = '';
         
         // Create iframe
         const iframe = document.createElement('iframe');
         iframe.src = `https://www.youtube.com/embed/${clip.key}?autoplay=1&rel=0&modestbranding=1&showinfo=0&controls=1`;
         iframe.allow = "autoplay; encrypted-media; picture-in-picture";
         iframe.allowFullscreen = true;
         iframe.style.position = "absolute";
         iframe.style.top = "0";
         iframe.style.left = "0";
         iframe.style.width = "100%";
         iframe.style.height = "100%";
         iframe.style.border = "none";
         iframe.style.borderRadius = "12px";
         
         trailerContainer.appendChild(iframe);
         
         // Add close button
         const closeBtn = document.createElement('button');
         closeBtn.innerHTML = '✕';
         closeBtn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:1000;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
         closeBtn.onclick = (e) => {
           e.stopPropagation();
           console.log('Close button clicked');
           trailerContainer.style.display = 'none';
           trailerContainer.innerHTML = '';
         };
         trailerContainer.appendChild(closeBtn);
         
         console.log('Trailer loaded successfully');
         
       } else {
         console.log('No trailer found');
         trailerContainer.innerHTML = `
           <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #999; flex-direction: column; gap: 8px;">
             <div style="font-size: 32px;">🎬</div>
             <p style="font-size: 12px;">No trailer available</p>
             <button onclick="this.parentElement.parentElement.style.display='none'" style="padding: 4px 12px; background: var(--accent); border: none; border-radius: 20px; color: white; font-size: 10px; cursor: pointer;">Close</button>
           </div>
         `;
       }
     } catch (error) {
       console.error('Error loading trailer:', error);
       trailerContainer.innerHTML = `
         <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #999; flex-direction: column; gap: 8px;">
           <div style="font-size: 32px;">⚠️</div>
           <p style="font-size: 12px;">Error: ${error.message}</p>
           <button onclick="this.parentElement.parentElement.style.display='none'" style="padding: 4px 12px; background: var(--accent); border: none; border-radius: 20px; color: white; font-size: 10px; cursor: pointer;">Close</button>
         </div>
       `;
     }
     
     console.log('=== playTrailerInContainer END ===');
   }
   
   // Main trailer function for regular cards
   async function playTrailerInsideCard(item, type, card) {
     console.log('=== playTrailerInsideCard START ===');
     console.log('Item:', item.title || item.name);
     
     // Make sure we have the actual card element
     let actualCard = card;
     if (!actualCard || !actualCard.classList) {
       actualCard = document.querySelector(`.movie-card[data-id="${item.id}"], .trending-card[data-id="${item.id}"]`);
     }
     
     if (!actualCard) {
       console.error('Could not find card element!');
       return;
     }
     
     // Find the trailer container
     let trailerContainer = actualCard.querySelector('.card-trailer-container');
     if (!trailerContainer) {
       trailerContainer = actualCard.querySelector(`#trailer-${item.id}, #trending-trailer-${item.id}`);
     }
     
     if (!trailerContainer) {
       console.error('No trailer container found!');
       return;
     }
     
     console.log('Found container:', trailerContainer.id);
     
     // Use the container function
     await _plainPlayTrailer(item, type, trailerContainer, actualCard);
   }

   function renderTrending(movies) {
    const container = $('trending-row');
    container.innerHTML = movies.map(m => `
        <div class="trending-card" onclick="location.href='movie.html?id=${m.id}&type=${m.media_type || 'movie'}'">
            <img src="${IMG_500}${m.backdrop_path}" alt="${m.title || m.name}">
            <div class="trending-info">
                <div class="trending-title">${m.title || m.name}</div>
            </div>
        </div>
    `).join('');
}
   
   async function openTrailerModal(item, type, anchorEl) {
     let trailerContainer = null;
     let parentCard = null;
     
     if (anchorEl && anchorEl.classList && (anchorEl.classList.contains('movie-card') || anchorEl.classList.contains('trending-card'))) {
       parentCard = anchorEl;
       trailerContainer = parentCard.querySelector('.card-trailer-container');
     } else if (anchorEl && anchorEl.closest) {
       parentCard = anchorEl.closest('.movie-card, .trending-card');
       if (parentCard) {
         trailerContainer = parentCard.querySelector('.card-trailer-container');
       }
     }
     
     if (!trailerContainer && parentCard) {
       trailerContainer = document.createElement('div');
       trailerContainer.className = 'card-trailer-container';
       trailerContainer.style.cssText = 'display: none; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; margin: 8px;';
       parentCard.appendChild(trailerContainer);
     }
     
     if (trailerContainer) {
       await playTrailerInContainer(item, type, trailerContainer, parentCard);
     }
   }
   
   /* ================================================================
      WATCH PARTY — YouTube IFrame API integration
      When the user is in a Watch Party room, we swap the plain <iframe>
      for a YT IFrame Player so WatchParty.hookPlayer() can control it.
   ================================================================ */
   function loadYTApiIfNeeded(callback) {
     if (window.YT && window.YT.Player) { callback(); return; }
     if (window._ytApiLoading) { window._ytApiQueue = window._ytApiQueue || []; window._ytApiQueue.push(callback); return; }
     window._ytApiLoading = true;
     window._ytApiQueue = [callback];
     const tag = document.createElement('script');
     tag.src = 'https://www.youtube.com/iframe_api';
     document.head.appendChild(tag);
     window.onYouTubeIframeAPIReady = () => {
       (window._ytApiQueue || []).forEach(fn => fn());
       window._ytApiQueue = [];
     };
   }
   
   /* Override playTrailerInContainer to hook WatchParty when in a room */
   async function playTrailerInContainer(item, type, trailerContainer, card) {
     // If not in a Watch Party room, use original behaviour
     if (!window.WatchParty?.isInRoom()) {
       return _plainPlayTrailer(item, type, trailerContainer, card);
     }
   
     // In a room — use YT IFrame API for sync
     if (!trailerContainer) return;
   
     if (trailerContainer.style.display === 'block' && trailerContainer.innerHTML !== '') {
       trailerContainer.style.display = 'none';
       trailerContainer.innerHTML = '';
       return;
     }
   
     document.querySelectorAll('.card-trailer-container').forEach(c => {
       if (c !== trailerContainer) { c.style.display = 'none'; c.innerHTML = ''; }
     });
   
     const title = item.title || item.name || 'Unknown';
     const year = (item.release_date || item.first_air_date || '').slice(0, 4);
     addRecentlyViewed({ id: item.id, title, year, poster_path: item.poster_path || '', _type: type });
   
     trailerContainer.style.cssText = 'display:block;position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;';
     trailerContainer.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;gap:10px;flex-direction:column"><div style="width:36px;height:36px;border:3px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite"></div><div style="font-size:12px">Loading trailer…</div></div>`;
     if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
   
     try {
       const videoUrl = type === 'tv'
         ? `${BASE_URL}/tv/${item.id}/videos?api_key=${API_KEY}`
         : `${BASE_URL}/movie/${item.id}/videos?api_key=${API_KEY}`;
       const res = await fetch(videoUrl);
       const data = await res.json();
       const vids = data.results || [];
       let clip = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official === true)
         || vids.find(v => v.site === 'YouTube' && v.type === 'Trailer')
         || vids.find(v => v.site === 'YouTube' && v.type === 'Teaser')
         || vids.find(v => v.site === 'YouTube');
   
       if (!clip) {
         trailerContainer.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1a1a1a;color:#999;flex-direction:column;gap:8px"><div style="font-size:32px">🎬</div><p style="font-size:12px">No trailer available</p></div>`;
         return;
       }
   
       trailerContainer.innerHTML = '';
   
       // Create a div for YT player
       const playerDiv = document.createElement('div');
       playerDiv.id = `yt-player-${item.id}-${Date.now()}`;
       playerDiv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%';
       trailerContainer.appendChild(playerDiv);
   
       // Close btn
       const closeBtn = document.createElement('button');
       closeBtn.innerHTML = '✕';
       closeBtn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:1000;background:rgba(0,0,0,.7);color:#fff;border:none;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
       closeBtn.onclick = (e) => { e.stopPropagation(); trailerContainer.style.display = 'none'; trailerContainer.innerHTML = ''; };
       trailerContainer.appendChild(closeBtn);
   
       loadYTApiIfNeeded(() => {
         const player = new YT.Player(playerDiv.id, {
           videoId: clip.key,
           playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
           events: {
             onReady: () => {
               window.WatchParty?.hookPlayer(player, clip.key);
             }
           }
         });
       });
   
     } catch (err) {
       trailerContainer.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1a1a1a;color:#999;flex-direction:column;gap:8px"><div style="font-size:32px">⚠️</div><p style="font-size:12px">${err.message}</p></div>`;
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
       // Added videoRes to the fetch list
       const [detailRes, creditsRes, videoRes] = await Promise.all([
         fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=en-US`),
         fetch(`${BASE_URL}/${type}/${id}/credits?api_key=${API_KEY}&language=en-US`),
         fetch(`${BASE_URL}/${type}/${id}/videos?api_key=${API_KEY}&language=en-US`)
       ]);

       const detail = await detailRes.json();
       const credits = await creditsRes.json();
       const videoData = await videoRes.json(); // Get the video data

       document.title = `${detail.title || detail.name} — Trailer Hub`;

       // Find the YouTube Trailer
       const trailer = videoData.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
       const videoId = trailer ? trailer.key : null;

       // Pass the videoId into renderDetail
       renderDetail(detail, credits, type, videoId);
       loadSimilar(id, type);
       
       // Update badges for Watch Later
       updateBadges();

     } catch (err) {
       console.error("Error loading details:", err);
       $('movie-detail').innerHTML = `...error message...`;
     }
   }
   
   function renderDetail(d, credits, type, videoId) {
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
   
     const storeItem = { id: d.id, title, year, poster_path: d.poster_path || '', _type: type, score: d.vote_average || 0 };
   
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
             <div id="detail-watchparty-note" class="detail-watchparty-note">
               <strong>Watch Party active:</strong> click <em>Watch Trailer</em> to sync playback with your room.
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
   
     $('detail-trailer-btn')?.addEventListener('click', async () => {
       if (window.WatchParty?.isInRoom()) {
         await playDetailTrailerWithWatchParty(d, type);
         return;
       }

       let wrap = document.getElementById('detail-trailer-container');
       if (!wrap) {
         // Create a trailer container right after the actions div
         wrap = document.createElement('div');
         wrap.id = 'detail-trailer-container';
         const actionsDiv = $('detail-trailer-btn')?.closest('.detail-actions');
         actionsDiv?.insertAdjacentElement('afterend', wrap);
       }
       // Toggle off if already showing
       if (wrap.classList.contains('active')) {
         wrap.classList.remove('active');
         wrap.innerHTML = '';
         $('detail-trailer-btn').textContent = '▶ Watch Trailer';
         return;
       }
       wrap.classList.add('active');
       $('detail-trailer-btn').textContent = '⏳ Loading…';
       wrap.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;border-radius:16px"><div style="width:36px;height:36px;border:3px solid #6C63FF;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite"></div></div>`;
       try {
         const videoUrl = type === 'tv'
           ? `${BASE_URL}/tv/${d.id}/videos?api_key=${API_KEY}`
           : `${BASE_URL}/movie/${d.id}/videos?api_key=${API_KEY}`;
         const res = await fetch(videoUrl);
         const data = await res.json();
         const vids = data.results || [];
         const clip = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
           || vids.find(v => v.site === 'YouTube' && v.type === 'Trailer')
           || vids.find(v => v.site === 'YouTube' && v.type === 'Teaser')
           || vids.find(v => v.site === 'YouTube');
         if (!clip) {
           wrap.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg2);color:var(--faint);flex-direction:column;gap:8px;border-radius:16px"><span style="font-size:32px">🎬</span><p style="font-size:13px">No trailer available</p></div>`;
           $('detail-trailer-btn').textContent = '▶ Watch Trailer';
           return;
         }
         wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${clip.key}?autoplay=1&rel=0&modestbranding=1" allow="autoplay;encrypted-media;picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:none;border-radius:16px"></iframe>`;
         $('detail-trailer-btn').textContent = '✕ Close Trailer';
       } catch {
         wrap.classList.remove('active');
         wrap.innerHTML = '';
         $('detail-trailer-btn').textContent = '▶ Watch Trailer';
       }
     });

     async function playDetailTrailerWithWatchParty(detail, type) {
       let wrap = document.getElementById('detail-trailer-container');
       if (!wrap) {
         wrap = document.createElement('div');
         wrap.id = 'detail-trailer-container';
         const actionsDiv = $('detail-trailer-btn')?.closest('.detail-actions');
         actionsDiv?.insertAdjacentElement('afterend', wrap);
       }
       if (wrap.classList.contains('active')) {
         wrap.classList.remove('active');
         wrap.innerHTML = '';
         $('detail-trailer-btn').textContent = '▶ Watch Trailer';
         return;
       }

       wrap.classList.add('active');
       $('detail-trailer-btn').textContent = '⏳ Loading…';
       wrap.style.cssText = 'position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:16px;margin-top:20px;';
       wrap.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;border-radius:16px"><div style="width:36px;height:36px;border:3px solid #6C63FF;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite"></div></div>`;

       try {
         const videoUrl = type === 'tv'
           ? `${BASE_URL}/tv/${detail.id}/videos?api_key=${API_KEY}`
           : `${BASE_URL}/movie/${detail.id}/videos?api_key=${API_KEY}`;
         const res = await fetch(videoUrl);
         const data = await res.json();
         const vids = data.results || [];
         const clip = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
           || vids.find(v => v.site === 'YouTube' && v.type === 'Trailer')
           || vids.find(v => v.site === 'YouTube' && v.type === 'Teaser')
           || vids.find(v => v.site === 'YouTube');

         if (!clip) {
           wrap.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg2);color:var(--faint);flex-direction:column;gap:8px;border-radius:16px"><span style="font-size:32px">🎬</span><p style="font-size:13px">No trailer available</p></div>`;
           $('detail-trailer-btn').textContent = '▶ Watch Trailer';
           return;
         }

         wrap.innerHTML = '';
         const playerDiv = document.createElement('div');
         playerDiv.id = `yt-detail-player-${detail.id}-${Date.now()}`;
         playerDiv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
         wrap.appendChild(playerDiv);

         const closeBtn = document.createElement('button');
         closeBtn.innerHTML = '✕';
         closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;z-index:1000;background:rgba(0,0,0,0.72);color:#fff;border:none;border-radius:50%;width:34px;height:34px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
         closeBtn.onclick = (e) => {
           e.stopPropagation();
           wrap.classList.remove('active');
           wrap.innerHTML = '';
           $('detail-trailer-btn').textContent = '▶ Watch Trailer';
         };
         wrap.appendChild(closeBtn);

         loadYTApiIfNeeded(() => {
           new YT.Player(playerDiv.id, {
             videoId: clip.key,
             playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
             events: {
               onReady: (event) => {
                 window.WatchParty?.hookPlayer(event.target, clip.key);
                 $('detail-trailer-btn').textContent = '✕ Close Trailer';
               }
             }
           });
         });
       } catch (error) {
         wrap.classList.remove('active');
         wrap.innerHTML = '';
         $('detail-trailer-btn').textContent = '▶ Watch Trailer';
         wrap.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg2);color:var(--faint);flex-direction:column;gap:8px;border-radius:16px"><span style="font-size:32px">⚠️</span><p style="font-size:13px">${error.message}</p></div>`;
       }
     }
     
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
        const wlatSaved2 = storage.has('watchlater', d.id);
        const btn = $('detail-wlat-btn');
        btn.classList.toggle('saved', wlatSaved2);
        btn.textContent = wlatSaved2 ? '\u2713 Watch Later' : '+ Watch Later';
        updateBadges();
      });
   
     const note = $('detail-watchparty-note');
     if (note) {
       note.style.display = window.WatchParty?.isInRoom() ? 'block' : 'none';
     }
   
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
       if (section && grid && items.length) {
         section.style.display = 'block';
        grid.innerHTML = '';
        items.forEach((item, idx) => buildCard(item, idx, grid, item.media_type || type));
       section.querySelectorAll('[data-reveal]').forEach(el => revealObs.observe(el));
     }
     } catch {

        console.error('Error loading similar items:', err);
     }
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
   INIT — WRAPPED FOR SAFETY
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready - Initializing Hub...");

    // 1. Run Auth checks safely
    if (typeof auth !== 'undefined') {
        auth?.enforceAccess?.();
        auth?.renderNavAuth?.();
    }

    // 2. Load the movie data
    updateBadges();
    renderRecentlyViewed();
    loadTrending();
    loadTonightPicks();
    loadHypeTimeline();
    readURLState();
    loadMovieDetail();
    initMoodChips();
    initFilterDropdowns();

    // 3. Add shake animation style
    const shakeStyle = document.createElement('style');
    shakeStyle.textContent = `@keyframes shakeField{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}@keyframes spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(shakeStyle);

    // 4. Genre dropdown toggle logic
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
});