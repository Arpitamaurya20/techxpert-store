import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { userPool } from '../db/mysql.js';
import { store } from '../db/store.js';
import { DEV_OTP, getJwtSecret, isDevCustomerLoginAllowed } from '../config/security.js';
import { sendSignInCode } from '../utils/otpSms.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';

const JWT_SECRET = getJwtSecret();

/** Customer sign-in and profile. Portal staff sign-in lives in StaffService. */
export class AuthService {
  static async login(identifier: string) {
    const clean = String(identifier).trim();

    try {
      const [rows] = await userPool.query<any[]>(
        `SELECT user_id, phone, email, full_name, profile_image, is_active, is_verified
         FROM users
         WHERE (phone = ? OR email = ?) AND is_active = 1
         LIMIT 1`,
        [clean, clean]
      );

      if (rows.length > 0) {
        const user = rows[0];
        const [addrRows] = await userPool.query<any[]>(
          `SELECT address_id, label, flat_no, building, area, city, pincode, is_default
           FROM user_addresses
           WHERE user_id = ? AND is_deleted = 0
           ORDER BY is_default DESC, address_id DESC
           LIMIT 1`,
          [user.user_id]
        );

        const defaultAddr = addrRows[0];
        const token = jwt.sign(
          {
            userId: user.user_id,
            mobile: user.phone,
            email: user.email,
            name: user.full_name,
            role: 'customer',
          },
          JWT_SECRET,
          { expiresIn: '30d' }
        );

        return {
          token,
          user: {
            id: String(user.user_id),
            name: user.full_name || 'Valued Customer',
            email: user.email || '',
            mobile: user.phone,
            deliveryLocation: AuthService.deliveryLocation(defaultAddr),
            role: 'customer',
          },
        };
      }
    } catch (err) {
      return mysqlOrFileStore('auth.login', err, () => {
        const localUser = store.findUserByIdentifier(clean);
        if (!localUser) {
          throw Object.assign(new Error('User not found'), { statusCode: 404 });
        }
        const token = jwt.sign(
          { userId: localUser.id, mobile: localUser.mobile, email: localUser.email, role: 'customer' },
          JWT_SECRET,
          { expiresIn: '30d' }
        );
        return {
          token,
          user: {
            id: localUser.id,
            name: localUser.name,
            email: localUser.email,
            mobile: localUser.mobile,
            deliveryLocation: localUser.deliveryLocation,
            role: localUser.role,
          },
        };
      });
    }

    throw Object.assign(new Error('The mobile number or email entered is not registered'), { statusCode: 404 });
  }

  static async sendOtp(phone: string, purpose: string = 'login', ipAddress: string = '127.0.0.1') {
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const devLogin = isDevCustomerLoginAllowed();
    const otp = devLogin ? DEV_OTP : String(crypto.randomInt(100000, 1000000));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    try {
      await userPool.query(
        `INSERT INTO otp_attempts (phone, otp_hash, purpose, attempts, expires_at, is_used, ip_address)
         VALUES (?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, ?)`,
        [cleanPhone, otpHash, purpose, ipAddress]
      );
    } catch (e) {
      console.warn('[AuthService] otp_attempts insert warning', e);
    }

    if (!devLogin) {
      const sent = await sendSignInCode(cleanPhone, otp, process.env);
      if (!sent.sent) {
        throw Object.assign(new Error(sent.detail), { statusCode: 503 });
      }
    }

    return {
      phone: cleanPhone,
      message: devLogin ? `OTP sent successfully to +91 ${cleanPhone}` : 'The sign-in code was sent.',
      devOtp: devLogin ? otp : undefined,
    };
  }

  /** A saved address. No address is null, never a made-up city. */
  static deliveryLocation(addr: { pincode?: string; city?: string } | undefined) {
    const pincode = String(addr?.pincode || '').trim();
    const city = String(addr?.city || '').trim();
    if (!/^\d{6}$/.test(pincode) || !city) return null;
    return { pincode, city };
  }

