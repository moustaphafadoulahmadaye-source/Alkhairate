// The backend serves the frontend in normal use. When a page is opened directly
// from disk, use the local backend instead of resolving /api as a file URL.
const API_BASE = window.location.protocol === 'file:'
  ? 'http://localhost:4000/api'
  : '/api';

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
