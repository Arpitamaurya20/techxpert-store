import type { RowDataPacket } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { validateAboutBody, type AboutIcon } from '../utils/aboutPage.js';

export type AboutFact = { value: string; label: string; position: number };
export type AboutValue = { icon: AboutIcon | string; title: string; body: string; position: number };
export type AboutContent = {
  missionTitle: string;
  missionBody: string;
  facts: AboutFact[];
  values: AboutValue[];
};

export class AboutService {
  static async get(): Promise<AboutContent> {
    const [pages] = await storePool.query<RowDataPacket[]>(
      `SELECT MissionTitle as missionTitle, MissionBody as missionBody FROM about_page WHERE ID = 1 LIMIT 1`
    );
    const [facts] = await storePool.query<RowDataPacket[]>(
      `SELECT FactValue as factValue, FactLabel as factLabel, Position as position
       FROM about_facts ORDER BY Position ASC, ID ASC`
    );
    const [values] = await storePool.query<RowDataPacket[]>(
      `SELECT Icon as icon, Title as title, Body as body, Position as position
       FROM about_values ORDER BY Position ASC, ID ASC`
    );
    const page = pages[0];
    return {
      missionTitle: page ? String(page.missionTitle ?? '') : '',
      missionBody: page ? String(page.missionBody ?? '') : '',
      facts: facts.map((row) => ({
        value: String(row.factValue),
        label: String(row.factLabel),
        position: Number(row.position),
      })),
      values: values.map((row) => ({
        icon: String(row.icon),
        title: String(row.title),
        body: String(row.body),
        position: Number(row.position),
      })),
    };
  }

  /** Replaces the page. An empty body clears it. */
  static async save(body: unknown): Promise<AboutContent> {
    const next = validateAboutBody(body);
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO about_page (ID, MissionTitle, MissionBody) VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE MissionTitle = VALUES(MissionTitle), MissionBody = VALUES(MissionBody)`,
        [next.missionTitle, next.missionBody]
      );
      await conn.query(`DELETE FROM about_facts`);
      await conn.query(`DELETE FROM about_values`);
      for (let i = 0; i < next.facts.length; i++) {
        const fact = next.facts[i];
        await conn.query(`INSERT INTO about_facts (FactValue, FactLabel, Position) VALUES (?, ?, ?)`, [
          fact.value,
          fact.label,
          i + 1,
        ]);
      }
      for (let i = 0; i < next.values.length; i++) {
        const value = next.values[i];
        await conn.query(`INSERT INTO about_values (Icon, Title, Body, Position) VALUES (?, ?, ?, ?)`, [
          value.icon,
          value.title,
          value.body,
          i + 1,
        ]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return AboutService.get();
  }
}
