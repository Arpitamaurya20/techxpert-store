import type { PoolConnection } from 'mysql2/promise';
import { storePool } from '../db/mysql.js';
import { AuditService } from './auditService.js';
import { CartService } from './cartService.js';
import { DeliveryAreaService } from './deliveryAreaService.js';
import { StoreStockService } from './storeStockService.js';
import { isOrderRefusal, orderRefusal } from '../utils/checkoutPricing.js';
import { lineLimits } from '../utils/cartRules.js';
import { readTalkRequest, readTalkStatus, talkNote, talkRefusal } from '../utils/talkRequest.js';

const NOT_READY = 'Talk requests are not ready. Run the talk requests SQL, then try again.';

export type TalkLine = {
  productId: string;
  variantId: number;
  name: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  stockAtRequest: number;
  note: string | null;
};

export type TalkRequest = {
  id: string;
  name: string;
  phone: string;
  pincode: string;
  storeId: number;
  storeName: string | null;
  note: string | null;
  status: 'new' | 'closed';
  placedAt: string;
  totals: { subtotal: number; tax: number; delivery: number; grandTotal: number };
  lines: TalkLine[];
  message: string | null;
};

const HELD = 'Staff will call this number. Nothing is ordered, and no stock is held.';

export class TalkRequestService {
  static async create(body: unknown): Promise<TalkRequest> {
    const input = readTalkRequest(body);
    const { pincode, storeId } = await DeliveryAreaService.assertServiceable(input.pincode);
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      const rows: any[] = [];
      for (const line of input.lines) {
        const product = await CartService.productForCart(line.productId, conn, true, line.variantId);
        if (!product) throw orderRefusal(409, 'A product in this request is no longer in the catalogue.');
        if (product.variantId == null) {
          throw orderRefusal(
            409,
            line.variantId
              ? "That option isn't part of this product."
              : `"${product.name}" isn't available to order right now.`
          );
        }
        if (Number(product.variantActive) !== 1) {
          throw orderRefusal(409, `"${product.name}" isn't available to order right now.`);
        }
        const limits = lineLimits(product);
        const refusal = talkRefusal(product.name, line.quantity, limits, product.price);
        if (refusal) throw orderRefusal(409, refusal);
        rows.push({ ...product, quantity: line.quantity });
      }
      await StoreStockService.capLines(conn, storeId, rows);
      for (const row of rows) {
        const asked = Number(row.quantity);
        const sellable = lineLimits(row);
        row.talkStock = sellable.stock;
        row.talkNote = talkNote(String(row.name), asked, sellable);
        row.stock = Math.max(sellable.stock, asked, 1);
        row.maxOrderQuantity = null;
      }

      const { lines, totals } = await CartService.priceRows(rows);
      const blocked = lines.find((line) => line.problem);
      if (blocked) throw orderRefusal(409, `"${blocked.name}" isn't available to order right now.`);

      const [insert] = await conn.query<any>(
        `INSERT INTO talk_requests
         (CustomerName, CustomerPhone, Pincode, StoreID, Note, Status, SubTotal, TaxTotal, ShippingCharges, GrandTotal, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, CURDATE(), CURTIME())`,
        [
          input.name,
          input.phone,
          pincode,
          storeId,
          input.note,
          totals.subtotal.toFixed(2),
          totals.tax.toFixed(2),
          totals.delivery.toFixed(2),
          totals.grandTotal.toFixed(2),
        ]
      );
      const requestId = Number(insert.insertId);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const source = rows[i];
        await conn.query(
          `INSERT INTO talk_request_lines
           (RequestID, ProductID, VariantID, ProductName, VariantName, Quantity, UnitPrice, LineTotal, StockAtRequest, Note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            requestId,
            Number(line.productId),
            line.variantId,
            line.name,
            line.variantName,
            line.quantity,
            Number(line.unitPrice).toFixed(2),
            line.lineTotal.toFixed(2),
            source.talkStock,
            source.talkNote ? String(source.talkNote).slice(0, 255) : null,
          ]
        );
      }
      await conn.commit();
      const saved = await TalkRequestService.one(requestId, conn);
      return { ...saved, message: HELD };
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      if (isOrderRefusal(err) || (err as { statusCode?: number })?.statusCode) throw err;
      if ((err as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
        throw Object.assign(new Error(NOT_READY), { statusCode: 503 });
      }
      console.error('[TalkRequest] create failed', err);
      throw Object.assign(new Error("We couldn't send that request. Nothing was saved."), { statusCode: 503 });
    } finally {
      conn.release();
    }
  }

  static async list(storeIds: number[] | null): Promise<TalkRequest[]> {
    if (storeIds && storeIds.length === 0) return [];
    try {
      const params: unknown[] = [];
      const where = storeIds ? 'WHERE r.StoreID IN (?)' : '';
      if (storeIds) params.push(storeIds);
      const [rows] = await storePool.query<any[]>(
        `SELECT r.ID as id FROM talk_requests r ${where} ORDER BY r.ID DESC LIMIT 100`,
        params
      );
      const requests: TalkRequest[] = [];
      for (const row of rows) requests.push(await TalkRequestService.one(Number(row.id)));
      return requests;
    } catch (err) {
      if ((err as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
        throw Object.assign(new Error(NOT_READY), { statusCode: 503 });
      }
      throw err;
    }
  }

  static async setStatus(id: unknown, body: unknown, storeIds: number[] | null, actorName: string): Promise<TalkRequest> {
    const status = readTalkStatus(body);
    const requestId = Number(id);
    if (!Number.isInteger(requestId) || requestId <= 0) throw orderRefusal(400, 'That request was not found.');
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query<any[]>(
        `SELECT ID as id, StoreID as storeId, Status as status, CustomerName as name FROM talk_requests WHERE ID = ? LIMIT 1 FOR UPDATE`,
        [requestId]
      );
      const row = rows[0];
      if (!row || (storeIds && !storeIds.includes(Number(row.storeId)))) {
        throw orderRefusal(404, 'That request was not found.');
      }
      if (String(row.status) !== status) {
        await conn.query(
          `UPDATE talk_requests SET Status = ?, UpdatedDate = CURDATE(), UpdatedTime = CURTIME() WHERE ID = ?`,
          [status, requestId]
        );
      }
      await conn.commit();
      if (String(row.status) !== status) {
        await AuditService.create({
          action: status === 'closed' ? 'Closed a talk request' : 'Reopened a talk request',
          entity: 'request',
          details: `${row.name}, request ${requestId}`,
          user: actorName,
        }).catch((err) => console.warn('[TalkRequest] audit write failed', err));
      }
      return TalkRequestService.one(requestId);
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      if (isOrderRefusal(err) || (err as { statusCode?: number })?.statusCode) throw err;
      if ((err as { code?: string })?.code === 'ER_NO_SUCH_TABLE') {
        throw Object.assign(new Error(NOT_READY), { statusCode: 503 });
      }
      console.error('[TalkRequest] status failed', err);
      throw Object.assign(new Error("We couldn't update that request."), { statusCode: 503 });
    } finally {
      conn.release();
    }
  }

  private static async one(id: number, conn: Pick<PoolConnection, 'query'> = storePool): Promise<TalkRequest> {
    const [rows] = await conn.query<any[]>(
      `SELECT r.ID as id, r.CustomerName as name, r.CustomerPhone as phone, r.Pincode as pincode,
              r.StoreID as storeId, s.StoreName as storeName, r.Note as note, r.Status as status,
              UNIX_TIMESTAMP(TIMESTAMP(r.CreatedDate, COALESCE(r.CreatedTime, '00:00:00'))) as placedEpoch,
              CAST(r.SubTotal AS DOUBLE) as subtotal, CAST(r.TaxTotal AS DOUBLE) as tax,
              CAST(r.ShippingCharges AS DOUBLE) as delivery, CAST(r.GrandTotal AS DOUBLE) as grandTotal
       FROM talk_requests r
       LEFT JOIN stores s ON s.ID = r.StoreID
       WHERE r.ID = ? LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) throw orderRefusal(404, 'That request was not found.');
    const [lines] = await conn.query<any[]>(
      `SELECT ProductID as productId, VariantID as variantId, ProductName as name, VariantName as variantName,
              Quantity as quantity, CAST(UnitPrice AS DOUBLE) as unitPrice, CAST(LineTotal AS DOUBLE) as lineTotal,
              StockAtRequest as stockAtRequest, Note as note
       FROM talk_request_lines WHERE RequestID = ? ORDER BY ID ASC`,
      [id]
    );
    return {
      id: String(row.id),
      name: String(row.name),
      phone: String(row.phone),
      pincode: String(row.pincode),
      storeId: Number(row.storeId),
      storeName: row.storeName ? String(row.storeName) : null,
      note: row.note ? String(row.note) : null,
      status: row.status === 'closed' ? 'closed' : 'new',
      placedAt: new Date(Number(row.placedEpoch) * 1000).toISOString(),
      totals: {
        subtotal: Number(row.subtotal),
        tax: Number(row.tax),
        delivery: Number(row.delivery),
        grandTotal: Number(row.grandTotal),
      },
      lines: lines.map((line) => ({
        productId: String(line.productId),
        variantId: Number(line.variantId),
        name: String(line.name),
        variantName: line.variantName ? String(line.variantName) : null,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        lineTotal: Number(line.lineTotal),
        stockAtRequest: Number(line.stockAtRequest),
        note: line.note ? String(line.note) : null,
      })),
      message: row.status === 'closed' ? null : HELD,
    };
  }
}
