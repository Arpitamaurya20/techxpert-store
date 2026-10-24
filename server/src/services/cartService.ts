import type { PoolConnection } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { mysqlOrFileStore } from '../db/mysqlErrors.js';
import { PricingService } from './pricingService.js';
import { orderRefusal } from '../utils/checkoutPricing.js';
import { VARIANT_SELLING_PRICE } from '../utils/variants.js';
import {
  cartTotals,
  isUsableSessionId,
  lineLimits,
  mergeQuantity,
  newSessionId,
  priceLine,
  quantityRefusal,
  reorderTarget,
  type CartLimits,
  type CartTotals,
  type LineProblem,
} from '../utils/cartRules.js';

export type CartAccess = { userId?: number; sessionId?: string };

export type CartRow = { id: number; userId: number | null; sessionId: string | null; status?: string };

export type PricedCartLine = {
  productId: string;
  /** The option in the cart. Omitted by older clients; the server still fills it. */
  variantId: number;
  variantName: string | null;
  name: string;
  brandName: string | null;
  categoryId: string | null;
  imageUrl: string | null;
  unit: string;
  quantity: number;
  basePrice: number | null;
  unitPrice: number | null;
  appliedTier: unknown;
  lineTotal: number;
  limits: CartLimits;
  problem: LineProblem;
};

export type PricedCart = {
  id: number;
  sessionId?: string;
  lines: PricedCartLine[];
  totals: CartTotals;
  canCheckout: boolean;
};

/** A priced line plus the saving checkout records on the order. */
export type CheckoutLine = PricedCartLine & { savings: number };

/** Product facts the cart needs. `pv` is the option being sold. */
const PRODUCT_FACTS = `
  p.ID as productId,
  p.IsActive as isActive,
  p.ProductCode as sku,
  p.ProductName as name,
  p.Brand as brandName,
  p.CategoryID as categoryId,
  p.ProductImage as imageUrl,
  COALESCE(mu.UnitName, 'unit') as unit,
  p.MinOrderQuantity as minOrderQuantity,
  p.MaxOrderQuantity as maxOrderQuantity,
  ${VARIANT_SELLING_PRICE} as price`;

export class CartService {
  /** Ensure the caller owns the cart (user JWT or matching x-session-id). */
  static async assertCartAccess(cartId: number, userId?: number, sessionId?: string) {
    const [rows] = await storePool.query<any[]>(
      `SELECT ID as id, UserID as userId, SessionID as sessionId, Status as status
       FROM carts WHERE ID = ? LIMIT 1`,
      [cartId]
    );
    if (!rows.length) {
      throw Object.assign(new Error('Cart not found'), { statusCode: 404 });
    }
    const cart = rows[0];
    if (cart.userId != null) {
      if (userId != null && Number(cart.userId) === Number(userId)) return cart;
      throw Object.assign(new Error('Not authorized to access this cart'), { statusCode: 403 });
    }
    if (sessionId && cart.sessionId && String(cart.sessionId) === String(sessionId)) {
      return cart;
    }
    throw Object.assign(new Error('Not authorized to access this cart'), { statusCode: 403 });
  }

  /**
   * The caller's active cart. Signed in: by user. Guest: by a server-issued session id;
   * an unknown or missing id gets a new cart with a new id.
   */
  static async activeCart(access: CartAccess): Promise<CartRow> {
    if (access.userId) {
      const [rows] = await storePool.query<any[]>(
        `SELECT ID as id, UserID as userId, SessionID as sessionId FROM carts
         WHERE UserID = ? AND Status = 'active' ORDER BY ID DESC LIMIT 1`,
        [access.userId]
      );
      if (rows.length) return rows[0];
      const [res] = await storePool.query<any>(
        `INSERT INTO carts (UserID, SessionID, CurrencyID, Status, CreatedDate, CreatedTime)
         VALUES (?, NULL, 1, 'active', CURDATE(), CURTIME())`,
        [access.userId]
      );
      return { id: Number(res.insertId), userId: access.userId, sessionId: null };
    }

    if (isUsableSessionId(access.sessionId)) {
      const [rows] = await storePool.query<any[]>(
        `SELECT ID as id, UserID as userId, SessionID as sessionId FROM carts
         WHERE SessionID = ? AND UserID IS NULL AND Status = 'active' ORDER BY ID DESC LIMIT 1`,
        [access.sessionId]
      );
      if (rows.length) return rows[0];
    }

    const sessionId = newSessionId();
    const [res] = await storePool.query<any>(
      `INSERT INTO carts (UserID, SessionID, CurrencyID, Status, CreatedDate, CreatedTime)
       VALUES (NULL, ?, 1, 'active', CURDATE(), CURTIME())`,
      [sessionId]
    );
    return { id: Number(res.insertId), userId: null, sessionId };
  }

