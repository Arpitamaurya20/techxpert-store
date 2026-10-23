import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';
import { resolveAssetUrl } from '../utils/validate.js';
import { isBannerLiveForCustomers } from '../utils/bannerEligibility.js';
import {
  HOMEPAGE_SECTIONS,
  canonicalSectionType,
  layoutSections,
  type LayoutSection,
} from '../data/homepageSections.js';

function withResolvedAssets<T extends { imageUrl?: string }>(row: T): T {
  if (!row?.imageUrl) return row;
  return { ...row, imageUrl: resolveAssetUrl(row.imageUrl) };
}

export class CmsService {
  static async getBanners(
    statusOnly?: string,
    opts?: { audience?: 'admin' | 'customer'; now?: Date },
  ) {
    const audience = opts?.audience ?? 'admin';
    try {
      let query = `
        SELECT 
          id,
          title,
          COALESCE(subtitle, '') as subtitle,
          image_url as imageUrl,
          cta_label as ctaLabel,
          cta_type as ctaType,
          cta_target as ctaTarget,
          status,
          starts_at as startsAt,
          ends_at as endsAt,
          display_order as position,
          terms_text as termsText,
          location_scope as locationScope,
          DATE_FORMAT(updated_at, '%Y-%m-%d') as updatedAt
        FROM cms_banners
      `;
      const params: any[] = [];
      if (audience === 'customer') {
        query += ` WHERE status IN ('published', 'scheduled')`;
      } else if (statusOnly) {
        query += ` WHERE status = ?`;
        params.push(statusOnly);
      }
      query += ` ORDER BY display_order ASC`;

      const [rows] = await storePool.query<any[]>(query, params);
      return CmsService.visibleBanners(rows, audience, opts?.now);
    } catch (err) {
      return mysqlOrFileStore('cms.getBanners', err, () => {
        let rows = store.getBanners();
        if (audience === 'customer') {
          rows = rows.filter((row) => row.status === 'published' || row.status === 'scheduled');
        } else if (statusOnly) {
          rows = rows.filter((row) => row.status === statusOnly);
        }
        return CmsService.visibleBanners(rows, audience, opts?.now);
      });
    }
  }

  private static visibleBanners(rows: any[], audience: 'admin' | 'customer', now?: Date) {
    const mapped = rows.map((r) => withResolvedAssets(r));
    if (audience !== 'customer') return mapped;
    return mapped.filter((row) => isBannerLiveForCustomers(row, now));
  }

