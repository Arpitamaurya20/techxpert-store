import { Router } from 'express';
import { CatalogService } from '../services/catalogService.js';
import { StoreStockService } from '../services/storeStockService.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/response.js';
import { accessActor, requireAdmin, requirePermission } from '../middleware/auth.js';
import { validateProductCreateBody, validateProductUpdateBody } from '../utils/validate.js';

const router = Router();

// GET /catalog/categories
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await CatalogService.getCategories();
    return sendSuccess(res, categories);
  })
);

// POST /catalog/categories
router.post(
  '/categories',
  requireAdmin,
  requirePermission('categories', 'edit'),
  asyncHandler(async (req, res) => {
    const category = await CatalogService.createCategory(req.body);
    return sendSuccess(res, category, 'Category created successfully', 201);
  })
);

// PUT /catalog/categories/:id
router.put(
  '/categories/:id',
  requireAdmin,
  requirePermission('categories', 'edit'),
  asyncHandler(async (req, res) => {
    const updated = await CatalogService.updateCategory(req.params.id, req.body);
    return sendSuccess(res, updated, 'Category updated successfully');
  })
);

// DELETE /catalog/categories/:id (soft-delete)
router.delete(
  '/categories/:id',
  requireAdmin,
  requirePermission('categories', 'delete'),
  asyncHandler(async (req, res) => {
    const result = await CatalogService.deleteCategory(req.params.id);
    return sendSuccess(res, result, 'Category removed successfully');
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

// POST /catalog/subcategories
router.post(
  '/subcategories',
  requireAdmin,
  requirePermission('categories', 'edit'),
  asyncHandler(async (req, res) => {
    const sub = await CatalogService.createSubcategory(req.body);
    return sendSuccess(res, sub, 'Subcategory created successfully', 201);
  })
);

// PUT /catalog/subcategories/:id
router.put(
  '/subcategories/:id',
  requireAdmin,
  requirePermission('categories', 'edit'),
  asyncHandler(async (req, res) => {
    const updated = await CatalogService.updateSubcategory(req.params.id, req.body);
    return sendSuccess(res, updated, 'Subcategory updated successfully');
  })
);

// DELETE /catalog/subcategories/:id (soft-delete)
router.delete(
  '/subcategories/:id',
  requireAdmin,
  requirePermission('categories', 'delete'),
  asyncHandler(async (req, res) => {
    const result = await CatalogService.deleteSubcategory(req.params.id);
    return sendSuccess(res, result, 'Subcategory removed successfully');
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
  requireAdmin,
  requirePermission('products', 'edit'),
  asyncHandler(async (req, res) => {
    const body = validateProductCreateBody(req.body);
    const newProduct = await CatalogService.createProduct(body);
    return sendSuccess(res, newProduct, 'Product created successfully', 201);
  })
);

// GET /catalog/products/:id/store-stock — staff only. The shop still shows the company figure.
router.get(
  '/products/:id/store-stock',
  requireAdmin,
  requirePermission('products', 'view'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendError(res, 404, 'Product not found');
    return sendSuccess(res, await StoreStockService.forProduct(id));
  })
);

// PUT /catalog/products/:id
router.put(
  '/products/:id',
  requireAdmin,
  requirePermission('products', 'edit'),
  asyncHandler(async (req, res) => {
    const body = validateProductUpdateBody(req.body);
    const updated = await CatalogService.updateProduct(req.params.id, body, accessActor(req).name);
    if (!updated) return sendError(res, 404, 'Product not found');
    return sendSuccess(res, updated, 'Product updated successfully');
  })
);

// DELETE /catalog/products/:id
router.delete(
  '/products/:id',
  requireAdmin,
  requirePermission('products', 'delete'),
  asyncHandler(async (req, res) => {
    const deleted = await CatalogService.deleteProduct(req.params.id);
    if (!deleted) return sendError(res, 404, 'Product not found');
    return sendSuccess(res, { success: true }, 'Product removed successfully');
  })
);

export default router;
