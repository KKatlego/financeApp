/* ============================================
   Personal Finance App - Budgets Page
   ============================================ */

const BudgetsPage = {
  // Available categories and themes
  categories: [
    { name: 'Entertainment', color: '#277C78' },
    { name: 'Bills', color: '#82C9D7' },
    { name: 'Groceries', color: '#C94736' },
    { name: 'Dining Out', color: '#F2CDAC' },
    { name: 'Transportation', color: '#D19900' },
    { name: 'Personal Care', color: '#626070' },
    { name: 'Education', color: '#826CB0' },
    { name: 'Lifestyle', color: '#008C76' },
    { name: 'Shopping', color: '#E2B93D' },
    { name: 'General', color: '#647484' }
  ],

  themes: [
    { name: 'Green', color: '#277C78', class: 'theme-green' },
    { name: 'Cyan', color: '#82C9D7', class: 'theme-cyan' },
    { name: 'Yellow', color: '#D19900', class: 'theme-yellow' },
    { name: 'Navy', color: '#626070', class: 'theme-navy' },
    { name: 'Red', color: '#C94736', class: 'theme-red' },
    { name: 'Purple', color: '#826CB0', class: 'theme-purple' },
    { name: 'Turquoise', color: '#008C76', class: 'theme-turquoise' },
    { name: 'Brown', color: '#93674F', class: 'theme-brown' },
    { name: 'Magenta', color: '#AF81CD', class: 'theme-magenta' },
    { name: 'Blue', color: '#647484', class: 'theme-blue' }
  ],

  // State
  state: {
    budgets: [],
    transactions: [],
    isLoading: true,
    selectedCategory: '',
    selectedTheme: '#277C78',
    editingBudgetId: null
  },

  // === Initialization ===
  async init() {
    console.log('Initializing Budgets Page...');

    // Setup sidebar
    this.setupSidebar();

    // Setup modals
    this.setupModals();

    // Setup form
    this.setupForm();

    // Render category and theme selectors
    this.renderCategorySelector();
    this.renderThemeSelector();

    // Load data
    await this.loadBudgets();

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

  // === Modal Setup ===
  setupModals() {
    // Add Budget button
    const addBtn = document.getElementById('addBudgetBtn');
    addBtn?.addEventListener('click', () => this.openAddModal());

    // Close modals
    document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal('budgetModal'));
    document.getElementById('closeDeleteModal')?.addEventListener('click', () => this.closeModal('deleteModal'));
    document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeModal('budgetModal'));
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.closeModal('deleteModal'));

    // Click outside to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModal(overlay.id);
        }
      });
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal('budgetModal');
        this.closeModal('deleteModal');
      }
    });

    // Delete confirmation
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.confirmDelete());
  },

  // === Form Setup ===
  setupForm() {
    const form = document.getElementById('budgetForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveBudget();
    });
  },

  // === Category & Theme Selectors ===
  renderCategorySelector() {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;

    // Get existing budget categories
    const existingCategories = this.state.budgets.map(b => b.category);

    grid.innerHTML = this.categories.map(cat => `
      <label class="category-option ${existingCategories.includes(cat.name) ? 'disabled' : ''}"
             data-category="${cat.name}"
             ${existingCategories.includes(cat.name) ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
        <input type="radio" name="category" value="${cat.name}" ${this.state.selectedCategory === cat.name ? 'checked' : ''}>
        <span class="category-dot" style="background-color: ${cat.color};"></span>
        <span>${cat.name}</span>
      </label>
    `).join('');

    // Add click handlers
    grid.querySelectorAll('.category-option:not(.disabled)').forEach(option => {
      option.addEventListener('click', () => {
        grid.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.state.selectedCategory = option.dataset.category;
      });
    });
  },

  renderThemeSelector() {
    const selector = document.getElementById('themeSelector');
    if (!selector) return;

    selector.innerHTML = this.themes.map((theme, index) => `
      <button type="button"
              class="theme-option ${index === 0 ? 'selected' : ''}"
              data-color="${theme.color}"
              style="background-color: ${theme.color};"
              aria-label="Select ${theme.name} theme">
      </button>
    `).join('');

    selector.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        selector.querySelectorAll('.theme-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.state.selectedTheme = option.dataset.color;
      });
    });
  },

  // === Data Loading ===
  async loadBudgets() {
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

      this.state.transactions = data.transactions || [];
      this.state.budgets = data.budgets || [];

      // Render budgets
      this.renderBudgets();

      // Update category selector
      this.renderCategorySelector();

    } catch (error) {
      console.error('Failed to load budgets:', error);
      this.showError('Failed to load budgets. Please refresh the page.');
    } finally {
      this.state.isLoading = false;
    }
  },

  async loadLocalData() {
    const response = await fetch('../data.json');
    if (!response.ok) throw new Error('Failed to load local data');
    return await response.json();
  },

  // === Rendering ===
  renderBudgets() {
    const container = document.getElementById('budgetsGrid');
    if (!container) return;

    if (this.state.budgets.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: var(--space-12); text-align: center;">
          <img src="../assets/images/icon-nav-budgets.svg" alt="" style="width: 3rem; height: 3rem; opacity: 0.3; margin-bottom: var(--space-4);">
          <p style="font-size: var(--text-lg); font-weight: var(--font-medium); color: var(--text-primary); margin-bottom: var(--space-2);">
            No budgets yet
          </p>
          <p class="text-gray" style="font-size: var(--text-sm); margin-bottom: var(--space-6);">
            Create your first budget to start tracking your spending.
          </p>
          <button class="btn btn-primary" onclick="BudgetsPage.openAddModal()">+ Add New Budget</button>
        </div>
      `;
      return;
    }

    const augustSpending = this.calculateSpending();

    const latestTransactions = this.getLatestTransactions();

    let html = '';

    // Budget cards
    this.state.budgets.forEach((budget, index) => {
      const spent = augustSpending[budget.category] || 0;
      const percentage = budget.maximum > 0 ? Math.round((spent / budget.maximum) * 100) : 0;
      const latest = latestTransactions[budget.category] || [];

      html += `
        <div class="budget-card" data-budget-id="${index}">
          <div class="budget-header">
            <div class="budget-category">
              <div class="budget-color" style="background-color: ${budget.theme};"></div>
              <span class="budget-name">${budget.category}</span>
            </div>
            <button class="budget-menu-btn" onclick="BudgetsPage.toggleMenu(${index})" aria-label="Budget options">
              <img src="../assets/images/icon-ellipsis.svg" alt="">
            </button>
            <div class="budget-menu" id="menu-${index}">
              <button class="budget-menu-item" onclick="BudgetsPage.openEditModal(${index})">Edit</button>
              <button class="budget-menu-item delete" onclick="BudgetsPage.openDeleteModal(${index})">Delete</button>
            </div>
          </div>

          <div class="budget-amounts">
            <span class="budget-spent">${Utils.formatCurrency(spent)}</span>
            <span class="budget-maximum">of ${Utils.formatCurrency(budget.maximum)} limit</span>
          </div>

          <div class="budget-progress">
            <div class="progress-bar" style="height: 0.5rem; background-color: var(--bg-beige);">
              <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%; background-color: ${budget.theme};"></div>
            </div>
          </div>

          ${latest.length > 0 ? `
            <div class="budget-latest">
              <div class="budget-latest-header">
                <span class="budget-latest-title">Latest Spending</span>
                <a href="transactions.html?category=${encodeURIComponent(budget.category)}"
                   class="budget-latest-link">
                  See All
                  <img src="../assets/images/icon-caret-right.svg" alt="" style="width: 0.75rem; height: 0.75rem;">
                </a>
              </div>
              ${latest.slice(0, 3).map(t => `
                <div class="latest-transaction">
                  <span class="latest-transaction-name">${t.name}</span>
                  <span class="latest-transaction-amount ${t.amount < 0 ? '' : 'text-green'}">
                    ${t.amount < 0 ? '-' : '+'}${Utils.formatCurrency(Math.abs(t.amount))}
                  </span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });

    // Add budget button
    html += `
      <button class="add-budget-btn" onclick="BudgetsPage.openAddModal()">
        <span>+ Add New Budget</span>
      </button>
    `;

    container.innerHTML = html;
  },

  // === Spending Calculation ===
  calculateSpending() {
    const spending = {};

    this.state.transactions
      .filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === 7 && date.getFullYear() === 2024 && t.amount < 0;
      })
      .forEach(t => {
        if (!spending[t.category]) spending[t.category] = 0;
        spending[t.category] += Math.abs(t.amount);
      });

    return spending;
  },

  getLatestTransactions() {
    const latest = {};
    const categories = [...new Set(this.state.transactions.map(t => t.category))];

    categories.forEach(category => {
      latest[category] = this.state.transactions
        .filter(t => t.category === category)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
    });

    return latest;
  },

  // === Menu Toggle ===
  toggleMenu(index) {
    // Close all other menus
    document.querySelectorAll('.budget-menu').forEach((menu, i) => {
      if (i !== index) menu.classList.remove('active');
    });

    // Toggle this menu
    const menu = document.getElementById(`menu-${index}`);
    menu?.classList.toggle('active');
  },

  // === Modal Operations ===
  openAddModal() {
    this.state.editingBudgetId = null;
    this.state.selectedCategory = '';
    this.state.selectedTheme = '#277C78';

    document.getElementById('modalTitle').textContent = 'Add New Budget';
    document.getElementById('submitBtn').textContent = 'Add Budget';
    document.getElementById('maximumSpend').value = '';
    document.getElementById('editBudgetId').value = '';

    // Reset category selection
    this.renderCategorySelector();

    // Reset theme selection
    document.querySelectorAll('.theme-option').forEach((o, i) => {
      o.classList.toggle('selected', i === 0);
    });

    this.openModal('budgetModal');
  },

  openEditModal(index) {
    const budget = this.state.budgets[index];
    if (!budget) return;

    this.state.editingBudgetId = index;
    this.state.selectedCategory = budget.category;
    this.state.selectedTheme = budget.theme;

    document.getElementById('modalTitle').textContent = 'Edit Budget';
    document.getElementById('submitBtn').textContent = 'Save Changes';
    document.getElementById('maximumSpend').value = budget.maximum;
    document.getElementById('editBudgetId').value = index;

    // Update category selection - for edit, allow selecting the current category
    this.renderCategorySelectorForEdit(budget.category);

    // Update theme selection
    document.querySelectorAll('.theme-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.color === budget.theme);
    });

    // Close menu
    document.getElementById(`menu-${index}`)?.classList.remove('active');

    this.openModal('budgetModal');
  },

  renderCategorySelectorForEdit(currentCategory) {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;

    const existingCategories = this.state.budgets
      .filter(b => b.category !== currentCategory)
      .map(b => b.category);

    grid.innerHTML = this.categories.map(cat => {
      const isExisting = existingCategories.includes(cat.name);
      const isCurrent = cat.name === currentCategory;

      return `
        <label class="category-option ${isCurrent ? 'selected' : ''} ${isExisting ? 'disabled' : ''}"
               data-category="${cat.name}"
               ${isExisting ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          <input type="radio" name="category" value="${cat.name}" ${isCurrent ? 'checked' : ''}>
          <span class="category-dot" style="background-color: ${cat.color};"></span>
          <span>${cat.name}</span>
        </label>
      `;
    }).join('');

    // Add click handlers
    grid.querySelectorAll('.category-option:not(.disabled)').forEach(option => {
      option.addEventListener('click', () => {
        grid.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.state.selectedCategory = option.dataset.category;
      });
    });
  },

  openDeleteModal(index) {
    const budget = this.state.budgets[index];
    if (!budget) return;

    document.getElementById('deleteBudgetName').textContent = budget.category;
    document.getElementById('deleteBudgetId').value = budget.id;
    document.getElementById('deleteBudgetIndex').value = index;

    // Close menu
    document.getElementById(`menu-${index}`)?.classList.remove('active');

    this.openModal('deleteModal');
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Focus first input
      const firstInput = modal.querySelector('input:not([type="hidden"]), button');
      firstInput?.focus();
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  },

  // === CRUD Operations ===
  async saveBudget() {
    const maximumSpend = parseFloat(document.getElementById('maximumSpend').value);
    const editId = document.getElementById('editBudgetId').value;

    // Validation
    if (!this.state.selectedCategory) {
      alert('Please select a category');
      return;
    }

    if (!maximumSpend || maximumSpend <= 0) {
      alert('Please enter a valid maximum spend amount');
      return;
    }

    const budgetData = {
      category: this.state.selectedCategory,
      maximum: maximumSpend,
      theme: this.state.selectedTheme
    };

    try {
      if (editId !== '') {
        // Update existing budget
        await API.updateBudget(parseInt(editId), budgetData);
        this.state.budgets[parseInt(editId)] = budgetData;
      } else {
        // Create new budget
        await API.createBudget(budgetData);
        this.state.budgets.push(budgetData);
      }

      this.closeModal('budgetModal');
      this.renderBudgets();
      this.renderCategorySelector();

    } catch (error) {
      console.error('Failed to save budget:', error);
      alert('Failed to save budget. Please try again.');
    }
  },

  async confirmDelete() {
    const deleteId = document.getElementById('deleteBudgetId').value;
    const deleteIndex = document.getElementById('deleteBudgetIndex').value;
    if (deleteId === '') return;

    try {
      await API.deleteBudget(parseInt(deleteId));
      this.state.budgets.splice(parseInt(deleteIndex), 1);

      this.closeModal('deleteModal');
      this.renderBudgets();
      this.renderCategorySelector();

    } catch (error) {
      console.error('Failed to delete budget:', error);
      alert('Failed to delete budget. Please try again.');
    }
  },

  // === Error Handling ===
  showError(message) {
    const container = document.getElementById('budgetsGrid');
    if (container) {
      container.innerHTML = `
        <div class="error-state" style="grid-column: 1 / -1; padding: var(--space-8); text-align: center;">
          <p style="color: var(--color-red); margin-bottom: var(--space-4);">${message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  BudgetsPage.init();
});

window.BudgetsPage = BudgetsPage;

document.addEventListener('click', (e) => {
  if (!e.target.closest('.budget-menu') && !e.target.closest('.budget-menu-btn')) {
    document.querySelectorAll('.budget-menu').forEach(menu => menu.classList.remove('active'));
  }
});