  /** The cart's lines with the stock of the option on each line; `FOR UPDATE` when checkout is about to take them. */
  static async cartRows(cartId: number, conn: Pick<PoolConnection, 'query'> = storePool, forUpdate = false) {
    const [rows] = await conn.query<any[]>(
      `SELECT ci.Quantity as quantity, pv.ID as variantId, pv.VariantName as variantName,
              pv.IsActive as variantActive, pv.StockQuantity as stock, ${PRODUCT_FACTS}
       FROM cart_items ci
       JOIN product_variants pv ON pv.ID = ci.VariantID
       JOIN products p ON p.ID = pv.ProductID
       LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
       WHERE ci.CartID = ?
       ORDER BY ci.ID ASC
       ${forUpdate ? 'FOR UPDATE' : ''}`,
      [cartId]
    );
    return rows;
  }

  /**
   * Prices rows exactly as the Cart screen shows them and as checkout charges them:
   * the option's own price (or the product price when the option has none), bulk tier, that option's stock.
   * A product or option taken off sale is treated as having no price.
   */
  static async priceRows(rows: any[]): Promise<{ lines: CheckoutLine[]; totals: CartTotals }> {
    const lines: CheckoutLine[] = [];
    for (const row of rows) {
      const quantity = Number(row.quantity);
      const limits = lineLimits(row);
      const sellable = Number(row.isActive) === 1 && Number(row.variantActive) === 1;
      const price = sellable ? row.price : null;
      const base = Number(price);
      const bulk =
        price != null && Number.isFinite(base) && base > 0
          ? await PricingService.calculateBulkPrice(Number(row.productId), quantity, base)
          : null;
      const priced = priceLine(quantity, limits, price, bulk);
      lines.push({
        productId: String(row.productId),
        variantId: Number(row.variantId),
        variantName: row.variantName ? String(row.variantName) : null,
        name: String(row.name),
        brandName: row.brandName ?? null,
        categoryId: row.categoryId != null ? String(row.categoryId) : null,
        imageUrl: row.imageUrl ?? null,
        unit: String(row.unit),
        quantity,
        basePrice: priced.basePrice,
        unitPrice: priced.unitPrice,
        appliedTier: priced.appliedTier,
        lineTotal: priced.lineTotal,
        limits,
        problem: priced.problem,
        savings: priced.savings,
      });
    }
    return { lines, totals: cartTotals(lines) };
  }

  static async pricedCart(cart: CartRow): Promise<PricedCart> {
    const { lines } = await CartService.priceRows(await CartService.cartRows(cart.id));
    const publicLines: PricedCartLine[] = lines.map(({ savings: _savings, ...line }) => line);
    return {
      id: cart.id,
      ...(cart.userId == null && cart.sessionId ? { sessionId: cart.sessionId } : {}),
      lines: publicLines,
      totals: cartTotals(lines),
      canCheckout: lines.length > 0 && lines.every((line) => line.problem === null),
    };
  }

  static async view(access: CartAccess): Promise<PricedCart> {
    try {
      return await CartService.pricedCart(await CartService.activeCart(access));
    } catch (err) {
      return mysqlOrFileStore('cart.view', err, () => ({
        id: 1,
        lines: [],
        totals: cartTotals([]),
        canCheckout: false,
      }));
    }
  }

