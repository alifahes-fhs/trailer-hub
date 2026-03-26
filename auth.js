(function () {
  const USER_KEY = 'th_user';
  const GUEST_KEY = 'th_guest';

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }
  function isGuest() { return localStorage.getItem(GUEST_KEY) === '1'; }
  function isLoggedIn() { return !!getUser(); }
  function canUsePersonalFeatures() { return isLoggedIn(); }

  function setUser(email, provider = 'email') {
    localStorage.setItem(USER_KEY, JSON.stringify({ email, provider, at: Date.now() }));
    localStorage.removeItem(GUEST_KEY);
  }
  function setGuest() {
    localStorage.setItem(GUEST_KEY, '1');
    localStorage.removeItem(USER_KEY);
  }
  function logout() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(GUEST_KEY);
    window.location.href = 'login.html';
  }

  function routeName() {
    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return file;
  }

  function enforceAccess() {
    const page = routeName();
    const authPages = ['login.html', 'register.html'];
    const appPages = ['index.html', 'movie.html', 'contact.html'];

  
    if (appPages.includes(page) && !isLoggedIn() && !isGuest()) {
      window.location.href = 'login.html';
    }
  }

  function renderNavAuth() {
    const nav = document.querySelector('header nav');
    if (!nav) return;
  
    let host = document.getElementById('auth-nav-host');
    if (!host) {
      host = document.createElement('span');
      host.id = 'auth-nav-host';
      nav.appendChild(host);
    }
  
    if (isLoggedIn()) {
      const u = getUser();
      const name = (u?.email || 'User').split('@')[0];
      const initials = name.slice(0,2).toUpperCase();
  
      host.innerHTML = `
        <div class="profile-dropdown">
          <button class="profile-btn" id="profile-btn">
            <span class="profile-avatar">${initials}</span>
            <span class="profile-name">${name}</span>
            <span class="caret">▾</span>
          </button>
  
          <div class="dropdown-menu" id="profile-menu">
            <div class="profile-pop">
              <div class="profile-pop-header">
                <span class="profile-avatar-large">${initials}</span>
                <div class="profile-pop-info">
                  <div class="name">${name}</div>
                  <div class="email">${u.email}</div>
                  <div class="provider">Provider: ${u.provider}</div>
                </div>
              </div>
              <button class="logout-btn" id="logout-btn">Logout</button>
            </div>
          </div>
        </div>
      `;
  
      const btn = host.querySelector('#profile-btn');
      const menu = host.querySelector('#profile-menu');
  
      // toggle dropdown
      btn.addEventListener('click', () => {
        menu.classList.toggle('open');
      });
  
      // close when clicking outside
      document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
          menu.classList.remove('open');
        }
      });
  
      // logout
      host.querySelector('#logout-btn')?.addEventListener('click', logout);
  
      return;
    }
  
    // Guest
    host.innerHTML = `<a href="login.html" class="btn-pill">Login</a>`;
  }
  

  function requirePersonalFeature(message) {
    if (canUsePersonalFeatures()) return true;
    alert(message || 'Login required for this feature.');
    return false;
  }

  window.TrailerAuth = {
    getUser,
    isGuest,
    isLoggedIn,
    canUsePersonalFeatures,
    setUser,
    setGuest,
    logout,
    enforceAccess,
    renderNavAuth,
    requirePersonalFeature
  };
})();

