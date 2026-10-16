import { Router, Request, Response } from 'express';
import { store } from '../db/store.js';

const router = Router();

// GET /cms/banners
router.get('/banners', (_req: Request, res: Response) => {
  const banners = store.getBanners();
  res.json({ data: banners });
});

// POST /cms/banners
router.post('/banners', (req: Request, res: Response) => {
  const { title, subtitle, imageUrl, ctaLabel, ctaType, ctaTarget, status, termsText, locationScope } =
    req.body;

  if (!title || !imageUrl) {
    return res.status(400).json({ error: 'Title and imageUrl are required' });
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

  res.status(201).json({ data: newBanner });
});

// PUT /cms/banners/:id
router.put('/banners/:id', (req: Request, res: Response) => {
  const updated = store.updateBanner(req.params.id, {
    ...req.body,
    updatedAt: new Date().toLocaleDateString(),
  });

  if (!updated) {
    return res.status(404).json({ error: 'Banner not found' });
  }

  res.json({ data: updated });
});

// DELETE /cms/banners/:id
router.delete('/banners/:id', (req: Request, res: Response) => {
  const deleted = store.deleteBanner(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Banner not found' });
  }
  res.json({ success: true, message: 'Banner removed' });
});

export default router;
