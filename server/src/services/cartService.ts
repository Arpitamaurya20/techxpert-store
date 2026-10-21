import { storePool } from '../db/mysql.js';
import { PricingService } from './pricingService.js';
import { OrderService } from './orderService.js';

export class CartService {
  static async getOrCreateCart(userId?: number, sessionId?: string) {
    if (!userId && !sessionId) {
      throw new Error('Either userId or sessionId must be provided');
    }

    try {
      let [carts] = await storePool.query<any[]>(
        `SELECT ID as id, UserID as userId, SessionID as sessionId, Status as status
         FROM techxpertstore.carts
         WHERE (UserID = ? OR (SessionID = ? AND UserID IS NULL)) AND Status = 'active'
         ORDER BY ID DESC LIMIT 1`,
        [userId || null, sessionId || null]
      );

      if (carts.length === 0) {
        const [insertRes] = await storePool.query<any>(
          `INSERT INTO techxpertstore.carts (UserID, SessionID, CurrencyID, Status, CreatedDate, CreatedTime)
           VALUES (?, ?, 1, 'active', CURDATE(), CURTIME())`,
          [userId || null, sessionId || null]
        );
        return { id: insertRes.insertId, userId, sessionId, items: [], subtotal: 0 };
      }

      const cart = carts[0];
      const [items] = await storePool.query<any[]>(
        `SELECT 
           ci.ID as id,
           ci.CartID as cartId,
           ci.VariantID as variantId,
           ci.Quantity as quantity,
           p.ID as productId,
           p.ProductName as name,
           p.ProductCode as sku,
           p.ProductImage as imageUrl,
           COALESCE(pr.SellingPrice, 450) as unitPrice,
           COALESCE(mu.UnitName, 'unit') as unit,
           pv.StockQuantity as availableStock
         FROM techxpertstore.cart_items ci
         LEFT JOIN techxpertstore.product_variants pv ON pv.ID = ci.VariantID
         LEFT JOIN techxpertstore.products p ON p.ID = pv.ProductID
         LEFT JOIN techxpertstore.product_pricing pr ON pr.ProductID = p.ID AND pr.IsActive = 1
         LEFT JOIN techxpertstore.measurement_units mu ON mu.ID = p.MeasurementUnitID
         WHERE ci.CartID = ?`,
        [cart.id]
      );

      let subtotal = 0;
      for (const it of items) {
        it.lineTotal = Number(it.unitPrice) * Number(it.quantity);
        subtotal += it.lineTotal;
      }

      return {
        id: cart.id,
        userId: cart.userId,
        sessionId: cart.sessionId,
        items,
        subtotal,
      };
    } catch (err) {
      console.warn('[CartService] MySQL cart operations failed', err);
      return { id: 1, userId, sessionId, items: [], subtotal: 0 };
    }
  }

