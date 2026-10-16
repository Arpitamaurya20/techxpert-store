import { Router } from 'express';
import { CatalogService } from '../services/catalogService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';

const router = Router();

// GET /catalog/categories
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await CatalogService.getCategories();
    return sendSuccess(res, categories);
  })
);

// GET /catalog/subcategories
router.get(
  '/subcategories',
  asyncHandler(async (req, res) => {
    const subcategories = await CatalogService.getSubcategories(req.query.categoryId as string);
    return sendSuccess(res, subcategories);
  })
);

// GET /catalog/brands
router.get(
  '/brands',
  asyncHandler(async (_req, res) => {
    const brands = await CatalogService.getBrands();
    return sendSuccess(res, brands);
  })
);

// GET /catalog/products
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { search, categoryId, subcategoryId, brandId, featured, page, limit } = req.query;
    const result = await CatalogService.getProducts({
      search: search ? String(search) : undefined,
      categoryId: categoryId ? String(categoryId) : undefined,
      subcategoryId: subcategoryId ? String(subcategoryId) : undefined,
      brandId: brandId ? String(brandId) : undefined,
      featured: featured !== undefined ? featured === 'true' : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendSuccess(res, result.products, undefined, 200, result.meta);
  })
);

// GET /catalog/products/:id
router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await CatalogService.getProductById(req.params.id);
    if (!product) return sendError(res, 404, 'Product not found');
    return sendSuccess(res, product);
  })
);

// POST /catalog/products
router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const newProduct = await CatalogService.createProduct(req.body);
    return sendSuccess(res, newProduct, 'Product created successfully', 201);
  })
);

// PUT /catalog/products/:id
router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const updated = await CatalogService.updateProduct(req.params.id, req.body);
    if (!updated) return sendError(res, 404, 'Product not found');
    return sendSuccess(res, updated, 'Product updated successfully');
  })
);

// DELETE /catalog/products/:id
router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const deleted = await CatalogService.deleteProduct(req.params.id);
    if (!deleted) return sendError(res, 404, 'Product not found');
    return sendSuccess(res, { success: true }, 'Product removed successfully');
  })
);

export default router;
