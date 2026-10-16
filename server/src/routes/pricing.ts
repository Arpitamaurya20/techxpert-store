import { Router, Request, Response } from 'express';
import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';

const router = Router();

// GET /pricing/bulk-tiers
router.get('/bulk-tiers', async (_req: Request, res: Response) => {
  try {
    const [rows] = await storePool.query<any[]>(
      `SELECT 
         id,
         product_id as productId,
         category_id as categoryId,
         product_name as productName,
         min_quantity as minQty,
         max_quantity as maxQty,
         discount_type as discountType,
         CAST(discount_value AS DOUBLE) as discountValue,
         COALESCE(terms_condition, 'Standard bulk rate') as terms,
         is_active as isActive
       FROM techxpertstore.bulk_price_tiers
       WHERE is_active = 1
       ORDER BY product_id ASC, min_quantity ASC`
    );

    if (rows.length > 0) {
      return res.json({ data: rows });
    }
  } catch (err) {
    console.warn('[Pricing] Query bulk tiers MySQL failed, fallback', err);
  }

  const tiers = store.getBulkTiers();
  return res.json({ data: tiers });
});

// POST /pricing/bulk-tiers
router.post('/bulk-tiers', async (req: Request, res: Response) => {
  const { productId, productName, minQty, maxQty, discountType, discountValue, terms } = req.body;

  if (!productId || minQty === undefined || discountValue === undefined) {
    return res.status(400).json({ error: 'productId, minQty, and discountValue are required' });
  }

  try {
    const [insertRes] = await storePool.query<any>(
      `INSERT INTO techxpertstore.bulk_price_tiers
       (product_id, product_name, min_quantity, max_quantity, discount_type, discount_value, terms_condition, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        Number(productId),
        productName || 'Construction Product',
        Number(minQty),
        maxQty ? Number(maxQty) : null,
        discountType || 'percentage',
        Number(discountValue),
        terms || 'Bulk contractor pricing applied at checkout',
      ]
    );

    return res.status(201).json({
      data: {
        id: String(insertRes.insertId),
        productId,
        productName: productName || 'Construction Product',
        minQty: Number(minQty),
        maxQty: maxQty ? Number(maxQty) : undefined,
        discountType: discountType || 'percentage',
        discountValue: Number(discountValue),
        terms: terms || 'Bulk contractor pricing applied at checkout',
        isActive: 1,
      },
    });
  } catch (err) {
    console.warn('[Pricing] Insert tier MySQL failed, fallback', err);
  }

  const newTier = store.createBulkTier({
    id: `tier-${Date.now()}`,
    productId,
    productName: productName || 'Construction Material',
    minQty: Number(minQty),
    maxQty: maxQty ? Number(maxQty) : undefined,
    discountType: discountType || 'percentage',
    discountValue: Number(discountValue),
    terms: terms || 'Bulk savings applied at checkout',
  });

  return res.status(201).json({ data: newTier });
});

// DELETE /pricing/bulk-tiers/:id
router.delete('/bulk-tiers/:id', async (req: Request, res: Response) => {
  try {
    await storePool.query(`DELETE FROM techxpertstore.bulk_price_tiers WHERE id = ?`, [req.params.id]);
    return res.json({ success: true, message: 'Bulk tier removed' });
  } catch (err) {
    console.warn('[Pricing] Delete tier MySQL failed, fallback', err);
  }

  const deleted = store.deleteBulkTier(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Bulk tier not found' });
  }
  return res.json({ success: true, message: 'Bulk tier removed' });
});

export default router;
