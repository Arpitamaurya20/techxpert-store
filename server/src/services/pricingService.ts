import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';
import { bulkPrice, type Tier } from '../utils/bulkPricing.js';

export class PricingService {
  static async getBulkTiers(productId?: string | number) {
    try {
      // product_name on the tier is a copy taken when it was made; the catalogue's name wins.
      let query = `
        SELECT
          t.id,
          t.product_id as productId,
          t.category_id as categoryId,
          COALESCE(p.ProductName, t.product_name) as productName,
          p.ProductCode as productSku,
          CASE WHEN p.ID IS NOT NULL AND p.IsActive = 1 THEN 1 ELSE 0 END as productLive,
          (SELECT CAST(MIN(pr.SellingPrice) AS DOUBLE) FROM product_pricing pr
            WHERE pr.ProductID = t.product_id AND pr.IsActive = 1) as productPrice,
          t.min_quantity as minQty,
          t.max_quantity as maxQty,
          t.discount_type as discountType,
          CAST(t.discount_value AS DOUBLE) as discountValue,
          COALESCE(t.terms_condition, '') as terms,
          t.is_active as isActive
        FROM bulk_price_tiers t
        LEFT JOIN products p ON p.ID = t.product_id
        WHERE t.is_active = 1
      `;
      const params: any[] = [];
      if (productId) {
        query += ` AND t.product_id = ?`;
        params.push(productId);
      }
      query += ` ORDER BY t.product_id ASC, t.min_quantity ASC`;

      const [rows] = await storePool.query<any[]>(query, params);
      return rows;
    } catch (err) {
      return mysqlOrFileStore('pricing.getBulkTiers', err, () => store.getBulkTiers());
    }
  }

