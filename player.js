/* ============================================================
   TRAILER PLAYER PAGE
   Dedicated video player with cinema mode and recommendations
   ============================================================ */

const API_KEY = 'afecc8075597c531e9aae083331172c6';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_500 = 'https://image.tmdb.org/t/p/w500';
const IMG_300 = 'https://image.tmdb.org/t/p/w300';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const mediaId = urlParams.get('id');
const mediaType = urlParams.get('type') || 'movie';

let currentMedia = null;
let isCinemaMode = false;

// DOM elements
const videoWrapper = document.getElementById('video-wrapper');
const videoContainer = document.getElementById('video-container');
const videoFrame = document.getElementById('video-frame');
const playerLoading = document.getElementById('player-loading');
const videoInfo = document.getElementById('video-info');
const videoTitle = document.getElementById('video-title');
const videoMeta = document.getElementById('video-meta');
const videoOverview = document.getElementById('video-overview');
const videoActions = document.getElementById('video-actions');
const recGrid = document.getElementById('rec-grid');
const cinemaToggle = document.getElementById('cinema-toggle');

// Storage helpers
const storage = {
  get: key => JSON.parse(localStorage.getItem(key) || '[]'),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
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

// Theme
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.body.classList.toggle('light', saved === 'light');
}
initTheme();

// Load media details and trailer
async function loadMedia() {
  if (!mediaId) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const detailRes = await fetch(`${BASE_URL}/${mediaType}/${mediaId}?api_key=${API_KEY}&language=en-US`);
    currentMedia = await detailRes.json();
    
    const title = currentMedia.title || currentMedia.name;
    const year = (currentMedia.release_date || currentMedia.first_air_date || '').slice(0, 4);
    const score = currentMedia.vote_average ? `★ ${currentMedia.vote_average.toFixed(1)}` : '';
    const runtime = currentMedia.runtime ? `${currentMedia.runtime} min` : '';
    
    document.title = `${title} — Trailer Player`;
    
    videoTitle.textContent = title;
    videoMeta.innerHTML = `
      <span class="video-meta-item">📅 ${year || 'Unknown'}</span>
      ${score ? `<span class="video-meta-item">⭐ ${score}</span>` : ''}
      ${runtime ? `<span class="video-meta-item">⏱️ ${runtime}</span>` : ''}
      <span class="video-meta-item">🎬 ${mediaType === 'tv' ? 'TV Show' : 'Movie'}</span>
    `;
    videoOverview.textContent = currentMedia.overview || 'No description available.';
    
    await loadTrailer();
    await loadRecommendations();
    renderActions();
    addRecentlyViewed();
    
  } catch (error) {
    console.error('Error loading media:', error);
    videoTitle.textContent = 'Error loading content';
    videoOverview.textContent = 'Something went wrong. Please try again.';
    if (playerLoading) {
      playerLoading.innerHTML = `
        <div style="text-align: center; color: var(--muted);">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <p>Could not load content</p>
          <a href="index.html" class="video-action-btn primary" style="margin-top: 20px; display: inline-block;">Go Back</a>
        </div>
      `;
    }
  }
}

