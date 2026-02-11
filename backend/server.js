/* ============================================
   Personal Finance App - Server (MySQL + Auth)
   ============================================ */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ============================================
// Initialize Database Connection
// ============================================
async function initApp() {
  // Test database connection
  const dbConnected = await db.testConnection();

  if (!dbConnected) {
    console.error('❌ FATAL: Cannot connect to database. Exiting...');
    process.exit(1);
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Visit: http://localhost:${PORT}`);
  });
}

// ============================================
// Routes
// ============================================

// Home page - redirect to login if not authenticated
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Signup page
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/signup.html'));
});

// ============================================
// API: Authentication Routes (Public)
// ============================================

// Signup - Create new user
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Validate input
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create user
    const user = await auth.createUser({
      email,
      password,
      first_name,
      last_name
    });

    // Generate token
    const token = auth.generateToken(user);

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.message === 'Email already registered') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login - Authenticate user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await auth.authenticateUser(email, password);

    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error.message === 'Invalid email or password') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile (Protected)
app.get('/api/auth/me', auth.authenticateToken, async (req, res) => {
  try {
    const user = await auth.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// ============================================
// API: Get All Data (Protected)
// ============================================
app.get('/api/data', auth.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get balance
    const balance = await db.queryOne(
      'SELECT current, income, expenses FROM balance WHERE user_id = ?',
      [userId]
    );

    // Get transactions
    const transactions = await db.query(`
      SELECT id, avatar, name, category, date, amount, recurring
      FROM transactions
      WHERE user_id = ?
      ORDER BY date DESC
    `, [userId]);

    // Get budgets
    const budgets = await db.query(
      'SELECT id, category, maximum, theme FROM budgets WHERE user_id = ?',
      [userId]
    );

    // Get pots
    const pots = await db.query(
      'SELECT id, name, target, total, theme FROM pots WHERE user_id = ?',
      [userId]
    );

    // Format response
    const response = {
      balance: balance || { current: 0, income: 0, expenses: 0 },
      transactions: transactions.map(t => ({
        id: t.id,
        avatar: t.avatar,
        name: t.name,
        category: t.category,
        date: t.date.toISOString ? t.date.toISOString() : t.date,
        amount: parseFloat(t.amount),
        recurring: !!t.recurring
      })),
      budgets: budgets.map(b => ({
        id: b.id,
        category: b.category,
        maximum: parseFloat(b.maximum),
        theme: b.theme
      })),
      pots: pots.map(p => ({
        id: p.id,
        name: p.name,
        target: parseFloat(p.target),
        total: parseFloat(p.total),
        theme: p.theme
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data from database' });
  }
});

// ============================================
// API: Balance (Protected)
// ============================================
app.get('/api/balance', auth.authenticateToken, async (req, res) => {
  try {
    const balance = await db.queryOne(
      'SELECT current, income, expenses FROM balance WHERE user_id = ?',
      [req.user.id]
    );
    res.json(balance || { current: 0, income: 0, expenses: 0 });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

app.put('/api/balance', auth.authenticateToken, async (req, res) => {
  try {
    const { current, income, expenses } = req.body;

    await db.query(
      'UPDATE balance SET current = ?, income = ?, expenses = ? WHERE user_id = ?',
      [current, income, expenses, req.user.id]
    );

    const balance = await db.queryOne(
      'SELECT current, income, expenses FROM balance WHERE user_id = ?',
      [req.user.id]
    );
    res.json(balance);
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// ============================================
// API: Transactions (Protected)
// ============================================
app.get('/api/transactions', auth.authenticateToken, async (req, res) => {
  try {
    let sql = 'SELECT id, avatar, name, category, date, amount, recurring FROM transactions WHERE user_id = ?';
    const params = [req.user.id];

    // Filter by category
    if (req.query.category && req.query.category !== 'All Transactions') {
      sql += ' AND category = ?';
      params.push(req.query.category);
    }

    // Search by name
    if (req.query.search) {
      sql += ' AND name LIKE ?';
      params.push(`%${req.query.search}%`);
    }

    // Sort
    const sort = req.query.sort || 'latest';
    switch (sort) {
      case 'latest':
        sql += ' ORDER BY date DESC';
        break;
      case 'oldest':
        sql += ' ORDER BY date ASC';
        break;
      case 'a-z':
        sql += ' ORDER BY name ASC';
        break;
      case 'z-a':
        sql += ' ORDER BY name DESC';
        break;
      case 'highest':
        sql += ' ORDER BY ABS(amount) DESC';
        break;
      case 'lowest':
        sql += ' ORDER BY ABS(amount) ASC';
        break;
      default:
        sql += ' ORDER BY date DESC';
    }

    // Get total count first
    const countSql = sql.replace('SELECT id, avatar, name, category, date, amount, recurring', 'SELECT COUNT(*) as total');
    const countResult = await db.queryOne(countSql, params);
    const totalItems = countResult.total;

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const transactions = await db.query(sql, params);

    res.json({
      data: transactions.map(t => ({
        id: t.id,
        avatar: t.avatar,
        name: t.name,
        category: t.category,
        date: t.date.toISOString ? t.date.toISOString() : t.date,
        amount: parseFloat(t.amount),
        recurring: !!t.recurring
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems: totalItems,
        hasNext: offset + limit < totalItems,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/transactions/:id', auth.authenticateToken, async (req, res) => {
  try {
    const transaction = await db.queryOne(
      'SELECT id, avatar, name, category, date, amount, recurring FROM transactions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      ...transaction,
      date: transaction.date.toISOString ? transaction.date.toISOString() : transaction.date,
      amount: parseFloat(transaction.amount),
      recurring: !!transaction.recurring
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// ============================================
// API: Budgets (Protected)
// ============================================
app.get('/api/budgets', auth.authenticateToken, async (req, res) => {
  try {
    // Get all budgets for user
    const budgets = await db.query(
      'SELECT id, category, maximum, theme FROM budgets WHERE user_id = ?',
      [req.user.id]
    );

    // Calculate spent amount for each budget (current month)
    const budgetsWithSpending = await Promise.all(budgets.map(async (budget) => {
      // Get spent amount for current month
      const spentResult = await db.queryOne(`
        SELECT COALESCE(SUM(ABS(amount)), 0) as spent
        FROM transactions
        WHERE category = ?
        AND user_id = ?
        AND amount < 0
        AND MONTH(date) = MONTH(CURRENT_DATE)
        AND YEAR(date) = YEAR(CURRENT_DATE)
      `, [budget.category, req.user.id]);

      // Get latest 3 transactions in this category
      const latestTransactions = await db.query(`
        SELECT id, avatar, name, category, date, amount, recurring
        FROM transactions
        WHERE category = ? AND user_id = ?
        ORDER BY date DESC
        LIMIT 3
      `, [budget.category, req.user.id]);

      return {
        id: budget.id,
        category: budget.category,
        maximum: parseFloat(budget.maximum),
        theme: budget.theme,
        spent: parseFloat(spentResult.spent) || 0,
        latestTransactions: latestTransactions.map(t => ({
          id: t.id,
          avatar: t.avatar,
          name: t.name,
          category: t.category,
          date: t.date.toISOString ? t.date.toISOString() : t.date,
          amount: parseFloat(t.amount),
          recurring: !!t.recurring
        }))
      };
    }));

    res.json(budgetsWithSpending);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

app.post('/api/budgets', auth.authenticateToken, async (req, res) => {
  try {
    const { category, maximum, theme } = req.body;

    if (!category || !maximum || !theme) {
      return res.status(400).json({ error: 'Category, maximum, and theme are required' });
    }

    // Check if budget for this category already exists for this user
    const existing = await db.queryOne(
      'SELECT id FROM budgets WHERE category = ? AND user_id = ?',
      [category, req.user.id]
    );
    if (existing) {
      return res.status(400).json({ error: 'Budget for this category already exists' });
    }

    const result = await db.insert(
      'INSERT INTO budgets (category, maximum, theme, user_id) VALUES (?, ?, ?, ?)',
      [category, maximum, theme, req.user.id]
    );

    res.status(201).json({ id: result, category, maximum: parseFloat(maximum), theme });
  } catch (error) {
    console.error('Error creating budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.put('/api/budgets/:id', auth.authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, maximum, theme } = req.body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (maximum !== undefined) {
      updates.push('maximum = ?');
      params.push(maximum);
    }
    if (theme !== undefined) {
      updates.push('theme = ?');
      params.push(theme);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id, req.user.id);

    const affectedRows = await db.update(
      `UPDATE budgets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const budget = await db.queryOne(
      'SELECT id, category, maximum, theme FROM budgets WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    res.json({ ...budget, maximum: parseFloat(budget.maximum) });
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

app.delete('/api/budgets/:id', auth.authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const affectedRows = await db.deleteRecord(
      'DELETE FROM budgets WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// ============================================
// API: Pots (Protected)
// ============================================
app.get('/api/pots', auth.authenticateToken, async (req, res) => {
  try {
    const pots = await db.query(
      'SELECT id, name, target, total, theme FROM pots WHERE user_id = ?',
      [req.user.id]
    );

    const potsWithProgress = pots.map(pot => ({
      id: pot.id,
      name: pot.name,
      target: parseFloat(pot.target),
      total: parseFloat(pot.total),
      theme: pot.theme,
      percentage: pot.target > 0 ? Math.round((pot.total / pot.target) * 100) : 0
    }));

    res.json(potsWithProgress);
  } catch (error) {
    console.error('Error fetching pots:', error);
    res.status(500).json({ error: 'Failed to fetch pots' });
  }
});

app.post('/api/pots', auth.authenticateToken, async (req, res) => {
  try {
    const { name, target, total, theme } = req.body;

    if (!name || !target || !theme) {
      return res.status(400).json({ error: 'Name, target, and theme are required' });
    }

    const result = await db.insert(
      'INSERT INTO pots (name, target, total, theme, user_id) VALUES (?, ?, ?, ?, ?)',
      [name, target, total || 0, theme, req.user.id]
    );

    res.status(201).json({
      id: result,
      name,
      target: parseFloat(target),
      total: parseFloat(total || 0),
      theme
    });
  } catch (error) {
    console.error('Error creating pot:', error);
    res.status(500).json({ error: 'Failed to create pot' });
  }
});

app.put('/api/pots/:id', auth.authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, target, total, theme } = req.body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (target !== undefined) {
      updates.push('target = ?');
      params.push(target);
    }
    if (total !== undefined) {
      updates.push('total = ?');
      params.push(total);
    }
    if (theme !== undefined) {
      updates.push('theme = ?');
      params.push(theme);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id, req.user.id);

    const affectedRows = await db.update(
      `UPDATE pots SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Pot not found' });
    }

    const pot = await db.queryOne(
      'SELECT id, name, target, total, theme FROM pots WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    res.json({
      ...pot,
      target: parseFloat(pot.target),
      total: parseFloat(pot.total)
    });
  } catch (error) {
    console.error('Error updating pot:', error);
    res.status(500).json({ error: 'Failed to update pot' });
  }
});

app.delete('/api/pots/:id', auth.authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get pot details before deleting
    const pot = await db.queryOne(
      'SELECT total FROM pots WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!pot) {
      return res.status(404).json({ error: 'Pot not found' });
    }

    // Return funds to balance
    await db.update(
      'UPDATE balance SET current = current + ? WHERE user_id = ?',
      [pot.total, req.user.id]
    );

    // Delete the pot
    await db.deleteRecord('DELETE FROM pots WHERE id = ? AND user_id = ?', [id, req.user.id]);

    // Get new balance
    const balance = await db.queryOne(
      'SELECT current FROM balance WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      message: 'Pot deleted successfully',
      returnedAmount: parseFloat(pot.total),
      newBalance: parseFloat(balance.current)
    });
  } catch (error) {
    console.error('Error deleting pot:', error);
    res.status(500).json({ error: 'Failed to delete pot' });
  }
});

app.post('/api/pots/:id/add', auth.authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const addAmount = parseFloat(amount);
    if (isNaN(addAmount) || addAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check balance
    const balance = await db.queryOne(
      'SELECT current FROM balance WHERE user_id = ?',
      [req.user.id]
    );
    if (addAmount > balance.current) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Check pot exists and belongs to user
    const potExists = await db.queryOne(
      'SELECT id FROM pots WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!potExists) {
      return res.status(404).json({ error: 'Pot not found' });
    }

    // Deduct from balance
    await db.update(
      'UPDATE balance SET current = current - ? WHERE user_id = ?',
      [addAmount, req.user.id]
    );

    // Add to pot
    await db.update(
      'UPDATE pots SET total = total + ? WHERE id = ? AND user_id = ?',
      [addAmount, id, req.user.id]
    );

    // Get updated pot and balance
    const pot = await db.queryOne(
      'SELECT id, name, target, total, theme FROM pots WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    const newBalance = await db.queryOne(
      'SELECT current FROM balance WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      pot: {
        ...pot,
        target: parseFloat(pot.target),
        total: parseFloat(pot.total)
      },
      balance: parseFloat(newBalance.current)
    });
  } catch (error) {
    console.error('Error adding to pot:', error);
    res.status(500).json({ error: 'Failed to add to pot' });
  }
});

app.post('/api/pots/:id/withdraw', auth.authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check pot balance
    const pot = await db.queryOne(
      'SELECT total FROM pots WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!pot) {
      return res.status(404).json({ error: 'Pot not found' });
    }
    if (withdrawAmount > pot.total) {
      return res.status(400).json({ error: 'Insufficient funds in pot' });
    }

    // Deduct from pot
    await db.update(
      'UPDATE pots SET total = total - ? WHERE id = ? AND user_id = ?',
      [withdrawAmount, id, req.user.id]
    );

    // Add to balance
    await db.update(
      'UPDATE balance SET current = current + ? WHERE user_id = ?',
      [withdrawAmount, req.user.id]
    );

    // Get updated pot and balance
    const updatedPot = await db.queryOne(
      'SELECT id, name, target, total, theme FROM pots WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    const newBalance = await db.queryOne(
      'SELECT current FROM balance WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      pot: {
        ...updatedPot,
        target: parseFloat(updatedPot.target),
        total: parseFloat(updatedPot.total)
      },
      balance: parseFloat(newBalance.current)
    });
  } catch (error) {
    console.error('Error withdrawing from pot:', error);
    res.status(500).json({ error: 'Failed to withdraw from pot' });
  }
});

// ============================================
// API: Recurring Bills (Protected)
// ============================================
app.get('/api/recurring-bills', auth.authenticateToken, async (req, res) => {
  try {
    // Get unique recurring transactions for user
    let sql = `
      SELECT
        id, avatar, name, category, amount, date as lastDate
      FROM transactions
      WHERE recurring = TRUE AND user_id = ?
    `;
    const params = [req.user.id];

    // Search filter
    if (req.query.search) {
      sql += ' AND name LIKE ?';
      params.push(`%${req.query.search}%`);
    }

    // Sort
    const sort = req.query.sort || 'latest';
    switch (sort) {
      case 'latest':
        sql += ' ORDER BY date DESC';
        break;
      case 'oldest':
        sql += ' ORDER BY date ASC';
        break;
      case 'a-z':
        sql += ' ORDER BY name ASC';
        break;
      case 'z-a':
        sql += ' ORDER BY name DESC';
        break;
      case 'highest':
        sql += ' ORDER BY ABS(amount) DESC';
        break;
      case 'lowest':
        sql += ' ORDER BY ABS(amount) ASC';
        break;
      default:
        sql += ' ORDER BY date DESC';
    }

    const bills = await db.query(sql, params);

    const referenceDate = new Date();

    const processedBills = bills.map(bill => {
      const lastDate = new Date(bill.lastDate);

      const nextDue = new Date(lastDate);
      nextDue.setMonth(nextDue.getMonth() + 1);

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const isPaid = lastDate.getMonth() === currentMonth && lastDate.getFullYear() === currentYear;

      const daysUntilDue = Math.ceil((nextDue - referenceDate) / (1000 * 60 * 60 * 24));
      const isDueSoon = !isPaid && daysUntilDue >= 0 && daysUntilDue <= 5;

      return {
        id: bill.id,
        name: bill.name,
        avatar: bill.avatar,
        category: bill.category,
        amount: Math.abs(parseFloat(bill.amount)),
        lastDate: bill.lastDate.toISOString ? bill.lastDate.toISOString() : bill.lastDate,
        nextDueDate: nextDue.toISOString(),
        isPaid,
        isDueSoon,
        daysUntilDue
      };
    });

    // Calculate summary
    const summary = {
      paid: processedBills.filter(b => b.isPaid).reduce((sum, b) => sum + b.amount, 0),
      upcoming: processedBills.filter(b => !b.isPaid).reduce((sum, b) => sum + b.amount, 0),
      dueSoon: processedBills.filter(b => b.isDueSoon).reduce((sum, b) => sum + b.amount, 0)
    };

    res.json({
      data: processedBills,
      summary
    });
  } catch (error) {
    console.error('Error fetching recurring bills:', error);
    res.status(500).json({ error: 'Failed to fetch recurring bills' });
  }
});

// ============================================
// Health Check (Public)
// ============================================
app.get('/api/health', async (req, res) => {
  try {
    await db.queryOne('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================
// Graceful Shutdown
// ============================================
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await db.closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await db.closePool();
  process.exit(0);
});

// ============================================
// Start Application
// ============================================
initApp();

module.exports = app;
