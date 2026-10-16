import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import catalogRouter from './routes/catalog.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import cmsRouter from './routes/cms.js';
import pricingRouter from './routes/pricing.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger for debugging
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Mount Routes
app.use('/catalog', catalogRouter);
app.use('/auth', authRouter);
app.use('/orders', ordersRouter);
app.use('/cms', cmsRouter);
app.use('/pricing', pricingRouter);

// Health & System Info
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Techxpert Store API Backend',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /auth/login',
      'POST /auth/register',
      'GET  /catalog/categories',
      'GET  /catalog/subcategories',
      'GET  /catalog/brands',
      'GET  /catalog/products',
      'GET  /catalog/products/:id',
      'GET  /orders',
      'POST /orders',
      'GET  /cms/banners',
      'GET  /pricing/bulk-tiers',
    ],
  });
});

// Root handler
app.get('/', (_req, res) => {
  res.send({
    message: 'Techxpert Store Backend API Service is active',
    documentation: '/health',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Techxpert Backend API running on http://localhost:${PORT}`);
  console.log(`📡 Ready for Expo Mobile App connection via EXPO_PUBLIC_API_BASE_URL=http://localhost:${PORT}`);
});

export default app;
