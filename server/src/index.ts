import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import catalogRouter from './routes/catalog.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import cmsRouter from './routes/cms.js';
import pricingRouter from './routes/pricing.js';
import cartRouter from './routes/cart.js';

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

// Mount Routes (supporting both root and /api prefixes)
const mountRouters = (prefix: string) => {
  app.use(`${prefix}/catalog`, catalogRouter);
  app.use(`${prefix}/auth`, authRouter);
  app.use(`${prefix}/orders`, ordersRouter);
  app.use(`${prefix}/cms`, cmsRouter);
  app.use(`${prefix}/pricing`, pricingRouter);
  app.use(`${prefix}/cart`, cartRouter);
};
mountRouters('');
mountRouters('/api');

const healthHandler = (_req: express.Request, res: express.Response) => {
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
      'GET  /pricing/calculate',
      'GET  /cart',
      'POST /cart/items',
    ],
  });
};

// Health & System Info
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

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
