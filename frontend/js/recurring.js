/* ============================================
   Personal Finance App - Recurring Bills Page
   ============================================ */

const RecurringPage = {
  // Reference date for "due soon" calculation (19 August 2024)
  referenceDate: new Date('2024-08-19'),
  dueSoonDays: 5,

  // State
  state: {
    recurringBills: [],
    filteredBills: [],
    summary: {
      paid: 0,
      upcoming: 0,
      dueSoon: 0,
      paidCount: 0,
      upcomingCount: 0,
      dueSoonCount: 0
    },
    searchQuery: '',
    sortBy: 'latest',
    isLoading: true
  },

  async init() {
    console.log('Initializing Recurring Bills Page...');

    this.setupSidebar();

    this.setupEventListeners();

    await this.loadRecurringBills();

    this.setupKeyboardNav();
  },

  setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const minimizeBtn = document.getElementById('minimizeBtn');

    const isCollapsed = Utils.loadFromStorage('sidebarCollapsed');
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      minimizeBtn.setAttribute('aria-expanded', 'false');
    }

    minimizeBtn?.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const isNowCollapsed = sidebar.classList.contains('collapsed');
      minimizeBtn.setAttribute('aria-expanded', !isNowCollapsed);
      Utils.saveToStorage('sidebarCollapsed', isNowCollapsed);
    });
  },

  // === Keyboard Navigation ===
  setupKeyboardNav() {
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

  // === Event Listeners ===
  setupEventListeners() {
    // Search input with debounce
    const searchInput = document.getElementById('searchBills');
    searchInput?.addEventListener('input', Utils.debounce((e) => {
      this.state.searchQuery = e.target.value;
      this.applyFiltersAndRender();
    }, 300));

    // Sort select
    const sortSelect = document.getElementById('sortBills');
    sortSelect?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.applyFiltersAndRender();
    });
  },

  // === Data Loading ===
  async loadRecurringBills() {
    try {
      this.state.isLoading = true;

      // Try API first, fallback to local data processing
      let data;
      try {
        const response = await API.getRecurringBills();
        this.state.recurringBills = response.data || [];
        this.state.summary = {
          paid: response.summary?.paid || 0,
          upcoming: response.summary?.upcoming || 0,
          dueSoon: response.summary?.dueSoon || 0,
          paidCount: this.state.recurringBills.filter(b => b.isPaid).length,
          upcomingCount: this.state.recurringBills.filter(b => !b.isPaid).length,
          dueSoonCount: this.state.recurringBills.filter(b => b.isDueSoon).length
        };
      } catch (apiError) {
        console.warn('API not available, loading local data...');
        data = await this.loadLocalData();
        this.processLocalData(data);
      }

      this.applyFiltersAndRender();

    } catch (error) {
      console.error('Failed to load recurring bills:', error);
      this.showError('Failed to load recurring bills. Please refresh the page.');
    } finally {
      this.state.isLoading = false;
    }
  },

  async loadLocalData() {
    const response = await fetch('../data.json');
    if (!response.ok) throw new Error('Failed to load local data');
    return await response.json();
  },

  processLocalData(data) {
    // Get unique recurring transactions
    const recurringMap = new Map();

    data.transactions
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

    // Process into bills array
    this.state.recurringBills = Array.from(recurringMap.values()).map((bill, index) => {
      const sortedDates = bill.dates.sort((a, b) => new Date(b) - new Date(a));
      const lastDate = new Date(sortedDates[0]);

      // Calculate next due date (assume monthly)
      const nextDue = new Date(lastDate);
      nextDue.setMonth(nextDue.getMonth() + 1);

      const isPaid = sortedDates.some(d => {
        const date = new Date(d);
        return date.getMonth() === 7 && date.getFullYear() === 2024;
      });

      const daysUntilDue = Math.ceil((nextDue - this.referenceDate) / (1000 * 60 * 60 * 24));
      const isDueSoon = !isPaid && daysUntilDue >= 0 && daysUntilDue <= this.dueSoonDays;

      return {
        id: index,
        ...bill,
        lastDate: sortedDates[0],
        nextDueDate: nextDue.toISOString(),
        isPaid,
        isDueSoon,
        daysUntilDue
      };
    });

    // Calculate summary
    this.state.summary = {
      paid: this.state.recurringBills.filter(b => b.isPaid).reduce((sum, b) => sum + b.amount, 0),
      upcoming: this.state.recurringBills.filter(b => !b.isPaid).reduce((sum, b) => sum + b.amount, 0),
      dueSoon: this.state.recurringBills.filter(b => b.isDueSoon).reduce((sum, b) => sum + b.amount, 0),
      paidCount: this.state.recurringBills.filter(b => b.isPaid).length,
      upcomingCount: this.state.recurringBills.filter(b => !b.isPaid).length,
      dueSoonCount: this.state.recurringBills.filter(b => b.isDueSoon).length
    };
  },

  // === Filtering & Sorting ===
  applyFiltersAndRender() {
    let filtered = [...this.state.recurringBills];

    // Apply search filter
    if (this.state.searchQuery.trim()) {
      const query = this.state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(b =>
        b.name.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered = this.sortBills(filtered, this.state.sortBy);

    // Update state
    this.state.filteredBills = filtered;

    // Render
    this.renderSummary();
    this.renderBills();
  },

  sortBills(bills, sortBy) {
    const sorted = [...bills];

    switch (sortBy) {
      case 'latest':
        return sorted.sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.lastDate) - new Date(b.lastDate));
      case 'a-z':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'z-a':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'highest':
        return sorted.sort((a, b) => b.amount - a.amount);
      case 'lowest':
        return sorted.sort((a, b) => a.amount - b.amount);
      default:
        return sorted;
    }
  },

  // === Rendering ===
  renderSummary() {
    const { summary } = this.state;

    // Total bills (paid + upcoming)
    const total = summary.paid + summary.upcoming;
    document.getElementById('totalBills').textContent = Utils.formatCurrency(total);

    // Paid bills
    document.getElementById('paidBillsAmount').textContent = Utils.formatCurrency(summary.paid);
    document.getElementById('paidBillsCount').textContent = `${summary.paidCount} bill${summary.paidCount !== 1 ? 's' : ''} paid`;

    // Upcoming bills
    document.getElementById('upcomingBillsAmount').textContent = Utils.formatCurrency(summary.upcoming);
    document.getElementById('upcomingBillsCount').textContent = `${summary.upcomingCount} bill${summary.upcomingCount !== 1 ? 's' : ''} upcoming`;

    // Due soon
    document.getElementById('dueSoonAmount').textContent = Utils.formatCurrency(summary.dueSoon);
    document.getElementById('dueSoonCount').textContent = `${summary.dueSoonCount} bill${summary.dueSoonCount !== 1 ? 's' : ''} due soon`;
  },

  renderBills() {
    const container = document.getElementById('billsList');
    if (!container) return;

    const { filteredBills } = this.state;

    if (filteredBills.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-12); text-align: center;">
          <img src="../assets/images/icon-recurring-bills.svg" alt="" style="width: 3rem; height: 3rem; opacity: 0.3; margin-bottom: var(--space-4);">
          <p style="font-size: var(--text-lg); font-weight: var(--font-medium); color: var(--text-primary); margin-bottom: var(--space-2);">
            No recurring bills found
          </p>
          <p class="text-gray" style="font-size: var(--text-sm);">
            ${this.state.searchQuery
              ? `No results for "${this.state.searchQuery}"`
              : 'No recurring bills to display'}
          </p>
        </div>
      `;
      return;
    }

    let html = '';

    filteredBills.forEach(bill => {
      const statusClass = bill.isPaid ? 'paid' : (bill.isDueSoon ? 'due-soon' : 'pending');
      const statusText = bill.isPaid ? 'Paid' : (bill.isDueSoon ? 'Due Soon' : 'Upcoming');

      html += `
        <div class="bill-item" role="listitem" tabindex="0">
          <!-- Bill Title -->
          <div class="bill-name">
            <img
              src="${bill.avatar}"
              alt=""
              class="bill-avatar"
              onerror="this.src='../assets/images/avatars/emma-richardson.jpg'"
            >
            <span class="bill-vendor">${bill.name}</span>
          </div>

          <!-- Status -->
          <div>
            <span class="bill-status ${statusClass}">
              <span class="bill-status-dot"></span>
              ${statusText}
            </span>
          </div>

          <!-- Due Date -->
          <div class="bill-date">
            ${Utils.formatDate(bill.nextDueDate)}
            ${!bill.isPaid && bill.daysUntilDue >= 0 ? `<span style="color: var(--text-tertiary);"> (${bill.daysUntilDue} days)</span>` : ''}
          </div>

          <!-- Amount -->
          <div class="bill-amount">
            ${Utils.formatCurrency(bill.amount)}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  // === Error Handling ===
  showError(message) {
    const container = document.getElementById('billsList');
    if (container) {
      container.innerHTML = `
        <div class="error-state" style="padding: var(--space-8); text-align: center;">
          <p style="color: var(--color-red); margin-bottom: var(--space-4);">${message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  RecurringPage.init();
});

// Export for onclick handlers
window.RecurringPage = RecurringPage;
