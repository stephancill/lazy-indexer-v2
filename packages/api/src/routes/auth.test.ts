import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from './auth.js';

// Create test app with auth routes
const testApp = new Hono();
testApp.route('/auth', authRoutes);

describe('Auth Routes', () => {
  describe('POST /auth/login', () => {
    it('should login successfully with correct password', async () => {
      const res = await testApp.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: 'admin-password-123',
        }),
      });

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Login successful');
      expect(data.user.id).toBe('admin');
      expect(data.user.role).toBe('admin');
      
      // Check for HTTP-only cookie
      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('token=');
      expect(setCookie).toContain('HttpOnly');
    });

    it('should fail login with incorrect password', async () => {
      const res = await testApp.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: 'wrong-password',
        }),
      });

      expect(res.status).toBe(401);
      
      const data = await res.json();
      expect(data.error).toBe('Invalid credentials');
    });

    it('should fail login with missing password', async () => {
      const res = await testApp.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('Password is required');
    });

    it('should fail login with malformed JSON', async () => {
      const res = await testApp.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      expect(res.status).toBe(500);
      
      const data = await res.json();
      expect(data.error).toBe('Login failed');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await testApp.request('/auth/logout', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logout successful');
      
      // Check for cookie deletion
      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('token=;');
      expect(setCookie).toContain('Max-Age=0');
    });
  });

  describe('GET /auth/status', () => {
    it('should return unauthenticated status without token', async () => {
      const res = await testApp.request('/auth/status');
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.authenticated).toBe(false);
    });

    it('should return authenticated status with valid token', async () => {
      // First login to get token
      const loginRes = await testApp.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: 'admin-password-123',
        }),
      });

      const setCookie = loginRes.headers.get('Set-Cookie');
      const tokenMatch = setCookie?.match(/token=([^;]+)/);
      const token = tokenMatch?.[1];

      expect(token).toBeDefined();

      // Then check status with token
      const statusRes = await testApp.request('/auth/status', {
        headers: {
          'Cookie': `token=${token}`,
        },
      });

      expect(statusRes.status).toBe(200);
      
      const data = await statusRes.json();
      expect(data.authenticated).toBe(true);
      expect(data.user.id).toBe('admin');
      expect(data.user.role).toBe('admin');
    });
  });
});