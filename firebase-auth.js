/* ============================================================
   TRAILER HUB — firebase-auth.js
   Real Firebase Authentication (email/password + Google)
   Replace YOUR_API_KEY etc. with your Firebase config values.
   Load this BEFORE auth.js on every page.
============================================================ */

/* ── STEP 1: Paste your Firebase config here ── */
const FIREBASE_CONFIG = {
   apiKey:            "AIzaSyBRIT0-DjvyeMjeU-tvYlet3Z_ngLgLW4E",
  authDomain:        "trailer-hub-fd68c.firebaseapp.com",
  projectId:         "trailer-hub-fd68c",
  storageBucket:     "trailer-hub-fd68c.firebasestorage.app",
  messagingSenderId: "778104528195",
  appId:             "1:778104528195:web:5d7581127f9b9697f163f6"
};

/* ── Load Firebase SDK from CDN ── */
(function loadFirebase() {
  const scripts = [
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js'
  ];
  scripts.forEach(src => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
  });
})();

/* ── Wait for Firebase to load, then init ── */
window.addEventListener('load', () => {
  if (!window.firebase) {
    console.error('Firebase SDK failed to load');
    return;
  }

  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  /* ── Sync Firebase user → TrailerAuth localStorage ── */
  auth.onAuthStateChanged(user => {
    if (user) {
      /* Real logged-in user — sync to TrailerAuth format */
      window.TrailerAuth?.setUser(user.email, user.providerData?.[0]?.providerId || 'email');
    }
    /* If no user, leave localStorage as-is (guest may be set) */
  });

  /* ── Expose Firebase methods globally ── */
  window.FirebaseAuth = {

    /* Email/Password Sign Up */
    async register(email, password) {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      return cred.user;
    },

    /* Email/Password Login */
    async login(email, password) {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      return cred.user;
    },

    /* Google Popup Login */
    async loginWithGoogle() {
      const cred = await auth.signInWithPopup(googleProvider);
      return cred.user;
    },

    /* Logout */
    async logout() {
      await auth.signOut();
      localStorage.removeItem('th_user');
      localStorage.removeItem('th_guest');
      window.location.href = 'login.html';
    },

    /* Get current Firebase user */
    getCurrentUser() {
      return auth.currentUser;
    }
  };
});