import { Router, Request, Response } from 'express';
import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';

const router = Router();

// GET /cms/banners
router.get('/banners', async (_req: Request, res: Response) => {
  try {
    const [rows] = await storePool.query<any[]>(
      `SELECT 
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
       ORDER BY display_order ASC`
    );

    if (rows.length > 0) {
      return res.json({ data: rows });
    }
  } catch (err) {
    console.warn('[CMS] Failed reading banners from MySQL, falling back', err);
  }

  const banners = store.getBanners();
  return res.json({ data: banners });
});

// POST /cms/banners
router.post('/banners', async (req: Request, res: Response) => {
  const { title, subtitle, imageUrl, ctaLabel, ctaType, ctaTarget, status, termsText, locationScope } =
    req.body;

  if (!title || !imageUrl) {
    return res.status(400).json({ error: 'Title and imageUrl are required' });
  }

  try {
    const [countRow] = await storePool.query<any[]>(
      `SELECT COUNT(*) as cnt FROM techxpertstore.cms_banners`
    );
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

    return res.status(201).json({
      data: {
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
      },
    });
  } catch (err) {
    console.warn('[CMS] Insert into MySQL failed, fallback to local store', err);
  }

  const banners = store.getBanners();
  const newBanner = store.createBanner({
    id: `banner-${Date.now()}`,
    title,
    subtitle: subtitle || '',
    imageUrl,
    ctaLabel: ctaLabel || 'Shop Now',
    ctaType: ctaType || 'category',
    ctaTarget: ctaTarget || '/category/cement-plaster',
    status: status || 'draft',
    position: banners.length + 1,
    termsText: termsText || '',
    locationScope: locationScope || 'All serviceable zones',
    updatedAt: new Date().toLocaleDateString(),
  });

  return res.status(201).json({ data: newBanner });
});

// PUT /cms/banners/:id
router.put('/banners/:id', async (req: Request, res: Response) => {
  const { title, subtitle, imageUrl, ctaLabel, ctaType, ctaTarget, status, termsText, locationScope, position } =
    req.body;

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
        req.params.id,
      ]
    );

    return res.json({
      data: {
        id: req.params.id,
        ...req.body,
        updatedAt: new Date().toISOString().slice(0, 10),
      },
    });
  } catch (err) {
    console.warn('[CMS] Update MySQL failed, falling back to local store', err);
  }

  const updated = store.updateBanner(req.params.id, {
    ...req.body,
    updatedAt: new Date().toLocaleDateString(),
  });

  if (!updated) {
    return res.status(404).json({ error: 'Banner not found' });
  }

  return res.json({ data: updated });
});

// DELETE /cms/banners/:id
router.delete('/banners/:id', async (req: Request, res: Response) => {
  try {
    await storePool.query(`DELETE FROM techxpertstore.cms_banners WHERE id = ?`, [req.params.id]);
    return res.json({ success: true, message: 'Banner removed' });
  } catch (err) {
    console.warn('[CMS] Delete MySQL failed, falling back to local store', err);
  }

  const deleted = store.deleteBanner(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Banner not found' });
  }
  return res.json({ success: true, message: 'Banner removed' });
});

// GET /cms/sections
router.get('/sections', async (_req: Request, res: Response) => {
  try {
    const [rows] = await storePool.query<any[]>(
      `SELECT id, section_code as sectionCode, section_type as sectionType,
              title, display_order as displayOrder, is_enabled as isEnabled, description
       FROM techxpertstore.cms_homepage_sections
       ORDER BY display_order ASC`
    );
    return res.json({ data: rows });
  } catch (err) {
    return res.json({
      data: [
        { id: 1, sectionCode: 'hero_banners', sectionType: 'banner_carousel', title: 'Featured Promotions', displayOrder: 1, isEnabled: 1 },
        { id: 2, sectionCode: 'popular_categories', sectionType: 'category_grid', title: 'Shop by Category', displayOrder: 2, isEnabled: 1 },
        { id: 3, sectionCode: 'bulk_deals', sectionType: 'product_deal_slider', title: 'Bulk Contractor Tiers', displayOrder: 3, isEnabled: 1 },
      ],
    });
  }
});

export default router;
