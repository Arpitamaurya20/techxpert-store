import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';

export class CmsService {
  static async getBanners(statusOnly?: string) {
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
          display_order as position,
          terms_text as termsText,
          location_scope as locationScope,
          DATE_FORMAT(updated_at, '%Y-%m-%d') as updatedAt
        FROM techxpertstore.cms_banners
      `;
      const params: any[] = [];
      if (statusOnly) {
        query += ` WHERE status = ?`;
        params.push(statusOnly);
      }
      query += ` ORDER BY display_order ASC`;

      const [rows] = await storePool.query<any[]>(query, params);
      if (rows.length > 0) return rows;
    } catch (err) {
      console.warn('[CmsService] MySQL banners query failed, fallback', err);
    }
    return store.getBanners();
  }

  static async createBanner(data: any) {
    const { title, subtitle, imageUrl, ctaLabel, ctaType, ctaTarget, status, termsText, locationScope } = data;

    if (!title || !imageUrl) {
      throw new Error('Title and imageUrl are required');
    }

    try {
      const [countRow] = await storePool.query<any[]>(`SELECT COUNT(*) as cnt FROM techxpertstore.cms_banners`);
      const nextOrder = (countRow[0]?.cnt || 0) + 1;

      const [insertRes] = await storePool.query<any>(
        `INSERT INTO techxpertstore.cms_banners
         (title, subtitle, image_url, cta_label, cta_type, cta_target, status, display_order, terms_text, location_scope)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          subtitle || null,
          imageUrl,
          ctaLabel || 'Shop Now',
          ctaType || 'category',
          ctaTarget || '/category/1',
          status || 'published',
          nextOrder,
          termsText || null,
          locationScope || 'All serviceable zones',
        ]
      );

      return {
        id: String(insertRes.insertId),
        title,
        subtitle: subtitle || '',
        imageUrl,
        ctaLabel: ctaLabel || 'Shop Now',
        ctaType: ctaType || 'category',
        ctaTarget: ctaTarget || '/category/1',
        status: status || 'published',
        position: nextOrder,
        termsText: termsText || '',
        locationScope: locationScope || 'All serviceable zones',
        updatedAt: new Date().toISOString().slice(0, 10),
      };
    } catch (err) {
      console.warn('[CmsService] MySQL insert banner failed, fallback', err);
    }

    return store.createBanner({
      id: `banner-${Date.now()}`,
      title,
      subtitle: subtitle || '',
      imageUrl,
      ctaLabel: ctaLabel || 'Shop Now',
      ctaType: ctaType || 'category',
      ctaTarget: ctaTarget || '/category/cement-plaster',
      status: status || 'draft',
      position: store.getBanners().length + 1,
      termsText: termsText || '',
      locationScope: locationScope || 'All serviceable zones',
      updatedAt: new Date().toLocaleDateString(),
    });
  }

  static async updateBanner(id: string | number, data: any) {
    const { title, subtitle, imageUrl, ctaLabel, ctaType, ctaTarget, status, termsText, locationScope, position } = data;

    try {
      await storePool.query(
        `UPDATE techxpertstore.cms_banners
         SET 
           title = COALESCE(?, title),
           subtitle = COALESCE(?, subtitle),
           image_url = COALESCE(?, image_url),
           cta_label = COALESCE(?, cta_label),
           cta_type = COALESCE(?, cta_type),
           cta_target = COALESCE(?, cta_target),
           status = COALESCE(?, status),
           display_order = COALESCE(?, display_order),
           terms_text = COALESCE(?, terms_text),
           location_scope = COALESCE(?, location_scope)
         WHERE id = ?`,
        [
          title || null,
          subtitle || null,
          imageUrl || null,
          ctaLabel || null,
          ctaType || null,
          ctaTarget || null,
          status || null,
          position !== undefined ? Number(position) : null,
          termsText || null,
          locationScope || null,
          id,
        ]
      );

      return {
        id: String(id),
        ...data,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
    } catch (err) {
      console.warn('[CmsService] MySQL update banner failed, fallback', err);
    }

    const updated = store.updateBanner(String(id), { ...data, updatedAt: new Date().toLocaleDateString() });
    if (!updated) throw new Error('Banner not found');
    return updated;
  }

  static async deleteBanner(id: string | number) {
    try {
      await storePool.query(`DELETE FROM techxpertstore.cms_banners WHERE id = ?`, [id]);
      return { success: true };
    } catch (err) {
      console.warn('[CmsService] MySQL delete banner failed, fallback', err);
    }
    const deleted = store.deleteBanner(String(id));
    if (!deleted) throw new Error('Banner not found');
    return { success: true };
  }

  static async reorderBanners(items: { id: string | number; position: number }[]) {
    for (const it of items) {
      try {
        await storePool.query(`UPDATE techxpertstore.cms_banners SET display_order = ? WHERE id = ?`, [it.position, it.id]);
      } catch (e) {
        console.warn('[CmsService] banner order update failed for id', it.id, e);
      }
    }
    return { success: true };
  }

  static async getSections() {
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT id, section_code as sectionCode, section_type as sectionType,
                title, display_order as displayOrder, is_enabled as isEnabled, description
         FROM techxpertstore.cms_homepage_sections
         ORDER BY display_order ASC`
      );
      if (rows.length > 0) return rows;
    } catch (err) {
      console.warn('[CmsService] MySQL sections failed, fallback', err);
    }

    return [
      { id: 1, sectionCode: 'hero_banners', sectionType: 'banner_carousel', title: 'Featured Promotions', displayOrder: 1, isEnabled: 1 },
      { id: 2, sectionCode: 'popular_categories', sectionType: 'category_grid', title: 'Shop by Category', displayOrder: 2, isEnabled: 1 },
      { id: 3, sectionCode: 'bulk_deals', sectionType: 'product_deal_slider', title: 'Bulk Contractor Tiers', displayOrder: 3, isEnabled: 1 },
    ];
  }
}