  /** The person for this phone. A new phone is unverified until `verify` is set. An existing phone is not replaced. */
  static async attachByPhone(contact: {
    phone?: string;
    name?: string;
    email?: string;
    verify: boolean;
  }): Promise<{ userId: number; created: boolean } | null> {
    const phone = AuthService.cleanPhone(contact.phone);
    if (!/^[1-9]\d{9}$/.test(phone)) return null;

    const claim = async (userId: number, created: boolean) => {
      try {
        await AuthService.persistCustomerContact(userId, contact);
      } catch (err) {
        const duplicate = AuthService.duplicateCustomer(err);
        if (duplicate) throw duplicate;
        throw err;
      }
      if (contact.verify) {
        await userPool.query(`UPDATE users SET is_verified = 1 WHERE user_id = ?`, [userId]);
      }
      return { userId, created };
    };

    const [existing] = await userPool.query<any[]>(`SELECT user_id FROM users WHERE phone = ? LIMIT 1`, [phone]);
    if (existing.length) return claim(Number(existing[0].user_id), false);

    const incomingName = String(contact.name || '').trim();
    const storedName = incomingName && !AuthService.isPlaceholderName(incomingName) ? incomingName.slice(0, 200) : null;
    const incomingEmail = String(contact.email || '').trim();
    const storedEmail = incomingEmail.includes('@') ? incomingEmail.slice(0, 200) : null;
    try {
      const [insertRes] = await userPool.query<any>(
        `INSERT INTO users (phone, full_name, email, is_active, is_verified) VALUES (?, ?, ?, 1, ?)`,
        [phone, storedName, storedEmail, contact.verify ? 1 : 0]
      );
      return { userId: Number(insertRes.insertId), created: true };
    } catch (err) {
      const duplicate = AuthService.duplicateCustomer(err);
      if (duplicate && (duplicate as { code?: string }).code === 'PHONE_TAKEN') {
        const [again] = await userPool.query<any[]>(`SELECT user_id FROM users WHERE phone = ? LIMIT 1`, [phone]);
        if (again.length) return claim(Number(again[0].user_id), false);
      }
      if (duplicate) throw duplicate;
      throw err;
    }
  }

  static duplicateCustomer(err: unknown): Error | null {
    const row = err as { code?: string; errno?: number; message?: string };
    if (row?.code !== 'ER_DUP_ENTRY' && row?.errno !== 1062) return null;
    if (String(row.message || '').toLowerCase().includes('email')) {
      return Object.assign(new Error('That email is already on another account.'), {
        statusCode: 409,
        code: 'EMAIL_TAKEN',
      });
    }
    return Object.assign(new Error('That phone already has an account.'), { statusCode: 409, code: 'PHONE_TAKEN' });
  }

  /** Names that mean "we don't know yet" — safe to overwrite with a real name. */
  static isPlaceholderName(name: unknown): boolean {
    const n = String(name || '').trim().toLowerCase();
    return (
      !n ||
      n === 'customer' ||
      n === 'valued customer' ||
      n === 'guest' ||
      n === '—' ||
      n === '-' ||
      n === 'n/a' ||
      n === 'na'
    );
  }

  static cleanPhone(phone: unknown): string {
    return String(phone || '').replace(/\D/g, '').slice(-10);
  }

