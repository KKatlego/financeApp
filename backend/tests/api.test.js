/* ============================================
   API Endpoint Unit Tests
   ============================================ */

const request = require('supertest');

// Mock the db module before requiring the app
jest.mock('../db', () => ({
  queryOne: jest.fn(),
  query: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  deleteRecord: jest.fn(),
  testConnection: jest.fn().mockResolvedValue(true),
  closePool: jest.fn().mockResolvedValue()
}));

// Mock console.log to reduce noise
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

const db = require('../db');
const app = require('../server');

describe('API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    test('should return healthy status when database is connected', async () => {
      db.queryOne.mockResolvedValueOnce({ 1: 1 });

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBe('connected');
    });

    test('should return unhealthy status when database fails', async () => {
      db.queryOne.mockRejectedValueOnce(new Error('Connection failed'));

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
      expect(res.body.database).toBe('disconnected');
    });
  });

  describe('POST /api/auth/signup', () => {
    test('should return 400 when fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    test('should return 400 when password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: '123',
          first_name: 'Test',
          last_name: 'User'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must be at least 6 characters');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password are required');
    });

    test('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password are required');
    });
  });

  describe('Protected Routes', () => {
    test('should return 401 when accessing /api/data without token', async () => {
      const res = await request(app).get('/api/data');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access token required');
    });

    test('should return 401 when accessing /api/balance without token', async () => {
      const res = await request(app).get('/api/balance');

      expect(res.status).toBe(401);
    });

    test('should return 401 when accessing /api/transactions without token', async () => {
      const res = await request(app).get('/api/transactions');

      expect(res.status).toBe(401);
    });

    test('should return 401 when accessing /api/budgets without token', async () => {
      const res = await request(app).get('/api/budgets');

      expect(res.status).toBe(401);
    });

    test('should return 401 when accessing /api/pots without token', async () => {
      const res = await request(app).get('/api/pots');

      expect(res.status).toBe(401);
      
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Route not found');
    });
  });
});