  static async createBanner(data: any) {
    const { title, subtitle, imageUrl, ctaLabel, ctaType, ctaTarget, status, termsText, locationScope, startsAt, endsAt } = data;

    if (!title || !imageUrl) {
      throw Object.assign(new Error('A banner needs a title and an image.'), { statusCode: 400 });
    }

    try {
      const [countRow] = await storePool.query<any[]>(`SELECT COUNT(*) as cnt FROM cms_banners`);
      const nextOrder = (countRow[0]?.cnt || 0) + 1;

      const [insertRes] = await storePool.query<any>(
        `INSERT INTO cms_banners
         (title, subtitle, image_url, cta_label, cta_type, cta_target, status, starts_at, ends_at, display_order, terms_text, location_scope)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          subtitle || null,
          imageUrl,
          ctaLabel || 'Shop Now',
          ctaType || 'category',
          ctaTarget || '/category/1',
          status || 'published',
          startsAt || null,
          endsAt || null,
          nextOrder,
          termsText || null,
          locationScope || 'All serviceable zones',
        ]
      );

      return withResolvedAssets({
        id: String(insertRes.insertId),
        title,
        subtitle: subtitle || '',
        imageUrl,
        ctaLabel: ctaLabel || 'Shop Now',
        ctaType: ctaType || 'category',
        ctaTarget: ctaTarget || '/category/1',
        status: status || 'published',
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        position: nextOrder,
        termsText: termsText || '',
        locationScope: locationScope || 'All serviceable zones',
        updatedAt: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      return mysqlOrFileStore('cms.createBanner', err, () =>
        store.createBanner({
          id: `banner-${Date.now()}`,
          title,
          subtitle: subtitle || '',
          imageUrl,
          ctaLabel: ctaLabel || 'Shop Now',
          ctaType: ctaType || 'category',
          ctaTarget: ctaTarget || '/category/cement-plaster',
          status: status || 'draft',
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
          position: store.getBanners().length + 1,
          termsText: termsText || '',
          locationScope: locationScope || 'All serviceable zones',
          updatedAt: new Date().toLocaleDateString(),
        })
      );
    }
  }

  static async updateBanner(id: string | number, data: any) {
    const { title, subtitle, imageUrl, ctaLabel, ctaType, ctaTarget, status, termsText, locationScope, position, startsAt, endsAt } = data;
    const setStarts = startsAt !== undefined;
    const setEnds = endsAt !== undefined;

    try {
      await storePool.query(
        `UPDATE cms_banners
         SET 
           title = COALESCE(?, title),
           subtitle = COALESCE(?, subtitle),
           image_url = COALESCE(?, image_url),
           cta_label = COALESCE(?, cta_label),
           cta_type = COALESCE(?, cta_type),
           cta_target = COALESCE(?, cta_target),
           status = COALESCE(?, status),
           starts_at = IF(? = 1, ?, starts_at),
           ends_at = IF(? = 1, ?, ends_at),
           display_order = COALESCE(?, display_order),
           terms_text = COALESCE(?, terms_text),
           location_scope = COALESCE(?, location_scope)
         WHERE id = ?`,
        [
          title || null,
          subtitle !== undefined && subtitle !== null ? String(subtitle) : null,
          imageUrl || null,
          ctaLabel || null,
          ctaType || null,
          ctaTarget || null,
          status || null,
          setStarts ? 1 : 0,
          setStarts ? startsAt || null : null,
          setEnds ? 1 : 0,
          setEnds ? endsAt || null : null,
          position !== undefined ? Number(position) : null,
          termsText || null,
          locationScope || null,
          id,
        ]
      );

      const saved = (await CmsService.getBanners()).find((b: any) => String(b.id) === String(id));
      if (!saved) throw Object.assign(new Error('That banner no longer exists.'), { statusCode: 404 });
      return saved;
    } catch (err: any) {
      if (err?.statusCode) throw err;
      return mysqlOrFileStore('cms.updateBanner', err, () => {
        const updated = store.updateBanner(String(id), { ...data, updatedAt: new Date().toLocaleDateString() });
        if (!updated) throw Object.assign(new Error('Banner not found'), { statusCode: 404 });
        return updated;
      });
    }
  }

  static async deleteBanner(id: string | number) {
    try {
      await storePool.query(`DELETE FROM cms_banners WHERE id = ?`, [id]);
      return { success: true };
    } catch (err) {
      return mysqlOrFileStore('cms.deleteBanner', err, () => {
        const deleted = store.deleteBanner(String(id));
        if (!deleted) throw Object.assign(new Error('Banner not found'), { statusCode: 404 });
        return { success: true };
      });
    }
  }

  static async reorderBanners(items: { id: string | number; position: number }[]) {
    for (const it of items) {
      try {
        await storePool.query(`UPDATE cms_banners SET display_order = ? WHERE id = ?`, [it.position, it.id]);
      } catch (e) {
        console.warn('[CmsService] banner order update failed for id', it.id, e);
      }
    }
    return { success: true };
  }

  private static async readSectionRows() {
    const [rows] = await storePool.query<any[]>(
      `SELECT id, section_code as sectionCode, section_type as sectionType,
              title, display_order as displayOrder, is_enabled as isEnabled, description
       FROM cms_homepage_sections
       ORDER BY display_order ASC, id ASC`
    );
    return rows;
  }

  /** Insert any phone block that has no stored row yet. Does not overwrite a row the desk already edited. */
  private static async ensureHomepageSections(rows: any[]) {
    let nextPosition = rows.reduce((max, row) => Math.max(max, Number(row.displayOrder) || 0), 0);
    for (const def of HOMEPAGE_SECTIONS) {
      const taken = rows.some((row) => canonicalSectionType(row.sectionCode, row.sectionType) === def.type);
      if (taken) continue;
      nextPosition += 1;
      const position = rows.length === 0 ? def.position : nextPosition;
      try {
        await storePool.query(
          `INSERT INTO cms_homepage_sections
           (section_code, section_type, title, display_order, is_enabled, description)
           VALUES (?, ?, ?, ?, 1, ?)`,
          [def.type, def.type, def.title, position, def.description]
        );
      } catch (err: any) {
        if (err?.code !== 'ER_DUP_ENTRY') throw err;
      }
    }
  }

  static async getSections(opts?: { audience?: 'admin' | 'customer' }) {
    const audience = opts?.audience ?? 'admin';
    try {
      let rows = await CmsService.readSectionRows();
      await CmsService.ensureHomepageSections(rows);
      rows = await CmsService.readSectionRows();
      return layoutSections(rows, audience);
    } catch (err) {
      return mysqlOrFileStore('cms.getSections', err, () => layoutSections(fallbackSections, audience));
    }
  }

  static async updateSection(id: string | number, data: { enabled?: boolean; position?: number; title?: string; description?: string }) {
    try {
      await storePool.query(
        `UPDATE cms_homepage_sections
         SET
           is_enabled = COALESCE(?, is_enabled),
           display_order = COALESCE(?, display_order),
           title = COALESCE(?, title),
           description = COALESCE(?, description)
         WHERE id = ?`,
        [
          data.enabled === undefined ? null : data.enabled ? 1 : 0,
          data.position !== undefined ? Number(data.position) : null,
          data.title || null,
          data.description || null,
          id,
        ]
      );
      const sections = await CmsService.getSections({ audience: 'admin' });
      const updated = sections.find((s) => s.id === String(id));
      if (updated) return updated;
    } catch (err) {
      return mysqlOrFileStore('cms.updateSection', err, () => {
        const idx = fallbackSections.findIndex((s) => s.id === String(id) || s.type === String(id));
        if (idx === -1) throw Object.assign(new Error('Section not found'), { statusCode: 404 });
        if (data.enabled !== undefined) fallbackSections[idx].enabled = data.enabled;
        if (data.position !== undefined) fallbackSections[idx].position = data.position;
        if (data.title) fallbackSections[idx].title = data.title;
        if (data.description !== undefined) fallbackSections[idx].description = data.description;
        return fallbackSections[idx];
      });
    }
  }

  static async reorderSections(items: { id: string | number; position: number }[]) {
    for (const it of items) {
      try {
        await storePool.query(
          `UPDATE cms_homepage_sections SET display_order = ? WHERE id = ?`,
          [it.position, it.id]
        );
      } catch (e) {
        console.warn('[CmsService] section order update failed for id', it.id, e);
      }
    }

    for (const it of items) {
      const sec = fallbackSections.find((s) => s.id === String(it.id) || s.type === String(it.id));
      if (sec) sec.position = it.position;
    }

    return { success: true };
  }

  static async resetSections() {
    try {
      let rows = await CmsService.readSectionRows();
      await CmsService.ensureHomepageSections(rows);
      rows = await CmsService.readSectionRows();
      for (const def of HOMEPAGE_SECTIONS) {
        const row = rows.find((item) => canonicalSectionType(item.sectionCode, item.sectionType) === def.type);
        if (!row) continue;
        await storePool.query(
          `UPDATE cms_homepage_sections
           SET display_order = ?, is_enabled = 1, title = ?, description = ?
           WHERE id = ?`,
          [def.position, def.title, def.description, row.id]
        );
      }
      fallbackSections.splice(0, fallbackSections.length, ...defaultFallbackSections());
      return CmsService.getSections({ audience: 'admin' });
    } catch (err) {
      return mysqlOrFileStore('cms.resetSections', err, () => {
        fallbackSections.splice(0, fallbackSections.length, ...defaultFallbackSections());
        return layoutSections(fallbackSections, 'admin');
      });
    }
  }
}

function defaultFallbackSections(): LayoutSection[] {
  return layoutSections([], 'admin');
}

/** Used when MySQL is down. Ids match the section type so a local toggle still lines up. */
let fallbackSections: LayoutSection[] = defaultFallbackSections();
