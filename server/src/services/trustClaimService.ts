import type { RowDataPacket } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { validateTrustClaims, type TrustAction, type TrustIcon } from '../utils/trustClaims.js';
import { invalidateHomeBootCache } from '../utils/responseCache.js';

export type TrustClaim = {
  label: string;
  icon: TrustIcon | string;
  action: TrustAction | string;
  position: number;
};

export type TrustContent = { claims: TrustClaim[] };

export class TrustClaimService {
  static async get(): Promise<TrustContent> {
    const [rows] = await storePool.query<RowDataPacket[]>(
      `SELECT Label as label, Icon as icon, Action as action, Position as position
       FROM trust_claims ORDER BY Position ASC, ID ASC`
    );
    return {
      claims: rows.map((row) => ({
        label: String(row.label),
        icon: String(row.icon),
        action: String(row.action),
        position: Number(row.position),
      })),
    };
  }

  /** Replaces the strip. An empty list clears it. A missing list is refused. */
  static async save(body: unknown): Promise<TrustContent> {
    const next = validateTrustClaims(body);
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM trust_claims`);
      for (let i = 0; i < next.length; i++) {
        const claim = next[i];
        await conn.query(`INSERT INTO trust_claims (Label, Icon, Action, Position) VALUES (?, ?, ?, ?)`, [
          claim.label,
          claim.icon,
          claim.action,
          i + 1,
        ]);
      }
      await conn.commit();
      invalidateHomeBootCache();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return TrustClaimService.get();
  }
}
