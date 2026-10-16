import { Router, Request, Response } from 'express';
import { store } from '../db/store.js';

const router = Router();

// GET /pricing/bulk-tiers
router.get('/bulk-tiers', (_req: Request, res: Response) => {
  const tiers = store.getBulkTiers();
  res.json({ data: tiers });
});

// POST /pricing/bulk-tiers
router.post('/bulk-tiers', (req: Request, res: Response) => {
  const { productId, productName, minQty, maxQty, discountType, discountValue, terms } = req.body;

  if (!productId || minQty === undefined || discountValue === undefined) {
    return res.status(400).json({ error: 'productId, minQty, and discountValue are required' });
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

  res.status(201).json({ data: newTier });
});

// DELETE /pricing/bulk-tiers/:id
router.delete('/bulk-tiers/:id', (req: Request, res: Response) => {
  const deleted = store.deleteBulkTier(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Bulk tier not found' });
  }
  res.json({ success: true, message: 'Bulk tier removed' });
});

export default router;
