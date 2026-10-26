/** How staff tell a customer an order is confirmed. Off until they choose one. */
export type OrderNotice = 'off' | 'sms' | 'whatsapp';

export type OrderConfirmation = {
  channel: 'sms' | 'whatsapp';
  status: 'sent' | 'failed';
  detail: string;
};

export type NoticeTransport =
  | { kind: 'missing'; detail: string }
  | { kind: 'prp'; apiKey: string; sender: string; templateName: string }
  | { kind: 'chatmybot'; accessToken: string; templateId: string }
  | { kind: 'interakt'; apiKey: string; templateName: string; langCode: string };

const NOT_CONFIGURED = {
  sms: 'SMS is not configured. Set the order template, then try again.',
  whatsapp: 'WhatsApp is not configured. Set the order template, then try again.',
} as const;

/** The order has been accepted, so the customer can be told. Pending and cancelled have not. */
export function orderAccepted(status: unknown): boolean {
  return status === 'confirmed' || status === 'processing' || status === 'shipped' || status === 'delivered';
}

export function readOrderNotice(raw: unknown): OrderNotice {
  if (raw === 'off' || raw === 'sms' || raw === 'whatsapp') return raw;
  throw Object.assign(new Error('Order confirmation is off, a text message, or WhatsApp.'), { statusCode: 400 });
}

export function orderNoticeFromValue(value: unknown): OrderNotice {
  return value === 'sms' || value === 'whatsapp' ? value : 'off';
}

/** Last 10 digits, the same mobile the shop already stored. Anything else cannot be texted. */
export function noticePhone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const ten = digits.slice(-10);
  if (!/^[1-9]\d{9}$/.test(ten)) return null;
  return ten;
}

export function confirmationText(orderNumber: string, total: number): string {
  const amount = Number.isFinite(total) ? total.toFixed(2) : '0.00';
  return `Techxpert order ${orderNumber} is confirmed. Total ₹${amount}.`;
}

/** Drop long digit runs so a provider error cannot keep a phone number. */
export function safeDetail(message: unknown): string {
  const cleaned = String(message ?? '')
    .replace(/\d{10,}/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
  const text = cleaned || 'The message was not sent.';
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

/**
 * Same accounts Homecare already uses for text and WhatsApp.
 * The order template is separate from the sign-in code template, and it is never assumed.
 */
export function noticeTransport(channel: 'sms' | 'whatsapp', env: NodeJS.ProcessEnv): NoticeTransport {
  if (channel === 'sms') {
    const provider = (env.ORDER_SMS_PROVIDER || env.SMS_PROVIDER || '').trim().toLowerCase();
    if (provider !== 'prp' && provider !== 'bulksms') return { kind: 'missing', detail: NOT_CONFIGURED.sms };
    const apiKey = (env.PRP_SMS_API_KEY || '').trim();
    const templateName = (env.PRP_ORDER_TEMPLATE_NAME || '').trim();
    if (!apiKey || !templateName) return { kind: 'missing', detail: NOT_CONFIGURED.sms };
    return {
      kind: 'prp',
      apiKey,
      sender: (env.PRP_SMS_SENDER || 'TECHX').trim() || 'TECHX',
      templateName,
    };
  }

  const explicit = (env.ORDER_WHATSAPP_PROVIDER || '').trim().toLowerCase();
  const legacy = (env.SMS_PROVIDER || '').trim().toLowerCase();
  const provider = explicit || (legacy === 'chatmybot' || legacy === 'interakt' ? legacy : '');
  if (provider === 'interakt') {
    const apiKey = (env.INTERAKT_API_KEY || '').trim();
    const templateName = (env.INTERAKT_ORDER_TEMPLATE || '').trim();
    if (!apiKey || !templateName) return { kind: 'missing', detail: NOT_CONFIGURED.whatsapp };
    return {
      kind: 'interakt',
      apiKey,
      templateName,
      langCode: (env.INTERAKT_LANG_CODE || 'en').trim() || 'en',
    };
  }
  if (provider === 'chatmybot') {
    const accessToken = (env.CHATMYBOT_ACCESS_TOKEN || '').trim();
    const templateId = (env.CHATMYBOT_ORDER_TEMPLATE_ID || '').trim();
    if (!accessToken || !templateId) return { kind: 'missing', detail: NOT_CONFIGURED.whatsapp };
    return { kind: 'chatmybot', accessToken, templateId };
  }
  return { kind: 'missing', detail: NOT_CONFIGURED.whatsapp };
}

/** PRP template body. The two values are the order number and the total. */
export function prpOrderBody(
  transport: Extract<NoticeTransport, { kind: 'prp' }>,
  phone: string,
  orderNumber: string,
  amount: string
) {
  return {
    sender: transport.sender,
    templateName: transport.templateName,
    smsReciever: [{ mobileNo: phone, templateParams: `${orderNumber}|${amount}` }],
  };
}

export function prpAccepted(httpOk: boolean, data: unknown): boolean {
  if (!httpOk || !data || typeof data !== 'object') return false;
  const body = data as Record<string, unknown>;
  if (body.isSuccess === true) return true;
  if (body.status === 'success' || body.Status === 'success') return true;
  const message = String(body.message || body.returnMessage || '').toLowerCase();
  return message.includes('success');
}

export function providerMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const body = data as Record<string, unknown>;
  return String(body.returnMessage || body.message || body.Message || '');
}

/**
 * Send once, when the order is first accepted. A later status does not send again.
 * A failed send is not retried on its own. Staff ask again with `manual`.
 */
export function confirmationAttempt(input: {
  channel: OrderNotice;
  status: string;
  existing: 'sent' | 'failed' | null;
  manual: boolean;
}): 'skip' | 'send' | 'already' | 'off' | 'waiting' {
  if (!orderAccepted(input.status)) return input.manual ? 'waiting' : 'skip';
  if (input.existing === 'sent') return input.manual ? 'already' : 'skip';
  if (input.existing === 'failed' && !input.manual) return 'skip';
  if (input.channel === 'off') return input.manual ? 'off' : 'skip';
  return 'send';
}
