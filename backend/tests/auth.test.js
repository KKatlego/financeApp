/* ============================================
   Authentication Unit Tests
   ============================================ */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock the db module
jest.mock('../db', () => ({
  queryOne: jest.fn(),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteRecord: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true)
}));

const auth = require('../auth');

describe('Authentication Module', () => {
  describe('Password Hashing', () => {
    test('should hash a password', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should compare password correctly', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);

      const isValid = await auth.comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('should return false for wrong password', async () => {
      const password = 'testPassword123';
      const hash = await auth.hashPassword(password);

      const isValid = await auth.comparePassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Token Management', () => {
    const testUser = {
      id: 1,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User'
    };

    test('should generate a valid token', () => {
      const token = auth.generateToken(testUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    test('should verify and decode a valid token', () => {
      const token = auth.generateToken(testUser);
      const decoded = auth.verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
    });

    test('should return null for invalid token', () => {
      const decoded = auth.verifyToken('invalid.token.here');
      expect(decoded).toBeNull();
    });
  });

  describe('Authentication Middleware', () => {
    test('should return 401 when no token provided', () => {
      const req = { headers: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      auth.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 403 for invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid_token' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      auth.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next for valid token', () => {
      const testUser = { id: 1, email: 'test@example.com', first_name: 'Test', last_name: 'User' };
      const token = auth.generateToken(testUser);

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      auth.authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(testUser.id);
    });
  });
});
