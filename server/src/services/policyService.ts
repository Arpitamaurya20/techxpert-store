import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import {
  POLICY_IDS,
  POLICY_TITLES,
  validatePolicyBody,
  type PolicyBlock,
  type PolicyId,
  type PolicySection,
} from '../utils/policies.js';

export type PolicyDocument = {
  id: PolicyId;
  title: string;
  lastUpdated: string;
  sourceUrl: string;
  intro: string[];
  sections: PolicySection[];
};

const blank = (id: PolicyId): PolicyDocument => ({
  id,
  title: POLICY_TITLES[id],
  lastUpdated: '',
  sourceUrl: '',
  intro: [],
  sections: [],
});

export class PolicyService {
  static async list(): Promise<{ policies: PolicyDocument[] }> {
    const [pages] = await storePool.query<RowDataPacket[]>(
      `SELECT PolicyID as policyId, LastUpdated as lastUpdated, SourceUrl as sourceUrl FROM policy_pages`
    );
    const [intros] = await storePool.query<RowDataPacket[]>(
      `SELECT PolicyID as policyId, Paragraph as paragraph, Position as position
       FROM policy_intro ORDER BY Position ASC, ID ASC`
    );
    const [sections] = await storePool.query<RowDataPacket[]>(
      `SELECT ID as id, PolicyID as policyId, Heading as heading, Position as position
       FROM policy_sections ORDER BY Position ASC, ID ASC`
    );
    const [blocks] = await storePool.query<RowDataPacket[]>(
      `SELECT ID as id, SectionID as sectionId, Kind as kind, Paragraph as paragraph, Position as position
       FROM policy_blocks ORDER BY Position ASC, ID ASC`
    );
    const [bullets] = await storePool.query<RowDataPacket[]>(
      `SELECT BlockID as blockId, Bullet as bullet, Position as position
       FROM policy_bullets ORDER BY Position ASC, ID ASC`
    );
    const byPolicy = new Map<string, PolicyDocument>(POLICY_IDS.map((id) => [id, blank(id)]));
    for (const row of pages) {
      const page = byPolicy.get(String(row.policyId));
      if (!page) continue;
      page.lastUpdated = String(row.lastUpdated ?? '');
      page.sourceUrl = String(row.sourceUrl ?? '');
    }
    for (const row of intros) {
      byPolicy.get(String(row.policyId))?.intro.push(String(row.paragraph));
    }
    const sectionById = new Map<number, PolicySection>();
    for (const row of sections) {
      const page = byPolicy.get(String(row.policyId));
      if (!page) continue;
      const section: PolicySection = { heading: String(row.heading), blocks: [] };
      page.sections.push(section);
      sectionById.set(Number(row.id), section);
    }
    const blockById = new Map<number, string[]>();
    for (const row of blocks) {
      const section = sectionById.get(Number(row.sectionId));
      if (!section) continue;
      if (row.kind === 'list') {
        const list: string[] = [];
        section.blocks.push(list);
        blockById.set(Number(row.id), list);
      } else if (row.paragraph) {
        section.blocks.push(String(row.paragraph));
      }
    }
    for (const row of bullets) {
      blockById.get(Number(row.blockId))?.push(String(row.bullet));
    }
    return { policies: POLICY_IDS.map((id) => byPolicy.get(id)!) };
  }

  /** Replaces one policy. Both lists must be sent. Empty lists clear that policy only. */
  static async save(id: unknown, body: unknown): Promise<{ policies: PolicyDocument[] }> {
    const next = validatePolicyBody(id, body);
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `DELETE b FROM policy_bullets b
         INNER JOIN policy_blocks k ON k.ID = b.BlockID
         INNER JOIN policy_sections s ON s.ID = k.SectionID
         WHERE s.PolicyID = ?`,
        [next.id]
      );
      await conn.query(
        `DELETE k FROM policy_blocks k
         INNER JOIN policy_sections s ON s.ID = k.SectionID
         WHERE s.PolicyID = ?`,
        [next.id]
      );
      await conn.query(`DELETE FROM policy_sections WHERE PolicyID = ?`, [next.id]);
      await conn.query(`DELETE FROM policy_intro WHERE PolicyID = ?`, [next.id]);
      await conn.query(`DELETE FROM policy_pages WHERE PolicyID = ?`, [next.id]);
      const published = next.intro.length > 0 || next.sections.length > 0;
      if (published) {
        await conn.query(`INSERT INTO policy_pages (PolicyID, LastUpdated, SourceUrl) VALUES (?, ?, ?)`, [
          next.id,
          next.lastUpdated,
          next.sourceUrl,
        ]);
        for (let i = 0; i < next.intro.length; i++) {
          await conn.query(`INSERT INTO policy_intro (PolicyID, Paragraph, Position) VALUES (?, ?, ?)`, [
            next.id,
            next.intro[i],
            i + 1,
          ]);
        }
        for (let i = 0; i < next.sections.length; i++) {
          const section = next.sections[i];
          const [inserted] = await conn.query<ResultSetHeader>(
            `INSERT INTO policy_sections (PolicyID, Heading, Position) VALUES (?, ?, ?)`,
            [next.id, section.heading, i + 1]
          );
          for (let b = 0; b < section.blocks.length; b++) {
            const block: PolicyBlock = section.blocks[b];
            if (typeof block === 'string') {
              await conn.query(
                `INSERT INTO policy_blocks (SectionID, Kind, Paragraph, Position) VALUES (?, 'paragraph', ?, ?)`,
                [inserted.insertId, block, b + 1]
              );
            } else {
              const [list] = await conn.query<ResultSetHeader>(
                `INSERT INTO policy_blocks (SectionID, Kind, Paragraph, Position) VALUES (?, 'list', NULL, ?)`,
                [inserted.insertId, b + 1]
              );
              for (let n = 0; n < block.length; n++) {
                await conn.query(`INSERT INTO policy_bullets (BlockID, Bullet, Position) VALUES (?, ?, ?)`, [
                  list.insertId,
                  block[n],
                  n + 1,
                ]);
              }
            }
          }
        }
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return PolicyService.list();
  }
}
