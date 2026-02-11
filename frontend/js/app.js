/* ============================================
   Personal Finance App - Main Application
   ============================================ */

const App = {
  // Application state
  state: {
    balance: { current: 0, income: 0, expenses: 0 },
    transactions: [],
    budgets: [],
    pots: [],
    recurringBills: [],
    isLoading: true
  },

  // === Initialization ===
  async init() {
    console.log('Initializing Personal Finance App...');

    // Setup sidebar toggle
    this.setupSidebar();

    // Load initial data
    await this.loadData();

    // Setup keyboard navigation
    this.setupKeyboardNav();
  },

  // === Sidebar Setup ===
  setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const minimizeBtn = document.getElementById('minimizeBtn');

    // Check for saved sidebar state
    const isCollapsed = Utils.loadFromStorage('sidebarCollapsed');
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      minimizeBtn.setAttribute('aria-expanded', 'false');
    }

    // Toggle sidebar
    minimizeBtn?.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const isNowCollapsed = sidebar.classList.contains('collapsed');
      minimizeBtn.setAttribute('aria-expanded', !isNowCollapsed);
      Utils.saveToStorage('sidebarCollapsed', isNowCollapsed);
    });
  },

  // === Keyboard Navigation ===
  setupKeyboardNav() {
    // Handle escape key for modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
          Utils.hideModal(activeModal.id);
        }
      }
    });

    // Handle arrow keys for navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach((link, index) => {
      link.addEventListener('keydown', (e) => {
        let targetIndex;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          targetIndex = (index + 1) % navLinks.length;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          targetIndex = (index - 1 + navLinks.length) % navLinks.length;
        }

        if (targetIndex !== undefined) {
          e.preventDefault();
          navLinks[targetIndex].focus();
        }
      });
    });
  },

  // === Data Loading ===
  async loadData() {
    try {
      this.state.isLoading = true;

      // Try to fetch from API first
      let data;
      try {
        data = await API.getAllData();
      } catch (apiError) {
        console.warn('API not available, loading from local data...');
        // Fallback to local data.json for development
        data = await this.loadLocalData();
      }

      // Update state
      this.state.balance = data.balance || { current: 0, income: 0, expenses: 0 };
      this.state.transactions = data.transactions || [];
      this.state.budgets = data.budgets || [];
      this.state.pots = data.pots || [];

      // Process recurring bills
      this.processRecurringBills();

      // Render components
      this.render();

    } catch (error) {
      console.error('Failed to load data:', error);
      this.showError('Failed to load data. Please refresh the page.');
    } finally {
      this.state.isLoading = false;
    }
  },

  async loadLocalData() {
    const response = await fetch('./data.json');
    if (!response.ok) throw new Error('Failed to load local data');
    return await response.json();
  },

  // === Process Recurring Bills ===
  processRecurringBills() {
    // Get unique recurring transactions
    const recurringMap = new Map();

    this.state.transactions
      .filter(t => t.recurring)
      .forEach(t => {
        if (!recurringMap.has(t.name)) {
          recurringMap.set(t.name, {
            name: t.name,
            avatar: t.avatar,
            category: t.category,
            amount: Math.abs(t.amount),
            dates: []
          });
        }
        recurringMap.get(t.name).dates.push(t.date);
      });

    // Convert to array and process
    this.state.recurringBills = Array.from(recurringMap.values()).map(bill => {
      const sortedDates = bill.dates.sort((a, b) => new Date(b) - new Date(a));
      const lastDate = new Date(sortedDates[0]);

      return {
        ...bill,
        lastDate: sortedDates[0],
        nextDueDate: this.calculateNextDueDate(lastDate),
        isPaid: this.isPaidInAugust2024(sortedDates)
      };
    });
  },

  calculateNextDueDate(lastDate) {
    // Assume monthly recurring
    const next = new Date(lastDate);
    next.setMonth(next.getMonth() + 1);
    return next.toISOString();
  },

  isPaidInAugust2024(dates) {
    return dates.some(d => {
      const date = new Date(d);
      return date.getMonth() === 7 && date.getFullYear() === 2024; // August is month 7
    });
  },

  // === Rendering ===
  render() {
    this.renderBalance();
    this.renderPotsSummary();
    this.renderBudgetsSummary();
    this.renderTransactionsSummary();
    this.renderRecurringSummary();
  },

  renderBalance() {
    const { current, income, expenses } = this.state.balance;

    const currentEl = document.getElementById('currentBalance');
    const incomeEl = document.getElementById('totalIncome');
    const expensesEl = document.getElementById('totalExpenses');

    if (currentEl) currentEl.textContent = Utils.formatCurrency(current);
    if (incomeEl) incomeEl.textContent = Utils.formatCurrency(income);
    if (expensesEl) expensesEl.textContent = Utils.formatCurrency(expenses);
  },

  renderPotsSummary() {
    const container = document.getElementById('potsSummary');
    if (!container) return;

    const totalSaved = this.state.pots.reduce((sum, pot) => sum + pot.total, 0);

    let html = `
      <div class="pots-total" style="display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-5);">
        <img src="./assets/images/icon-pot.svg" alt="" style="width: 2.5rem; height: 2.5rem;">
        <div>
          <p class="text-gray" style="font-size: var(--text-sm); margin-bottom: var(--space-1);">Total Saved</p>
          <p style="font-size: var(--text-3xl); font-weight: var(--font-bold); color: var(--color-green);">${Utils.formatCurrency(totalSaved)}</p>
        </div>
      </div>
      <div class="pots-list">
    `;

    this.state.pots.slice(0, 4).forEach(pot => {
      const percentage = (pot.total / pot.target) * 100;
      html += `
        <div class="item-card">
          <div class="item-indicator" style="background-color: ${pot.theme};"></div>
          <div class="item-content">
            <div class="item-header">
              <span class="item-name">${pot.name}</span>
              <span class="item-amount">${Utils.formatCurrency(pot.total)}</span>
            </div>
            <div class="progress-bar" style="margin-top: var(--space-2);">
              <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%; background-color: ${pot.theme};"></div>
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  },

  renderBudgetsSummary() {
    const container = document.getElementById('budgetsSummary');
    if (!container) return;

    // Calculate spending per category for August 2024
    const augustSpending = {};
    this.state.transactions
      .filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === 7 && date.getFullYear() === 2024 && t.amount < 0;
      })
      .forEach(t => {
        if (!augustSpending[t.category]) augustSpending[t.category] = 0;
        augustSpending[t.category] += Math.abs(t.amount);
      });

    const totalBudget = this.state.budgets.reduce((sum, b) => sum + b.maximum, 0);
    const totalSpent = this.state.budgets.reduce((sum, b) => sum + (augustSpending[b.category] || 0), 0);
    const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    let html = `
      <div style="display: flex; align-items: center; gap: var(--space-6);">
        <div style="position: relative; width: 120px; height: 120px;">
          <svg viewBox="0 0 120 120" style="transform: rotate(-90deg);">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#F8F4F0" stroke-width="12"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke="#277C78" stroke-width="12"
              stroke-dasharray="${2 * Math.PI * 50}"
              stroke-dashoffset="${2 * Math.PI * 50 * (1 - spentPercentage / 100)}"
              stroke-linecap="round"/>
          </svg>
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
            <p style="font-size: var(--text-lg); font-weight: var(--font-bold);">${Math.round(spentPercentage)}%</p>
            <p style="font-size: var(--text-xs); color: var(--text-secondary);">of limit</p>
          </div>
        </div>
        <div style="flex: 1;">
          <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">
            <strong>${Utils.formatCurrency(totalSpent)}</strong> of <strong>${Utils.formatCurrency(totalBudget)}</strong> limit
          </p>
          <div style="display: flex; flex-direction: column; gap: var(--space-3);">
    `;

    this.state.budgets.slice(0, 4).forEach(budget => {
      const spent = augustSpending[budget.category] || 0;
      const percentage = budget.maximum > 0 ? (spent / budget.maximum) * 100 : 0;

      html += `
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <div style="width: 0.5rem; height: 0.5rem; border-radius: 50%; background-color: ${budget.theme};"></div>
          <span style="flex: 1; font-size: var(--text-sm);">${budget.category}</span>
          <span style="font-size: var(--text-sm); font-weight: var(--font-medium);">${Utils.formatCurrency(spent)}</span>
        </div>
      `;
    });

    html += '</div></div></div>';
    container.innerHTML = html;
  },

  renderTransactionsSummary() {
    const container = document.getElementById('transactionsSummary');
    if (!container) return;

    const recentTransactions = Utils.sortByDate(this.state.transactions, 'desc').slice(0, 5);

    let html = '';
    recentTransactions.forEach(transaction => {
      const isPositive = transaction.amount > 0;
      html += `
        <div class="transaction-item">
          <img src="${transaction.avatar}" alt="" class="transaction-avatar">
          <div class="transaction-info">
            <p class="transaction-name">${transaction.name}</p>
            <p class="transaction-category">${transaction.category}</p>
          </div>
          <div style="text-align: right;">
            <p class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
              ${Utils.formatCurrency(Math.abs(transaction.amount), true)}
            </p>
            <p class="transaction-date">${Utils.formatDate(transaction.date)}</p>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderRecurringSummary() {
    const container = document.getElementById('recurringSummary');
    if (!container) return;

    // Reference date: 19 August 2024
    const referenceDate = new Date('2024-08-19');

    // Calculate paid bills (in August 2024)
    const paidBills = this.state.recurringBills.filter(b => b.isPaid);
    const paidTotal = paidBills.reduce((sum, b) => sum + b.amount, 0);

    // Calculate upcoming and due soon
    let upcomingTotal = 0;
    let dueSoonTotal = 0;

    this.state.recurringBills.forEach(bill => {
      if (!bill.isPaid) {
        upcomingTotal += bill.amount;
        const dueDate = new Date(bill.nextDueDate);
        const daysDiff = Math.ceil((dueDate - referenceDate) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 0 && daysDiff <= 5) {
          dueSoonTotal += bill.amount;
        }
      }
    });

    container.innerHTML = `
      <div class="bill-stat">
        <div class="bill-stat-indicator paid"></div>
        <div class="bill-stat-info">
          <p class="bill-stat-label">Paid Bills</p>
          <p class="bill-stat-amount">${Utils.formatCurrency(paidTotal)}</p>
        </div>
      </div>
      <div class="bill-stat">
        <div class="bill-stat-indicator upcoming"></div>
        <div class="bill-stat-info">
          <p class="bill-stat-label">Total Upcoming</p>
          <p class="bill-stat-amount">${Utils.formatCurrency(upcomingTotal)}</p>
        </div>
      </div>
      <div class="bill-stat">
        <div class="bill-stat-indicator due"></div>
        <div class="bill-stat-info">
          <p class="bill-stat-label">Due Soon</p>
          <p class="bill-stat-amount">${Utils.formatCurrency(dueSoonTotal)}</p>
        </div>
      </div>
    `;
  },

  // === Error Handling ===
  showError(message) {
    const containers = ['potsSummary', 'budgetsSummary', 'transactionsSummary', 'recurringSummary'];
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = `<p class="text-red">${message}</p>`;
      }
    });
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
