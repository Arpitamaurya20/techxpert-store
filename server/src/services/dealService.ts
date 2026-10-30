import type { RowDataPacket } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { validateDealsBody, type DealTone } from '../utils/deals.js';
import { invalidateHomeBootCache } from '../utils/responseCache.js';

export type HomeDeal = {
  categoryId: number;
  name: string;
  available: boolean;
  title: string;
  highlight: string;
  tagline: string;
  tone: DealTone | string;
  imageUrl: string;
  position: number;
};

function onSale(value: unknown): boolean {
  return Number(value) === 1;
}

export class DealService {
  static async get(): Promise<{ deals: HomeDeal[] }> {
    const [rows] = await storePool.query<RowDataPacket[]>(
      `SELECT d.CategoryID as categoryId, c.CategoryName as name, c.IsActive as active,
              d.Title as title, d.Highlight as highlight, d.Tagline as tagline,
              d.Tone as tone, d.ImageURL as imageUrl, d.Position as position
       FROM home_deals d
       LEFT JOIN categories c ON c.ID = d.CategoryID
       ORDER BY d.Position ASC, d.ID ASC`
    );
    return {
      deals: rows.map((row) => ({
        categoryId: Number(row.categoryId),
        name: row.name ? String(row.name) : '',
        available: onSale(row.active),
        title: String(row.title),
        highlight: String(row.highlight ?? ''),
        tagline: String(row.tagline ?? ''),
        tone: String(row.tone),
        imageUrl: String(row.imageUrl ?? ''),
        position: Number(row.position),
      })),
    };
  }

  /** Replaces the row. Leaving the list out is refused. An empty list clears it. */
  static async save(body: unknown): Promise<{ deals: HomeDeal[] }> {
    const next = validateDealsBody(body);
    if (next.length > 0) {
      const ids = next.map((deal) => deal.categoryId);
      const [live] = await storePool.query<RowDataPacket[]>(
        `SELECT ID as id FROM categories WHERE IsActive = 1 AND ID IN (?)`,
        [ids]
      );
      const onSaleIds = new Set(live.map((row) => Number(row.id)));
      if (ids.some((id) => !onSaleIds.has(id))) {
        throw Object.assign(new Error('Pick a category that is on sale.'), { statusCode: 400 });
      }
    }
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM home_deals`);
      for (let i = 0; i < next.length; i++) {
        const deal = next[i];
        await conn.query(
          `INSERT INTO home_deals (CategoryID, Title, Highlight, Tagline, Tone, ImageURL, Position)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [deal.categoryId, deal.title, deal.highlight, deal.tagline, deal.tone, deal.imageUrl, i + 1]
        );
      }
      await conn.commit();
      invalidateHomeBootCache();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return DealService.get();
  }
}
