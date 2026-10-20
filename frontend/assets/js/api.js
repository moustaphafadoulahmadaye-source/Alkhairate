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

const Auth = {
  getToken(){ return localStorage.getItem('eaepcg_token'); },
  getUser(){
    try { return JSON.parse(localStorage.getItem('eaepcg_user') || 'null'); }
    catch(e){ return null; }
  },
  setSession(token, user){
    localStorage.setItem('eaepcg_token', token);
    localStorage.setItem('eaepcg_user', JSON.stringify(user));
  },
  clear(){
    localStorage.removeItem('eaepcg_token');
    localStorage.removeItem('eaepcg_user');
  },
  isLoggedIn(){ return !!this.getToken(); },
  isAdmin(){ const u = this.getUser(); return u && u.role === 'admin'; }
};

async function apiFetch(path, options = {}){
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
