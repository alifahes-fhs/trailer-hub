/* ============================================================
   TRAILER HUB — firebase-auth.js
============================================================ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBRIT0-DjvyeMjeU-tvYlet3Z_ngLgLW4E",
  authDomain: "trailer-hub-fd68c.firebaseapp.com",
  projectId: "trailer-hub-fd68c",
  storageBucket: "trailer-hub-fd68c.firebasestorage.app",
  messagingSenderId: "778104528195",
  appId: "1:778104528195:web:5d7581127f9b9697f163f6"
};

(function loadFirebase() {
  const scripts = [
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"
  ];

  scripts.forEach(src => {
    if ([...document.scripts].some(s => s.src === src)) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    document.head.appendChild(s);
  });
})();

window.addEventListener("load", () => {
  if (!window.firebase) {
    console.error("Firebase SDK failed to load");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  const auth = firebase.auth();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  auth.onAuthStateChanged(user => {
    if (user) {
      window.TrailerAuth?.setUser(
        user.email,
        user.providerData?.[0]?.providerId || "email"
      );
    }
  });

  window.FirebaseAuth = {
    async register(email, password) {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      return cred.user;
    },

    async login(email, password) {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      return cred.user;
    },

    async loginWithGoogle() {
      const cred = await auth.signInWithPopup(googleProvider);
      return cred.user;
    },

  async logout() {
  sessionStorage.setItem('th_logging_out', '1');

  try {
    await auth.signOut();
  } catch (e) {
    console.warn('Firebase logout failed:', e);
  }

  localStorage.removeItem('th_user');
  localStorage.removeItem('th_guest');

  window.location.replace('login.html?logout=1');
},

    getCurrentUser() {
      return auth.currentUser;
    }
  };
});