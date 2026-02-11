/* ============================================
   Personal Finance App - API Module
   ============================================ */

const API = {
  // Base URL for API calls
  baseUrl: '/api',

  // === Generic Request Methods ===
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
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

  // === Balance API ===
  async getBalance() {
    return this.get('/balance');
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
