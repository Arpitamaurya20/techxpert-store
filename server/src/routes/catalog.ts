import { Router, Request, Response } from 'express';
import { store } from '../db/store.js';

const router = Router();

// GET /catalog/categories
router.get('/categories', (_req: Request, res: Response) => {
  const categories = store.getCategories();
  res.json({ data: categories });
});

// GET /catalog/subcategories
router.get('/subcategories', (req: Request, res: Response) => {
  const subcategories = store.getSubcategories();
  res.json({ data: subcategories });
});

// GET /catalog/brands
router.get('/brands', (_req: Request, res: Response) => {
  const brands = store.getBrands();
  res.json({ data: brands });
});

// GET /catalog/products
router.get('/products', (req: Request, res: Response) => {
  const { search, categoryId, brandId, featured, limit } = req.query;

  const products = store.getProducts({
    search: search ? String(search) : undefined,
    categoryId: categoryId ? String(categoryId) : undefined,
    brandId: brandId ? String(brandId) : undefined,
    featured: featured !== undefined ? featured === 'true' : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({ data: products });
});

// GET /catalog/products/:id
router.get('/products/:id', (req: Request, res: Response) => {
  const product = store.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ data: product });
});

// POST /catalog/products (Admin / Portal)
router.post('/products', (req: Request, res: Response) => {
  const { name, categoryId, price, unit, stockQuantity, description, sku, brandId } = req.body;
  if (!name || !categoryId || price === undefined) {
    return res.status(400).json({ error: 'Name, categoryId, and price are required' });
  }

  const newProduct = store.createProduct({
    id: `prod-${Date.now()}`,
    name,
    categoryId,
    price: Number(price),
    unit: unit || '1 unit',
    stockStatus: stockQuantity && Number(stockQuantity) > 0 ? 'in_stock' : 'out_of_stock',
    stockQuantity: stockQuantity ? Number(stockQuantity) : 100,
    description: description || '',
    sku: sku || `TX-${Date.now().toString().slice(-4)}`,
    brandId: brandId || undefined,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ data: newProduct });
});

// PUT /catalog/products/:id (Admin / Portal)
router.put('/products/:id', (req: Request, res: Response) => {
  const updated = store.updateProduct(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ data: updated });
});

// DELETE /catalog/products/:id (Admin / Portal)
router.delete('/products/:id', (req: Request, res: Response) => {
  const deleted = store.deleteProduct(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ success: true, message: 'Product removed' });
});

export default router;
