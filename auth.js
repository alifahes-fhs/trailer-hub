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

    if (authPages.includes(page) && (isLoggedIn() || isGuest())) {
      window.location.href = 'index.html';
      return;
    }
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
      host.innerHTML = `<button class="btn-pill" id="logout-btn" type="button">Logout (${(u?.email || 'User').split('@')[0]})</button>`;
      host.querySelector('#logout-btn')?.addEventListener('click', logout);
      return;
    }
    if (isGuest()) {
      host.innerHTML = `<a href="login.html" class="btn-pill">Login</a>`;
      return;
    }
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

