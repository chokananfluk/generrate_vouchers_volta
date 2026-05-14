// ============================================================
// auth.js — Session management (localStorage)
// ============================================================

const Auth = {
  getSession() {
    try {
      const raw = localStorage.getItem(CONFIG.SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (new Date(s.expiresAt) < new Date()) {
        this.clearSession();
        return null;
      }
      return s;
    } catch(_) { return null; }
  },

  saveSession(data) {
    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(data));
  },

  clearSession() {
    localStorage.removeItem(CONFIG.SESSION_KEY);
  },

  getUser() {
    const s = this.getSession();
    return s ? s.user : null;
  },

  isLoggedIn() { return this.getSession() !== null; },

  isAdmin() {
    const u = this.getUser();
    return u && u.role === 'admin';
  },

  // Guard: redirect to login if not authenticated
  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = rootPath() + 'index.html';
      return false;
    }
    return true;
  },

  // Guard: redirect if not admin
  requireAdmin() {
    if (!this.requireLogin()) return false;
    if (!this.isAdmin()) {
      window.location.href = rootPath() + 'user/dashboard.html';
      return false;
    }
    return true;
  },

  // Guard: redirect admin away from user pages
  requireUser() {
    if (!this.requireLogin()) return false;
    if (this.isAdmin()) {
      window.location.href = rootPath() + 'admin/dashboard.html';
      return false;
    }
    return true;
  },

  async logout() {
    try { await API.logout(); } catch(_) {}
    this.clearSession();
    window.location.href = rootPath() + 'index.html';
  }
};
