import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { validateHomeBody, type Calculator, type HomeInput } from '../utils/homeMerch.js';

export type HomeShortcut = {
  categoryId: number;
  /** Short name staff typed. Empty means the app should show `name`. */
  label: string;
  name: string;
  imageUrl: string;
  available: boolean;
};

export type HomeProjectCategory = { categoryId: number; name: string; available: boolean };

export type HomeProject = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  calculator: Calculator | string;
  categories: HomeProjectCategory[];
};

export type HomeContent = { shortcuts: HomeShortcut[]; projects: HomeProject[] };

function onSale(value: unknown): boolean {
  return Number(value) === 1;
}

export class HomeMerchService {
  static async get(): Promise<HomeContent> {
    const [shortcutRows] = await storePool.query<RowDataPacket[]>(
      `SELECT s.CategoryID as categoryId, s.Label as label, c.CategoryName as name,
              c.CategoryImage as imageUrl, c.IsActive as active
       FROM home_shortcuts s
       LEFT JOIN categories c ON c.ID = s.CategoryID
       ORDER BY s.Position ASC, s.ID ASC`
    );
    const [projectRows] = await storePool.query<RowDataPacket[]>(
      `SELECT ID as id, Title as title, Subtitle as subtitle, ImageURL as imageUrl, Calculator as calculator
       FROM home_projects
       ORDER BY Position ASC, ID ASC`
    );
    const [categoryRows] = await storePool.query<RowDataPacket[]>(
      `SELECT pc.ProjectID as projectId, pc.CategoryID as categoryId, c.CategoryName as name, c.IsActive as active
       FROM home_project_categories pc
       LEFT JOIN categories c ON c.ID = pc.CategoryID
       ORDER BY pc.ProjectID ASC, pc.Position ASC`
    );
    const byProject = new Map<number, HomeProjectCategory[]>();
    for (const row of categoryRows) {
      const projectId = Number(row.projectId);
      const list = byProject.get(projectId) ?? [];
      list.push({
        categoryId: Number(row.categoryId),
        name: row.name ? String(row.name) : '',
        available: onSale(row.active),
      });
      byProject.set(projectId, list);
    }
    return {
      shortcuts: shortcutRows.map((row) => ({
        categoryId: Number(row.categoryId),
        label: String(row.label ?? ''),
        name: row.name ? String(row.name) : '',
        imageUrl: row.imageUrl ? String(row.imageUrl) : '',
        available: onSale(row.active),
      })),
      projects: projectRows.map((row) => ({
        id: Number(row.id),
        title: String(row.title),
        subtitle: String(row.subtitle ?? ''),
        imageUrl: String(row.imageUrl ?? ''),
        calculator: String(row.calculator ?? ''),
        categories: byProject.get(Number(row.id)) ?? [],
      })),
    };
  }

  /** Replaces the page. An empty body clears it. Every category must be on sale. */
  static async save(body: unknown): Promise<HomeContent> {
    const next: HomeInput = validateHomeBody(body);
    const wanted = [
      ...new Set([
        ...next.shortcuts.map((row) => row.categoryId),
        ...next.projects.flatMap((project) => project.categoryIds),
      ]),
    ];
    if (wanted.length > 0) {
      const [live] = await storePool.query<RowDataPacket[]>(
        `SELECT ID as id FROM categories WHERE IsActive = 1 AND ID IN (?)`,
        [wanted]
      );
      const onSaleIds = new Set(live.map((row) => Number(row.id)));
      if (wanted.some((id) => !onSaleIds.has(id))) {
        throw Object.assign(new Error('Pick a category that is on sale.'), { statusCode: 400 });
      }
    }

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM home_project_categories`);
      await conn.query(`DELETE FROM home_projects`);
      await conn.query(`DELETE FROM home_shortcuts`);
      for (let i = 0; i < next.shortcuts.length; i++) {
        const row = next.shortcuts[i];
        await conn.query(
          `INSERT INTO home_shortcuts (CategoryID, Label, Position) VALUES (?, ?, ?)`,
          [row.categoryId, row.label, i + 1]
        );
      }
      for (let i = 0; i < next.projects.length; i++) {
        const project = next.projects[i];
        const [created] = await conn.query<ResultSetHeader>(
          `INSERT INTO home_projects (Title, Subtitle, ImageURL, Calculator, Position) VALUES (?, ?, ?, ?, ?)`,
          [project.title, project.subtitle, project.imageUrl, project.calculator, i + 1]
        );
        for (let c = 0; c < project.categoryIds.length; c++) {
          await conn.query(
            `INSERT INTO home_project_categories (ProjectID, CategoryID, Position) VALUES (?, ?, ?)`,
            [created.insertId, project.categoryIds[c], c + 1]
          );
        }
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return HomeMerchService.get();
  }
}
