import type { PoolConnection } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { orderRefusal } from '../utils/checkoutPricing.js';
import { isUsableSessionId, newSessionId } from '../utils/cartRules.js';
import { mergeSavedIds, savedAvailability, savedProductIds, WISHLIST_MAX } from '../utils/wishlist.js';
import { resolveCatalogImageUrl } from '../utils/catalogMedia.js';

export type WishlistAccess = { userId?: number; sessionId?: string };

export type SavedItem = {
  productId: number;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  categoryId: number | null;
  brandName: string | null;
  unit: string;
  price: number | null;
  stockQuantity: number;
  stockStatus: 'in_stock' | 'out_of_stock';
  minOrderQuantity: number;
  quantityStep: number;
  variantId: number | null;
  available: boolean;
  unavailableReason: string | null;
};

export type Wishlist = { sessionId?: string; items: SavedItem[] };

type Owner = { userId: number; sessionId?: undefined } | { userId?: undefined; sessionId: string };

const ITEM_SQL = `
  SELECT
    s.ID as savedId,
    s.ProductID as productId,
    COALESCE(p.ProductName, 'Construction Material') as name,
    p.ProductCode as sku,
    p.ProductImage as imageUrl,
    p.CategoryID as categoryId,
    p.Brand as brandName,
    COALESCE(mu.UnitName, 'unit') as unit,
    (p.ID IS NOT NULL AND p.IsActive = 1) as active,
    (SELECT MIN(pr.SellingPrice) FROM product_pricing pr WHERE pr.ProductID = p.ID AND pr.IsActive = 1) as price,
    (SELECT v.ID FROM product_variants v WHERE v.ProductID = p.ID ORDER BY v.ID ASC LIMIT 1) as variantId,
    COALESCE((SELECT v.StockQuantity FROM product_variants v WHERE v.ProductID = p.ID ORDER BY v.ID ASC LIMIT 1), 0) as stockQuantity,
    COALESCE(p.MinOrderQuantity, 1) as minOrderQuantity,
    COALESCE(p.QuantityStep, 1) as quantityStep
  FROM saved_items s
  LEFT JOIN products p ON p.ID = s.ProductID
  LEFT JOIN measurement_units mu ON mu.ID = p.MeasurementUnitID
`;

function toItem(row: any): SavedItem {
  const availability = savedAvailability(Number(row.active) === 1, row.price, row.stockQuantity);
  return {
    productId: Number(row.productId),
    name: String(row.name || 'Construction Material'),
    sku: row.sku == null ? null : String(row.sku),
    imageUrl: resolveCatalogImageUrl(row.imageUrl),
    categoryId: row.categoryId == null ? null : Number(row.categoryId),
    brandName: row.brandName == null || row.brandName === '' ? null : String(row.brandName),
    unit: String(row.unit || 'unit'),
    minOrderQuantity: Number(row.minOrderQuantity) > 0 ? Math.floor(Number(row.minOrderQuantity)) : 1,
    quantityStep: Number(row.quantityStep) > 0 ? Math.floor(Number(row.quantityStep)) : 1,
    variantId: row.variantId == null ? null : Number(row.variantId),
    ...availability,
  };
}

export class WishlistService {
  private static owner(access: WishlistAccess): Owner {
    if (access.userId) return { userId: access.userId };
    const sessionId = isUsableSessionId(access.sessionId) ? access.sessionId : newSessionId();
    return { sessionId };
  }

  private static async itemsFor(owner: Owner, conn: Pick<PoolConnection, 'query'> = storePool): Promise<SavedItem[]> {
    const [rows] = await conn.query<any[]>(
      `${ITEM_SQL} WHERE ${owner.userId ? 's.UserID = ?' : 's.SessionID = ?'} ORDER BY s.ID DESC`,
      [owner.userId ?? owner.sessionId]
    );
    return rows.map(toItem);
  }

  private static present(owner: Owner, items: SavedItem[]): Wishlist {
    return owner.userId ? { items } : { sessionId: owner.sessionId, items };
  }

  static async view(access: WishlistAccess): Promise<Wishlist> {
    const owner = WishlistService.owner(access);
    return WishlistService.present(owner, await WishlistService.itemsFor(owner));
  }

  /** Saves or removes one product. Saving again moves it to the front. */
  static async setSaved(access: WishlistAccess, productId: number, saved: boolean): Promise<Wishlist> {
    if (!Number.isInteger(productId) || productId <= 0) {
      throw orderRefusal(400, 'productId must be a product number.');
    }
    const owner = WishlistService.owner(access);
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      const where = owner.userId ? 'UserID = ?' : 'SessionID = ?';
      const key = owner.userId ?? owner.sessionId;
      await conn.query(`DELETE FROM saved_items WHERE ${where} AND ProductID = ?`, [key, productId]);

      if (saved) {
        const [products] = await conn.query<any[]>(
          `SELECT ID FROM products WHERE ID = ? AND IsActive = 1 LIMIT 1`,
          [productId]
        );
        if (!products.length) throw orderRefusal(409, 'This product is no longer in the catalogue.');

        const [counts] = await conn.query<any[]>(`SELECT COUNT(*) as n FROM saved_items WHERE ${where}`, [key]);
        if (Number(counts[0]?.n) >= WISHLIST_MAX) {
          throw orderRefusal(409, `You can save up to ${WISHLIST_MAX} products. Remove one to save another.`);
        }
        await conn.query(
          `INSERT INTO saved_items (UserID, SessionID, ProductID, CreatedDate, CreatedTime)
           VALUES (?, ?, ?, CURDATE(), CURTIME())`,
          [owner.userId ?? null, owner.sessionId ?? null, productId]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return WishlistService.present(owner, await WishlistService.itemsFor(owner));
  }

  /**
   * After sign-in, folds the guest session and the ids saved on the device into the account list.
   * The guest session list is cleared.
   */
  static async merge(userId: number, sessionId: unknown, deviceIds: unknown): Promise<Wishlist> {
    if (!Number.isInteger(userId) || userId <= 0) throw orderRefusal(401, 'Sign in to keep your saved items.');
    const device = savedProductIds(deviceIds);
    const guestSession = isUsableSessionId(sessionId) ? sessionId : null;

    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      const account = await WishlistService.itemsFor({ userId }, conn);
      const guest = guestSession ? await WishlistService.itemsFor({ sessionId: guestSession }, conn) : [];
      const merged = mergeSavedIds(
        account.map((item) => item.productId),
        guest.map((item) => item.productId),
        device
      );

      await conn.query(`DELETE FROM saved_items WHERE UserID = ?`, [userId]);
      if (guestSession) await conn.query(`DELETE FROM saved_items WHERE SessionID = ?`, [guestSession]);
      for (const productId of [...merged].reverse()) {
        await conn.query(
          `INSERT INTO saved_items (UserID, SessionID, ProductID, CreatedDate, CreatedTime)
           VALUES (?, NULL, ?, CURDATE(), CURTIME())`,
          [userId, productId]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return { items: await WishlistService.itemsFor({ userId }) };
  }
}
