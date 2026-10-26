import { quantityRefusal, type CartLimits } from './cartRules.js';

export type TalkLineInput = { productId: number; variantId: number | null; quantity: number };

export type TalkRequestInput = {
  name: string;
  phone: string;
  pincode: string;
  note: string | null;
  lines: TalkLineInput[];
};

const NAME_MAX = 80;
const NOTE_MAX = 400;
const LINE_MAX = 30;

/**
 * A request may ask for more than the shelf holds. Pack size, the minimum and a missing price
 * still refuse, because those are how the product is sold.
 */
export function talkRefusal(
  name: string,
  quantity: number,
  limits: CartLimits,
  price: unknown
): string | null {
  const shelf: CartLimits = { ...limits, stock: Math.max(limits.stock, quantity, 1), max: null };
  return quantityRefusal(name, quantity, shelf, price);
}

/** What staff should see when the asked quantity does not fit the shelf. Null when it does. */
export function talkNote(name: string, quantity: number, limits: CartLimits): string | null {
  if (limits.stock <= 0) return `"${name}" is out of stock. They asked for ${quantity}.`;
  const parts: string[] = [];
  if (quantity > limits.stock) parts.push(`only ${limits.stock} are in stock`);
  if (limits.max != null && quantity > limits.max) parts.push(`the shelf limit is ${limits.max}`);
  if (!parts.length) return null;
  return `"${name}": they asked for ${quantity}; ${parts.join(', and ')}.`;
}

export function readTalkRequest(body: unknown): TalkRequestInput {
  if (!body || typeof body !== 'object') throw talkError('Send the name, phone, pincode and the products.');
  const source = body as Record<string, unknown>;
  const name = String(source.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) throw talkError("Enter the customer's name.");
  if (name.length > NAME_MAX) throw talkError(`The name can be ${NAME_MAX} characters.`);
  const phone = String(source.phone ?? '').replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) throw talkError('Enter a 10-digit mobile number.');
  const pincode = String(source.pincode ?? '').replace(/\D/g, '');
  if (pincode.length !== 6) throw talkError('Add a 6-digit pincode.');
  const rawNote = source.note == null ? '' : String(source.note).trim();
  if (rawNote.length > NOTE_MAX) throw talkError(`The note can be ${NOTE_MAX} characters.`);
  if (!Array.isArray(source.lines) || source.lines.length === 0) throw talkError('Add at least one product.');
  const merged = new Map<string, TalkLineInput>();
  for (const raw of source.lines) {
    if (!raw || typeof raw !== 'object') throw talkError('Each product needs a product number and a quantity.');
    const line = raw as Record<string, unknown>;
    const productId = Number(line.productId);
    if (!Number.isInteger(productId) || productId <= 0) throw talkError('Each product needs a product number.');
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw talkError('Quantity must be a whole number of at least 1.');
    let variantId: number | null = null;
    if (line.variantId != null && line.variantId !== '') {
      variantId = Number(line.variantId);
      if (!Number.isInteger(variantId) || variantId <= 0) throw talkError('variantId must be an option of that product.');
    }
    const key = `${productId}:${variantId ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, { productId, variantId, quantity: (prev?.quantity ?? 0) + quantity });
  }
  if (merged.size > LINE_MAX) throw talkError(`A request can hold up to ${LINE_MAX} products.`);
  return { name, phone, pincode, note: rawNote || null, lines: [...merged.values()] };
}

export function readTalkStatus(body: unknown): 'new' | 'closed' {
  const status = String((body as { status?: unknown } | null)?.status ?? '');
  if (status !== 'new' && status !== 'closed') throw talkError('Status is new or closed.');
  return status;
}

function talkError(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}
