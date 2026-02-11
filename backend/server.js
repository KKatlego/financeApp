const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Load initial data from JSON file
let financeData = {};

function loadData() {
  try {
    const dataPath = path.join(__dirname, 'data', 'data.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    financeData = JSON.parse(rawData);
    console.log('Data loaded successfully');
  } catch (error) {
    console.error('Error loading data:', error);
    // Initialize with empty data if file not found
    financeData = {
      balance: { current: 0, income: 0, expenses: 0 },
      transactions: [],
      budgets: [],
      pots: []
    };
  }
}

function saveData() {
  try {
    const dataPath = path.join(__dirname, 'data', 'data.json');
    fs.writeFileSync(dataPath, JSON.stringify(financeData, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
}

// Load data on startup
loadData();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// === API Endpoints ===

// Get all data (for initial load)
app.get('/api/data', (req, res) => {
  res.json(financeData);
});

// === Balance Endpoints ===
app.get('/api/balance', (req, res) => {
  res.json(financeData.balance);
});

app.put('/api/balance', (req, res) => {
  const { current, income, expenses } = req.body;

  if (current !== undefined) financeData.balance.current = current;
  if (income !== undefined) financeData.balance.income = income;
  if (expenses !== undefined) financeData.balance.expenses = expenses;

  saveData();
  res.json(financeData.balance);
});

// === Transactions Endpoints ===
app.get('/api/transactions', (req, res) => {
  let transactions = [...financeData.transactions];

  // Filter by category
  if (req.query.category && req.query.category !== 'All Transactions') {
    transactions = transactions.filter(t => t.category === req.query.category);
  }

  // Search by name
  if (req.query.search) {
    const searchTerm = req.query.search.toLowerCase();
    transactions = transactions.filter(t =>
      t.name.toLowerCase().includes(searchTerm)
    );
  }

  // Sort
  const sort = req.query.sort || 'latest';
  switch (sort) {
    case 'latest':
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
    case 'oldest':
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case 'a-z':
      transactions.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'z-a':
      transactions.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'highest':
      transactions.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      break;
    case 'lowest':
      transactions.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
      break;
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedTransactions = transactions.slice(startIndex, endIndex);

  res.json({
    data: paginatedTransactions,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(transactions.length / limit),
      totalItems: transactions.length,
      hasNext: endIndex < transactions.length,
      hasPrev: page > 1
    }
  });
});

app.get('/api/transactions/:id', (req, res) => {
  const index = parseInt(req.params.id);
  const transaction = financeData.transactions[index];

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  res.json({ ...transaction, id: index });
});

// === Budgets Endpoints ===
app.get('/api/budgets', (req, res) => {
  // Calculate spent amount for each budget (August 2024)
  const augustSpending = {};

  financeData.transactions
    .filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === 7 && date.getFullYear() === 2024 && t.amount < 0;
    })
    .forEach(t => {
      if (!augustSpending[t.category]) augustSpending[t.category] = 0;
      augustSpending[t.category] += Math.abs(t.amount);
    });

  // Get latest 3 transactions per category
  const latestTransactions = {};
  const categories = [...new Set(financeData.transactions.map(t => t.category))];

  categories.forEach(category => {
    latestTransactions[category] = financeData.transactions
      .filter(t => t.category === category)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
  });

  const budgetsWithSpending = financeData.budgets.map((budget, index) => ({
    id: index,
    ...budget,
    spent: augustSpending[budget.category] || 0,
    latestTransactions: latestTransactions[budget.category] || []
  }));

  res.json(budgetsWithSpending);
});

app.post('/api/budgets', (req, res) => {
  const { category, maximum, theme } = req.body;

  if (!category || !maximum || !theme) {
    return res.status(400).json({ error: 'Category, maximum, and theme are required' });
  }

  // Check if budget for this category already exists
  const existingIndex = financeData.budgets.findIndex(b => b.category === category);
  if (existingIndex !== -1) {
    return res.status(400).json({ error: 'Budget for this category already exists' });
  }

  const newBudget = { category, maximum: parseFloat(maximum), theme };
  financeData.budgets.push(newBudget);
  saveData();

  res.status(201).json({ id: financeData.budgets.length - 1, ...newBudget });
});

app.put('/api/budgets/:id', (req, res) => {
  const index = parseInt(req.params.id);

  if (index < 0 || index >= financeData.budgets.length) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  const { category, maximum, theme } = req.body;

  if (category !== undefined) financeData.budgets[index].category = category;
  if (maximum !== undefined) financeData.budgets[index].maximum = parseFloat(maximum);
  if (theme !== undefined) financeData.budgets[index].theme = theme;

  saveData();
  res.json({ id: index, ...financeData.budgets[index] });
});

app.delete('/api/budgets/:id', (req, res) => {
  const index = parseInt(req.params.id);

  if (index < 0 || index >= financeData.budgets.length) {
    return res.status(404).json({ error: 'Budget not found' });
  }

  financeData.budgets.splice(index, 1);
  saveData();

  res.json({ message: 'Budget deleted successfully' });
});

// === Pots Endpoints ===
app.get('/api/pots', (req, res) => {
  const potsWithProgress = financeData.pots.map((pot, index) => ({
    id: index,
    ...pot,
    percentage: pot.target > 0 ? Math.round((pot.total / pot.target) * 100) : 0
  }));

  res.json(potsWithProgress);
});

app.post('/api/pots', (req, res) => {
  const { name, target, total, theme } = req.body;

  if (!name || !target || !theme) {
    return res.status(400).json({ error: 'Name, target, and theme are required' });
  }

  const newPot = {
    name,
    target: parseFloat(target),
    total: parseFloat(total) || 0,
    theme
  };

  financeData.pots.push(newPot);
  saveData();

  res.status(201).json({ id: financeData.pots.length - 1, ...newPot });
});

app.put('/api/pots/:id', (req, res) => {
  const index = parseInt(req.params.id);

  if (index < 0 || index >= financeData.pots.length) {
    return res.status(404).json({ error: 'Pot not found' });
  }

  const { name, target, total, theme } = req.body;

  if (name !== undefined) financeData.pots[index].name = name;
  if (target !== undefined) financeData.pots[index].target = parseFloat(target);
  if (total !== undefined) financeData.pots[index].total = parseFloat(total);
  if (theme !== undefined) financeData.pots[index].theme = theme;

  saveData();
  res.json({ id: index, ...financeData.pots[index] });
});

app.delete('/api/pots/:id', (req, res) => {
  const index = parseInt(req.params.id);

  if (index < 0 || index >= financeData.pots.length) {
    return res.status(404).json({ error: 'Pot not found' });
  }

  // Return funds to balance before deleting
  const pot = financeData.pots[index];
  financeData.balance.current += pot.total;

  financeData.pots.splice(index, 1);
  saveData();

  res.json({
    message: 'Pot deleted successfully',
    returnedAmount: pot.total,
    newBalance: financeData.balance.current
  });
});

app.post('/api/pots/:id/add', (req, res) => {
  const index = parseInt(req.params.id);
  const { amount } = req.body;

  if (index < 0 || index >= financeData.pots.length) {
    return res.status(404).json({ error: 'Pot not found' });
  }

  const addAmount = parseFloat(amount);
  if (isNaN(addAmount) || addAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  if (addAmount > financeData.balance.current) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  financeData.pots[index].total += addAmount;
  financeData.balance.current -= addAmount;
  saveData();

  res.json({
    pot: { id: index, ...financeData.pots[index] },
    balance: financeData.balance.current
  });
});

app.post('/api/pots/:id/withdraw', (req, res) => {
  const index = parseInt(req.params.id);
  const { amount } = req.body;

  if (index < 0 || index >= financeData.pots.length) {
    return res.status(404).json({ error: 'Pot not found' });
  }

  const withdrawAmount = parseFloat(amount);
  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  if (withdrawAmount > financeData.pots[index].total) {
    return res.status(400).json({ error: 'Insufficient funds in pot' });
  }

  financeData.pots[index].total -= withdrawAmount;
  financeData.balance.current += withdrawAmount;
  saveData();

  res.json({
    pot: { id: index, ...financeData.pots[index] },
    balance: financeData.balance.current
  });
});

// === Recurring Bills Endpoints ===
app.get('/api/recurring-bills', (req, res) => {
  // Get unique recurring transactions
  const recurringMap = new Map();

  financeData.transactions
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

  // Reference date: latest transaction date (19 Aug 2024)
  const referenceDate = new Date('2024-08-19');

  let recurringBills = Array.from(recurringMap.values()).map((bill, index) => {
    const sortedDates = bill.dates.sort((a, b) => new Date(b) - new Date(a));
    const lastDate = new Date(sortedDates[0]);

    // Calculate next due date (assume monthly)
    const nextDue = new Date(lastDate);
    nextDue.setMonth(nextDue.getMonth() + 1);

    const isPaid = sortedDates.some(d => {
      const date = new Date(d);
      return date.getMonth() === 7 && date.getFullYear() === 2024;
    });

    const daysUntilDue = Math.ceil((nextDue - referenceDate) / (1000 * 60 * 60 * 24));
    const isDueSoon = !isPaid && daysUntilDue >= 0 && daysUntilDue <= 5;

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

  // Search by vendor name
  if (req.query.search) {
    const searchTerm = req.query.search.toLowerCase();
    recurringBills = recurringBills.filter(b =>
      b.name.toLowerCase().includes(searchTerm)
    );
  }

  // Sort
  const sort = req.query.sort || 'latest';
  switch (sort) {
    case 'latest':
      recurringBills.sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
      break;
    case 'oldest':
      recurringBills.sort((a, b) => new Date(a.lastDate) - new Date(b.lastDate));
      break;
    case 'a-z':
      recurringBills.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'z-a':
      recurringBills.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'highest':
      recurringBills.sort((a, b) => b.amount - a.amount);
      break;
    case 'lowest':
      recurringBills.sort((a, b) => a.amount - b.amount);
      break;
  }

  // Calculate summary
  const summary = {
    paid: recurringBills.filter(b => b.isPaid).reduce((sum, b) => sum + b.amount, 0),
    upcoming: recurringBills.filter(b => !b.isPaid).reduce((sum, b) => sum + b.amount, 0),
    dueSoon: recurringBills.filter(b => b.isDueSoon).reduce((sum, b) => sum + b.amount, 0)
  };

  res.json({
    data: recurringBills,
    summary
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Visit: http://localhost:${PORT}`);
});

// For cPanel deployment, export the app
module.exports = app;
