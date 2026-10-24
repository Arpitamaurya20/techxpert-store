import type { PoolConnection } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { allocationOver, sellableAtStore } from '../utils/storeStock.js';
import { badRequest } from '../utils/validate.js';

export interface StoreStockAssignment {
  variantId: number;
  storeId: number;
  /** null clears the row, so the store sells the company figure again. */
  quantity: number | null;
}

interface StoreStockVariant {
  variantId: number;
  name: string;
  companyStock: number;
  stores: { storeId: number; name: string; quantity: number | null }[];
}

/** Staff read of which stores have their own quantity. The shop still shows the company figure. */
export class StoreStockService {
  static async forProduct(productId: number): Promise<{ variants: StoreStockVariant[] }> {
    const [products] = await storePool.query<any[]>(`SELECT ID FROM products WHERE ID = ? LIMIT 1`, [productId]);
    if (!products.length) {
      throw Object.assign(new Error('Product not found'), { statusCode: 404 });
    }

    const [variants] = await storePool.query<any[]>(
      `SELECT ID as variantId, VariantName as name, StockQuantity as companyStock
       FROM product_variants WHERE ProductID = ? ORDER BY ID ASC`,
      [productId]
    );
    const [stores] = await storePool.query<any[]>(
      `SELECT ID as storeId, StoreName as name FROM stores WHERE IsActive = 1 ORDER BY StoreName ASC, ID ASC`
    );
    const variantIds = variants.map((row) => Number(row.variantId));
    const held = new Map<string, number>();
    if (variantIds.length) {
      const [rows] = await storePool.query<any[]>(
        `SELECT VariantID as variantId, StoreID as storeId, StockQuantity as quantity
         FROM store_variant_stock WHERE VariantID IN (${variantIds.map(() => '?').join(',')})`,
        variantIds
      );
      for (const row of rows) held.set(`${row.variantId}:${row.storeId}`, Number(row.quantity));
    }

    return {
      variants: variants.map((variant) => ({
        variantId: Number(variant.variantId),
        name: String(variant.name || 'Option'),
        companyStock: Number(variant.companyStock) || 0,
        stores: stores.map((store) => {
          const key = `${variant.variantId}:${store.storeId}`;
          return {
            storeId: Number(store.storeId),
            name: String(store.name || 'Store'),
            quantity: held.has(key) ? held.get(key)! : null,
          };
        }),
      })),
    };
  }

  /**
   * Sets or clears the pairs in `assignments`. Pairs left out stay as they are.
   * `targets` is the company figure each option will have after this same save; missing ids keep today's figure.
   */
  static async apply(
    conn: PoolConnection,
    productId: number,
    assignments: unknown,
    targets: Map<number, number> | null
  ) {
    const parsed = parseAssignments(assignments);
    const [variants] = await conn.query<any[]>(
      `SELECT ID as variantId, VariantName as name, StockQuantity as companyStock
       FROM product_variants WHERE ProductID = ? ORDER BY ID ASC`,
      [productId]
    );
    const known = new Map(variants.map((row) => [Number(row.variantId), row]));
    const [stores] = await conn.query<any[]>(`SELECT ID as storeId FROM stores WHERE IsActive = 1`);
    const open = new Set(stores.map((row) => Number(row.storeId)));

    const seen = new Set<string>();
    for (const row of parsed) {
      if (!known.has(row.variantId)) badRequest("That option isn't part of this product.");
      if (!open.has(row.storeId)) badRequest('Pick a store that is open.');
      const key = `${row.variantId}:${row.storeId}`;
      if (seen.has(key)) badRequest('Each store is listed once for an option.');
      seen.add(key);
    }

    const variantIds = [...known.keys()];
    const next = new Map<number, Map<number, number>>();
    if (variantIds.length) {
      const [rows] = await conn.query<any[]>(
        `SELECT VariantID as variantId, StoreID as storeId, StockQuantity as quantity
         FROM store_variant_stock WHERE VariantID IN (${variantIds.map(() => '?').join(',')}) FOR UPDATE`,
        variantIds
      );
      for (const row of rows) {
        const variantId = Number(row.variantId);
        const own = next.get(variantId) ?? new Map<number, number>();
        own.set(Number(row.storeId), Number(row.quantity) || 0);
        next.set(variantId, own);
      }
    }

    for (const row of parsed) {
      const own = next.get(row.variantId) ?? new Map<number, number>();
      if (row.quantity == null) own.delete(row.storeId);
      else own.set(row.storeId, row.quantity);
      next.set(row.variantId, own);
    }

    for (const [variantId, own] of next) {
      const variant = known.get(variantId);
      const company = targets?.has(variantId) ? targets.get(variantId)! : Number(variant?.companyStock) || 0;
      const reason = allocationOver(company, [...own.values()], String(variant?.name || 'this option'));
      if (reason) badRequest(reason);
    }

    for (const row of parsed) {
      if (row.quantity == null) {
        await conn.query(`DELETE FROM store_variant_stock WHERE StoreID = ? AND VariantID = ?`, [
          row.storeId,
          row.variantId,
        ]);
      } else {
        await conn.query(
          `INSERT INTO store_variant_stock (StoreID, VariantID, StockQuantity)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE StockQuantity = VALUES(StockQuantity)`,
          [row.storeId, row.variantId, row.quantity]
        );
      }
    }
  }

  /** Checkout: a store with its own row sells that quantity, and never more than the company figure. */
  static async capLines(
    conn: Pick<PoolConnection, 'query'>,
    storeId: number,
    rows: { variantId?: number; stock?: number }[]
  ) {
    const ids = [...new Set(rows.map((row) => Number(row.variantId)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!storeId || ids.length === 0) return;
    const [held] = await conn.query<any[]>(
      `SELECT VariantID as variantId, StockQuantity as quantity
       FROM store_variant_stock WHERE StoreID = ? AND VariantID IN (${ids.map(() => '?').join(',')}) FOR UPDATE`,
      [storeId, ...ids]
    );
    const own = new Map(held.map((row) => [Number(row.variantId), Number(row.quantity)]));
    for (const row of rows) {
      const variantId = Number(row.variantId);
      if (!own.has(variantId)) continue;
      row.stock = sellableAtStore(Number(row.stock) || 0, own.get(variantId)!);
    }
  }
}

function parseAssignments(value: unknown): StoreStockAssignment[] {
  if (!Array.isArray(value)) badRequest('storeStock must be a list.');
  return value.map((row) => {
    const variantId = Number(row?.variantId);
    const storeId = Number(row?.storeId);
    if (!Number.isInteger(variantId) || variantId <= 0) badRequest("That option isn't part of this product.");
    if (!Number.isInteger(storeId) || storeId <= 0) badRequest('Pick a store that is open.');
    if (row?.quantity == null || row?.quantity === '') return { variantId, storeId, quantity: null };
    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      badRequest('Stock at a store is a whole number, or empty to use the company stock.');
    }
    return { variantId, storeId, quantity };
  });
}