  /**
   * An active product and one option. With no `variantId`, that option is the first one.
   * `variantId` null on the row means the product has no option, or the asked-for option is not its.
   */
  static async productForCart(
    productId: number,
    conn: Pick<PoolConnection, 'query'> = storePool,
    forUpdate = false,
    variantId: number | null = null
  ) {
    const lock = forUpdate ? 'FOR UPDATE' : '';
    const [rows] = variantId
      ? await conn.query<any[]>(
          `SELECT pv.ID as variantId, pv.VariantName as variantName, pv.IsActive as variantActive,
                  pv.StockQuantity as stock, ${PRODUCT_FACTS}
           FROM products p
           LEFT JOIN product_variants pv ON pv.ID = ? AND pv.ProductID = p.ID
           LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
           WHERE p.ID = ? AND p.IsActive = 1
           LIMIT 1
           ${lock}`,
          [variantId, productId]
        )
      : await conn.query<any[]>(
          `SELECT pv.ID as variantId, pv.VariantName as variantName, pv.IsActive as variantActive,
                  pv.StockQuantity as stock, ${PRODUCT_FACTS}
           FROM products p
           LEFT JOIN product_variants pv ON pv.ID = (SELECT MIN(v.ID) FROM product_variants v WHERE v.ProductID = p.ID)
           LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
           WHERE p.ID = ? AND p.IsActive = 1
           LIMIT 1
           ${lock}`,
          [productId]
        );
    return rows[0] ?? null;
  }

  /**
   * Sets the exact quantity of one product in the caller's cart.
   * With no variant, that is the first option, and 0 removes every option of the product.
   * With a variant, 0 removes only that option and the others stay.
   */
  static async setLineQuantity(
    access: CartAccess,
    productId: number,
    quantity: number,
    variantId: number | null = null
  ): Promise<PricedCart> {
    if (!Number.isInteger(productId) || productId <= 0) {
      throw orderRefusal(400, 'productId must be a product number');
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw orderRefusal(400, 'Quantity must be a whole number of 0 or more.');
    }

    const cart = await CartService.activeCart(access);

    if (quantity === 0 && variantId == null) {
      await storePool.query(
        `DELETE ci FROM cart_items ci
         JOIN product_variants pv ON pv.ID = ci.VariantID
         WHERE ci.CartID = ? AND pv.ProductID = ?`,
        [cart.id, productId]
      );
      return CartService.pricedCart(cart);
    }

    if (variantId != null) {
      const [owned] = await storePool.query<any[]>(
        `SELECT ID as id, IsActive as active FROM product_variants WHERE ID = ? AND ProductID = ? LIMIT 1`,
        [variantId, productId]
      );
      if (!owned.length) throw orderRefusal(400, "That option isn't part of this product.");
      if (quantity === 0) {
        await storePool.query(`DELETE FROM cart_items WHERE CartID = ? AND VariantID = ?`, [cart.id, variantId]);
        return CartService.pricedCart(cart);
      }
      if (Number(owned[0].active) !== 1) {
        throw orderRefusal(409, "This option isn't available to order right now.");
      }
    }

    const product = await CartService.productForCart(productId, storePool, false, variantId);
    if (!product) throw orderRefusal(409, 'This product is no longer in the catalogue.');
    if (product.variantId == null) {
      throw orderRefusal(409, `"${product.name}" isn't available to order right now.`);
    }
    const label =
      variantId != null && product.variantName ? `${product.name} (${product.variantName})` : String(product.name);
    const refusal = quantityRefusal(label, quantity, lineLimits(product), product.price);
    if (refusal) throw orderRefusal(409, refusal);

    await storePool.query(
      `INSERT INTO cart_items (CartID, VariantID, Quantity, CreatedDate, CreatedTime)
       VALUES (?, ?, ?, CURDATE(), CURTIME())
       ON DUPLICATE KEY UPDATE Quantity = VALUES(Quantity), UpdatedDate = CURDATE(), UpdatedTime = CURTIME()`,
      [cart.id, product.variantId, quantity]
    );
    return CartService.pricedCart(cart);
  }

