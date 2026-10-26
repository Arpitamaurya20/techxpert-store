import { storePool } from '../db/mysql.js';
import { ShopSettingsService } from './shopSettingsService.js';
import {
  confirmationAttempt,
  noticePhone,
  noticeTransport,
  prpAccepted,
  prpOrderBody,
  providerMessage,
  safeDetail,
  type OrderConfirmation,
} from '../utils/orderNotice.js';

const NOT_READY = 'Order confirmation is not ready. Run the order messages SQL, then try again.';

/**
 * Tells the customer an order is confirmed, by text or WhatsApp, after the order is saved.
 * A missing provider or a failed send does not undo the order. The phone number is not stored.
 */
export class OrderNoticeService {
  /** After a successful commit. Never throws, and does not send twice. */
  static async tell(orderId: number): Promise<OrderConfirmation | null> {
    try {
      return await OrderNoticeService.send(orderId, false);
    } catch {
      console.warn(`[OrderNotice] confirmation skipped for order ${orderId}`);
      return null;
    }
  }

  /** Staff ask again after a failed send. */
  static async resend(orderId: number): Promise<OrderConfirmation> {
    const confirmation = await OrderNoticeService.send(orderId, true);
    if (!confirmation) throw Object.assign(new Error('That order was not found.'), { statusCode: 404 });
    return confirmation;
  }

  static async attach(orders: { id: unknown; confirmation?: OrderConfirmation | null }[]): Promise<void> {
    try {
      const ids = orders.map((order) => Number(order.id)).filter((id) => Number.isInteger(id) && id > 0);
      const found = await OrderNoticeService.readMap(ids);
      for (const order of orders) order.confirmation = found.get(Number(order.id)) ?? null;
    } catch {
      console.warn('[OrderNotice] could not read confirmations');
      for (const order of orders) order.confirmation = null;
    }
  }

  private static async send(orderId: number, manual: boolean): Promise<OrderConfirmation | null> {
    const [orders] = await storePool.query<any[]>(
      `SELECT OrderNumber as orderNumber, OrderStatus as status, GuestPhone as phone,
              CAST(GrandTotal AS DOUBLE) as total
       FROM orders WHERE ID = ? LIMIT 1`,
      [orderId]
    );
    const order = orders[0];
    if (!order) {
      if (manual) throw Object.assign(new Error('That order was not found.'), { statusCode: 404 });
      return null;
    }

    if (!(await OrderNoticeService.tableReady())) {
      if (manual) throw Object.assign(new Error(NOT_READY), { statusCode: 503 });
      return null;
    }

    const channel = (await ShopSettingsService.read()).orderNotice;
    const existing = await OrderNoticeService.readOne(orderId);
    const attempt = confirmationAttempt({
      channel,
      status: String(order.status),
      existing: existing?.status ?? null,
      manual,
    });
    if (attempt === 'skip') return existing;
    if (attempt === 'waiting') {
      throw Object.assign(new Error('Tell the customer once the order is confirmed.'), { statusCode: 409 });
    }
    if (attempt === 'already') {
      throw Object.assign(new Error('That confirmation was already sent.'), { statusCode: 409 });
    }
    if (attempt === 'off') {
      throw Object.assign(new Error('Order confirmation is switched off.'), { statusCode: 409 });
    }

    const phone = noticePhone(order.phone);
    const outcome = phone
      ? await deliver(channel === 'whatsapp' ? 'whatsapp' : 'sms', phone, String(order.orderNumber), Number(order.total))
      : { status: 'failed' as const, detail: 'This order has no mobile number.' };
    const confirmation: OrderConfirmation = {
      channel: channel === 'whatsapp' ? 'whatsapp' : 'sms',
      status: outcome.status,
      detail: outcome.detail,
    };
    await OrderNoticeService.write(orderId, confirmation);
    if (outcome.status === 'failed') {
      console.warn(`[OrderNotice] ${order.orderNumber} was not sent: ${outcome.detail}`);
    }
    return confirmation;
  }

  private static async readOne(orderId: number): Promise<OrderConfirmation | null> {
    const found = await OrderNoticeService.readMap([orderId]);
    return found.get(orderId) ?? null;
  }

