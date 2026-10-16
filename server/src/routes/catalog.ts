import { Router, Request, Response } from 'express';
import { catalogPool } from '../db/mysql.js';
import { store } from '../db/store.js';

const router = Router();

// GET /catalog/categories
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const [rows] = await catalogPool.query<any[]>(
      `SELECT ID as id, CategoryCode as slug, CategoryName as name, CategoryImage as imageUrl,
              DisplayOrder as displayOrder, 100 as productCount, (DisplayOrder <= 5) as featured
       FROM categories
       WHERE IsActive = 1
       ORDER BY DisplayOrder ASC`
    );
    return res.json({ data: rows });
  } catch (err) {
    console.warn('[Catalog] MySQL query failed, falling back to local store', err);
    return res.json({ data: store.getCategories() });
  }
});

// GET /catalog/subcategories
router.get('/subcategories', async (req: Request, res: Response) => {
  const { categoryId } = req.query;
  try {
    let query = `
      SELECT ID as id, CategoryID as categoryId, SubCategoryCode as slug,
             SubCategoryName as name, SubCategoryName as searchTerm,
             SubCategoryImage as imageUrl, DisplayOrder as displayOrder
      FROM sub_categories
      WHERE IsActive = 1
    `;
    const params: any[] = [];
    if (categoryId) {
      query += ` AND CategoryID = ?`;
      params.push(categoryId);
    }
    query += ` ORDER BY DisplayOrder ASC`;

    const [rows] = await catalogPool.query<any[]>(query, params);
    return res.json({ data: rows });
  } catch (err) {
    console.warn('[Catalog] MySQL subcategories failed, falling back to local store', err);
    return res.json({ data: store.getSubcategories() });
  }
});

// GET /catalog/brands
router.get('/brands', async (_req: Request, res: Response) => {
  try {
    const [rows] = await catalogPool.query<any[]>(
      `SELECT DISTINCT Brand as id, Brand as name
       FROM products
       WHERE Brand IS NOT NULL AND Brand != '' AND IsActive = 1
       LIMIT 40`
    );
    return res.json({ data: rows });
  } catch (err) {
    console.warn('[Catalog] MySQL brands failed, falling back to local store', err);
    return res.json({ data: store.getBrands() });
  }
});

// GET /catalog/products
router.get('/products', async (req: Request, res: Response) => {
  const { search, categoryId, brandId, featured, limit = 50, page = 1 } = req.query;
  const numLimit = Math.min(Number(limit) || 50, 100);
  const numOffset = ((Number(page) || 1) - 1) * numLimit;

  try {
    let query = `
      SELECT p.ID as id, p.ProductCode as sku, p.ProductName as name,
             p.ProductDescription as description, p.CategoryID as categoryId,
             c.CategoryName as categoryName, p.SubCategoryID as subcategoryId,
             p.Brand as brandName, p.ProductImage as imageUrl,
             p.StockStatus as stockStatus, p.MinOrderQuantity as minOrderQuantity,
             p.MaxOrderQuantity as maxOrderQuantity, p.IsFeatured as featured,
             p.CreatedDate as createdAt,
             COALESCE(pr.SellingPrice, 450) as price,
             pr.MRP as originalPrice,
             COALESCE(mu.UnitName, 'unit') as unit,
             COALESCE(inv.StockQuantity, 150) as stockQuantity
      FROM products p
      JOIN categories c ON c.ID = p.CategoryID
      LEFT JOIN sub_categories sc ON sc.ID = p.SubCategoryID
      LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
      LEFT JOIN product_pricing pr ON pr.ProductID = p.ID AND pr.IsActive = 1
      LEFT JOIN product_variants pv ON pv.ProductID = p.ID
      LEFT JOIN inventory_stock inv ON inv.VariantID = pv.ID
      WHERE p.IsActive = 1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (p.ProductName LIKE ? OR p.ProductCode LIKE ? OR p.Brand LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (categoryId) {
      query += ` AND p.CategoryID = ?`;
      params.push(categoryId);
    }

    if (brandId) {
      query += ` AND p.Brand = ?`;
      params.push(brandId);
    }

    if (featured !== undefined) {
      query += ` AND p.IsFeatured = ?`;
      params.push(featured === 'true' ? 1 : 0);
    }

    query += ` GROUP BY p.ID ORDER BY p.ID ASC LIMIT ? OFFSET ?`;
    params.push(numLimit, numOffset);

    const [rows] = await catalogPool.query<any[]>(query, params);
    return res.json({ data: rows });
  } catch (err) {
    console.warn('[Catalog] MySQL products query failed, using local store', err);
    const fallback = store.getProducts({
      search: search ? String(search) : undefined,
      categoryId: categoryId ? String(categoryId) : undefined,
      brandId: brandId ? String(brandId) : undefined,
      featured: featured !== undefined ? featured === 'true' : undefined,
      limit: numLimit,
    });
    return res.json({ data: fallback });
  }
});

// GET /catalog/products/:id
router.get('/products/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [rows] = await catalogPool.query<any[]>(
      `SELECT p.ID as id, p.ProductCode as sku, p.ProductName as name,
              p.ProductDescription as description, p.CategoryID as categoryId,
              c.CategoryName as categoryName, p.SubCategoryID as subcategoryId,
              p.Brand as brandName, p.ProductImage as imageUrl,
              p.StockStatus as stockStatus, p.MinOrderQuantity as minOrderQuantity,
              p.MaxOrderQuantity as maxOrderQuantity, p.IsFeatured as featured,
              p.CreatedDate as createdAt,
              COALESCE(pr.SellingPrice, 450) as price,
              pr.MRP as originalPrice,
              COALESCE(mu.UnitName, 'unit') as unit,
              COALESCE(inv.StockQuantity, 150) as stockQuantity
       FROM products p
       JOIN categories c ON c.ID = p.CategoryID
       LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
       LEFT JOIN product_pricing pr ON pr.ProductID = p.ID AND pr.IsActive = 1
       LEFT JOIN product_variants pv ON pv.ProductID = p.ID
       LEFT JOIN inventory_stock inv ON inv.VariantID = pv.ID
       WHERE p.ID = ? OR p.ProductCode = ?
       LIMIT 1`,
      [id, id]
    );

    if (rows.length > 0) {
      return res.json({ data: rows[0] });
    }
  } catch (err) {
    console.warn('[Catalog] MySQL product by id failed, trying local store', err);
  }

  const prod = store.getProductById(id);
  if (prod) return res.json({ data: prod });
  return res.status(404).json({ error: 'Product not found' });
});

// POST /catalog/products
router.post('/products', async (req: Request, res: Response) => {
  const { name, categoryId, price, unit, stockQuantity, description, sku, brandId } = req.body;
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
  return res.status(201).json({ data: newProduct });
});

// PUT /catalog/products/:id
router.put('/products/:id', (req: Request, res: Response) => {
  const updated = store.updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  return res.json({ data: updated });
});

// DELETE /catalog/products/:id
router.delete('/products/:id', (req: Request, res: Response) => {
  const deleted = store.deleteProduct(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Product not found' });
  return res.json({ success: true, message: 'Product removed' });
});

export default router;
