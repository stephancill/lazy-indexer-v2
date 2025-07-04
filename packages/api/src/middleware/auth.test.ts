import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { authMiddleware, generateToken, verifyToken } from './auth.js';

describe('Auth Middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    
    // Protected route for testing
    app.get('/protected', authMiddleware, (c) => {
      const user = c.get('user');
      return c.json({ message: 'Protected content', user });
    });
    
    // Route to set test cookie
    app.get('/set-cookie', (c) => {
      const token = generateToken('admin');
      setCookie(c, 'token', token, { httpOnly: true });
      return c.json({ token });
    });
  });

  describe('authMiddleware', () => {
    it('should allow access with valid token', async () => {
      // First get a valid token
      const tokenRes = await app.request('/set-cookie');
      const setCookieHeader = tokenRes.headers.get('Set-Cookie');
      const tokenMatch = setCookieHeader?.match(/token=([^;]+)/);
      const token = tokenMatch?.[1];

      expect(token).toBeDefined();

      // Then access protected route with the token
      const res = await app.request('/protected', {
        headers: {
          'Cookie': `token=${token}`,
        },
      });

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.message).toBe('Protected content');
      expect(data.user.id).toBe('admin');
      expect(data.user.role).toBe('admin');
    });

    it('should deny access without token', async () => {
      const res = await app.request('/protected');
      
      expect(res.status).toBe(401);
      
      const data = await res.json();
      expect(data.error).toBe('Authentication required');
    });

    it('should deny access with invalid token', async () => {
      const res = await app.request('/protected', {
        headers: {
          'Cookie': 'token=invalid-token',
        },
      });

      expect(res.status).toBe(401);
      
      const data = await res.json();
      expect(data.error).toBe('Invalid token');
    });

    it('should deny access with malformed token', async () => {
      const res = await app.request('/protected', {
        headers: {
          'Cookie': 'token=malformed.token.here',
        },
      });

      expect(res.status).toBe(401);
      
      const data = await res.json();
      expect(data.error).toBe('Invalid token');
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const token = generateToken('admin');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate token with correct payload', () => {
      const token = generateToken('testuser', 'admin');
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe('testuser');
      expect(decoded.role).toBe('admin');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should generate token with 24 hour expiry', () => {
      const token = generateToken('admin');
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      const now = Math.floor(Date.now() / 1000);
      const expectedExp = now + (24 * 60 * 60);
      
      // Allow 5 second tolerance for test execution time
      expect(decoded.exp).toBeGreaterThan(expectedExp - 5);
      expect(decoded.exp).toBeLessThan(expectedExp + 5);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = generateToken('admin');
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe('admin');
      expect(decoded.role).toBe('admin');
    });

    it('should return null for invalid token', () => {
      const decoded = verifyToken('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should return null for malformed token', () => {
      const decoded = verifyToken('malformed.token.here');
      expect(decoded).toBeNull();
    });

    it('should return null for empty token', () => {
      const decoded = verifyToken('');
      expect(decoded).toBeNull();
    });
  });
});