// Load trailer video
async function loadTrailer() {
  try {
    const endpoint = mediaType === 'tv'
      ? `${BASE_URL}/tv/${mediaId}/videos?api_key=${API_KEY}`
      : `${BASE_URL}/movie/${mediaId}/videos?api_key=${API_KEY}`;
    
    const res = await fetch(endpoint);
    const data = await res.json();
    const videos = data.results || [];
    
    const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
                    videos.find(v => v.site === 'YouTube' && v.type === 'Teaser') ||
                    videos.find(v => v.site === 'YouTube');
    
    if (trailer) {
      const youtubeId = trailer.key;
      videoFrame.style.display = 'block';
      videoFrame.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&showinfo=0&controls=1`;
      if (playerLoading) playerLoading.style.display = 'none';
    } else {
      if (playerLoading) {
        playerLoading.innerHTML = `
          <div style="text-align: center; color: var(--muted);">
            <div style="font-size: 48px; margin-bottom: 16px;">🎬</div>
            <p>No trailer available for this title</p>
            <a href="index.html" class="video-action-btn primary" style="margin-top: 20px; display: inline-block;">Browse More Movies</a>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading trailer:', error);
    if (playerLoading) {
      playerLoading.innerHTML = `
        <div style="text-align: center; color: var(--muted);">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <p>Could not load trailer</p>
          <a href="index.html" class="video-action-btn primary" style="margin-top: 20px; display: inline-block;">Go Back</a>
        </div>
      `;
    }
  }
}

// Load recommendations
async function loadRecommendations() {
  try {
    const res = await fetch(`${BASE_URL}/${mediaType}/${mediaId}/similar?api_key=${API_KEY}&language=en-US&page=1`);
    const data = await res.json();
    const items = (data.results || []).filter(i => i.poster_path).slice(0, 8);
    
    if (items.length === 0) {
      recGrid.innerHTML = '<p style="color: var(--muted); grid-column: 1/-1; text-align: center;">No recommendations found</p>';
      return;
    }
    
    recGrid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'rec-card';
      card.onclick = () => {
        window.location.href = `player.html?id=${item.id}&type=${item.media_type || mediaType}`;
      };
      
      const title = item.title || item.name;
      const year = (item.release_date || item.first_air_date || '').slice(0, 4);
      const poster = item.poster_path
        ? `<img class="rec-thumb" src="${IMG_300}${item.poster_path}" alt="${title}" loading="lazy">`
        : `<div class="rec-thumb" style="display: flex; align-items: center; justify-content: center; background: var(--bg3); font-size: 32px;">🎬</div>`;
      
      card.innerHTML = `
        ${poster}
        <div class="rec-info">
          <div class="rec-title-small">${title}</div>
          <div class="rec-year">${year || ''}</div>
        </div>
      `;
      
      recGrid.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading recommendations:', error);
    recGrid.innerHTML = '<p style="color: var(--muted); grid-column: 1/-1; text-align: center;">Could not load recommendations</p>';
  }
}

// Render action buttons
function renderActions() {
  if (!currentMedia) return;
  
  const inWL = storage.has('watchlist', currentMedia.id);
  const inWLat = storage.has('watchlater', currentMedia.id);
  
  const storeItem = {
    id: currentMedia.id,
    title: currentMedia.title || currentMedia.name,
    year: (currentMedia.release_date || currentMedia.first_air_date || '').slice(0, 4),
    poster_path: currentMedia.poster_path || '',
    _type: mediaType
  };
  
  videoActions.innerHTML = `
    <button class="video-action-btn ${inWL ? 'saved' : ''}" id="player-wl-btn">
      ${inWL ? '✓ Saved to Watchlist' : '+ Add to Watchlist'}
    </button>
    <button class="video-action-btn ${inWLat ? 'saved' : ''}" id="player-wlat-btn">
      ${inWLat ? '✓ Added to Watch Later' : '+ Watch Later'}
    </button>
    <button class="video-action-btn primary" id="player-back-btn">
      ← Back to Hub
    </button>
  `;
  
  document.getElementById('player-wl-btn')?.addEventListener('click', () => {
    if (storage.has('watchlist', currentMedia.id)) {
      storage.remove('watchlist', currentMedia.id);
    } else {
      storage.add('watchlist', storeItem);
    }
    renderActions();
  });
  
  document.getElementById('player-wlat-btn')?.addEventListener('click', () => {
    if (storage.has('watchlater', currentMedia.id)) {
      storage.remove('watchlater', currentMedia.id);
    } else {
      storage.add('watchlater', storeItem);
    }
    renderActions();
  });
  
  document.getElementById('player-back-btn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

// Cinema mode toggle
function toggleCinemaMode() {
  isCinemaMode = !isCinemaMode;
  
  if (isCinemaMode) {
    videoWrapper.classList.add('cinema');
    cinemaToggle.innerHTML = '✕';
    cinemaToggle.title = 'Exit cinema mode';
    document.body.style.overflow = 'hidden';
  } else {
    videoWrapper.classList.remove('cinema');
    cinemaToggle.innerHTML = '⛶';
    cinemaToggle.title = 'Cinema mode';
    document.body.style.overflow = '';
  }
}

cinemaToggle.addEventListener('click', toggleCinemaMode);

// Handle escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isCinemaMode) {
    toggleCinemaMode();
  }
});

// Add to recently viewed
function addRecentlyViewed() {
  if (!currentMedia) return;
  
  const recently = storage.get('recently');
  const filtered = recently.filter(i => i.id !== currentMedia.id);
  filtered.unshift({
    id: currentMedia.id,
    title: currentMedia.title || currentMedia.name,
    year: (currentMedia.release_date || currentMedia.first_air_date || '').slice(0, 4),
    poster_path: currentMedia.poster_path || '',
    _type: mediaType
  });
  storage.set('recently', filtered.slice(0, 20));
}

// Initialize
loadMedia();