  static async createBulkTier(data: any) {
    const {
      productId,
      categoryId,
      productName,
      minQty,
      maxQty,
      discountType = 'percentage',
      discountValue,
      terms,
    } = data;

    if (!productId || minQty === undefined || discountValue === undefined) {
      throw Object.assign(new Error('productId, minQty, and discountValue are required'), {
        statusCode: 400,
      });
    }

    try {
      const [named] = await storePool.query<any[]>(`SELECT ProductName FROM products WHERE ID = ?`, [
        Number(productId),
      ]);
      if (!named.length) {
        throw Object.assign(new Error("That product isn't in the catalogue."), { statusCode: 404 });
      }
      const [insertRes] = await storePool.query<any>(
        `INSERT INTO bulk_price_tiers
         (product_id, category_id, product_name, min_quantity, max_quantity, discount_type, discount_value, terms_condition, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          Number(productId),
          categoryId ? Number(categoryId) : null,
          String(named[0].ProductName),
          Number(minQty),
          maxQty ? Number(maxQty) : null,
          discountType,
          Number(discountValue),
          terms ? String(terms) : '',
        ]
      );

      const tiers = await PricingService.getBulkTiers();
      return tiers.find((tier) => String(tier.id) === String(insertRes.insertId));
    } catch (err: any) {
      if (err?.statusCode) throw err;
      return mysqlOrFileStore('pricing.createBulkTier', err, () =>
        store.createBulkTier({
          id: `tier-${Date.now()}`,
          productId: String(productId),
          productName: productName || '',
          minQty: Number(minQty),
          maxQty: maxQty ? Number(maxQty) : undefined,
          discountType,
          discountValue: Number(discountValue),
          terms: terms ? String(terms) : '',
        })
      );
    }
  }

  static async updateBulkTier(id: string | number, data: any) {
    const setMax = data.maxQty !== undefined || data.max_quantity !== undefined;
    const maxQty = setMax ? (data.maxQty ?? data.max_quantity ?? null) : undefined;
    try {
      const [result] = await storePool.query<any>(
        `UPDATE bulk_price_tiers
         SET
           product_id = COALESCE(?, product_id),
           product_name = COALESCE(?, product_name),
           min_quantity = COALESCE(?, min_quantity),
           max_quantity = IF(? = 1, ?, max_quantity),
           discount_type = COALESCE(?, discount_type),
           discount_value = COALESCE(?, discount_value),
           terms_condition = COALESCE(?, terms_condition)
         WHERE id = ?`,
        [
          data.productId != null && data.productId !== '' ? Number(data.productId) : null,
          data.productName || null,
          data.minQty !== undefined ? Number(data.minQty) : null,
          setMax ? 1 : 0,
          setMax ? (maxQty == null || maxQty === '' ? null : Number(maxQty)) : null,
          data.discountType || null,
          data.discountValue !== undefined ? Number(data.discountValue) : null,
          data.terms !== undefined && data.terms !== null ? String(data.terms) : null,
          id,
        ]
      );
      if (!result.affectedRows) {
        const [found] = await storePool.query<any[]>(`SELECT id FROM bulk_price_tiers WHERE id = ?`, [id]);
        if (!found.length) throw Object.assign(new Error('Bulk tier not found'), { statusCode: 404 });
      }
      const tiers = await PricingService.getBulkTiers();
      const updated = tiers.find((tier) => String(tier.id) === String(id));
      if (!updated) throw Object.assign(new Error('Bulk tier not found'), { statusCode: 404 });
      return updated;
    } catch (err: any) {
      if (err?.statusCode === 404) throw err;
      return mysqlOrFileStore('pricing.updateBulkTier', err, () => {
        const updated = store.updateBulkTier(String(id), {
          ...(data.productId != null ? { productId: String(data.productId) } : {}),
          ...(data.productName ? { productName: data.productName } : {}),
          ...(data.minQty !== undefined ? { minQty: Number(data.minQty) } : {}),
          ...(setMax ? { maxQty: maxQty == null || maxQty === '' ? undefined : Number(maxQty) } : {}),
          ...(data.discountType ? { discountType: data.discountType } : {}),
          ...(data.discountValue !== undefined ? { discountValue: Number(data.discountValue) } : {}),
          ...(data.terms !== undefined ? { terms: data.terms } : {}),
        });
        if (!updated) throw Object.assign(new Error('Bulk tier not found'), { statusCode: 404 });
        return updated;
      });
    }
  }

  static async deleteBulkTier(id: string | number) {
    try {
      await storePool.query(`DELETE FROM bulk_price_tiers WHERE id = ?`, [id]);
      return { success: true };
    } catch (err) {
      return mysqlOrFileStore('pricing.deleteBulkTier', err, () => {
        const deleted = store.deleteBulkTier(String(id));
        if (!deleted) throw Object.assign(new Error('Bulk tier not found'), { statusCode: 404 });
        return { success: true };
      });
    }
  }

  static async calculateBulkPrice(productId: number, quantity: number, basePrice: number) {
    const rows = await this.getBulkTiers(productId);
    const tiers: Tier[] = rows.map((t: any) => ({
      id: t.id,
      minQty: Number(t.minQty),
      maxQty: t.maxQty == null ? null : Number(t.maxQty),
      discountType: String(t.discountType),
      discountValue: Number(t.discountValue),
      terms: t.terms ?? '',
    }));
    return bulkPrice(tiers, quantity, basePrice);
  }

  /** `GET /pricing/calculate`: the bulk price on the product's own selling price, as the cart charges it. */
  static async calculateForProduct(productId: number, quantity: number) {
    const [rows] = await storePool.query<any[]>(
      `SELECT CAST(MIN(pr.SellingPrice) AS DOUBLE) as price
       FROM products p
       JOIN product_pricing pr ON pr.ProductID = p.ID AND pr.IsActive = 1
       WHERE p.ID = ? AND p.IsActive = 1`,
      [productId]
    );
    const price = Number(rows[0]?.price);
    if (!(price > 0)) {
      throw Object.assign(new Error("That product isn't available to order right now."), { statusCode: 404 });
    }
    return this.calculateBulkPrice(productId, quantity, price);
  }
}
