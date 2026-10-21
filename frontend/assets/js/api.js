const BACKEND_URL = 'https://alkhairate.onrender.com';

const isNativeApp = () => {
  return typeof window !== 'undefined' && !!(
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform()
  );
};

// Use remote backend when running inside native mobile app (Capacitor).
// When opened locally via file:, point to local port 4000.
// On normal web deployments, use relative /api.
const API_BASE = isNativeApp()
  ? `${BACKEND_URL}/api`
  : (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:'
      ? 'http://localhost:4000/api'
      : '/api');

/**
 * Prefixes relative upload asset URLs with BACKEND_URL when running inside native mobile app.
 * Keeps local static assets and web relative URLs intact.
 */
function assetUrl(path) {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (isNativeApp()) {
    const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    // Uploaded content that only lives on the remote server
    if (cleanPath.startsWith('uploads/') || cleanPath.startsWith('assets/uploads/') || cleanPath.startsWith('assets/avatars/')) {
      return `${BACKEND_URL}/${cleanPath}`;
    }
  }
  return trimmed;
}

if (typeof window !== 'undefined') {
  window.BACKEND_URL = BACKEND_URL;
  window.isNativeApp = isNativeApp;
  window.assetUrl = assetUrl;
}

let _cachedToken = (!isNativeApp() && typeof localStorage !== 'undefined') ? localStorage.getItem('eaepcg_token') : null;
let _cachedUser = null;
if (!isNativeApp() && typeof localStorage !== 'undefined') {
  try {
    _cachedUser = JSON.parse(localStorage.getItem('eaepcg_user') || 'null');
  } catch(e) {
    _cachedUser = null;
  }
}

const getSecureStoragePlugin = () => {
  if (typeof window === 'undefined') return null;
  return window.Capacitor?.Plugins?.SecureStoragePlugin || null;
};

const getPreferencesPlugin = () => {
  if (typeof window === 'undefined') return null;
  return window.Capacitor?.Plugins?.Preferences || window.Capacitor?.Plugins?.Storage || null;
};

const Auth = {
  initPromise: null,

  async init() {
    if (isNativeApp()) {
      const SecureStorage = getSecureStoragePlugin();
      if (SecureStorage) {
        try {
          const { value: token } = await SecureStorage.get({ key: 'eaepcg_token' });
          const { value: userStr } = await SecureStorage.get({ key: 'eaepcg_user' });
          if (token) _cachedToken = token;
          if (userStr) {
            try { _cachedUser = JSON.parse(userStr); } catch(e){}
          }
        } catch(e) {
          // Key doesn't exist yet or fresh install
        }
      }
    }
  },

  getToken() {
    if (_cachedToken) return _cachedToken;
    if (isNativeApp()) return null;
    return (typeof localStorage !== 'undefined' ? localStorage.getItem('eaepcg_token') : null);
  },

  getUser() {
    if (_cachedUser) return _cachedUser;
    if (isNativeApp()) return null;
    try {
      return typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('eaepcg_user') || 'null') : null;
    } catch(e) {
      return null;
    }
  },

  setSession(token, user) {
    _cachedToken = token;
    _cachedUser = user;

    if (isNativeApp()) {
      // Strictly store in Keychain/Keystore via SecureStoragePlugin.
      // Never store the token in localStorage or @capacitor/preferences!
      const SecureStorage = getSecureStoragePlugin();
      if (SecureStorage) {
        SecureStorage.set({ key: 'eaepcg_token', value: token }).catch(console.error);
        SecureStorage.set({ key: 'eaepcg_user', value: JSON.stringify(user) }).catch(console.error);
      }
      // Wipe any legacy plaintext traces from localStorage and preferences
      try {
        localStorage.removeItem('eaepcg_token');
        localStorage.removeItem('eaepcg_user');
      } catch(e){}
      const Prefs = getPreferencesPlugin();
      if (Prefs) {
        Prefs.remove({ key: 'eaepcg_token' }).catch(() => {});
        Prefs.remove({ key: 'eaepcg_user' }).catch(() => {});
      }
    } else {
      // Standard web browser deployment
      try {
        localStorage.setItem('eaepcg_token', token);
        localStorage.setItem('eaepcg_user', JSON.stringify(user));
      } catch(e){}
    }
  },

  clear() {
    // Detach push notification token on server if registered
    const deviceToken = typeof localStorage !== 'undefined' ? localStorage.getItem('eaepcg_device_token') : null;
    if (deviceToken) {
      try {
        apiFetch('/push/deregister', {
          method: 'POST',
          body: JSON.stringify({ token: deviceToken })
        }).catch(() => {});
      } catch(e){}
    }

    _cachedToken = null;
    _cachedUser = null;

    if (isNativeApp()) {
      const SecureStorage = getSecureStoragePlugin();
      if (SecureStorage) {
        SecureStorage.remove({ key: 'eaepcg_token' }).catch(console.error);
        SecureStorage.remove({ key: 'eaepcg_user' }).catch(console.error);
      }
    }

    try {
      localStorage.removeItem('eaepcg_token');
      localStorage.removeItem('eaepcg_user');
    } catch(e){}

    const Prefs = getPreferencesPlugin();
    if (Prefs) {
      Prefs.remove({ key: 'eaepcg_token' }).catch(console.error);
      Prefs.remove({ key: 'eaepcg_user' }).catch(console.error);
    }
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  isAdmin() {
    const u = this.getUser();
    return u && u.role === 'admin';
  }
};

// Bootstrap preferences if on native platform
Auth.initPromise = Auth.init();

if (typeof window !== 'undefined') {
  window.Auth = Auth;
}

async function apiFetch(path, options = {}) {
  // Ensure native preferences are read before making first network call
  if (Auth.initPromise) {
    try { await Auth.initPromise; } catch(e){}
  }

  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = Auth.getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
  let data = null;
  try { data = await res.json(); } catch(e) { /* no body */ }

  if (!res.ok) {
    if (res.status === 401 && Auth.getToken()) {
      Auth.clear();
      window.location.href = 'login.html';
      return;
    }
    const err = new Error((data && data.error) || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
