import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapStoreOrderToActivityItem,
  parseServiceOrdersCursor,
  rupeesToPaise,
} from './activityItem.js';

describe('rupeesToPaise', () => {
  it('rounds rupees to the nearest paise integer', () => {
    assert.equal(rupeesToPaise(2450), 245000);
    assert.equal(rupeesToPaise(799.005), 79901);
    assert.equal(rupeesToPaise(10.004), 1000);
  });
});

describe('parseServiceOrdersCursor', () => {
  it('parses before timestamp|store_order:id', () => {
    const c = parseServiceOrdersCursor('2026-11-02T14:30:00.000Z|store_order:456');
    assert.equal(c?.iso, '2026-11-02T14:30:00.000Z');
    assert.equal(c?.orderId, 456);
  });

  it('returns null for empty or junk', () => {
    assert.equal(parseServiceOrdersCursor(undefined), null);
    assert.equal(parseServiceOrdersCursor('nope'), null);
  });
});

describe('mapStoreOrderToActivityItem', () => {
  it('maps a COD store order to ActivityItem v1', () => {
    const item = mapStoreOrderToActivityItem({
      id: 456,
      orderNumber: 'TX-ORD-456',
      status: 'processing',
      paymentMethod: 'COD',
      total: 2450,
      placedAt: '2026-11-02T14:30:00.000Z',
      channel: 'homecare_app',
    });
    assert.equal(item.schemaVersion, 1);
    assert.equal(item.id, 'store_order:456');
    assert.equal(item.domain, 'store');
    assert.equal(item.kind, 'store_order');
    assert.equal(item.amountPaise, 245000);
    assert.equal(item.amountKind, 'cod_due');
    assert.equal(item.channel, 'homecare_app');
    assert.equal(item.nativeRef, 'TX-ORD-456');
    assert.equal(item.groupRef, null);
  });
});
