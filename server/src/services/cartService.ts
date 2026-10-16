import { storePool } from '../db/mysql.js';

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
           COALESCE(mu.UnitName, 'unit') as unit
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

  static async addItem(cartId: number, variantId: number, quantity: number) {
    const qty = Math.max(Number(quantity) || 1, 1);

    const [existing] = await storePool.query<any[]>(
      `SELECT ID, Quantity FROM techxpertstore.cart_items WHERE CartID = ? AND VariantID = ? LIMIT 1`,
      [cartId, variantId]
    );

    if (existing.length > 0) {
      const newQty = existing[0].Quantity + qty;
      await storePool.query(
        `UPDATE techxpertstore.cart_items SET Quantity = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
        [newQty, existing[0].ID]
      );
      return { id: existing[0].ID, cartId, variantId, quantity: newQty };
    }

    const [insert] = await storePool.query<any>(
      `INSERT INTO techxpertstore.cart_items (CartID, VariantID, Quantity, CreatedDate, CreatedTime)
       VALUES (?, ?, ?, CURDATE(), CURTIME())`,
      [cartId, variantId, qty]
    );

    return { id: insert.insertId, cartId, variantId, quantity: qty };
  }

  static async removeItem(cartId: number, itemId: number) {
    await storePool.query(`DELETE FROM techxpertstore.cart_items WHERE CartID = ? AND ID = ?`, [cartId, itemId]);
    return { success: true };
  }

  static async clearCart(cartId: number) {
    await storePool.query(`DELETE FROM techxpertstore.cart_items WHERE CartID = ?`, [cartId]);
    return { success: true };
  }
}
