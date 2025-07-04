import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { compress } from 'hono/compress';
import { config } from '@farcaster-indexer/shared';
import { authRoutes } from './routes/auth.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';
import { authMiddleware } from './middleware/auth.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', compress());
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// CORS configuration
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'farcaster-indexer-api'
  });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/v1', publicRoutes);
app.route('/api/admin', adminRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((error, c) => {
  console.error('API Error:', error);
  return c.json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  }, 500);
});

export default function startApiServer(port = 3001) {
  console.log(`🚀 Farcaster API Server starting on port ${port}...`);
  
  const server = serve({
    fetch: app.fetch,
    port: port,
  });
  
  console.log(`✅ API Server running at http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔐 Admin login: http://localhost:${port}/api/auth/login`);
  
  return server;
}

export { app };