import React, { useState } from 'react';
import { Button, Field, Modal } from './ui';
import type { PlaceOrderSeed, PlacedOrder } from './placeOrderForm';

const emptyLine = () => ({ productId: '', variantId: '', quantity: '1' });

type Draft = PlaceOrderSeed;

export const PlaceOrderDialog: React.FC<{
  seed: PlaceOrderSeed;
  onClose: () => void;
  onPlaced: (order: PlacedOrder) => void;
  place: (body: unknown) => Promise<PlacedOrder>;
}> = ({ seed, onClose, onPlaced, place }) => {
  const [draft, setDraft] = useState<Draft>(seed);
  const [seen, setSeen] = useState(seed);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (seed !== seen) {
    setSeen(seed);
    setDraft(seed);
    setError(null);
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const lines = draft.lines.map((line) => ({
      productId: Number(line.productId),
      variantId: line.variantId.trim() === '' ? undefined : Number(line.variantId),
      quantity: Number(line.quantity),
    }));
    try {
      setSaving(true);
      setError(null);
      const order = await place({
        name: draft.name,
        phone: draft.phone,
        pincode: draft.pincode,
        address: draft.address,
        note: draft.note.trim() || undefined,
        requestId: draft.requestId ? Number(draft.requestId) : undefined,
        lines,
      });
      onPlaced(order);
    } catch (err: any) {
      setError(err?.message || 'The server refused the order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={draft.requestId ? 'Place this request' : 'Place an order'}
      subtitle="The price, the stock and the pincode are decided here, the same as in the app. The goods are held."
      maxWidth="640px"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="place-order" loading={saving}>
            Place order
          </Button>
        </>
      }
    >
      <form id="place-order" onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Field id="place-name" label="Customer name">
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Field id="place-phone" label="Mobile" hint="A number that already has an account keeps that account.">
          <input inputMode="numeric" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
        </Field>
        <Field id="place-pin" label="Pincode">
          <input inputMode="numeric" value={draft.pincode} onChange={(event) => setDraft({ ...draft, pincode: event.target.value })} />
        </Field>
        <Field id="place-address" label="Delivery address">
          <input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
        </Field>
        {draft.lines.map((line, index) => (
          <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <Field id={`place-product-${index}`} label="Product number" style={{ flex: 1 }}>
              <input inputMode="numeric" value={line.productId} onChange={(event) => setLine(index, { productId: event.target.value })} />
            </Field>
            <Field id={`place-variant-${index}`} label="Option number" hint="Empty uses the first option." style={{ flex: 1 }}>
              <input inputMode="numeric" value={line.variantId} onChange={(event) => setLine(index, { variantId: event.target.value })} />
            </Field>
            <Field id={`place-qty-${index}`} label="Quantity" style={{ width: '96px' }}>
              <input inputMode="numeric" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} />
            </Field>
            {draft.lines.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, i) => i !== index) })}>
                Remove
              </Button>
            ) : null}
          </div>
        ))}
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyLine()] })}>
            Add product
          </Button>
        </div>
        <Field id="place-note" label="Note" hint="Optional.">
          <input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        </Field>
        {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
      </form>
    </Modal>
  );

  function setLine(index: number, patch: Partial<Draft['lines'][number]>) {
    setDraft((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  }
};
