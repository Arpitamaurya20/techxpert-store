import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { bannerUploadRoot } from './utils/bannerMedia.js';
import { catalogImageRoot } from './utils/catalogMedia.js';
import catalogRouter from './routes/catalog.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import cmsRouter from './routes/cms.js';
import pricingRouter from './routes/pricing.js';
import cartRouter from './routes/cart.js';
import auditRouter from './routes/audit.js';
import shopRouter from './routes/shop.js';
import deliveryRouter from './routes/delivery.js';
import accessRouter from './routes/access.js';
import storesRouter from './routes/stores.js';
import wishlistRouter from './routes/wishlist.js';
import { getCorsOptions, getJwtSecret } from './config/security.js';
import { DB_STORE, DB_USERS, logDbBootStatus, testDbConnections } from './db/mysql.js';

dotenv.config();

// Fail fast in production if JWT is misconfigured
getJwtSecret();

const app = express();
const PORT = process.env.PORT || 5001;
// Empty locally. On the VPS set HOST=127.0.0.1 so only Apache on this machine reaches Node.
const HOST = process.env.HOST?.trim() || undefined;

// Middleware — CORS allowlist required in production (see getCorsOptions)
app.use(cors(getCorsOptions()));

// Campaign images. Served before the API's strict content-security header.
app.use(
  '/uploads',
  express.static(path.join(bannerUploadRoot), {
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  })
);

// Product pictures. DB paths are store/assets/catalog/...; files live in server/catalog/catalog/.
app.use(
  '/store/assets/catalog',
  express.static(catalogImageRoot, {
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  })
);

app.use(express.json());

// Baseline security headers (API + portal consumers)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  );
  next();
});

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
  app.use(`${prefix}/wishlist`, wishlistRouter);
  app.use(`${prefix}/audit`, auditRouter);
  app.use(`${prefix}/delivery`, deliveryRouter);
  app.use(`${prefix}/access`, accessRouter);
  app.use(`${prefix}/stores`, storesRouter);
  app.use(`${prefix}/shop`, shopRouter);
};
mountRouters('');
mountRouters('/api');

const healthHandler = async (_req: express.Request, res: express.Response) => {
  const db = await testDbConnections();
  const bothOk = db.users.ok && db.store.ok;
  res.status(bothOk ? 200 : 503).json({
    status: bothOk ? 'ok' : 'degraded',
    service: 'Techxpert Store API Backend',
    timestamp: new Date().toISOString(),
    db: {
      users: {
        ok: db.users.ok,
        database: db.users.database || DB_USERS,
        host: db.users.host,
        role: 'identity_login',
        ...(db.users.error ? { error: db.users.error } : {}),
      },
      store: {
        ok: db.store.ok,
        database: db.store.database || DB_STORE,
        host: db.store.host,
        role: 'catalog_commerce',
        ...(db.store.error ? { error: db.store.error } : {}),
      },
    },
    endpoints: [
      'POST /auth/login',
      'POST /auth/admin/login',
      'GET  /auth/admin/me',
      'GET  /catalog/categories',
      'GET  /catalog/products',
      'GET  /orders',
      'GET  /cms/banners',
      'GET  /cms/sections',
      'GET  /cms/home',
      'GET  /pricing/bulk-tiers',
      'GET  /cart',
      'GET  /delivery/pincodes/:pincode',
      'GET  /audit/logs',
    ],
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.get('/', (_req, res) => {
  res.send({
    message: 'Techxpert Store Backend API Service is active',
    documentation: '/health',
    dualDb: { users: DB_USERS, store: DB_STORE },
  });
});

const onListen = () => {
  console.log(`🚀 Techxpert Backend API running on http://${HOST || 'localhost'}:${PORT}`);
  console.log(
    `📡 Ready for Expo Mobile App connection via EXPO_PUBLIC_API_BASE_URL=http://localhost:${PORT}`
  );
  console.log(`[DB] Dual-DB contract: identity=${DB_USERS} | catalog=${DB_STORE}`);
  testDbConnections()
    .then(logDbBootStatus)
    .catch((e) => console.warn('[DB] boot probe failed', e));
};
if (HOST) app.listen(Number(PORT), HOST, onListen);
else app.listen(Number(PORT), onListen);

export default app;