  /**
   * Write name/phone/email onto homecare.users without clobbering a real name.
   * Used at OTP signup and checkout so search/emails read users, not a later snapshot.
   */
  static async persistCustomerContact(
    userId: number,
    contact: { name?: string; phone?: string; email?: string }
  ): Promise<void> {
    const id = Number(userId);
    if (!id) return;

    const incomingName = String(contact.name || '').trim();
    const incomingPhone = AuthService.cleanPhone(contact.phone);
    const incomingEmail = String(contact.email || '').trim();
    const realName = incomingName && !AuthService.isPlaceholderName(incomingName) ? incomingName.slice(0, 200) : '';
    const realPhone = incomingPhone.length === 10 ? incomingPhone : '';
    const realEmail = incomingEmail.includes('@') ? incomingEmail.slice(0, 200) : '';

    if (!realName && !realPhone && !realEmail) return;

    const [rows] = await userPool.query<any[]>(
      `SELECT full_name, phone, email FROM users WHERE user_id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return;
    const current = rows[0];

    const nextName = AuthService.isPlaceholderName(current.full_name) && realName ? realName : null;
    const nextPhone = !AuthService.cleanPhone(current.phone) && realPhone ? realPhone : null;
    const nextEmail = !String(current.email || '').trim() && realEmail ? realEmail : null;
    if (!nextName && !nextPhone && !nextEmail) return;

    await userPool.query(
      `UPDATE users SET
         full_name = COALESCE(?, full_name),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email)
       WHERE user_id = ?`,
      [nextName, nextPhone, nextEmail, id]
    );
  }

  static async verifyOtp(
    phone: string,
    otp: string,
    profile?: { name?: string; email?: string }
  ) {
    const cleanPhone = AuthService.cleanPhone(phone);
    const providedOtp = String(otp).trim();
    const providedHash = crypto.createHash('sha256').update(providedOtp).digest('hex');

    const [attempts] = await userPool.query<any[]>(
      `SELECT otp_id, otp_hash, expires_at, is_used
       FROM otp_attempts
       WHERE phone = ? AND is_used = 0 AND expires_at > NOW()
       ORDER BY otp_id DESC
       LIMIT 1`,
      [cleanPhone]
    );

    const isDev = isDevCustomerLoginAllowed() && providedOtp === DEV_OTP;
    let valid = isDev;

    if (attempts.length > 0) {
      if (attempts[0].otp_hash === providedHash || isDev) {
        valid = true;
        await userPool.query(`UPDATE otp_attempts SET is_used = 1 WHERE otp_id = ?`, [attempts[0].otp_id]);
      }
    }

    if (!valid) {
      throw Object.assign(new Error('That code is wrong or has expired. Ask for a new one.'), { statusCode: 401 });
    }

    const attached = await AuthService.attachByPhone({
      phone: cleanPhone,
      name: profile?.name,
      email: profile?.email,
      verify: true,
    });
    if (!attached) {
      throw Object.assign(new Error('Enter a 10-digit mobile number.'), { statusCode: 400 });
    }

    const [users] = await userPool.query<any[]>(
      `SELECT user_id, phone, email, full_name, is_active FROM users WHERE user_id = ? LIMIT 1`,
      [attached.userId]
    );
    const user = users[0];
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const [addrRows] = await userPool.query<any[]>(
      `SELECT city, pincode FROM user_addresses WHERE user_id = ? AND is_deleted = 0 ORDER BY is_default DESC LIMIT 1`,
      [user.user_id]
    );
    const addr = addrRows[0];

    const token = jwt.sign(
      { userId: user.user_id, mobile: user.phone, email: user.email, name: user.full_name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return {
      token,
      user: {
        id: String(user.user_id),
        name: user.full_name || 'Valued Customer',
        email: user.email || '',
        mobile: user.phone,
        deliveryLocation: AuthService.deliveryLocation(addr),
      },
    };
  }

  static async getProfile(userId: number) {
    const [users] = await userPool.query<any[]>(
      `SELECT user_id, phone, email, full_name, profile_image, is_active, created_at
       FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    if (users.length === 0) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    const u = users[0];

    const [addrRows] = await userPool.query<any[]>(
      `SELECT address_id, label, flat_no, building, area, city, pincode, is_default
       FROM user_addresses WHERE user_id = ? AND is_deleted = 0
       ORDER BY is_default DESC, address_id DESC LIMIT 1`,
      [userId]
    );

    return {
      id: String(u.user_id),
      name: u.full_name,
      email: u.email,
      mobile: u.phone,
      createdAt: u.created_at,
      deliveryLocation: AuthService.deliveryLocation(addrRows[0]),
    };
  }

  static async getAddresses(userId: number) {
    const [rows] = await userPool.query<any[]>(
      `SELECT address_id as id, user_id as userId, label, flat_no as flatNo,
              building, area, city, pincode, lat, lng, is_default as isDefault
       FROM user_addresses
       WHERE user_id = ? AND is_deleted = 0
       ORDER BY is_default DESC, address_id DESC`,
      [userId]
    );
    return rows;
  }

