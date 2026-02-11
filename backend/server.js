/* ============================================
   Personal Finance App - Server (MySQL)
   ============================================ */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

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

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ============================================
// API: Get All Data
// ============================================
app.get('/api/data', async (req, res) => {
  try {
    // Get balance
    const balance = await db.queryOne('SELECT current, income, expenses FROM balance WHERE id = 1');

    // Get transactions
    const transactions = await db.query(`
      SELECT id, avatar, name, category, date, amount, recurring
      FROM transactions
      ORDER BY date DESC
    `);

    // Get budgets
    const budgets = await db.query('SELECT id, category, maximum, theme FROM budgets');

    // Get pots
    const pots = await db.query('SELECT id, name, target, total, theme FROM pots');

    // Format response
    const response = {
      balance: balance || { current: 0, income: 0, expenses: 0 },
      transactions: transactions.map(t => ({
        avatar: t.avatar,
        name: t.name,
        category: t.category,
        date: t.date.toISOString ? t.date.toISOString() : t.date,
        amount: parseFloat(t.amount),
        recurring: !!t.recurring
      })),
      budgets: budgets.map(b => ({
        category: b.category,
        maximum: parseFloat(b.maximum),
        theme: b.theme
      })),
      pots: pots.map(p => ({
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
// API: Balance
// ============================================
app.get('/api/balance', async (req, res) => {
  try {
    const balance = await db.queryOne('SELECT current, income, expenses FROM balance WHERE id = 1');
    res.json(balance || { current: 0, income: 0, expenses: 0 });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

app.put('/api/balance', async (req, res) => {
  try {
    const { current, income, expenses } = req.body;

    await db.query(
      'UPDATE balance SET current = ?, income = ?, expenses = ? WHERE id = 1',
      [current, income, expenses]
    );

    const balance = await db.queryOne('SELECT current, income, expenses FROM balance WHERE id = 1');
    res.json(balance);
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// ============================================
// API: Transactions
// ============================================
app.get('/api/transactions', async (req, res) => {
  try {
    let sql = 'SELECT id, avatar, name, category, date, amount, recurring FROM transactions WHERE 1=1';
    const params = [];

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

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await db.queryOne(
      'SELECT id, avatar, name, category, date, amount, recurring FROM transactions WHERE id = ?',
      [req.params.id]
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
// API: Budgets
// ============================================
app.get('/api/budgets', async (req, res) => {
  try {
    // Get all budgets
    const budgets = await db.query('SELECT id, category, maximum, theme FROM budgets');

    // Calculate spent amount for each budget (August 2024)
    const budgetsWithSpending = await Promise.all(budgets.map(async (budget) => {
      // Get spent amount for August 2024
      const spentResult = await db.queryOne(`
        SELECT COALESCE(SUM(ABS(amount)), 0) as spent
        FROM transactions
        WHERE category = ?
        AND amount < 0
        AND MONTH(date) = 8
        AND YEAR(date) = 2024
      `, [budget.category]);

      // Get latest 3 transactions in this category
      const latestTransactions = await db.query(`
        SELECT id, avatar, name, category, date, amount, recurring
        FROM transactions
        WHERE category = ?
        ORDER BY date DESC
        LIMIT 3
      `, [budget.category]);

      return {
        id: budget.id,
        category: budget.category,
        maximum: parseFloat(budget.maximum),
        theme: budget.theme,
        spent: parseFloat(spentResult.spent) || 0,
        latestTransactions: latestTransactions.map(t => ({
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

app.post('/api/budgets', async (req, res) => {
  try {
    const { category, maximum, theme } = req.body;

    if (!category || !maximum || !theme) {
      return res.status(400).json({ error: 'Category, maximum, and theme are required' });
    }

    // Check if budget for this category already exists
    const existing = await db.queryOne('SELECT id FROM budgets WHERE category = ?', [category]);
    if (existing) {
      return res.status(400).json({ error: 'Budget for this category already exists' });
    }

    const result = await db.insert(
      'INSERT INTO budgets (category, maximum, theme) VALUES (?, ?, ?)',
      [category, maximum, theme]
    );

    res.status(201).json({ id: result, category, maximum: parseFloat(maximum), theme });
  } catch (error) {
    console.error('Error creating budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.put('/api/budgets/:id', async (req, res) => {
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

    params.push(id);

    const affectedRows = await db.update(
      `UPDATE budgets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const budget = await db.queryOne('SELECT id, category, maximum, theme FROM budgets WHERE id = ?', [id]);
    res.json({ ...budget, maximum: parseFloat(budget.maximum) });
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

app.delete('/api/budgets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const affectedRows = await db.deleteRecord('DELETE FROM budgets WHERE id = ?', [id]);

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
// API: Pots
// ============================================
app.get('/api/pots', async (req, res) => {
  try {
    const pots = await db.query('SELECT id, name, target, total, theme FROM pots');

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

app.post('/api/pots', async (req, res) => {
  try {
    const { name, target, total, theme } = req.body;

    if (!name || !target || !theme) {
      return res.status(400).json({ error: 'Name, target, and theme are required' });
    }

    const result = await db.insert(
      'INSERT INTO pots (name, target, total, theme) VALUES (?, ?, ?, ?)',
      [name, target, total || 0, theme]
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

app.put('/api/pots/:id', async (req, res) => {
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

    params.push(id);

    const affectedRows = await db.update(
      `UPDATE pots SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Pot not found' });
    }

    const pot = await db.queryOne('SELECT id, name, target, total, theme FROM pots WHERE id = ?', [id]);
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

app.delete('/api/pots/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get pot details before deleting
    const pot = await db.queryOne('SELECT total FROM pots WHERE id = ?', [id]);

    if (!pot) {
      return res.status(404).json({ error: 'Pot not found' });
    }

    // Return funds to balance
    await db.update(
      'UPDATE balance SET current = current + ? WHERE id = 1',
      [pot.total]
    );

    // Delete the pot
    await db.deleteRecord('DELETE FROM pots WHERE id = ?', [id]);

    // Get new balance
    const balance = await db.queryOne('SELECT current FROM balance WHERE id = 1');

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

app.post('/api/pots/:id/add', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const addAmount = parseFloat(amount);
    if (isNaN(addAmount) || addAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check balance
    const balance = await db.queryOne('SELECT current FROM balance WHERE id = 1');
    if (addAmount > balance.current) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct from balance
    await db.update('UPDATE balance SET current = current - ? WHERE id = 1', [addAmount]);

    // Add to pot
    await db.update('UPDATE pots SET total = total + ? WHERE id = ?', [addAmount, id]);

    // Get updated pot and balance
    const pot = await db.queryOne('SELECT id, name, target, total, theme FROM pots WHERE id = ?', [id]);
    const newBalance = await db.queryOne('SELECT current FROM balance WHERE id = 1');

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

app.post('/api/pots/:id/withdraw', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check pot balance
    const pot = await db.queryOne('SELECT total FROM pots WHERE id = ?', [id]);
    if (!pot) {
      return res.status(404).json({ error: 'Pot not found' });
    }
    if (withdrawAmount > pot.total) {
      return res.status(400).json({ error: 'Insufficient funds in pot' });
    }

    // Deduct from pot
    await db.update('UPDATE pots SET total = total - ? WHERE id = ?', [withdrawAmount, id]);

    // Add to balance
    await db.update('UPDATE balance SET current = current + ? WHERE id = 1', [withdrawAmount]);

    // Get updated pot and balance
    const updatedPot = await db.queryOne('SELECT id, name, target, total, theme FROM pots WHERE id = ?', [id]);
    const newBalance = await db.queryOne('SELECT current FROM balance WHERE id = 1');

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
// API: Recurring Bills
// ============================================
app.get('/api/recurring-bills', async (req, res) => {
  try {
    // Get unique recurring transactions
    let sql = `
      SELECT
        id, avatar, name, category, amount, date as lastDate
      FROM transactions
      WHERE recurring = TRUE
    `;
    const params = [];

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

    const referenceDate = new Date('2024-08-19');

    const processedBills = bills.map(bill => {
      const lastDate = new Date(bill.lastDate);

      const nextDue = new Date(lastDate);
      nextDue.setMonth(nextDue.getMonth() + 1);

      const isPaid = lastDate.getMonth() === 7 && lastDate.getFullYear() === 2024;

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
// Health Check
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
