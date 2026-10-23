import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';

export class PricingService {
  static async getBulkTiers(productId?: string | number) {
    try {
      let query = `
        SELECT 
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
        FROM bulk_price_tiers
        WHERE is_active = 1
      `;
      const params: any[] = [];
      if (productId) {
        query += ` AND product_id = ?`;
        params.push(productId);
      }
      query += ` ORDER BY product_id ASC, min_quantity ASC`;

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
      const [insertRes] = await storePool.query<any>(
        `INSERT INTO bulk_price_tiers
         (product_id, category_id, product_name, min_quantity, max_quantity, discount_type, discount_value, terms_condition, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          Number(productId),
          categoryId ? Number(categoryId) : null,
          productName || 'Construction Product',
          Number(minQty),
          maxQty ? Number(maxQty) : null,
          discountType,
          Number(discountValue),
          terms || 'Bulk contractor pricing applied at checkout',
        ]
      );

      return {
        id: String(insertRes.insertId),
        productId: Number(productId),
        categoryId: categoryId ? Number(categoryId) : undefined,
        productName: productName || 'Construction Product',
        minQty: Number(minQty),
        maxQty: maxQty ? Number(maxQty) : undefined,
        discountType,
        discountValue: Number(discountValue),
        terms: terms || 'Bulk contractor pricing applied at checkout',
        isActive: 1,
      };
    } catch (err) {
      return mysqlOrFileStore('pricing.createBulkTier', err, () =>
        store.createBulkTier({
          id: `tier-${Date.now()}`,
          productId: String(productId),
          productName: productName || 'Construction Material',
          minQty: Number(minQty),
          maxQty: maxQty ? Number(maxQty) : undefined,
          discountType,
          discountValue: Number(discountValue),
          terms: terms || 'Bulk savings applied at checkout',
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
          data.terms || null,
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
    const qty = Math.max(Number(quantity) || 1, 1);
    const tiers = await this.getBulkTiers(productId);

    let applicableTier: any = null;
    for (const tier of tiers) {
      if (qty >= tier.minQty && (!tier.maxQty || qty <= tier.maxQty)) {
        if (!applicableTier || tier.discountValue > applicableTier.discountValue) {
          applicableTier = tier;
        }
      }
    }

    if (!applicableTier) {
      return {
        unitPrice: basePrice,
        discountPercent: 0,
        discountPerUnit: 0,
        subtotal: basePrice * qty,
        totalSavings: 0,
        appliedTier: null,
      };
    }

    let discountPerUnit = 0;
    if (applicableTier.discountType === 'percentage') {
      discountPerUnit = (basePrice * applicableTier.discountValue) / 100;
    } else {
      discountPerUnit = Math.max(basePrice - applicableTier.discountValue, 0);
    }

    const effectiveUnitPrice = Math.max(basePrice - discountPerUnit, 0);
    const totalSavings = discountPerUnit * qty;

    return {
      basePrice,
      unitPrice: effectiveUnitPrice,
      discountPercent:
        applicableTier.discountType === 'percentage'
          ? applicableTier.discountValue
          : ((discountPerUnit / basePrice) * 100).toFixed(1),
      discountPerUnit,
      subtotal: effectiveUnitPrice * qty,
      totalSavings,
      appliedTier: {
        id: applicableTier.id,
        minQty: applicableTier.minQty,
        maxQty: applicableTier.maxQty,
        discountValue: applicableTier.discountValue,
        discountType: applicableTier.discountType,
        terms: applicableTier.terms,
      },
    };
  }
}