  static async createAddress(userId: number, data: any) {
    const { label = 'Home', flatNo, building, area, city, pincode, lat, lng, isDefault } = data;

    if (!flatNo || !area || !city || !pincode) {
      throw Object.assign(new Error('flatNo, area, city, and pincode are required'), { statusCode: 400 });
    }

    if (isDefault) {
      await userPool.query(`UPDATE user_addresses SET is_default = 0 WHERE user_id = ?`, [userId]);
    }

    const [insert] = await userPool.query<any>(
      `INSERT INTO user_addresses (user_id, label, flat_no, building, area, city, pincode, lat, lng, is_default, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [userId, label, flatNo, building || null, area, city, pincode, lat || null, lng || null, isDefault ? 1 : 0]
    );

    return {
      id: insert.insertId,
      userId,
      label,
      flatNo,
      building,
      area,
      city,
      pincode,
      isDefault: Boolean(isDefault),
    };
  }

  static async setDefaultAddress(userId: number, addressId: number) {
    await userPool.query(`UPDATE user_addresses SET is_default = 0 WHERE user_id = ?`, [userId]);
    await userPool.query(`UPDATE user_addresses SET is_default = 1 WHERE user_id = ? AND address_id = ?`, [userId, addressId]);
    return { success: true };
  }

  static async deleteAddress(userId: number, addressId: number) {
    await userPool.query(`UPDATE user_addresses SET is_deleted = 1 WHERE user_id = ? AND address_id = ?`, [userId, addressId]);
    return { success: true };
  }

  /**
   * Customers with order counts and spend. With `storeIds`, only customers who ordered from those
   * stores, counted on those stores' orders; there is no identity-only fallback for that view.
   */
  static async getAllUsers(storeIds: number[] | null = null) {
    if (storeIds) {
      if (!storeIds.length) return [];
      const [rows] = await userPool.query<any[]>(
        `SELECT 
           u.user_id as id,
           u.phone,
           u.email,
           u.full_name as name,
           u.is_active as isActive,
           u.created_at as createdAt,
           s.orderCount,
           s.totalSpent,
           (SELECT CONCAT(a.flat_no, ', ', a.city, ' - ', a.pincode) 
            FROM user_addresses a 
            WHERE a.user_id = u.user_id AND a.is_deleted = 0 
            ORDER BY a.is_default DESC, a.address_id DESC LIMIT 1) as defaultAddress
         FROM (
           SELECT o.UserID as userId, COUNT(*) as orderCount,
                  COALESCE(SUM(CASE WHEN o.OrderStatus = 'cancelled' THEN 0 ELSE o.GrandTotal END), 0) as totalSpent
           FROM techxpertstore.orders o
           WHERE o.UserID IS NOT NULL AND o.StoreID IN (?)
           GROUP BY o.UserID
         ) s
         JOIN users u ON u.user_id = s.userId
         ORDER BY u.user_id ASC`,
        [storeIds]
      );
      return rows;
    }
    // Same-host cross-DB: spend stats from techxpertstore.orders (requires both schemas on one MySQL)
    try {
      const [rows] = await userPool.query<any[]>(
        `SELECT 
           u.user_id as id,
           u.phone,
           u.email,
           u.full_name as name,
           u.is_active as isActive,
           u.created_at as createdAt,
           (SELECT COUNT(*) FROM techxpertstore.orders o WHERE o.UserID = u.user_id) as orderCount,
           (SELECT COALESCE(SUM(o.GrandTotal), 0) FROM techxpertstore.orders o
            WHERE o.UserID = u.user_id AND o.OrderStatus <> 'cancelled') as totalSpent,
           (SELECT CONCAT(a.flat_no, ', ', a.city, ' - ', a.pincode) 
            FROM user_addresses a 
            WHERE a.user_id = u.user_id AND a.is_deleted = 0 
            ORDER BY a.is_default DESC, a.address_id DESC LIMIT 1) as defaultAddress
         FROM users u
         ORDER BY u.user_id ASC`
      );
      return rows;
    } catch (err) {
      console.warn('[AuthService] getAllUsers with order spend failed; returning identity-only rows', err);
      // Order figures are unknown here, not zero: the portal shows them as "Not available".
      const [rows] = await userPool.query<any[]>(
        `SELECT 
           u.user_id as id,
           u.phone,
           u.email,
           u.full_name as name,
           u.is_active as isActive,
           u.created_at as createdAt,
           NULL as orderCount,
           NULL as totalSpent,
           (SELECT CONCAT(a.flat_no, ', ', a.city, ' - ', a.pincode) 
            FROM user_addresses a 
            WHERE a.user_id = u.user_id AND a.is_deleted = 0 
            ORDER BY a.is_default DESC, a.address_id DESC LIMIT 1) as defaultAddress
         FROM users u
         ORDER BY u.user_id ASC`
      );
      return rows;
    }
  }
}
