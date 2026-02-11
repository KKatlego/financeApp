/* ============================================
   Personal Finance App - Authentication Module
   ============================================ */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Configuration
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ============================================
// Password Hashing
// ============================================

/**
 * Hash a plain text password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare plain text password with hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if passwords match
 */
async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

// ============================================
// JWT Token Management
// ============================================

/**
 * Generate a JWT token for a user
 * @param {object} user - User object with id, email, first_name, last_name
 * @returns {string} JWT token
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token payload or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// ============================================
// Authentication Middleware
// ============================================

/**
 * Express middleware to authenticate JWT tokens
 * Adds req.user with user info if authenticated
 */
function authenticateToken(req, res, next) {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  // Add user info to request
  req.user = decoded;
  next();
}

/**
 * Optional middleware - attaches user if token present but doesn't require it
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  next();
}

// ============================================
// User Management Functions
// ============================================

/**
 * Create a new user
 * @param {object} userData - { email, password, first_name, last_name }
 * @returns {Promise<object>} Created user (without password)
 */
async function createUser(userData) {
  const { email, password, first_name, last_name } = userData;

  // Check if user already exists
  const existingUser = await db.queryOne(
    'SELECT id FROM users WHERE email = ?',
    [email.toLowerCase()]
  );

  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Insert user
  const userId = await db.insert(
    'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
    [email.toLowerCase(), passwordHash, first_name, last_name]
  );

  // Create default balance for new user
  await db.insert(
    'INSERT INTO balance (user_id, current, income, expenses) VALUES (?, 0, 0, 0)',
    [userId]
  );

  return {
    id: userId,
    email: email.toLowerCase(),
    first_name,
    last_name
  };
}

/**
 * Authenticate user with email and password
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @returns {Promise<object>} User object with token
 */
async function authenticateUser(email, password) {
  // Find user by email
  const user = await db.queryOne(
    'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = ?',
    [email.toLowerCase()]
  );

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isValid = await comparePassword(password, user.password_hash);

  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Generate token
  const token = generateToken(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    },
    token
  };
}

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise<object|null>} User object without password
 */
async function getUserById(userId) {
  const user = await db.queryOne(
    'SELECT id, email, first_name, last_name, created_at FROM users WHERE id = ?',
    [userId]
  );

  return user || null;
}

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Promise<object|null>} User object without password
 */
async function getUserByEmail(email) {
  const user = await db.queryOne(
    'SELECT id, email, first_name, last_name, created_at FROM users WHERE email = ?',
    [email.toLowerCase()]
  );

  return user || null;
}

// ============================================
// Export Module
// ============================================

module.exports = {
  // Password functions
  hashPassword,
  comparePassword,

  // Token functions
  generateToken,
  verifyToken,

  // Middleware
  authenticateToken,
  optionalAuth,

  // User management
  createUser,
  authenticateUser,
  getUserById,
  getUserByEmail
};
