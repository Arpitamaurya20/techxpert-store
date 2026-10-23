import { storePool } from '../db/mysql.js';
import type { PoolConnection } from 'mysql2/promise';
import { allocateCatalogueStock } from '../utils/stockAllocation.js';
import { store } from '../db/store.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';

function refuseTakenCode(err: any, what: string) {
  if (err?.code === 'ER_DUP_ENTRY') {
    throw Object.assign(new Error(`That short code is already used by another ${what}.`), { statusCode: 409 });
  }
}

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

/**
 * The shop sells each product's first variant, so its stock is what the cart and checkout use.
 * A product without a variant cannot be sold and reports 0.
 */
const SHOP_STOCK = `COALESCE((SELECT v.StockQuantity FROM product_variants v WHERE v.ProductID = p.ID ORDER BY v.ID ASC LIMIT 1), 0)`;
const SHOP_STOCK_STATUS = `CASE
  WHEN ${SHOP_STOCK} <= 0 THEN 'out_of_stock'
  WHEN p.StockStatus = 'low_stock' THEN 'low_stock'
  ELSE 'in_stock' END`;

export class CatalogService {
  /**
   * Resolve packaging label (e.g. "50 kg bag") to measurement_units.ID.
   * Creates a row when none matches so portal free-text units still persist.
   */
  static async resolveMeasurementUnitId(
    unitLabel: string | undefined | null,
    conn?: { query: (...args: any[]) => Promise<any> }
  ): Promise<number | null> {
    const label = String(unitLabel || '').trim();
    if (!label) return null;

    const q = conn?.query?.bind(conn) ?? ((sql: string, params?: any[]) => storePool.query(sql, params));
    const code = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50) || 'unit';

