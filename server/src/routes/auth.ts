import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { store } from '../db/store.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'techxpert-store-secret-key-2026';

// POST /auth/login
router.post('/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Mobile/Email and password are required' });
  }

  const user = store.findUserByIdentifier(identifier);

  // Validate credentials
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({
      error: 'Invalid mobile/email or password',
      message: 'The mobile number or password you entered is incorrect.',
    });
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, mobile: user.mobile },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      deliveryLocation: user.deliveryLocation,
      role: user.role,
    },
  });
});

// POST /auth/register
router.post('/register', (req: Request, res: Response) => {
  const { name, mobile, email, password, deliveryLocation } = req.body;

  if (!mobile || !password || !name) {
    return res.status(400).json({ error: 'Name, mobile and password are required' });
  }

  const existing = store.findUserByIdentifier(mobile);
  if (existing) {
    return res.status(409).json({ error: 'An account with this mobile number already exists' });
  }

  const newUser = store.createUser({
    id: `usr-${Date.now()}`,
    name,
    mobile,
    email: email || '',
    passwordHash: password,
    deliveryLocation: deliveryLocation || { pincode: '201309', city: 'Noida' },
    role: 'contractor',
  });

  const token = jwt.sign(
    { userId: newUser.id, role: newUser.role, mobile: newUser.mobile },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return res.status(201).json({
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      mobile: newUser.mobile,
      deliveryLocation: newUser.deliveryLocation,
      role: newUser.role,
    },
  });
});

// GET /auth/me
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = store.findUserById(payload.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        deliveryLocation: user.deliveryLocation,
        role: user.role,
      },
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
