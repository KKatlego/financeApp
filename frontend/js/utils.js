/* ============================================
   Personal Finance App - Utility Functions
   ============================================ */

const Utils = {
  // === Currency Formatting ===
  formatCurrency(amount, showSign = false) {
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(absAmount);

    if (showSign && amount !== 0) {
      return amount > 0 ? `+${formatted}` : `-${formatted}`;
    }
    return amount < 0 ? `-${formatted}` : formatted;
  },

  // === Date Formatting ===
  formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  },

  formatDateShort(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  },

  // Get day difference from today
  getDaysDifference(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  // Check if date is within range
  isDateWithinDays(dateString, days) {
    const diff = this.getDaysDifference(dateString);
    return diff >= 0 && diff <= days;
  },

  // === Category Colors ===
  categoryColors: {
    'Entertainment': '#277C78',
    'Bills': '#82C9D7',
    'Groceries': '#C94736',
    'Dining Out': '#F2CDAC',
    'Transportation': '#D19900',
    'Personal Care': '#626070',
    'Education': '#826CB0',
    'Lifestyle': '#008C76',
    'Shopping': '#E2B93D',
    'General': '#647484'
  },

  getCategoryColor(category) {
    return this.categoryColors[category] || '#647484';
  },

  // === String Helpers ===
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  truncate(str, maxLength = 20) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  },

  // === Array Helpers ===
  sortByDate(arr, order = 'desc') {
    return [...arr].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return order === 'desc' ? dateB - dateA : dateA - dateB;
    });
  },

  sortByName(arr, order = 'asc') {
    return [...arr].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return order === 'asc' ? comparison : -comparison;
    });
  },

  sortByAmount(arr, order = 'desc') {
    return [...arr].sort((a, b) => {
      const absA = Math.abs(a.amount);
      const absB = Math.abs(b.amount);
      return order === 'desc' ? absB - absA : absA - absB;
    });
  },

  // === Pagination ===
  paginate(arr, page = 1, perPage = 10) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
      data: arr.slice(start, end),
      currentPage: page,
      totalPages: Math.ceil(arr.length / perPage),
      totalItems: arr.length,
      hasNext: end < arr.length,
      hasPrev: page > 1
    };
  },

  // === Search & Filter ===
  searchByKeyword(arr, keyword, fields = ['name']) {
    if (!keyword || keyword.trim() === '') return arr;
    const searchTerm = keyword.toLowerCase().trim();
    return arr.filter(item =>
      fields.some(field =>
        item[field]?.toLowerCase().includes(searchTerm)
      )
    );
  },

  filterByCategory(arr, category) {
    if (!category || category === 'All Transactions') return arr;
    return arr.filter(item => item.category === category);
  },

  // === Debounce ===
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // === DOM Helpers ===
  $(selector) {
    return document.querySelector(selector);
  },

  $$(selector) {
    return document.querySelectorAll(selector);
  },

  createElement(tag, className = '', innerHTML = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  },

  // === Event Helpers ===
  on(element, event, handler) {
    element?.addEventListener(event, handler);
  },

  delegate(parent, eventType, selector, handler) {
    parent.addEventListener(eventType, (e) => {
      const target = e.target.closest(selector);
      if (target && parent.contains(target)) {
        handler.call(target, e);
      }
    });
  },

  // === Modal Helpers ===
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      // Focus first focusable element
      const focusable = modal.querySelector('input, button, select, textarea');
      focusable?.focus();
    }
  },

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  },

  // === Storage Helpers ===
  saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      return false;
    }
  },

  loadFromStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
      return null;
    }
  },

  removeFromStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Failed to remove from localStorage:', e);
      return false;
    }
  },

  // === Validation ===
  isValidAmount(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  },

  isPositiveAmount(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  }
};

// Export for modules (if needed later)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
