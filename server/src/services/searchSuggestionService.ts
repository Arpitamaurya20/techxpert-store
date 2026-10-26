import type { RowDataPacket } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { validateSearchSuggestions } from '../utils/searchSuggestions.js';

export type SearchIdeas = { suggestions: string[] };

export class SearchSuggestionService {
  static async get(): Promise<SearchIdeas> {
    const [rows] = await storePool.query<RowDataPacket[]>(
      `SELECT Phrase as phrase FROM search_suggestions ORDER BY Position ASC, ID ASC`
    );
    return { suggestions: rows.map((row) => String(row.phrase)) };
  }

  /** Replaces the list. An empty list clears it. A missing list is refused. */
  static async save(body: unknown): Promise<SearchIdeas> {
    const next = validateSearchSuggestions(body);
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM search_suggestions`);
      for (let i = 0; i < next.length; i++) {
        await conn.query(`INSERT INTO search_suggestions (Phrase, Position) VALUES (?, ?)`, [next[i], i + 1]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return SearchSuggestionService.get();
  }
}
