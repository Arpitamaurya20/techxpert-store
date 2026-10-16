import { storePool } from '../db/mysql.js';
import { store } from '../db/store.js';

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
        FROM techxpertstore.bulk_price_tiers
        WHERE is_active = 1
      `;
      const params: any[] = [];
      if (productId) {
        query += ` AND product_id = ?`;
        params.push(productId);
      }
      query += ` ORDER BY product_id ASC, min_quantity ASC`;

      const [rows] = await storePool.query<any[]>(query, params);
      if (rows.length > 0) return rows;
    } catch (err) {
      console.warn('[PricingService] MySQL bulk tiers query failed, fallback', err);
    }
    return store.getBulkTiers();
  }

  static async createBulkTier(data: any) {
    const { productId, categoryId, productName, minQty, maxQty, discountType = 'percentage', discountValue, terms } = data;

    if (!productId || minQty === undefined || discountValue === undefined) {
      throw new Error('productId, minQty, and discountValue are required');
    }

    try {
      const [insertRes] = await storePool.query<any>(
        `INSERT INTO techxpertstore.bulk_price_tiers
         (product_id, category_id, product_name, min_quantity, max_quantity, discount_type, discount_value, terms_condition, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
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
      console.warn('[PricingService] MySQL insert tier failed, fallback', err);
    }

    return store.createBulkTier({
      id: `tier-${Date.now()}`,
      productId: String(productId),
      productName: productName || 'Construction Material',
      minQty: Number(minQty),
      maxQty: maxQty ? Number(maxQty) : undefined,
      discountType,
      discountValue: Number(discountValue),
      terms: terms || 'Bulk savings applied at checkout',
    });
  }

  static async deleteBulkTier(id: string | number) {
    try {
      await storePool.query(`DELETE FROM techxpertstore.bulk_price_tiers WHERE id = ?`, [id]);
      return { success: true };
    } catch (err) {
      console.warn('[PricingService] MySQL delete tier failed, fallback', err);
    }
    const deleted = store.deleteBulkTier(String(id));
    if (!deleted) throw new Error('Bulk tier not found');
    return { success: true };
  }

  static async calculateBulkPrice(productId: number, quantity: number, basePrice: number) {
    const qty = Math.max(Number(quantity) || 1, 1);
    const tiers = await this.getBulkTiers(productId);

    // Find best applicable tier matching quantity
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
      discountPercent: applicableTier.discountType === 'percentage' ? applicableTier.discountValue : ((discountPerUnit / basePrice) * 100).toFixed(1),
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