  /** Moves a guest cart into the signed-in customer's cart, keeping the larger quantity of each option. */
  static async mergeGuestCart(userId: number, sessionId: unknown): Promise<PricedCart> {
    const account = await CartService.activeCart({ userId });
    if (!isUsableSessionId(sessionId)) return CartService.pricedCart(account);

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      const [guests] = await conn.query<any[]>(
        `SELECT ID as id FROM carts
         WHERE SessionID = ? AND UserID IS NULL AND Status = 'active'
         FOR UPDATE`,
        [sessionId]
      );
      if (!guests.length) {
        await conn.rollback();
        return CartService.pricedCart(account);
      }
      const guestIds = guests.map((g) => Number(g.id));

      const [lines] = await conn.query<any[]>(
        `SELECT ci.CartID as cartId, ci.VariantID as variantId, pv.ProductID as productId, ci.Quantity as quantity
         FROM cart_items ci JOIN product_variants pv ON pv.ID = ci.VariantID
         WHERE ci.CartID IN (?)`,
        [[account.id, ...guestIds]]
      );
      const byVariant = new Map<number, { productId: number; account?: number; guest?: number }>();
      for (const line of lines) {
        const variantId = Number(line.variantId);
        const entry = byVariant.get(variantId) ?? { productId: Number(line.productId) };
        const qty = Number(line.quantity);
        if (Number(line.cartId) === account.id) entry.account = Math.max(entry.account ?? 0, qty);
        else entry.guest = Math.max(entry.guest ?? 0, qty);
        byVariant.set(variantId, entry);
      }

      for (const [variantId, quantities] of byVariant) {
        if (quantities.guest == null) continue;
        const product = await CartService.productForCart(quantities.productId, conn, false, variantId);
        if (!product || product.variantId == null || Number(product.variantActive) !== 1) continue;
        const quantity = mergeQuantity(quantities.account, quantities.guest, lineLimits(product));
        await conn.query(`DELETE FROM cart_items WHERE CartID = ? AND VariantID = ?`, [account.id, variantId]);
        await conn.query(
          `INSERT INTO cart_items (CartID, VariantID, Quantity, CreatedDate, CreatedTime)
           VALUES (?, ?, ?, CURDATE(), CURTIME())`,
          [account.id, variantId, quantity]
        );
      }

      await conn.query(`DELETE FROM cart_items WHERE CartID IN (?)`, [guestIds]);
      await conn.query(
        `UPDATE carts SET Status = 'merged', UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID IN (?)`,
        [guestIds]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return CartService.pricedCart(account);
  }

  /**
   * Adds one of the customer's past orders into their cart, at today's prices and limits.
   * A line that cannot be bought is left out and named. This does not place an order.
   */
  static async reorder(userId: number, orderId: number) {
    const [orders] = await storePool.query<any[]>(
      `SELECT ID as id, UserID as userId FROM orders WHERE ID = ? LIMIT 1`,
      [orderId]
    );
    if (!orders.length || orders[0].userId == null || Number(orders[0].userId) !== Number(userId)) {
      throw orderRefusal(404, 'Order not found');
    }

    const [lines] = await storePool.query<any[]>(
      `SELECT oi.ProductID as productId,
              oi.VariantID as variantId,
              SUM(oi.Quantity) as quantity,
              COALESCE(MAX(p.ProductName), 'Construction Material') as name
       FROM order_items oi
       LEFT JOIN products p ON p.ID = oi.ProductID
       WHERE oi.OrderID = ?
       GROUP BY oi.ProductID, oi.VariantID
       ORDER BY MIN(oi.ID)`,
      [orderId]
    );

    const cart = await CartService.activeCart({ userId });
    const added: { productId: number; variantId: number; name: string; quantity: number; note: string | null }[] = [];
    const skipped: { productId: number; name: string; reason: string }[] = [];

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`SELECT ID FROM carts WHERE ID = ? FOR UPDATE`, [cart.id]);
      const [current] = await conn.query<any[]>(
        `SELECT ci.VariantID as variantId, ci.Quantity as quantity
         FROM cart_items ci
         WHERE ci.CartID = ?`,
        [cart.id]
      );
      const have = new Map<number, number>();
      for (const row of current) have.set(Number(row.variantId), Number(row.quantity));

      for (const line of lines) {
        const productId = Number(line.productId);
        const orderedVariant = line.variantId == null ? null : Number(line.variantId);
        const orderedName = String(line.name || 'Construction Material');
        const product = await CartService.productForCart(productId, conn, false, orderedVariant);
        if (!product || product.variantId == null || Number(product.variantActive) !== 1) {
          const reason = !product
            ? 'This product is no longer in the catalogue.'
            : product.variantId == null
              ? "That option isn't part of this product."
              : "This option isn't available to order right now.";
          skipped.push({ productId, name: product ? String(product.name) : orderedName, reason });
          continue;
        }

        const label = product.variantName ? `${product.name} (${product.variantName})` : String(product.name);
        const decision = reorderTarget(
          label,
          Number(line.quantity),
          have.get(Number(product.variantId)) ?? 0,
          lineLimits(product),
          product.price
        );
        if ('reason' in decision) {
          skipped.push({ productId, name: label, reason: decision.reason });
          continue;
        }

        await conn.query(`DELETE FROM cart_items WHERE CartID = ? AND VariantID = ?`, [cart.id, product.variantId]);
        await conn.query(
          `INSERT INTO cart_items (CartID, VariantID, Quantity, CreatedDate, CreatedTime)
           VALUES (?, ?, ?, CURDATE(), CURTIME())`,
          [cart.id, product.variantId, decision.setTo]
        );
        have.set(Number(product.variantId), decision.setTo);
        added.push({
          productId,
          variantId: Number(product.variantId),
          name: label,
          quantity: decision.setTo,
          note: decision.note,
        });
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return { cart: await CartService.pricedCart(cart), added, skipped };
  }

  /** Empties the caller's cart (after the phone has placed its order). */
  static async emptyCart(access: CartAccess): Promise<PricedCart> {
    const cart = await CartService.activeCart(access);
    await storePool.query(`DELETE FROM cart_items WHERE CartID = ?`, [cart.id]);
    return CartService.pricedCart(cart);
  }

  static async addItem(
    cartId: number,
    variantId?: number,
    quantity: number = 1,
    productId?: number,
    access?: { userId?: number; sessionId?: string }
  ) {
    if (access) {
      await CartService.assertCartAccess(cartId, access.userId, access.sessionId);
    }
    const qty = Math.max(Number(quantity) || 1, 1);
    let resolvedVariantId = variantId ? Number(variantId) : null;

    if (!resolvedVariantId && productId) {
      const [vars] = await storePool.query<any[]>(
        `SELECT ID FROM product_variants WHERE ProductID = ? ORDER BY ID ASC LIMIT 1`,
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
      `SELECT ID, Quantity FROM cart_items WHERE CartID = ? AND VariantID = ? LIMIT 1`,
      [cartId, resolvedVariantId]
    );

    if (existing.length > 0) {
      const newQty = existing[0].Quantity + qty;
      await storePool.query(
        `UPDATE cart_items SET Quantity = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
        [newQty, existing[0].ID]
      );
      return { id: existing[0].ID, cartId, variantId: resolvedVariantId, quantity: newQty };
    }

    const [insert] = await storePool.query<any>(
      `INSERT INTO cart_items (CartID, VariantID, Quantity, CreatedDate, CreatedTime)
       VALUES (?, ?, ?, CURDATE(), CURTIME())`,
      [cartId, resolvedVariantId, qty]
    );

    return { id: insert.insertId, cartId, variantId: resolvedVariantId, quantity: qty };
  }

  static async removeItem(
    cartId: number,
    itemId: number,
    access?: { userId?: number; sessionId?: string }
  ) {
    if (access) {
      await CartService.assertCartAccess(cartId, access.userId, access.sessionId);
    }
    await storePool.query(`DELETE FROM cart_items WHERE CartID = ? AND ID = ?`, [cartId, itemId]);
    return { success: true };
  }

  static async clearCart(cartId: number, access?: { userId?: number; sessionId?: string }) {
    if (access) {
      await CartService.assertCartAccess(cartId, access.userId, access.sessionId);
    }
    await storePool.query(`DELETE FROM cart_items WHERE CartID = ?`, [cartId]);
    return { success: true };
  }
}
