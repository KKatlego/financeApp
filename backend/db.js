/* ============================================
   Personal Finance App - Database Connection
   ============================================ */

require('dotenv').config();

const mysql = require('mysql2/promise');

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'finance_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully');
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Database: ${dbConfig.database}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Initialize database tables
async function initializeDatabase() {
  try {
    const fs = require('fs');
    const path = require('path');

    const schemaPath = path.join(__dirname, 'database', 'schema.sql');

    // Check if schema file exists
    if (!fs.existsSync(schemaPath)) {
      console.log('⚠️  Schema file not found, skipping initialization');
      return false;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('CREATE DATABASE') && !s.startsWith('USE '));

    const connection = await pool.getConnection();

    for (const statement of statements) {
      try {
        await connection.execute(statement);
      } catch (err) {
        // Ignore duplicate entry errors
        if (!err.message.includes('Duplicate entry')) {
          console.log(`   SQL: ${statement.substring(0, 50)}...`);
        }
      }
    }

    connection.release();
    console.log('✅ Database tables initialized');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
}

// Query helper with error handling
async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
}

// Get single row
async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

// Insert and return inserted ID
async function insert(sql, params = []) {
  const result = await query(sql, params);
  return result.insertId;
}

// Update and return affected rows
async function update(sql, params = []) {
  const result = await query(sql, params);
  return result.affectedRows;
}

// Delete and return affected rows
async function deleteRecord(sql, params = []) {
  const result = await query(sql, params);
  return result.affectedRows;
}

// Close pool (for graceful shutdown)
async function closePool() {
  await pool.end();
  console.log('Database connection pool closed');
}

module.exports = {
  pool,
  testConnection,
  initializeDatabase,
  query,
  queryOne,
  insert,
  update,
  deleteRecord,
  closePool
};
