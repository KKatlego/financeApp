/* ============================================
   Personal Finance App - Transactions Page
   ============================================ */

const TransactionsPage = {
  // State
  state: {
    allTransactions: [],
    filteredTransactions: [],
    currentPage: 1,
    itemsPerPage: 10,
    searchQuery: '',
    sortBy: 'latest',
    category: 'All Transactions',
    isLoading: true,
    totalPages: 1
  },

  // === Initialization ===
  async init() {
    console.log('Initializing Transactions Page...');

    // Setup sidebar
    this.setupSidebar();

    // Setup event listeners
    this.setupEventListeners();

    // Check for URL params (from budgets "See All")
    this.parseUrlParams();

    // Load transactions
    await this.loadTransactions();

    // Setup keyboard navigation
    this.setupKeyboardNav();
  },

  // === Sidebar Setup ===
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

  // === URL Params ===
  parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');

    if (category) {
      this.state.category = category;
      const categorySelect = document.getElementById('categorySelect');
      if (categorySelect) {
        categorySelect.value = category;
      }
    }
  },

  // === Event Listeners ===
  setupEventListeners() {
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', Utils.debounce((e) => {
      this.state.searchQuery = e.target.value;
      this.state.currentPage = 1;
      this.applyFiltersAndRender();
    }, 300));

    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    sortSelect?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.state.currentPage = 1;
      this.applyFiltersAndRender();
    });

    // Category select
    const categorySelect = document.getElementById('categorySelect');
    categorySelect?.addEventListener('change', (e) => {
      this.state.category = e.target.value;
      this.state.currentPage = 1;
      this.applyFiltersAndRender();

      // Update URL for bookmarking
      const url = new URL(window.location);
      if (e.target.value !== 'All Transactions') {
        url.searchParams.set('category', e.target.value);
      } else {
        url.searchParams.delete('category');
      }
      window.history.replaceState({}, '', url);
    });

    // Keyboard shortcuts for pagination
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.key === 'ArrowLeft' && this.state.currentPage > 1) {
        this.goToPage(this.state.currentPage - 1);
      } else if (e.key === 'ArrowRight' && this.state.currentPage < this.state.totalPages) {
        this.goToPage(this.state.currentPage + 1);
      }
    });
  },

  // === Data Loading ===
  async loadTransactions() {
    try {
      this.state.isLoading = true;

      // Try API first, fallback to local data
      let data;
      try {
        data = await API.getAllData();
      } catch (apiError) {
        console.warn('API not available, loading local data...');
        data = await this.loadLocalData();
      }

      this.state.allTransactions = data.transactions || [];
      this.applyFiltersAndRender();

    } catch (error) {
      console.error('Failed to load transactions:', error);
      this.showError('Failed to load transactions. Please refresh the page.');
    } finally {
      this.state.isLoading = false;
    }
  },

  async loadLocalData() {
    const response = await fetch('../data.json');
    if (!response.ok) throw new Error('Failed to load local data');
    return await response.json();
  },

  // === Filtering & Sorting ===
  applyFiltersAndRender() {
    let filtered = [...this.state.allTransactions];

    // Apply category filter
    if (this.state.category !== 'All Transactions') {
      filtered = filtered.filter(t => t.category === this.state.category);
    }

    // Apply search filter
    if (this.state.searchQuery.trim()) {
      const query = this.state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered = this.sortTransactions(filtered, this.state.sortBy);

    // Update state
    this.state.filteredTransactions = filtered;
    this.state.totalPages = Math.ceil(filtered.length / this.state.itemsPerPage);

    // Ensure current page is valid
    if (this.state.currentPage > this.state.totalPages) {
      this.state.currentPage = Math.max(1, this.state.totalPages);
    }

    // Render
    this.renderTransactions();
    this.renderPagination();
    this.updatePaginationInfo();
  },

  sortTransactions(transactions, sortBy) {
    const sorted = [...transactions];

    switch (sortBy) {
      case 'latest':
        return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
      case 'a-z':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'z-a':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'highest':
        return sorted.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      case 'lowest':
        return sorted.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
      default:
        return sorted;
    }
  },

  // === Rendering ===
  renderTransactions() {
    const container = document.getElementById('transactionList');
    if (!container) return;

    const { filteredTransactions, currentPage, itemsPerPage } = this.state;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageTransactions = filteredTransactions.slice(startIndex, endIndex);

    if (pageTransactions.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-12); text-align: center;">
          <img src="../assets/images/icon-search.svg" alt="" style="width: 3rem; height: 3rem; opacity: 0.3; margin-bottom: var(--space-4);">
          <p style="font-size: var(--text-lg); font-weight: var(--font-medium); color: var(--text-primary); margin-bottom: var(--space-2);">
            No transactions found
          </p>
          <p class="text-gray" style="font-size: var(--text-sm);">
            ${this.state.searchQuery
              ? `No results for "${this.state.searchQuery}"`
              : 'No transactions match the selected filters'}
          </p>
        </div>
      `;
      return;
    }

    let html = '';
    pageTransactions.forEach((transaction, index) => {
      const isPositive = transaction.amount > 0;
      const categoryColor = Utils.getCategoryColor(transaction.category);

      html += `
        <div class="transaction-row"
             role="listitem"
             tabindex="0"
             style="
               display: grid;
               grid-template-columns: 2fr 1fr 1fr 1fr;
               gap: var(--space-4);
               padding: var(--space-4);
               border-bottom: 1px solid var(--border-light);
               align-items: center;
               transition: background-color var(--transition-fast);
             "
             onmouseover="this.style.backgroundColor='var(--bg-beige)'"
             onmouseout="this.style.backgroundColor='transparent'"
        >
          <!-- Recipient/Sender -->
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <img
              src="${transaction.avatar}"
              alt=""
              style="width: 2.5rem; height: 2.5rem; border-radius: 50%; object-fit: cover;"
              onerror="this.src='../assets/images/avatars/emma-richardson.jpg'"
            >
            <span style="font-weight: var(--font-medium); color: var(--text-primary);">
              ${transaction.name}
            </span>
          </div>

          <!-- Category -->
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <span style="
              width: 0.5rem;
              height: 0.5rem;
              border-radius: 50%;
              background-color: ${categoryColor};
            "></span>
            <span style="font-size: var(--text-sm); color: var(--text-secondary);">
              ${transaction.category}
            </span>
          </div>

          <!-- Date -->
          <span style="font-size: var(--text-sm); color: var(--text-secondary);">
            ${Utils.formatDate(transaction.date)}
          </span>

          <!-- Amount -->
          <span style="
            font-weight: var(--font-bold);
            text-align: right;
            color: ${isPositive ? 'var(--color-green)' : 'var(--text-primary)'};
          ">
            ${isPositive ? '+' : '-'}${Utils.formatCurrency(Math.abs(transaction.amount))}
          </span>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;

    const { currentPage, totalPages } = this.state;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';

    // Previous button
    html += `
      <button
        class="pagination-btn"
        ${currentPage === 1 ? 'disabled' : ''}
        onclick="TransactionsPage.goToPage(${currentPage - 1})"
        aria-label="Previous page"
        ${currentPage === 1 ? 'aria-disabled="true"' : ''}
      >
        <img src="../assets/images/icon-caret-left.svg" alt="" style="width: 1rem; height: 1rem;">
      </button>
    `;

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      html += `
        <button class="pagination-btn" onclick="TransactionsPage.goToPage(1)" aria-label="Page 1">1</button>
      `;
      if (startPage > 2) {
        html += `<span style="padding: 0 var(--space-2); color: var(--text-secondary);">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `
        <button
          class="pagination-btn ${i === currentPage ? 'active' : ''}"
          onclick="TransactionsPage.goToPage(${i})"
          aria-label="Page ${i}"
          ${i === currentPage ? 'aria-current="page"' : ''}
        >
          ${i}
        </button>
      `;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += `<span style="padding: 0 var(--space-2); color: var(--text-secondary);">...</span>`;
      }
      html += `
        <button class="pagination-btn" onclick="TransactionsPage.goToPage(${totalPages})" aria-label="Page ${totalPages}">${totalPages}</button>
      `;
    }

    // Next button
    html += `
      <button
        class="pagination-btn"
        ${currentPage === totalPages ? 'disabled' : ''}
        onclick="TransactionsPage.goToPage(${currentPage + 1})"
        aria-label="Next page"
        ${currentPage === totalPages ? 'aria-disabled="true"' : ''}
      >
        <img src="../assets/images/icon-caret-right.svg" alt="" style="width: 1rem; height: 1rem;">
      </button>
    `;

    container.innerHTML = html;
  },

  updatePaginationInfo() {
    const infoEl = document.getElementById('paginationInfo');
    if (!infoEl) return;

    const { filteredTransactions, currentPage, itemsPerPage } = this.state;
    const total = filteredTransactions.length;
    const start = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, total);

    infoEl.textContent = `Showing ${start}-${end} of ${total} transaction${total !== 1 ? 's' : ''}`;
  },

  // === Pagination Navigation ===
  goToPage(page) {
    if (page < 1 || page > this.state.totalPages) return;

    this.state.currentPage = page;
    this.renderTransactions();
    this.renderPagination();
    this.updatePaginationInfo();

    // Scroll to top of list
    const container = document.getElementById('transactionList');
    container?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Announce to screen readers
    this.announcePageChange();
  },

  announcePageChange() {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `Page ${this.state.currentPage} of ${this.state.totalPages}`;
    document.body.appendChild(announcement);

    setTimeout(() => announcement.remove(), 1000);
  },

  // === Error Handling ===
  showError(message) {
    const container = document.getElementById('transactionList');
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
  TransactionsPage.init();
});

// Export for onclick handlers
window.TransactionsPage = TransactionsPage;
