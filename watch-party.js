/* ============================================================
   TRAILER HUB — watch-party.js
   Drop this AFTER auth.js and script.js in index.html / movie.html

   Requires: Socket.io CDN loaded before this file.
   Server:   ws://localhost:3000  (change SOCKET_URL for production)
   ============================================================ */

   (function () {
    /* ── Config ── */
    const SOCKET_URL = 'trailer-hub-production.up.railway.app'; // Change to your deployed server URL
  
    /* ── State ── */
    let socket = null;
    let currentRoomId = null;
    let ytPlayer = null;          // YouTube IFrame Player instance
    let isSyncing = false;        // Prevent re-emit loops
    let userCount = 1;
  
    /* ── Utils ── */
    function genRoomId() {
      return Math.random().toString(36).slice(2, 8).toUpperCase();
    }
  
    function getRoomFromURL() {
      return new URLSearchParams(window.location.search).get('room');
    }
  
    /* ================================================================
       SOCKET SETUP
    ================================================================ */
    function connectSocket(roomId) {
      socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
  
      socket.on('connect', () => {
        console.log('[WatchParty] Connected:', socket.id);
        socket.emit('join-room', { roomId });
      });
  
      socket.on('room-state', (state) => {
        userCount = state.userCount || 1;
        updatePartyUI();
        if (state.videoId && ytPlayer?.loadVideoById) {
          loadAndSync(state);
        }
      });
  
      socket.on('user-joined', ({ userCount: count }) => {
        userCount = count;
        updatePartyUI();
        showToast(`👋 Someone joined! (${count} watching)`);
      });
  
      socket.on('user-left', ({ userCount: count }) => {
        userCount = count;
        updatePartyUI();
        showToast(`🚪 Someone left. (${count} watching)`);
      });
  
      /* Incoming play */
      socket.on('play', ({ currentTime }) => {
        if (!ytPlayer) return;
        isSyncing = true;
        if (Math.abs(ytPlayer.getCurrentTime() - currentTime) > 2) {
          ytPlayer.seekTo(currentTime, true);
        }
        ytPlayer.playVideo();
        setTimeout(() => { isSyncing = false; }, 500);
      });
  
      /* Incoming pause */
      socket.on('pause', ({ currentTime }) => {
        if (!ytPlayer) return;
        isSyncing = true;
        ytPlayer.pauseVideo();
        ytPlayer.seekTo(currentTime, true);
        setTimeout(() => { isSyncing = false; }, 500);
      });
  
      /* Incoming seek */
      socket.on('seek', ({ currentTime }) => {
        if (!ytPlayer) return;
        isSyncing = true;
        ytPlayer.seekTo(currentTime, true);
        setTimeout(() => { isSyncing = false; }, 500);
      });
  
      /* Incoming reaction */
      socket.on('reaction', ({ emoji }) => {
        spawnFloatingEmoji(emoji);
      });
  
      /* Video set by another user */
      socket.on('video-set', ({ videoId }) => {
        if (ytPlayer?.loadVideoById) {
          ytPlayer.loadVideoById(videoId);
        }
      });
  
      socket.on('disconnect', () => {
        console.log('[WatchParty] Disconnected');
      });
    }
  
    function loadAndSync(state) {
      isSyncing = true;
      ytPlayer.loadVideoById({ videoId: state.videoId, startSeconds: state.currentTime || 0 });
      if (!state.playing) {
        setTimeout(() => { ytPlayer.pauseVideo(); isSyncing = false; }, 800);
      } else {
        setTimeout(() => { isSyncing = false; }, 800);
      }
    }
  
    /* ================================================================
       YOUTUBE PLAYER HOOKS
       Call WatchParty.hookPlayer(ytPlayerInstance, videoId) after
       the YT IFrame API fires onReady.
    ================================================================ */
    function hookPlayer(player, videoId) {
      ytPlayer = player;
  
      /* Tell the room which video we loaded */
      if (currentRoomId && socket?.connected) {
        socket.emit('set-video', { roomId: currentRoomId, videoId });
      }
  
      /* Intercept state changes */
      const origOnStateChange = player.onStateChange?.bind(player);
  
      player.addEventListener('onStateChange', (event) => {
        if (isSyncing || !currentRoomId || !socket?.connected) return;
  
        const YT_PLAYING = 1, YT_PAUSED = 2;
        const t = player.getCurrentTime();
  
        if (event.data === YT_PLAYING) {
          socket.emit('play', { roomId: currentRoomId, currentTime: t });
        } else if (event.data === YT_PAUSED) {
          socket.emit('pause', { roomId: currentRoomId, currentTime: t });
        }
      });
  
      /* Seek detection via polling */
      let lastKnownTime = 0;
      setInterval(() => {
        if (!player || isSyncing) return;
        const t = player.getCurrentTime?.() || 0;
        if (Math.abs(t - lastKnownTime) > 3) {
          // User seeked
          if (currentRoomId && socket?.connected) {
            socket.emit('seek', { roomId: currentRoomId, currentTime: t });
          }
        }
        lastKnownTime = t;
      }, 1000);
    }
  
    /* ================================================================
       EMOJI REACTIONS
    ================================================================ */
    function sendReaction(emoji) {
      if (!currentRoomId || !socket?.connected) return;
      socket.emit('reaction', { roomId: currentRoomId, emoji });
    }
  
    function spawnFloatingEmoji(emoji) {
      const el = document.createElement('div');
      el.textContent = emoji;
      el.style.cssText = `
        position:fixed;
        bottom:120px;
        left:${20 + Math.random() * 60}%;
        font-size:${32 + Math.random() * 24}px;
        pointer-events:none;
        z-index:9999;
        animation: floatUp 2.4s ease-out forwards;
        user-select:none;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2500);
    }
  
    /* Add float-up keyframe once */
    if (!document.getElementById('wp-float-style')) {
      const s = document.createElement('style');
      s.id = 'wp-float-style';
      s.textContent = `
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);   opacity: 1; }
          80%  { transform: translateY(-180px) scale(1.2); opacity: 0.8; }
          100% { transform: translateY(-240px) scale(0.8); opacity: 0; }
        }
      `;
      document.head.appendChild(s);
    }
  
    /* ================================================================
       UI — Watch Party Bar
    ================================================================ */
    function buildPartyBar() {
      const bar = document.createElement('div');
      bar.id = 'watch-party-bar';
      bar.innerHTML = `
        <div class="wp-bar-inner">
          <div class="wp-bar-left">
            <span class="wp-icon">🍿</span>
            <span class="wp-label">Watch Party</span>
            <span class="wp-room-id" id="wp-room-label">${currentRoomId ? `Room: <strong>${currentRoomId}</strong>` : ''}</span>
            <span class="wp-users" id="wp-user-count">👥 ${userCount}</span>
          </div>
          <div class="wp-bar-right">
            <div class="wp-reactions">
              <button class="wp-react-btn" data-emoji="🔥" title="Fire">🔥</button>
              <button class="wp-react-btn" data-emoji="😂" title="LOL">😂</button>
              <button class="wp-react-btn" data-emoji="😱" title="Shocked">😱</button>
              <button class="wp-react-btn" data-emoji="👏" title="Clap">👏</button>
              <button class="wp-react-btn" data-emoji="❤️" title="Love">❤️</button>
            </div>
            <button class="wp-copy-btn" id="wp-copy-link" title="Copy invite link">🔗 Copy Link</button>
            <button class="wp-leave-btn" id="wp-leave" title="Leave room">Leave</button>
          </div>
        </div>
      `;
  
      /* Reaction buttons */
      bar.querySelectorAll('.wp-react-btn').forEach(btn => {
        btn.addEventListener('click', () => sendReaction(btn.dataset.emoji));
      });
  
      /* Copy invite link */
      bar.querySelector('#wp-copy-link').addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('room', currentRoomId);
        navigator.clipboard.writeText(url.toString()).then(() => {
          showToast('📋 Room link copied!');
        });
      });
  
      /* Leave room */
      bar.querySelector('#wp-leave').addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.location.href = url.toString();
      });
  
      document.body.appendChild(bar);
      injectBarStyles();
    }
  
    function updatePartyUI() {
      const countEl = document.getElementById('wp-user-count');
      if (countEl) countEl.textContent = `👥 ${userCount}`;
    }
  
    function showToast(msg) {
      let toast = document.getElementById('wp-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'wp-toast';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
    }
  
    /* ================================================================
       CREATE ROOM BUTTON (injects into inline player)
    ================================================================ */
    function injectCreateRoomButton() {
      /* We'll inject a "Watch With Me" button next to the existing
         inline player actions area once the player opens */
      const observer = new MutationObserver(() => {
        const actionsEl = document.getElementById('inline-player-actions');
        if (actionsEl && !document.getElementById('wp-create-btn')) {
          const btn = document.createElement('button');
          btn.id = 'wp-create-btn';
          btn.className = 'wp-create-btn';
          btn.innerHTML = '🍿 Watch With Me';
          btn.addEventListener('click', startRoom);
          actionsEl.appendChild(btn);
        }
      });
  
      observer.observe(document.body, { childList: true, subtree: true });
    }
  
    function startRoom() {
      const roomId = genRoomId();
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      window.location.href = url.toString();
    }
  
    /* ================================================================
       STYLES
    ================================================================ */
    function injectBarStyles() {
      if (document.getElementById('wp-styles')) return;
      const s = document.createElement('style');
      s.id = 'wp-styles';
      s.textContent = `
        #watch-party-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: rgba(15, 15, 20, 0.95);
          backdrop-filter: blur(16px);
          border-top: 1px solid rgba(108, 99, 255, 0.35);
          padding: 10px 20px;
          z-index: 9000;
          box-shadow: 0 -4px 24px rgba(108,99,255,0.15);
        }
        .wp-bar-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .wp-bar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .wp-bar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .wp-icon { font-size: 20px; }
        .wp-label {
          font-family: var(--font-m, 'Barlow', sans-serif);
          font-weight: 700;
          font-size: 13px;
          color: var(--accent, #6C63FF);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .wp-room-id {
          font-size: 12px;
          color: var(--faint, #888);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 3px 10px;
          border-radius: 999px;
        }
        .wp-room-id strong { color: #fff; }
        .wp-users {
          font-size: 12px;
          color: var(--faint, #888);
        }
        .wp-reactions {
          display: flex;
          gap: 4px;
        }
        .wp-react-btn {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 18px;
          cursor: pointer;
          transition: transform 0.15s, background 0.15s;
          line-height: 1;
        }
        .wp-react-btn:hover {
          background: rgba(108,99,255,0.25);
          transform: scale(1.2);
          border-color: rgba(108,99,255,0.5);
        }
        .wp-react-btn:active { transform: scale(0.95); }
        .wp-copy-btn, .wp-leave-btn {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #ccc;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
        }
        .wp-copy-btn:hover { background: rgba(108,99,255,0.3); color: #fff; }
        .wp-leave-btn:hover { background: rgba(255,60,60,0.3); color: #ff8080; }
        .wp-create-btn {
          background: linear-gradient(135deg, #6C63FF, #a78bfa);
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: opacity 0.2s, transform 0.15s;
          margin-top: 8px;
        }
        .wp-create-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        #wp-toast {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%) translateY(20px);
          background: rgba(20,20,30,0.95);
          border: 1px solid rgba(108,99,255,0.4);
          color: #fff;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          opacity: 0;
          transition: opacity 0.3s, transform 0.3s;
          pointer-events: none;
          z-index: 9999;
          white-space: nowrap;
        }
        #wp-toast.show {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
  
        /* ── Mobile fixes ── */
        @media (max-width: 600px) {
          #watch-party-bar { padding: 8px 12px; }
          .wp-reactions { gap: 2px; }
          .wp-react-btn { padding: 5px 8px; font-size: 16px; }
          .wp-copy-btn, .wp-leave-btn { padding: 6px 10px; font-size: 11px; }
        }
      `;
      document.head.appendChild(s);
    }
  
    function injectCreateBtnStyles() {
      /* Already injected via injectBarStyles if bar exists,
         but we need the .wp-create-btn style before bar is shown */
      if (document.getElementById('wp-pre-styles')) return;
      const s = document.createElement('style');
      s.id = 'wp-pre-styles';
      s.textContent = `
        .wp-create-btn {
          background: linear-gradient(135deg, #6C63FF, #a78bfa);
          border: none; border-radius: 8px;
          padding: 8px 16px; font-size: 13px; font-weight: 700;
          color: #fff; cursor: pointer;
          letter-spacing: 0.03em;
          transition: opacity 0.2s, transform 0.15s;
          margin-top: 8px;
        }
        .wp-create-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      `;
      document.head.appendChild(s);
    }
  
    /* ================================================================
       BOOT
    ================================================================ */
    function init() {
      const roomId = getRoomFromURL();
      injectCreateBtnStyles();
  
      if (roomId) {
        currentRoomId = roomId;
        connectSocket(roomId);
        buildPartyBar();
      } else {
        /* No room → inject "Watch With Me" into player when it opens */
        injectCreateRoomButton();
      }
    }
  
    /* Wait for DOM */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  
    /* ── Public API ── */
    window.WatchParty = {
      hookPlayer,
      sendReaction,
      getRoomId: () => currentRoomId,
      isInRoom: () => !!currentRoomId
    };
  })();