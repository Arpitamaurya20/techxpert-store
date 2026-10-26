import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyAgreedPrice, priceChangeAllowed, readAgreedChange, taxFraction } from './agreedPrice.js';

const line = {
  id: 7,
  quantity: 1,
  unitPrice: 199,
  lineTotal: 199,
  taxRate: 18,
  taxAmount: 35.82,
  discountAmount: 0,
};

describe('priceChangeAllowed', () => {
  it('allows a pending order and a confirmed order staff placed', () => {
    assert.equal(priceChangeAllowed('pending', 'app'), true);
    assert.equal(priceChangeAllowed('pending', 'staff'), true);
    assert.equal(priceChangeAllowed('confirmed', 'staff'), true);
    assert.equal(priceChangeAllowed('confirmed', 'request'), true);
  });

  it('locks an app order once it is confirmed, and any order once it is being prepared', () => {
    assert.equal(priceChangeAllowed('confirmed', 'app'), false);
    assert.equal(priceChangeAllowed('processing', 'staff'), false);
    assert.equal(priceChangeAllowed('shipped', 'request'), false);
    assert.equal(priceChangeAllowed('delivered', 'staff'), false);
    assert.equal(priceChangeAllowed('cancelled', 'pending'), false);
  });
});

describe('readAgreedChange', () => {
  it('reads a delivery charge and a line price', () => {
    assert.deepEqual(readAgreedChange({ delivery: 0, lines: [{ itemId: 7, unitPrice: 100 }] }), {
      delivery: 0,
      lines: [{ itemId: 7, unitPrice: 100 }],
    });
  });

  it('refuses a blank body, a negative charge, and a repeated line', () => {
    assert.throws(() => readAgreedChange({}), /delivery charge or a line price/);
    assert.throws(() => readAgreedChange({ delivery: -1 }), /delivery charge/);
    assert.throws(() => readAgreedChange({ lines: [{ itemId: 7, unitPrice: 1 }, { itemId: 7, unitPrice: 2 }] }), /named once/);
  });
});

describe('applyAgreedPrice', () => {
  it('changes the delivery charge and leaves the line tax', () => {
    const next = applyAgreedPrice([line], 99, { delivery: 0, lines: [] });
    assert.equal(next.changed, true);
    assert.equal(next.delivery, 0);
    assert.equal(next.tax, 35.82);
    assert.equal(next.grandTotal, 234.82);
    assert.equal(next.lines[0].touched, false);
  });

  it('reprices a line, drops its bulk savings, and works the tax out again', () => {
    const saved = { ...line, discountAmount: 20 };
    const next = applyAgreedPrice([saved], 99, { lines: [{ itemId: 7, unitPrice: 100 }] });
    assert.equal(taxFraction(18), 0.18);
    assert.equal(next.lines[0].lineTotal, 100);
    assert.equal(next.lines[0].taxAmount, 18);
    assert.equal(next.lines[0].discountAmount, 0);
    assert.equal(next.subtotal, 100);
    assert.equal(next.tax, 18);
    assert.equal(next.discount, 0);
    assert.equal(next.grandTotal, 217);
    assert.match(next.note, /₹199\.00 to ₹100\.00/);
  });

  it('refuses a line that is not on the order and a price that is already set', () => {
    assert.throws(() => applyAgreedPrice([line], 99, { lines: [{ itemId: 8, unitPrice: 1 }] }), /not on this order/);
    const same = applyAgreedPrice([line], 99, { delivery: 99, lines: [] });
    assert.equal(same.changed, false);
  });
});
