/* ============================================
   Personal Finance App - API Module
   ============================================ */

const API = {
  // Base URL for API calls
  baseUrl: '/api',

  // === Token Management ===
  getToken() {
    return localStorage.getItem('finance_token');
  },

  setToken(token) {
    localStorage.setItem('finance_token', token);
  },

  removeToken() {
    localStorage.removeItem('finance_token');
    localStorage.removeItem('finance_user');
  },

  getUser() {
    const user = localStorage.getItem('finance_user');
    return user ? JSON.parse(user) : null;
  },

  setUser(user) {
    localStorage.setItem('finance_user', JSON.stringify(user));
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  // === Generic Request Methods ===
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add Authorization header if token exists
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        this.removeToken();
        // Only redirect if not already on login/signup pages
        if (!window.location.pathname.includes('login.html') &&
            !window.location.pathname.includes('signup.html')) {
          window.location.href = 'login.html';
        }
        throw new Error('Session expired. Please log in again.');
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        throw new Error('Access denied. Invalid or expired token.');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  // === Authentication API ===
  async login(email, password) {
    const response = await this.post('/auth/login', { email, password });
    if (response.token) {
      this.setToken(response.token);
      this.setUser(response.user);
    }
    return response;
  },

  async signup(userData) {
    const response = await this.post('/auth/signup', userData);
    if (response.token) {
      this.setToken(response.token);
      this.setUser(response.user);
    }
    return response;
  },

  async logout() {
    this.removeToken();
    window.location.href = 'login.html';
  },

  async getProfile() {
    return this.get('/auth/me');
  },

  // === Balance API ===
  async getBalance() {
    return this.get('/balance');
  },

  async updateBalance(data) {
    return this.put('/balance', data);
  },

  // === Transactions API ===
  async getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/transactions?${query}` : '/transactions';
    return this.get(endpoint);
  },

  async getTransaction(id) {
    return this.get(`/transactions/${id}`);
  },

  // === Budgets API ===
  async getBudgets() {
    return this.get('/budgets');
  },

  async createBudget(data) {
    return this.post('/budgets', data);
  },

  async updateBudget(id, data) {
    return this.put(`/budgets/${id}`, data);
  },

  async deleteBudget(id) {
    return this.delete(`/budgets/${id}`);
  },

  // === Pots API ===
  async getPots() {
    return this.get('/pots');
  },

  async createPot(data) {
    return this.post('/pots', data);
  },

  async updatePot(id, data) {
    return this.put(`/pots/${id}`, data);
  },

  async deletePot(id) {
    return this.delete(`/pots/${id}`);
  },

  async addToPot(id, amount) {
    return this.post(`/pots/${id}/add`, { amount });
  },

  async withdrawFromPot(id, amount) {
    return this.post(`/pots/${id}/withdraw`, { amount });
  },

  // === Recurring Bills API ===
  async getRecurringBills(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/recurring-bills?${query}` : '/recurring-bills';
    return this.get(endpoint);
  },

  // === Data API (Initial Load) ===
  async getAllData() {
    return this.get('/data');
  }
};

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
