/* ============================================
   Personal Finance App - Pots Page
   ============================================ */

const PotsPage = {
  // Available themes
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
    pots: [],
    balance: { current: 0, income: 0, expenses: 0 },
    isLoading: true,
    selectedTheme: '#277C78',
    editingPotId: null,
    currentBalance: 0
  },

  async init() {
    console.log('Initializing Pots Page...');

    this.setupSidebar();

    this.setupModals();

    this.setupForms();

    this.renderThemeSelector();

    await this.loadPots();

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

  // === Modal Setup ===
  setupModals() {
    // Add Pot button
    document.getElementById('addPotBtn')?.addEventListener('click', () => this.openAddModal());

    // Close modals
    const closeModalBtns = [
      { id: 'closePotModal', modal: 'potModal' },
      { id: 'closeAddModal', modal: 'addMoneyModal' },
      { id: 'closeWithdrawModal', modal: 'withdrawModal' },
      { id: 'closeDeletePotModal', modal: 'deletePotModal' }
    ];

    closeModalBtns.forEach(({ id, modal }) => {
      document.getElementById(id)?.addEventListener('click', () => this.closeModal(modal));
    });

    // Cancel buttons
    document.getElementById('cancelPotBtn')?.addEventListener('click', () => this.closeModal('potModal'));
    document.getElementById('cancelAddBtn')?.addEventListener('click', () => this.closeModal('addMoneyModal'));
    document.getElementById('cancelWithdrawBtn')?.addEventListener('click', () => this.closeModal('withdrawModal'));
    document.getElementById('cancelDeletePotBtn')?.addEventListener('click', () => this.closeModal('deletePotModal'));

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
        ['potModal', 'addMoneyModal', 'withdrawModal', 'deletePotModal'].forEach(modal => {
          this.closeModal(modal);
        });
      }
    });

    // Confirm buttons
    document.getElementById('confirmAddBtn')?.addEventListener('click', () => this.confirmAdd());
    document.getElementById('confirmWithdrawBtn')?.addEventListener('click', () => this.confirmWithdraw());
    document.getElementById('confirmDeletePotBtn')?.addEventListener('click', () => this.confirmDelete());
  },

  // === Form Setup ===
  setupForms() {
    const form = document.getElementById('potForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePot();
    });

    // Amount input handlers for real-time preview
    document.getElementById('amountToAdd')?.addEventListener('input', (e) => {
      this.updateAddPreview(parseFloat(e.target.value) || 0);
    });

    document.getElementById('amountToWithdraw')?.addEventListener('input', (e) => {
      this.updateWithdrawPreview(parseFloat(e.target.value) || 0);
    });
  },

  // === Theme Selector ===
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

    // Add click handlers
    selector.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        selector.querySelectorAll('.theme-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        this.state.selectedTheme = option.dataset.color;
      });
    });
  },

  // === Data Loading ===
  async loadPots() {
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

      this.state.pots = data.pots || [];
      this.state.balance = data.balance || { current: 0, income: 0, expenses: 0 };
      this.state.currentBalance = this.state.balance.current;

      // Render
      this.renderTotalSaved();
      this.renderPots();

    } catch (error) {
      console.error('Failed to load pots:', error);
      this.showError('Failed to load pots. Please refresh the page.');
    } finally {
      this.state.isLoading = false;
    }
  },

  async loadLocalData() {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('Failed to load local data');
    return await response.json();
  },

  // === Rendering ===
  renderTotalSaved() {
    const total = this.state.pots.reduce((sum, pot) => sum + pot.total, 0);
    const totalEl = document.getElementById('totalSaved');
    if (totalEl) {
      totalEl.textContent = Utils.formatCurrency(total);
    }
  },

  renderPots() {
    const container = document.getElementById('potsGrid');
    if (!container) return;

    if (this.state.pots.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: var(--space-12); text-align: center;">
          <img src="assets/images/icon-pot.svg" alt="" style="width: 3rem; height: 3rem; opacity: 0.3; margin-bottom: var(--space-4);">
          <p style="font-size: var(--text-lg); font-weight: var(--font-medium); color: var(--text-primary); margin-bottom: var(--space-2);">
            No pots yet
          </p>
          <p class="text-gray" style="font-size: var(--text-sm); margin-bottom: var(--space-6);">
            Create your first pot to start saving for your goals.
          </p>
          <button class="btn btn-primary" onclick="PotsPage.openAddModal()">+ Add New Pot</button>
        </div>
      `;
      return;
    }

    let html = '';

    // Pot cards
    this.state.pots.forEach((pot, index) => {
      const percentage = pot.target > 0 ? Math.round((pot.total / pot.target) * 100) : 0;
      const themeColor = pot.theme || '#277C78'; // Default to green if theme missing

      html += `
        <div class="pot-card" data-pot-id="${index}">
          <div class="pot-header">
            <div class="pot-name-section">
              <div class="pot-color" style="background-color: ${themeColor};"></div>
              <span class="pot-name">${pot.name}</span>
            </div>
            <button class="pot-menu-btn" onclick="PotsPage.toggleMenu(${index})" aria-label="Pot options">
              <img src="assets/images/icon-ellipsis.svg" alt="">
            </button>
            <div class="pot-menu" id="menu-${index}">
              <button class="pot-menu-item" onclick="PotsPage.openEditModal(${index})">Edit</button>
              <button class="pot-menu-item delete" onclick="PotsPage.openDeleteModal(${index})">Delete</button>
            </div>
          </div>

          <div class="pot-amounts">
            <span class="pot-saved">${Utils.formatCurrency(pot.total)}</span>
            <span class="pot-target">of ${Utils.formatCurrency(pot.target)} target</span>
          </div>

          <div class="pot-progress">
            <div class="progress-bar" style="height: 0.75rem; background-color: var(--bg-beige);">
              <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%; background-color: ${themeColor};"></div>
            </div>
            <div class="pot-percentage" style="color: ${themeColor};">${percentage}%</div>
          </div>

          <div class="pot-actions">
            <button class="pot-action-btn add" onclick="PotsPage.openAddMoneyModal(${index})">
              + Add Money
            </button>
            <button class="pot-action-btn withdraw" onclick="PotsPage.openWithdrawModal(${index})">
              Withdraw
            </button>
          </div>
        </div>
      `;
    });

    // Add pot button
    html += `
      <button class="add-pot-btn" onclick="PotsPage.openAddModal()">
        <span>+ Add New Pot</span>
      </button>
    `;

    container.innerHTML = html;
  },

  // === Menu Toggle ===
  toggleMenu(index) {
    // Close all other menus
    document.querySelectorAll('.pot-menu').forEach((menu, i) => {
      if (i !== index) menu.classList.remove('active');
    });

    // Toggle this menu
    const menu = document.getElementById(`menu-${index}`);
    menu?.classList.toggle('active');
  },

  // === Modal Operations ===
  openAddModal() {
    this.state.editingPotId = null;
    this.state.selectedTheme = '#277C78';

    document.getElementById('potModalTitle').textContent = 'Add New Pot';
    document.getElementById('submitPotBtn').textContent = 'Add Pot';
    document.getElementById('potName').value = '';
    document.getElementById('potTarget').value = '';
    document.getElementById('editPotId').value = '';

    // Reset theme selection
    document.querySelectorAll('#themeSelector .theme-option').forEach((o, i) => {
      o.classList.toggle('selected', i === 0);
    });

    this.openModal('potModal');
  },

  openEditModal(index) {
    const pot = this.state.pots[index];
    if (!pot) return;

    this.state.editingPotId = index;
    this.state.selectedTheme = pot.theme;

    document.getElementById('potModalTitle').textContent = 'Edit Pot';
    document.getElementById('submitPotBtn').textContent = 'Save Changes';
    document.getElementById('potName').value = pot.name;
    document.getElementById('potTarget').value = pot.target;
    document.getElementById('editPotId').value = index;

    // Update theme selection
    document.querySelectorAll('#themeSelector .theme-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.color === pot.theme);
    });

    // Close menu
    document.getElementById(`menu-${index}`)?.classList.remove('active');

    this.openModal('potModal');
  },

  openAddMoneyModal(index) {
    const pot = this.state.pots[index];
    if (!pot) return;

    document.getElementById('addMoneyTitle').textContent = `Add to '${pot.name}'`;
    document.getElementById('addPotId').value = pot.id;
    document.getElementById('addPotIndex').value = index;
    document.getElementById('amountToAdd').value = '';
    document.getElementById('addTargetAmount').textContent = Utils.formatCurrency(pot.target);
    document.getElementById('availableBalance').textContent = Utils.formatCurrency(this.state.currentBalance);

    // Set initial preview
    this.updateAddPreview(0);

    // Close menu
    document.getElementById(`menu-${index}`)?.classList.remove('active');

    this.openModal('addMoneyModal');
  },

  openWithdrawModal(index) {
    const pot = this.state.pots[index];
    if (!pot) return;

    document.getElementById('withdrawTitle').textContent = `Withdraw from '${pot.name}'`;
    document.getElementById('withdrawPotId').value = pot.id;
    document.getElementById('withdrawPotIndex').value = index;
    document.getElementById('amountToWithdraw').value = '';
    document.getElementById('withdrawTargetAmount').textContent = Utils.formatCurrency(pot.target);
    document.getElementById('potBalance').textContent = Utils.formatCurrency(pot.total);

    // Set initial preview
    this.updateWithdrawPreview(0);

    // Close menu
    document.getElementById(`menu-${index}`)?.classList.remove('active');

    this.openModal('withdrawModal');
  },

  openDeleteModal(index) {
    const pot = this.state.pots[index];
    if (!pot) return;

    document.getElementById('deletePotName').textContent = pot.name;
    document.getElementById('returnAmount').textContent = pot.total.toFixed(2);
    document.getElementById('deletePotId').value = pot.id;
    document.getElementById('deletePotIndex').value = index;

    // Close menu
    document.getElementById(`menu-${index}`)?.classList.remove('active');

    this.openModal('deletePotModal');
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Focus first input
      const firstInput = modal.querySelector('input:not([type="hidden"])');
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

  // === Preview Updates ===
  updateAddPreview(amount) {
    const potIndex = parseInt(document.getElementById('addPotIndex').value);
    const pot = this.state.pots[potIndex];
    if (!pot) return;

    const newTotal = pot.total + amount;
    document.getElementById('addPreviewAmount').textContent = Utils.formatCurrency(newTotal);
  },

  updateWithdrawPreview(amount) {
    const potIndex = parseInt(document.getElementById('withdrawPotIndex').value);
    const pot = this.state.pots[potIndex];
    if (!pot) return;

    const newTotal = pot.total - amount;
    document.getElementById('withdrawPreviewAmount').textContent = Utils.formatCurrency(Math.max(0, newTotal));
  },

  // === CRUD Operations ===
  async savePot() {
    const name = document.getElementById('potName').value.trim();
    const target = parseFloat(document.getElementById('potTarget').value);
    const editId = document.getElementById('editPotId').value;

    // Validation
    if (!name) {
      alert('Please enter a pot name');
      return;
    }

    if (!target || target <= 0) {
      alert('Please enter a valid target amount');
      return;
    }

    const potData = {
      name,
      target,
      theme: this.state.selectedTheme,
      total: 0
    };

    try {
      if (editId !== '') {
        // Update existing pot - preserve the total
        potData.total = this.state.pots[parseInt(editId)].total;
        await API.updatePot(parseInt(editId), potData);
        this.state.pots[parseInt(editId)] = potData;
      } else {
        // Create new pot
        await API.createPot(potData);
        this.state.pots.push(potData);
      }

      this.closeModal('potModal');
      this.renderTotalSaved();
      this.renderPots();

    } catch (error) {
      console.error('Failed to save pot:', error);
      alert('Failed to save pot. Please try again.');
    }
  },

  async confirmAdd() {
    const potId = parseInt(document.getElementById('addPotId').value);
    const potIndex = parseInt(document.getElementById('addPotIndex').value);
    const amount = parseFloat(document.getElementById('amountToAdd').value);

    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (amount > this.state.currentBalance) {
      alert('Insufficient balance');
      return;
    }

    try {
      const result = await API.addToPot(potId, amount);
      this.state.pots[potIndex].total += amount;
      this.state.currentBalance = result.balance;
      this.state.balance.current = result.balance;

      this.closeModal('addMoneyModal');
      this.renderTotalSaved();
      this.renderPots();

    } catch (error) {
      console.error('Failed to add money:', error);
      alert(error.message || 'Failed to add money. Please try again.');
    }
  },

  async confirmWithdraw() {
    const potId = parseInt(document.getElementById('withdrawPotId').value);
    const potIndex = parseInt(document.getElementById('withdrawPotIndex').value);
    const amount = parseFloat(document.getElementById('amountToWithdraw').value);
    const pot = this.state.pots[potIndex];

    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (amount > pot.total) {
      alert('Insufficient funds in pot');
      return;
    }

    try {
      const result = await API.withdrawFromPot(potId, amount);
      this.state.pots[potIndex].total -= amount;
      this.state.currentBalance = result.balance;
      this.state.balance.current = result.balance;

      this.closeModal('withdrawModal');
      this.renderTotalSaved();
      this.renderPots();

    } catch (error) {
      console.error('Failed to withdraw money:', error);
      alert(error.message || 'Failed to withdraw money. Please try again.');
    }
  },

  async confirmDelete() {
    const deleteId = document.getElementById('deletePotId').value;
    const deleteIndex = document.getElementById('deletePotIndex').value;
    if (deleteId === '') return;

    try {
      const result = await API.deletePot(parseInt(deleteId));
      this.state.pots.splice(parseInt(deleteIndex), 1);
      this.state.currentBalance = result.newBalance;
      this.state.balance.current = result.newBalance;

      this.closeModal('deletePotModal');
      this.renderTotalSaved();
      this.renderPots();

    } catch (error) {
      console.error('Failed to delete pot:', error);
      alert('Failed to delete pot. Please try again.');
    }
  },

  // === Error Handling ===
  showError(message) {
    const container = document.getElementById('potsGrid');
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  PotsPage.init();
});

// Export for onclick handlers
window.PotsPage = PotsPage;

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.pot-menu') && !e.target.closest('.pot-menu-btn')) {
    document.querySelectorAll('.pot-menu').forEach(menu => menu.classList.remove('active'));
  }
});
