import crypto from 'crypto';
import { storePool } from '../db/mysql.js';

export type IdempotencyRow = {
  requestHash: string;
  status: 'pending' | 'completed';
  statusCode: number | null;
  responseJson: string | null;
};

export type IdempotencyDecision =
  | { action: 'proceed' }
  | { action: 'replay'; statusCode: number; responseJson: string }
  | { action: 'conflict' };

export function hashCheckoutBody(body: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(body ?? {})).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function idempotencyDecision(input: {
  existing: IdempotencyRow | null;
  requestHash: string;
}): IdempotencyDecision {
  if (!input.existing) return { action: 'proceed' };
  if (input.existing.requestHash !== input.requestHash) return { action: 'conflict' };
  if (input.existing.status === 'pending') return { action: 'conflict' };
  if (input.existing.statusCode != null && input.existing.responseJson != null) {
    return {
      action: 'replay',
      statusCode: input.existing.statusCode,
      responseJson: input.existing.responseJson,
    };
  }
  return { action: 'conflict' };
}

export class CheckoutIdempotencyService {
  static async begin(userId: number, key: string, requestHash: string): Promise<IdempotencyDecision> {
    const [rows] = await storePool.query<any[]>(
      `SELECT RequestHash as requestHash, Status as status, StatusCode as statusCode, ResponseJson as responseJson
       FROM checkout_idempotency
       WHERE UserID = ? AND IdempotencyKey = ? AND ExpiresAt > NOW()
       LIMIT 1`,
      [userId, key]
    );
    const existing = rows[0]
      ? {
          requestHash: String(rows[0].requestHash),
          status: rows[0].status === 'completed' ? ('completed' as const) : ('pending' as const),
          statusCode: rows[0].statusCode == null ? null : Number(rows[0].statusCode),
          responseJson: rows[0].responseJson == null ? null : String(rows[0].responseJson),
        }
      : null;

    const decision = idempotencyDecision({ existing, requestHash });
    if (decision.action !== 'proceed') return decision;

    try {
      await storePool.query(
        `INSERT INTO checkout_idempotency
           (UserID, IdempotencyKey, RequestHash, Status, ExpiresAt)
         VALUES (?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
        [userId, key, requestHash]
      );
      return { action: 'proceed' };
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        return CheckoutIdempotencyService.begin(userId, key, requestHash);
      }
      throw err;
    }
  }

  static async complete(
    userId: number,
    key: string,
    statusCode: number,
    responseBody: unknown
  ): Promise<void> {
    await storePool.query(
      `UPDATE checkout_idempotency
       SET Status = 'completed', StatusCode = ?, ResponseJson = ?
       WHERE UserID = ? AND IdempotencyKey = ?`,
      [statusCode, JSON.stringify(responseBody), userId, key]
    );
  }
}
