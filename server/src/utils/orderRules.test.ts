import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orderAgainItem, orderAgainLimit, restocksOnCancel, statusChangeRefusal, type OrderAgainSource } from './orderRules.js';

describe('statusChangeRefusal', () => {
  it('allows moving an open order along or cancelling it', () => {
    for (const from of ['pending', 'confirmed', 'processing', 'shipped']) {
      assert.equal(statusChangeRefusal(from, 'cancelled'), null);
      assert.equal(statusChangeRefusal(from, 'delivered'), null);
    }
  });

  it('refuses cancelling a delivered order', () => {
    assert.match(statusChangeRefusal('delivered', 'cancelled') ?? '', /delivered order can't be cancelled/);
  });

  it('still lets a delivered order be corrected to another open status', () => {
    assert.equal(statusChangeRefusal('delivered', 'shipped'), null);
  });

  it('treats cancelled as final, including cancelling again', () => {
    for (const to of ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']) {
      assert.match(statusChangeRefusal('cancelled', to) ?? '', /already cancelled/);
    }
  });
});

function bought(over: Partial<OrderAgainSource> = {}): OrderAgainSource {
  return {
    productId: 5,
    name: '9W LED Bulb',
    sku: 'LED9',
    imageUrl: null,
    categoryId: 3,
    unit: 'piece',
    active: true,
    price: 99,
    variantId: 8,
    stockQuantity: 40,
    minOrderQuantity: 1,
    lastQuantity: 4,
    lastOrderedAt: '2026-10-16T22:01:43Z',
    ...over,
  };
}

describe('orderAgainItem', () => {
  it('uses today\'s price and stock, not the old order', () => {
    const item = orderAgainItem(bought());
    assert.equal(item.available, true);
    assert.equal(item.unavailableReason, null);
    assert.equal(item.price, 99);
    assert.equal(item.stockQuantity, 40);
    assert.equal(item.stockStatus, 'in_stock');
    assert.equal(item.lastQuantity, 4);
  });

  it('keeps a product that is no longer sold and says why', () => {
    const item = orderAgainItem(bought({ active: false, price: 99, stockQuantity: 40 }));
    assert.equal(item.available, false);
    assert.equal(item.unavailableReason, 'This product is no longer sold.');
    assert.equal(item.name, '9W LED Bulb');
  });

  it('says when a live product has no price', () => {
    const item = orderAgainItem(bought({ price: null }));
    assert.equal(item.available, false);
    assert.equal(item.price, null);
    assert.match(item.unavailableReason ?? '', /isn't available to order/);
  });

  it('says when a priced product is out of stock', () => {
    const item = orderAgainItem(bought({ stockQuantity: 0 }));
    assert.equal(item.available, false);
    assert.equal(item.stockStatus, 'out_of_stock');
    assert.match(item.unavailableReason ?? '', /out of stock/);
  });

  it('ignores a zero or negative price', () => {
    assert.equal(orderAgainItem(bought({ price: 0 })).price, null);
    assert.equal(orderAgainItem(bought({ price: -5 })).available, false);
  });
});

describe('orderAgainLimit', () => {
  it('defaults to 10 and caps at 20', () => {
    assert.equal(orderAgainLimit(undefined), 10);
    assert.equal(orderAgainLimit('0'), 10);
    assert.equal(orderAgainLimit('4'), 4);
    assert.equal(orderAgainLimit('100'), 20);
    assert.equal(orderAgainLimit('1.5'), 10);
  });
});

describe('restocksOnCancel', () => {
  it('is true only for orders placed through this shop', () => {
    assert.equal(restocksOnCancel('TX-ORD-229934-371'), true);
    assert.equal(restocksOnCancel('ORD-20260118-0001'), false);
    assert.equal(restocksOnCancel(''), false);
    assert.equal(restocksOnCancel(null), false);
  });
});
