import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { orderSource, readStaffOrder } from './staffOrder.js';

describe('orderSource', () => {
  it('keeps the three tags and treats anything else as the app', () => {
    assert.equal(orderSource('app'), 'app');
    assert.equal(orderSource('staff'), 'staff');
    assert.equal(orderSource('request'), 'request');
    assert.equal(orderSource(null), 'app');
    assert.equal(orderSource('phone'), 'app');
  });
});

describe('readStaffOrder', () => {
  const body = {
    name: 'Ravi',
    phone: '9999999999',
    pincode: '201301',
    address: 'B-204 Lotus Towers',
    lines: [{ productId: 3, quantity: 1 }],
  };

  it('reads an address and an optional request', () => {
    const order = readStaffOrder({ ...body, requestId: 4 });
    assert.equal(order.address, 'B-204 Lotus Towers');
    assert.equal(order.requestId, 4);
    assert.equal(order.lines[0].productId, 3);
  });

  it('refuses a missing address', () => {
    assert.throws(() => readStaffOrder({ ...body, address: '  ' }), /delivery address/);
  });
});
