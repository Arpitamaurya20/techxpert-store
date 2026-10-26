import { orderRefusal } from './checkoutPricing.js';

export function readProblemNote(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw orderRefusal(400, 'Say what went wrong.');
  }
  const note = (body as { note?: unknown }).note;
  if (typeof note !== 'string') throw orderRefusal(400, 'Say what went wrong.');
  const text = note.trim().replace(/\s+/g, ' ');
  if (!text) throw orderRefusal(400, 'Say what went wrong.');
  if (text.length > 400) throw orderRefusal(400, 'Keep it to 400 characters.');
  return text;
}

export function readProblemClose(body: unknown): void {
  if (!body || typeof body !== 'object' || Array.isArray(body) || (body as { status?: unknown }).status !== 'closed') {
    throw orderRefusal(400, 'Say that the problem is closed.');
  }
}