  static async addItem(cartId: number, variantId?: number, quantity: number = 1, productId?: number) {
    const qty = Math.max(Number(quantity) || 1, 1);
    let resolvedVariantId = variantId ? Number(variantId) : null;

    if (!resolvedVariantId && productId) {
      const [vars] = await storePool.query<any[]>(
        `SELECT ID FROM techxpertstore.product_variants WHERE ProductID = ? ORDER BY ID ASC LIMIT 1`,
        [productId]
      );
      if (vars.length > 0) {
        resolvedVariantId = vars[0].ID;
      }
    }

    if (!resolvedVariantId) {
      throw new Error('variantId or valid productId is required');
    }

    const [existing] = await storePool.query<any[]>(
      `SELECT ID, Quantity FROM techxpertstore.cart_items WHERE CartID = ? AND VariantID = ? LIMIT 1`,
      [cartId, resolvedVariantId]
    );

    if (existing.length > 0) {
      const newQty = existing[0].Quantity + qty;
      await storePool.query(
        `UPDATE techxpertstore.cart_items SET Quantity = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
        [newQty, existing[0].ID]
      );
      return { id: existing[0].ID, cartId, variantId: resolvedVariantId, quantity: newQty };
    }

    const [insert] = await storePool.query<any>(
      `INSERT INTO techxpertstore.cart_items (CartID, VariantID, Quantity, CreatedDate, CreatedTime)
       VALUES (?, ?, ?, CURDATE(), CURTIME())`,
      [cartId, resolvedVariantId, qty]
    );

    return { id: insert.insertId, cartId, variantId: resolvedVariantId, quantity: qty };
  }

  static async removeItem(cartId: number, itemId: number) {
    await storePool.query(`DELETE FROM techxpertstore.cart_items WHERE CartID = ? AND ID = ?`, [cartId, itemId]);
    return { success: true };
  }

  static async clearCart(cartId: number) {
    await storePool.query(`DELETE FROM techxpertstore.cart_items WHERE CartID = ?`, [cartId]);
    return { success: true };
  }

  static async getCartSummary(cartId: number) {
    const [cartRows] = await storePool.query<any[]>(
      `SELECT ID as id, UserID as userId, SessionID as sessionId, Status as status
       FROM techxpertstore.carts WHERE ID = ? LIMIT 1`,
      [cartId]
    );

    if (cartRows.length === 0) {
      throw new Error('Cart not found');
    }

    const [items] = await storePool.query<any[]>(
      `SELECT 
         ci.ID as id,
         ci.CartID as cartId,
         ci.VariantID as variantId,
         ci.Quantity as quantity,
         p.ID as productId,
         p.ProductName as name,
         p.ProductCode as sku,
         p.ProductImage as imageUrl,
         COALESCE(pr.SellingPrice, 450) as basePrice,
         COALESCE(mu.UnitName, 'unit') as unit,
         pv.StockQuantity as availableStock
       FROM techxpertstore.cart_items ci
       LEFT JOIN techxpertstore.product_variants pv ON pv.ID = ci.VariantID
       LEFT JOIN techxpertstore.products p ON p.ID = pv.ProductID
       LEFT JOIN techxpertstore.product_pricing pr ON pr.ProductID = p.ID AND pr.IsActive = 1
       LEFT JOIN techxpertstore.measurement_units mu ON mu.ID = p.MeasurementUnitID
       WHERE ci.CartID = ?`,
      [cartId]
    );

    let subtotal = 0;
    let totalDiscount = 0;
    const enrichedItems = [];

    for (const it of items) {
      const basePrice = Number(it.basePrice);
      const pricing = await PricingService.calculateBulkPrice(it.productId, it.quantity, basePrice);
      const lineTotal = pricing.unitPrice * it.quantity;
      subtotal += lineTotal;
      totalDiscount += pricing.totalSavings;

      enrichedItems.push({
        ...it,
        basePrice,
        unitPrice: pricing.unitPrice,
        discountPerUnit: pricing.discountPerUnit,
        discountTotal: pricing.totalSavings,
        appliedTier: pricing.appliedTier,
        lineTotal,
      });
    }

    const taxTotal = Number((subtotal * 0.18).toFixed(2));
    const shippingCharges = subtotal >= 2000 || subtotal === 0 ? 0 : 99;
    const grandTotal = Number((subtotal + taxTotal + shippingCharges).toFixed(2));

    return {
      cartId,
      items: enrichedItems,
      itemCount: enrichedItems.length,
      subtotal,
      discountTotal: totalDiscount,
      taxTotal,
      shippingCharges,
      grandTotal,
      freeShippingEligible: subtotal >= 2000,
    };
  }

  static async checkoutCart(cartId: number, options: {
    userId?: number;
    addressId?: number;
    shippingAddress?: string;
    paymentMethod?: string;
    notes?: string;
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string;
  }) {
    return OrderService.checkout({
      cartId,
      ...options,
    });
  }
}