    try {
      const [exact] = await q(
        `SELECT ID FROM measurement_units
         WHERE LOWER(UnitName) = LOWER(?) OR LOWER(UnitCode) = LOWER(?)
         LIMIT 1`,
        [label, code]
      );
      if (exact?.length) return Number(exact[0].ID);

      const [fuzzy] = await q(
        `SELECT ID FROM measurement_units
         WHERE LOWER(UnitName) LIKE CONCAT('%', LOWER(?), '%')
            OR LOWER(UnitCode) LIKE CONCAT('%', LOWER(?), '%')
         ORDER BY ID ASC LIMIT 1`,
        [label, code]
      );
      if (fuzzy?.length) return Number(fuzzy[0].ID);

      try {
        const [maxRow] = await q(`SELECT COALESCE(MAX(ID), 0) + 1 as nextId FROM measurement_units`);
        const nextId = Number(maxRow?.[0]?.nextId) || Date.now() % 100000;
        await q(`INSERT INTO measurement_units (ID, UnitCode, UnitName) VALUES (?, ?, ?)`, [
          nextId,
          code.slice(0, 50),
          label.slice(0, 100),
        ]);
        return nextId;
      } catch {
        // AUTO_INCREMENT schemas: insert without ID then re-read
        await q(`INSERT INTO measurement_units (UnitCode, UnitName) VALUES (?, ?)`, [
          code.slice(0, 50),
          label.slice(0, 100),
        ]);
        const [created] = await q(
          `SELECT ID FROM measurement_units WHERE UnitCode = ? OR UnitName = ? ORDER BY ID DESC LIMIT 1`,
          [code.slice(0, 50), label.slice(0, 100)]
        );
        return created?.length ? Number(created[0].ID) : null;
      }
    } catch (err) {
      console.warn('[CatalogService] measurement unit resolve failed', err);
      return null;
    }
  }

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
      return mysqlOrFileStore('catalog.getCategories', err, () => store.getCategories());
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
      return mysqlOrFileStore('catalog.getSubcategories', err, () =>
        store.getSubcategories(categoryId ? String(categoryId) : undefined)
      );
    }
  }

  private static slugify(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  static async createCategory(data: any) {
    const name = String(data.name || '').trim();
    if (!name) throw Object.assign(new Error('name is required'), { statusCode: 400 });

    const slug = String(data.slug || CatalogService.slugify(name) || `cat-${Date.now()}`);
    const description = data.description ? String(data.description) : null;
    const imageUrl = data.imageUrl ? String(data.imageUrl) : null;
    const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : 100;

    try {
      const [insertRes] = await storePool.query<any>(
        `INSERT INTO categories
         (CategoryCode, CategoryName, CategoryDescription, CategoryImage, DisplayOrder, IsActive, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, ?, ?, 1, CURDATE(), CURTIME())`,
        [slug, name, description, imageUrl, displayOrder]
      );
      return {
        id: insertRes.insertId,
        slug,
        name,
        description: description || '',
        imageUrl: imageUrl || '',
        displayOrder,
        productCount: 0,
        featured: displayOrder <= 5,
      };
    } catch (err) {
      refuseTakenCode(err, 'category');
      return mysqlOrFileStore('catalog.createCategory', err, () =>
        store.createCategory({
      id: `cat-${Date.now()}`,
      name,
      slug,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      productCount: 0,
      featured: displayOrder <= 5,
    })
      );
    }
  }

  static async updateCategory(id: string | number, data: any) {
    const name = data.name !== undefined ? String(data.name).trim() : undefined;
    const slug = data.slug !== undefined ? String(data.slug).trim() : undefined;
    const description = data.description !== undefined ? String(data.description) : undefined;
    const imageUrl = data.imageUrl !== undefined ? String(data.imageUrl) : undefined;
    const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : undefined;

    try {
      const numId = Number(id);
      if (!Number.isNaN(numId)) {
        await storePool.query(
          `UPDATE categories SET
             CategoryName = COALESCE(?, CategoryName),
             CategoryCode = COALESCE(?, CategoryCode),
             CategoryDescription = COALESCE(?, CategoryDescription),
             CategoryImage = COALESCE(?, CategoryImage),
             DisplayOrder = COALESCE(?, DisplayOrder),
             UpdatedDate = CURDATE(),
             UpdatedTime = CURTIME()
           WHERE ID = ?`,
          [
            name || null,
            slug || null,
            description !== undefined ? description : null,
            imageUrl !== undefined ? imageUrl : null,
            displayOrder !== undefined ? displayOrder : null,
            numId,
          ]
        );
        const all = await CatalogService.getCategories();
        const updated = all.find((c: any) => String(c.id) === String(id));
        if (updated) return updated;
      }
    } catch (err) {
      refuseTakenCode(err, 'category');
      return mysqlOrFileStore('catalog.updateCategory', err, () => {
        const updated = store.updateCategory(String(id), {
          ...(name !== undefined ? { name } : {}),
          ...(slug !== undefined ? { slug } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        });
        if (!updated) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
        return updated;
      });
    }
  }

  static async deleteCategory(id: string | number) {
    try {
      const numId = Number(id);
      if (!Number.isNaN(numId)) {
        await storePool.query(`UPDATE categories SET IsActive = 0 WHERE ID = ?`, [numId]);
        await storePool.query(`UPDATE sub_categories SET IsActive = 0 WHERE CategoryID = ?`, [numId]);
        return { success: true };
      }
    } catch (err) {
      return mysqlOrFileStore('catalog.deleteCategory', err, () => {
        const deleted = store.deleteCategory(String(id));
        if (!deleted) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
        return { success: true };
      });
    }
  }

  static async createSubcategory(data: any) {
    const name = String(data.name || '').trim();
    const categoryId = data.categoryId;
    if (!name || categoryId === undefined || categoryId === null || categoryId === '') {
      throw Object.assign(new Error('name and categoryId are required'), { statusCode: 400 });
    }

    const slug = String(data.slug || CatalogService.slugify(name) || `sub-${Date.now()}`);
    const imageUrl = data.imageUrl ? String(data.imageUrl) : null;
    const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : 100;

    try {
      // sub_categories.ID has no AUTO_INCREMENT in the live schema.
      const conn = await storePool.getConnection();
      let id = 0;
      try {
        const [[lock]] = await conn.query<any[]>(`SELECT GET_LOCK('tx_subcategory_id_gen', 10) as got`);
        if (Number(lock?.got) !== 1) {
          throw Object.assign(new Error('Another subcategory is being added. Try again.'), { statusCode: 503 });
        }
        const [[next]] = await conn.query<any[]>(`SELECT COALESCE(MAX(ID), 0) + 1 as id FROM sub_categories`);
        id = Number(next.id);
        await conn.query(
          `INSERT INTO sub_categories
           (ID, CategoryID, SubCategoryCode, SubCategoryName, SubCategoryImage, DisplayOrder, IsActive, CreatedDate, CreatedTime)
           VALUES (?, ?, ?, ?, ?, ?, 1, CURDATE(), CURTIME())`,
          [id, categoryId, slug, name, imageUrl, displayOrder]
        );
      } finally {
        await conn.query(`SELECT RELEASE_LOCK('tx_subcategory_id_gen')`).catch(() => undefined);
        conn.release();
      }
      return {
        id,
        categoryId: Number(categoryId) || categoryId,
        slug,
        name,
        searchTerm: name,
        imageUrl: imageUrl || '',
        displayOrder,
      };
    } catch (err) {
      if ((err as any)?.statusCode) throw err;
      refuseTakenCode(err, 'subcategory in this category');
      return mysqlOrFileStore('catalog.createSubcategory', err, () =>
        store.createSubcategory({
          id: `sub-${Date.now()}`,
          categoryId: String(categoryId),
          name,
          imageUrl: imageUrl || undefined,
          searchTerm: name,
        })
      );
    }
  }

  static async updateSubcategory(id: string | number, data: any) {
    const name = data.name !== undefined ? String(data.name).trim() : undefined;
    const slug = data.slug !== undefined ? String(data.slug).trim() : undefined;
    const imageUrl = data.imageUrl !== undefined ? String(data.imageUrl) : undefined;
    const displayOrder = data.displayOrder !== undefined ? Number(data.displayOrder) : undefined;
    const categoryId = data.categoryId !== undefined ? data.categoryId : undefined;

    try {
      const numId = Number(id);
      if (!Number.isNaN(numId)) {
        await storePool.query(
          `UPDATE sub_categories SET
             SubCategoryName = COALESCE(?, SubCategoryName),
             SubCategoryCode = COALESCE(?, SubCategoryCode),
             SubCategoryImage = COALESCE(?, SubCategoryImage),
             DisplayOrder = COALESCE(?, DisplayOrder),
             CategoryID = COALESCE(?, CategoryID),
             UpdatedDate = CURDATE(),
             UpdatedTime = CURTIME()
           WHERE ID = ?`,
          [
            name || null,
            slug || null,
            imageUrl !== undefined ? imageUrl : null,
            displayOrder !== undefined ? displayOrder : null,
            categoryId !== undefined ? categoryId : null,
            numId,
          ]
        );
        const all = await CatalogService.getSubcategories();
        const updated = all.find((s: any) => String(s.id) === String(id));
        if (updated) return updated;
      }
    } catch (err) {
      refuseTakenCode(err, 'subcategory in this category');
      return mysqlOrFileStore('catalog.updateSubcategory', err, () => {
        const updated = store.updateSubcategory(String(id), {
          ...(name !== undefined ? { name } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(categoryId !== undefined ? { categoryId: String(categoryId) } : {}),
        });
        if (!updated) throw Object.assign(new Error('Subcategory not found'), { statusCode: 404 });
        return updated;
      });
    }
  }

  static async deleteSubcategory(id: string | number) {
    try {
      const numId = Number(id);
      if (!Number.isNaN(numId)) {
        await storePool.query(`UPDATE sub_categories SET IsActive = 0 WHERE ID = ?`, [numId]);
        return { success: true };
      }
    } catch (err) {
      return mysqlOrFileStore('catalog.deleteSubcategory', err, () => {
        const deleted = store.deleteSubcategory(String(id));
        if (!deleted) throw Object.assign(new Error('Subcategory not found'), { statusCode: 404 });
        return { success: true };
      });
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
      return mysqlOrFileStore('catalog.getBrands', err, () => store.getBrands());
    }
  }

  static async getProducts(params: ProductFilterParams) {
    // Portal desk pages; hard cap avoids accidental full-table dumps of 100k+ SKUs
    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
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
          ${SHOP_STOCK_STATUS} as stockStatus,
          p.MinOrderQuantity as minOrderQuantity,
          p.MaxOrderQuantity as maxOrderQuantity,
          p.IsFeatured as featured,
          p.CreatedDate as createdAt,
          (SELECT MIN(pr.SellingPrice) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1) as price,
          (SELECT MIN(pr.MRP) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1) as originalPrice,
          COALESCE(mu.UnitName, 'unit') as unit,
          ${SHOP_STOCK} as stockQuantity
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
      return mysqlOrFileStore('catalog.getProducts', err, () => {
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
      });
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
           ${SHOP_STOCK_STATUS} as stockStatus,
           p.MinOrderQuantity as minOrderQuantity,
           p.MaxOrderQuantity as maxOrderQuantity,
           p.IsFeatured as featured,
           p.CreatedDate as createdAt,
           (SELECT MIN(pr.SellingPrice) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1) as price,
           (SELECT MIN(pr.MRP) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1) as originalPrice,
           COALESCE(mu.UnitName, 'unit') as unit,
           ${SHOP_STOCK} as stockQuantity
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
        const [tiers] = await storePool.query<any[]>(
          `SELECT id, min_quantity as minQty, max_quantity as maxQty, discount_type as discountType, discount_value as discountValue, terms_condition as terms
           FROM bulk_price_tiers WHERE product_id = ? AND is_active = 1 ORDER BY min_quantity ASC`,
          [prod.id]
        );
        prod.bulkTiers = tiers;
        return prod;
      }
      return null;
    } catch (err) {
      return mysqlOrFileStore('catalog.getProductById', err, () => store.getProductById(String(id)));
    }
  }

  static async createProduct(data: any) {
    const {
      name,
      categoryId,
      price,
      unit = '1 unit',
      stockQuantity = 100,
      description,
      sku,
      brandId,
      brandName,
    } = data;

    if (!name || !categoryId || price === undefined) {
      throw new Error('name, categoryId, and price are required');
    }

    const qty = Number(stockQuantity) || 0;
    const stockStatus = qty > 0 ? 'in_stock' : 'out_of_stock';
    const productCode = sku || `TX-${Date.now().toString().slice(-6)}`;
    const brand = brandName || brandId || null;

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      // Serialize ID allocation across concurrent creates (schema IDs are not AUTO_INCREMENT)
      await conn.query(`SELECT GET_LOCK('tx_product_id_gen', 10) as got`);

      const measurementUnitId = await CatalogService.resolveMeasurementUnitId(unit, conn);

      const [maxProd] = await conn.query<any[]>(
        `SELECT COALESCE(MAX(ID), 0) + 1 as nextId FROM products`
      );
      const productId = Number(maxProd[0]?.nextId) || Date.now() % 1000000000;

      await conn.query(
        `INSERT INTO products
         (ID, ProductCode, ProductName, ProductDescription, CategoryID, Brand, MeasurementUnitID, StockStatus, MinOrderQuantity, IsActive, IsFeatured)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0)`,
        [
          productId,
          productCode,
          name,
          description || null,
          categoryId,
          brand,
          measurementUnitId,
          stockStatus,
        ]
      );

      const [maxPrice] = await conn.query<any[]>(
        `SELECT COALESCE(MAX(ID), 0) + 1 as nextId FROM product_pricing`
      );
      const pricingId = Number(maxPrice[0]?.nextId) || productId;

      await conn.query(
        `INSERT INTO product_pricing
         (ID, ProductID, CurrencyID, CostPrice, SellingPrice, MRP, IsActive)
         VALUES (?, ?, 1, ?, ?, ?, 1)`,
        [pricingId, productId, Number(price), Number(price), Number(price)]
      );

      // Optional variant + inventory so list query does not fake stock as 150
      try {
        const [maxVar] = await conn.query<any[]>(
          `SELECT COALESCE(MAX(ID), 0) + 1 as nextId FROM product_variants`
        );
        const variantId = Number(maxVar[0]?.nextId) || productId;
        await conn.query(
          `INSERT INTO product_variants (ID, ProductID, VariantName, IsActive)
           VALUES (?, ?, 'Default', 1)`,
          [variantId, productId]
        );
        const [maxInv] = await conn.query<any[]>(
          `SELECT COALESCE(MAX(ID), 0) + 1 as nextId FROM inventory_stock`
        );
        const invId = Number(maxInv[0]?.nextId) || variantId;
        await conn.query(
          `INSERT INTO inventory_stock (ID, VariantID, StockQuantity, WarehouseID)
           VALUES (?, ?, ?, 1)`,
          [invId, variantId, qty]
        );
      } catch (stockErr) {
        console.warn('[CatalogService] variant/inventory seed skipped', stockErr);
      }

      await conn.query(`SELECT RELEASE_LOCK('tx_product_id_gen')`);
      await conn.commit();

      return {
        id: String(productId),
        name,
        categoryId: String(categoryId),
        sku: productCode,
        brandName: brand || undefined,
        unit,
        price: Number(price),
        stockQuantity: qty,
        stockStatus,
        description: description || '',
      };
    } catch (err) {
      try {
        await conn.query(`SELECT RELEASE_LOCK('tx_product_id_gen')`);
      } catch {
        /* ignore */
      }
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
      return await mysqlOrFileStore('catalog.createProduct', err, () =>
        store.createProduct({
          id: `prod-${Date.now()}`,
          name,
          categoryId: String(categoryId),
          price: Number(price),
          unit,
          stockStatus,
          stockQuantity: qty,
          description: description || '',
          sku: productCode,
          brandId: brandId || undefined,
          brandName: brandName || undefined,
          createdAt: new Date().toISOString(),
        })
      );
    } finally {
      conn.release();
    }
  }

  /** `data` comes from `validateProductUpdateBody`: `price: null` removes the price, `brandName: null` clears it. */
  static async updateProduct(id: string | number, data: any) {
    const { name, price, stockQuantity, description, brandName, unit } = data;
    const hasNewPrice = typeof price === 'number';

    try {
      const numId = Number(id);
      if (!isNaN(numId)) {
        const stockStatus =
          stockQuantity !== undefined
            ? Number(stockQuantity) > 0
              ? 'in_stock'
              : 'out_of_stock'
            : null;

        const measurementUnitId =
          unit !== undefined ? await CatalogService.resolveMeasurementUnitId(unit) : null;

        await storePool.query(
          `UPDATE products SET
             ProductName = COALESCE(?, ProductName),
             ProductDescription = COALESCE(?, ProductDescription),
             Brand = IF(? = 1, ?, Brand),
             StockStatus = COALESCE(?, StockStatus),
             MeasurementUnitID = COALESCE(?, MeasurementUnitID),
             UpdatedDate = CURDATE(),
             UpdatedTime = CURTIME()
           WHERE ID = ?`,
          [
            name || null,
            description !== undefined ? description : null,
            brandName !== undefined ? 1 : 0,
            brandName ?? null,
            stockStatus,
            measurementUnitId,
            numId,
          ]
        );

        if (hasNewPrice) {
          await CatalogService.writeSellingPrice(numId, price);
        } else if (price === null) {
          // Price rows are switched off, not deleted, so the old price stays on record.
          await storePool.query(`UPDATE product_pricing SET IsActive = 0 WHERE ProductID = ? AND IsActive = 1`, [
            numId,
          ]);
        }

        if (stockQuantity !== undefined) {
          await CatalogService.writeCatalogueStock(numId, Number(stockQuantity));
        }
      }
      const updated = await CatalogService.getProductById(id);
      if (updated) return updated;
    } catch (err) {
      return mysqlOrFileStore('catalog.updateProduct', err, () =>
        store.updateProduct(String(id), {
          ...data,
          ...(unit !== undefined ? { unit } : {}),
          ...(stockQuantity !== undefined
            ? {
                stockQuantity: Number(stockQuantity),
                stockStatus: Number(stockQuantity) > 0 ? 'in_stock' : 'out_of_stock',
              }
            : {}),
        })
      );
    }

    return CatalogService.getProductById(id);
  }

  /** Active selling price. Inserts a pricing row when the product has none, so the catalogue MIN() is this price. */
  private static async writeSellingPrice(productId: number, price: number) {
    const [existing] = await storePool.query<any[]>(
      `SELECT ID FROM product_pricing WHERE ProductID = ? AND IsActive = 1 LIMIT 1`,
      [productId]
    );
    if (existing.length > 0) {
      await storePool.query(
        `UPDATE product_pricing SET SellingPrice = ? WHERE ProductID = ? AND IsActive = 1`,
        [price, productId]
      );
      return;
    }

    await CatalogService.withProductIdLock(async (conn) => {
      const [maxPrice] = await conn.query<any[]>(
        `SELECT COALESCE(MAX(ID), 0) + 1 as nextId FROM product_pricing`
      );
      const pricingId = Number(maxPrice[0]?.nextId) || productId;
      await conn.query(
        `INSERT INTO product_pricing
         (ID, ProductID, CurrencyID, CostPrice, SellingPrice, MRP, IsActive)
         VALUES (?, ?, 1, ?, ?, ?, 1)`,
        [pricingId, productId, price, price, price]
      );
    });
  }

  /**
   * The typed stock is the first variant's stock: the variant the shop sells, whose count the cart and
   * checkout use. Its inventory rows are resized so they add up to it. A product without a variant or
   * without an inventory row gets one.
   */
  private static async writeCatalogueStock(productId: number, quantity: number) {
    const target = Math.max(0, Math.round(quantity));
    await CatalogService.withProductIdLock(async (conn) => {
      const [variants] = await conn.query<any[]>(
        `SELECT ID FROM product_variants WHERE ProductID = ? ORDER BY ID ASC LIMIT 1`,
        [productId]
      );
      let variantId = Number(variants[0]?.ID);
      if (!variantId) {
        const [maxVar] = await conn.query<any[]>(
          `SELECT COALESCE(MAX(ID), 0) + 1 as nextId FROM product_variants`
        );
        variantId = Number(maxVar[0]?.nextId) || productId;
        await conn.query(
          `INSERT INTO product_variants (ID, ProductID, VariantName, IsActive) VALUES (?, ?, 'Default', 1)`,
          [variantId, productId]
        );
      }

      const [rows] = await conn.query<any[]>(
        `SELECT ID as id, StockQuantity as quantity FROM inventory_stock WHERE VariantID = ? ORDER BY ID ASC`,
        [variantId]
      );
      if (rows.length > 0) {
        const next = allocateCatalogueStock(
          rows.map((row) => ({ id: Number(row.id), quantity: Number(row.quantity) || 0 })),
          target,
        );
        for (const row of next) {
          await conn.query(`UPDATE inventory_stock SET StockQuantity = ? WHERE ID = ?`, [row.quantity, row.id]);
        }
      } else {
        const [maxInv] = await conn.query<any[]>(
          `SELECT COALESCE(MAX(ID), 0) + 1 as nextId FROM inventory_stock`
        );
        const invId = Number(maxInv[0]?.nextId) || variantId;
        await conn.query(
          `INSERT INTO inventory_stock (ID, VariantID, StockQuantity, WarehouseID) VALUES (?, ?, ?, 1)`,
          [invId, variantId, target]
        );
      }
      await conn.query(`UPDATE product_variants SET StockQuantity = ? WHERE ID = ?`, [target, variantId]);
    });
  }

  private static async withProductIdLock<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`SELECT GET_LOCK('tx_product_id_gen', 10)`);
      const result = await fn(conn);
      await conn.query(`SELECT RELEASE_LOCK('tx_product_id_gen')`);
      await conn.commit();
      return result;
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
      try {
        await conn.query(`SELECT RELEASE_LOCK('tx_product_id_gen')`);
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      conn.release();
    }
  }

  static async deleteProduct(id: string | number) {
    const numId = Number(id);
    try {
      if (!isNaN(numId)) {
        await storePool.query(`UPDATE products SET IsActive = 0 WHERE ID = ?`, [numId]);
        return { success: true };
      }
      throw Object.assign(new Error('Product not found'), { statusCode: 404 });
    } catch (err: any) {
      if (err.statusCode === 404) throw err;
      return mysqlOrFileStore('catalog.deleteProduct', err, () => {
        const deleted = store.deleteProduct(String(id));
        if (!deleted) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
        return { success: true };
      });
    }
  }
}
