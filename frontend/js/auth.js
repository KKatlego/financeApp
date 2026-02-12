/* ============================================
   Personal Finance App - Auth Module
   ============================================ */

const Auth = {
  // Current user state
  currentUser: null,

  // Initialize auth on page load
  init() {
    this.currentUser = API.getUser();
    this.setupLogoutHandler();
    this.updateUserDisplay();
  },

  // Check if user is authenticated
  isAuthenticated() {
    return API.isAuthenticated();
  },

  // Get current user
  getUser() {
    return this.currentUser || API.getUser();
  },

  // Require authentication - redirect to login if not authenticated
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = this.getLoginUrl();
      return false;
    }
    return true;
  },

  // Redirect authenticated users away from login/signup pages
  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      window.location.href = 'index.html';
      return true;
    }
    return false;
  },

  // Get correct login URL based on current path
  getLoginUrl() {
    const path = window.location.pathname;
    if (path.includes('/pages/')) {
      return '../login.html';
    }
    return 'login.html';
  },

  // Get correct index URL based on current path
  getIndexUrl() {
    const path = window.location.pathname;
    if (path.includes('/pages/')) {
      return '../index.html';
    }
    return 'index.html';
  },

  // Logout user
  logout() {
    API.logout();
  },

  // Setup logout button handler
  setupLogoutHandler() {
    // Desktop sidebar logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    }

    // Mobile dropdown logout button
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    }

    // Mobile dropdown toggle
    const overviewMenuBtn = document.getElementById('overviewMenuBtn');
    const overviewDropdown = document.getElementById('overviewDropdown');
    if (overviewMenuBtn && overviewDropdown) {
      overviewMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        overviewDropdown.classList.toggle('show');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!overviewMenuBtn.contains(e.target) && !overviewDropdown.contains(e.target)) {
          overviewDropdown.classList.remove('show');
        }
      });
    }
  },

  // Update user display in sidebar
  updateUserDisplay() {
    const user = this.getUser();
    if (!user) return;

    // Update user name display
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
      userNameEl.textContent = `${user.first_name} ${user.last_name}`;
    }

    // Update user initials avatar
    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl) {
      const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`;
      userAvatarEl.textContent = initials.toUpperCase();
    }
  },

  // Show/hide auth-required elements
  updateUI() {
    const isAuthenticated = this.isAuthenticated();

    // Elements that should only show when authenticated
    const authElements = document.querySelectorAll('[data-auth="required"]');
    authElements.forEach(el => {
      el.style.display = isAuthenticated ? '' : 'none';
    });

    // Elements that should only show when NOT authenticated
    const guestElements = document.querySelectorAll('[data-auth="guest"]');
    guestElements.forEach(el => {
      el.style.display = isAuthenticated ? 'none' : '';
    });
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});
