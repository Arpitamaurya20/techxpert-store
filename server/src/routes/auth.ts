import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { userPool } from '../db/mysql.js';
import { store } from '../db/store.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'techxpert-store-secret-key-2026';

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Mobile/Email and password are required' });
  }

  try {
    const [rows] = await userPool.query<any[]>(
      `SELECT u.id, u.user_uuid, u.mobile, u.email, u.password_hash, u.role,
              p.full_name, p.company_name, p.default_pincode, p.default_city
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE (u.mobile = ? OR u.email = ?) AND u.is_active = 1
       LIMIT 1`,
      [identifier, identifier]
    );

    if (rows.length > 0) {
      const user = rows[0];
      if (user.password_hash === password) {
        const token = jwt.sign(
          { userId: user.id, role: user.role, mobile: user.mobile },
          JWT_SECRET,
          { expiresIn: '30d' }
        );

        return res.json({
          token,
          user: {
            id: String(user.id),
            name: user.full_name || user.mobile,
            email: user.email,
            mobile: user.mobile,
            deliveryLocation: {
              pincode: user.default_pincode || '201309',
              city: user.default_city || 'Noida',
            },
            role: user.role,
          },
        });
      }
    }
  } catch (err) {
    console.warn('[Auth] MySQL user query failed, checking local store', err);
  }

  // Fallback to local store
  const localUser = store.findUserByIdentifier(identifier);
  if (localUser && localUser.passwordHash === password) {
    const token = jwt.sign(
      { userId: localUser.id, role: localUser.role, mobile: localUser.mobile },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    return res.json({
      token,
      user: {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        mobile: localUser.mobile,
        deliveryLocation: localUser.deliveryLocation,
        role: localUser.role,
      },
    });
  }

  return res.status(401).json({
    error: 'Invalid mobile/email or password',
    message: 'The mobile number or password you entered is incorrect.',
  });
});

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { name, mobile, email, password, deliveryLocation } = req.body;

  if (!mobile || !password || !name) {
    return res.status(400).json({ error: 'Name, mobile and password are required' });
  }

  try {
    const userUuid = `usr-${Date.now()}`;
    const [insertResult] = await userPool.query<any>(
      `INSERT INTO users (user_uuid, mobile, email, password_hash, role)
       VALUES (?, ?, ?, ?, 'contractor')`,
      [userUuid, mobile, email || null, password]
    );

    const newUserId = insertResult.insertId;

    await userPool.query(
      `INSERT INTO user_profiles (user_id, full_name, default_pincode, default_city)
       VALUES (?, ?, ?, ?)`,
      [
        newUserId,
        name,
        deliveryLocation?.pincode || '201309',
        deliveryLocation?.city || 'Noida',
      ]
    );

    const token = jwt.sign(
      { userId: newUserId, role: 'contractor', mobile },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: String(newUserId),
        name,
        email: email || '',
        mobile,
        deliveryLocation: deliveryLocation || { pincode: '201309', city: 'Noida' },
        role: 'contractor',
      },
    });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with this mobile number already exists' });
    }
    console.warn('[Auth] MySQL register failed, falling back to local store', err);
  }

  const localUser = store.createUser({
    id: `usr-${Date.now()}`,
    name,
    mobile,
    email: email || '',
    passwordHash: password,
    deliveryLocation: deliveryLocation || { pincode: '201309', city: 'Noida' },
    role: 'contractor',
  });

  const token = jwt.sign(
    { userId: localUser.id, role: localUser.role, mobile: localUser.mobile },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return res.status(201).json({
    token,
    user: {
      id: localUser.id,
      name: localUser.name,
      email: localUser.email,
      mobile: localUser.mobile,
      deliveryLocation: localUser.deliveryLocation,
      role: localUser.role,
    },
  });
});

export default router;