  private static async readMap(ids: number[]): Promise<Map<number, OrderConfirmation>> {
    const map = new Map<number, OrderConfirmation>();
    if (!ids.length) return map;
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT OrderID as orderId, Channel as channel, Status as status, Detail as detail
         FROM order_messages WHERE OrderID IN (?)`,
        [ids]
      );
      for (const row of rows) {
        map.set(Number(row.orderId), {
          channel: row.channel === 'whatsapp' ? 'whatsapp' : 'sms',
          status: row.status === 'sent' ? 'sent' : 'failed',
          detail: String(row.detail ?? ''),
        });
      }
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE') return map;
      throw err;
    }
    return map;
  }

  private static async tableReady(): Promise<boolean> {
    try {
      await storePool.query(`SELECT 1 FROM order_messages LIMIT 0`);
      return true;
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE') return false;
      throw err;
    }
  }

  private static async write(orderId: number, confirmation: OrderConfirmation): Promise<void> {
    try {
      await storePool.query(
        `INSERT INTO order_messages (OrderID, Channel, Status, Detail, CreatedDate, CreatedTime)
         VALUES (?, ?, ?, ?, CURDATE(), CURTIME())
         ON DUPLICATE KEY UPDATE Channel = VALUES(Channel), Status = VALUES(Status), Detail = VALUES(Detail),
           CreatedDate = CURDATE(), CreatedTime = CURTIME()`,
        [orderId, confirmation.channel, confirmation.status, confirmation.detail]
      );
    } catch (err: any) {
      if (err?.code === 'ER_NO_SUCH_TABLE') {
        throw Object.assign(new Error(NOT_READY), { statusCode: 503 });
      }
      throw err;
    }
  }
}

async function deliver(
  channel: 'sms' | 'whatsapp',
  phone: string,
  orderNumber: string,
  total: number
): Promise<{ status: 'sent' | 'failed'; detail: string }> {
  const transport = noticeTransport(channel, process.env);
  if (transport.kind === 'missing') return { status: 'failed', detail: transport.detail };
  const amount = Number.isFinite(total) ? total.toFixed(2) : '0.00';
  try {
    if (transport.kind === 'prp') {
      const res = await fetch('https://api.bulksmsadmin.com/BulkSMSapi/keyApiSendSMS/SendSmsTemplateName', {
        method: 'POST',
        headers: { apikey: transport.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(prpOrderBody(transport, phone, orderNumber, amount)),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json().catch(() => ({}));
      if (prpAccepted(res.ok, data)) return { status: 'sent', detail: 'Sent by text message.' };
      return { status: 'failed', detail: safeDetail(providerMessage(data) || 'The text message was not sent.') };
    }
    if (transport.kind === 'interakt') {
      const res = await fetch('https://api.interakt.ai/v1/public/message/', {
        method: 'POST',
        headers: { Authorization: `Basic ${transport.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode: '+91',
          phoneNumber: phone,
          type: 'Template',
          template: {
            name: transport.templateName,
            languageCode: transport.langCode,
            bodyValues: [orderNumber, amount],
          },
        }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && typeof data === 'object' && (data as { result?: boolean }).result === true) {
        return { status: 'sent', detail: 'Sent by WhatsApp.' };
      }
      return { status: 'failed', detail: safeDetail(providerMessage(data) || 'The WhatsApp message was not sent.') };
    }
    const res = await fetch('https://wa.chatmybot.in/gateway/wabuissness/v1/message/batchapi', {
      method: 'POST',
      headers: { accessToken: transport.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          template: {
            id: transport.templateId,
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: orderNumber },
                  { type: 'text', text: amount },
                ],
              },
            ],
          },
          to: phone,
          type: 'template',
        },
      ]),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { status: 'sent', detail: 'Sent by WhatsApp.' };
    const data = await res.json().catch(() => ({}));
    return { status: 'failed', detail: safeDetail(providerMessage(data) || 'The WhatsApp message was not sent.') };
  } catch {
    console.warn(`[OrderNotice] ${orderNumber} ${channel} did not send`);
    return { status: 'failed', detail: channel === 'sms' ? 'The text message was not sent.' : 'The WhatsApp message was not sent.' };
  }
}
