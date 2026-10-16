import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';

export interface ProductFilterParams {
  search?: string;
  categoryId?: string | number;
  subcategoryId?: string | number;
  brandId?: string;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  page?: number;
  limit?: number;
}

export class CatalogService {
  static async getCategories() {
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT 
           c.ID as id,
           c.CategoryCode as slug,
           c.CategoryName as name,
           c.CategoryImage as imageUrl,
           c.CategoryDescription as description,
           c.DisplayOrder as displayOrder,
           (SELECT COUNT(*) FROM products p WHERE p.CategoryID = c.ID AND p.IsActive = 1) as productCount,
           (c.DisplayOrder <= 5) as featured
         FROM categories c
         WHERE c.IsActive = 1
         ORDER BY c.DisplayOrder ASC`
      );
      return rows;
    } catch (err) {
      console.warn('[CatalogService] MySQL categories failed, using fallback', err);
      return store.getCategories();
    }
  }

  static async getSubcategories(categoryId?: string | number) {
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
      const [rows] = await storePool.query<any[]>(query, params);
      return rows;
    } catch (err) {
      console.warn('[CatalogService] MySQL subcategories failed, using fallback', err);
      return store.getSubcategories();
    }
  }

  static async getBrands() {
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT Brand as id, Brand as name, COUNT(*) as productCount
         FROM products
         WHERE Brand IS NOT NULL AND Brand != '' AND IsActive = 1
         GROUP BY Brand
         ORDER BY productCount DESC
         LIMIT 40`
      );
      return rows;
    } catch (err) {
      console.warn('[CatalogService] MySQL brands failed, using fallback', err);
      return store.getBrands();
    }
  }

  static async getProducts(params: ProductFilterParams) {
    const limit = Math.min(Number(params.limit) || 50, 100);
    const page = Math.max(Number(params.page) || 1, 1);
    const offset = (page - 1) * limit;

    try {
      let whereClause = `WHERE p.IsActive = 1`;
      const queryParams: any[] = [];

      if (params.search) {
        whereClause += ` AND (p.ProductName LIKE ? OR p.ProductCode LIKE ? OR p.Brand LIKE ?)`;
        const s = `%${params.search}%`;
        queryParams.push(s, s, s);
      }

      if (params.categoryId) {
        whereClause += ` AND p.CategoryID = ?`;
        queryParams.push(params.categoryId);
      }

      if (params.subcategoryId) {
        whereClause += ` AND p.SubCategoryID = ?`;
        queryParams.push(params.subcategoryId);
      }

      if (params.brandId) {
        whereClause += ` AND p.Brand = ?`;
        queryParams.push(params.brandId);
      }

      if (params.featured !== undefined) {
        whereClause += ` AND p.IsFeatured = ?`;
        queryParams.push(params.featured ? 1 : 0);
      }

      // Count query for pagination meta
      const [countResult] = await storePool.query<any[]>(
        `SELECT COUNT(*) as total FROM products p ${whereClause}`,
        queryParams
      );
      const total = countResult[0]?.total || 0;

      // Data query
      const dataQuery = `
        SELECT 
          p.ID as id,
          p.ProductCode as sku,
          p.ProductName as name,
          p.ProductDescription as description,
          p.CategoryID as categoryId,
          c.CategoryName as categoryName,
          p.SubCategoryID as subcategoryId,
          p.Brand as brandName,
          p.ProductImage as imageUrl,
          p.StockStatus as stockStatus,
          p.MinOrderQuantity as minOrderQuantity,
          p.MaxOrderQuantity as maxOrderQuantity,
          p.IsFeatured as featured,
          p.CreatedDate as createdAt,
          COALESCE((SELECT MIN(pr.SellingPrice) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1), 450) as price,
          (SELECT MIN(pr.MRP) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1) as originalPrice,
          COALESCE(mu.UnitName, 'unit') as unit,
          COALESCE((SELECT SUM(inv.StockQuantity) FROM product_variants pv JOIN inventory_stock inv ON inv.VariantID = pv.ID WHERE pv.ProductID = p.ID), 150) as stockQuantity
        FROM products p
        JOIN categories c ON c.ID = p.CategoryID
        LEFT JOIN sub_categories sc ON sc.ID = p.SubCategoryID
        LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
        ${whereClause}
        ORDER BY p.ID ASC
        LIMIT ? OFFSET ?
      `;

      const [rows] = await storePool.query<any[]>(dataQuery, [...queryParams, limit, offset]);

      return {
        products: rows,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      console.warn('[CatalogService] MySQL query failed, falling back to local store', err);
      const fallback = store.getProducts({
        search: params.search,
        categoryId: params.categoryId ? String(params.categoryId) : undefined,
        brandId: params.brandId,
        featured: params.featured,
        limit,
      });
      return {
        products: fallback,
        meta: { page: 1, limit, total: fallback.length, totalPages: 1 },
      };
    }
  }

  static async getProductById(id: string | number) {
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT 
           p.ID as id,
           p.ProductCode as sku,
           p.ProductName as name,
           p.ProductDescription as description,
           p.CategoryID as categoryId,
           c.CategoryName as categoryName,
           p.SubCategoryID as subcategoryId,
           p.Brand as brandName,
           p.ProductImage as imageUrl,
           p.ProductGallery as gallery,
           p.StockStatus as stockStatus,
           p.MinOrderQuantity as minOrderQuantity,
           p.MaxOrderQuantity as maxOrderQuantity,
           p.IsFeatured as featured,
           p.CreatedDate as createdAt,
           COALESCE((SELECT MIN(pr.SellingPrice) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1), 450) as price,
           (SELECT MIN(pr.MRP) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1) as originalPrice,
           COALESCE(mu.UnitName, 'unit') as unit,
           COALESCE((SELECT SUM(inv.StockQuantity) FROM product_variants pv JOIN inventory_stock inv ON inv.VariantID = pv.ID WHERE pv.ProductID = p.ID), 150) as stockQuantity
         FROM products p
         JOIN categories c ON c.ID = p.CategoryID
         LEFT JOIN sub_categories sc ON sc.ID = p.SubCategoryID
         LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
         WHERE (p.ID = ? OR p.ProductCode = ?) AND p.IsActive = 1
         LIMIT 1`,
        [id, id]
      );

      if (rows.length > 0) {
        const prod = rows[0];
        // Fetch bulk pricing tiers for this product if any
        const [tiers] = await storePool.query<any[]>(
          `SELECT id, min_quantity as minQty, max_quantity as maxQty, discount_type as discountType, discount_value as discountValue, terms_condition as terms
           FROM bulk_price_tiers WHERE product_id = ? AND is_active = 1 ORDER BY min_quantity ASC`,
          [prod.id]
        );
        prod.bulkTiers = tiers;
        return prod;
      }
    } catch (err) {
      console.warn('[CatalogService] MySQL getProductById failed, fallback', err);
    }

    return store.getProductById(String(id));
  }

  static async createProduct(data: any) {
    const { name, categoryId, price, unit = '1 unit', stockQuantity = 100, description, sku, brandId } = data;

    if (!name || !categoryId || price === undefined) {
      throw new Error('name, categoryId, and price are required');
    }

    const prod = store.createProduct({
      id: `prod-${Date.now()}`,
      name,
      categoryId: String(categoryId),
      price: Number(price),
      unit,
      stockStatus: Number(stockQuantity) > 0 ? 'in_stock' : 'out_of_stock',
      stockQuantity: Number(stockQuantity),
      description: description || '',
      sku: sku || `TX-${Date.now().toString().slice(-4)}`,
      brandId: brandId || undefined,
      createdAt: new Date().toISOString(),
    });

    return prod;
  }

  static async updateProduct(id: string | number, data: any) {
    const { name, price, stockQuantity, description, brandName } = data;

    try {
      // Update in MySQL products and pricing if numeric ID
      const numId = Number(id);
      if (!isNaN(numId)) {
        if (name) {
          await storePool.query(
            `UPDATE products SET ProductName = COALESCE(?, ProductName), ProductDescription = COALESCE(?, ProductDescription), Brand = COALESCE(?, Brand), UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
            [name || null, description || null, brandName || null, numId]
          );
        }
        if (price !== undefined) {
          await storePool.query(
            `UPDATE product_pricing SET SellingPrice = ? WHERE ProductID = ? AND IsActive = 1`,
            [Number(price), numId]
          );
        }
      }
    } catch (err) {
      console.warn('[CatalogService] MySQL product update failed', err);
    }

    return store.updateProduct(String(id), data);
  }

  static async deleteProduct(id: string | number) {
    const numId = Number(id);
    if (!isNaN(numId)) {
      try {
        await storePool.query(`UPDATE products SET IsActive = 0 WHERE ID = ?`, [numId]);
      } catch (e) {
        console.warn('[CatalogService] MySQL soft delete product warning', e);
      }
    }
    return store.deleteProduct(String(id));
  }
}
