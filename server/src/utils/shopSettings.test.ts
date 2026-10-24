import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkoutPlacement,
  defaultShopSettings,
  moneyRulesFrom,
  publicShopRules,
  shopSettingsFromRows,
  validateShopSettings,
} from './shopSettings.js';

const saved = () => ({
  largeOrderValue: { enabled: false, amount: null },
  largeOrderQuantity: { enabled: false, amount: null },
  codLimit: { enabled: false, amount: null },
  freeDeliveryFrom: { enabled: true, amount: 2000 },
  deliveryFee: { enabled: true, amount: 99 },
  gstPercent: { enabled: true, amount: 18 },
});

describe('validateShopSettings', () => {
  it('keeps the built-in shop when every rule is sent as the default', () => {
    assert.deepEqual(validateShopSettings(saved()), defaultShopSettings());
  });

  it('refuses a body that leaves a rule out', () => {
    const body = saved() as Record<string, unknown>;
    delete body.deliveryFee;
    assert.throws(() => validateShopSettings(body), /Leave one out/);
  });

  it('remembers a number while the rule is switched off', () => {
    const body = saved();
    body.largeOrderValue = { enabled: false, amount: 50000 };
    assert.deepEqual(validateShopSettings(body).largeOrderValue, { enabled: false, amount: 50000 });
  });

  it('refuses a switched-on rule with no number', () => {
    const body = saved();
    body.codLimit = { enabled: true, amount: null };
    assert.throws(() => validateShopSettings(body), /Cash on delivery limit/);
  });
});

describe('moneyRulesFrom', () => {
  it('charges ₹99 below ₹2,000 and 18% GST', () => {
    assert.deepEqual(moneyRulesFrom(defaultShopSettings()), {
      taxRate: 0.18,
      freeDeliveryFrom: 2000,
      deliveryCharge: 99,
    });
  });

  it('charges the fee on every order when free delivery is switched off', () => {
    const settings = defaultShopSettings();
    settings.freeDeliveryFrom = { enabled: false, amount: 2000 };
    assert.equal(moneyRulesFrom(settings).freeDeliveryFrom, null);
    assert.equal(moneyRulesFrom(settings).deliveryCharge, 99);
  });

  it('drops the fee and the tax when those rules are switched off', () => {
    const settings = defaultShopSettings();
    settings.deliveryFee = { enabled: false, amount: 99 };
    settings.gstPercent = { enabled: false, amount: 18 };
    const rules = moneyRulesFrom(settings);
    assert.equal(rules.deliveryCharge, 0);
    assert.equal(rules.taxRate, 0);
  });
});

describe('publicShopRules', () => {
  it('hides a switched-off threshold', () => {
    const rules = publicShopRules(defaultShopSettings());
    assert.equal(rules.deliveryFee, 99);
    assert.equal(rules.freeDeliveryFrom, 2000);
    assert.equal(rules.gstPercent, 18);
    assert.equal(rules.largeOrderValue, null);
    assert.equal(rules.codLimit, null);
  });
});

describe('shopSettingsFromRows', () => {
  it('uses the built-in shop when the table has not been filled', () => {
    assert.deepEqual(shopSettingsFromRows([]), defaultShopSettings());
  });

  it('reads a stored fee', () => {
    const settings = shopSettingsFromRows([
      { key: 'deliveryFee', value: '120', enabled: 1 },
    ]);
    assert.deepEqual(settings.deliveryFee, { enabled: true, amount: 120 });
    assert.equal(settings.gstPercent.amount, 18);
  });
});

describe('checkoutPlacement', () => {
  const lines = [{ name: 'Cement', quantity: 10 }];

  it('confirms straight away while the thresholds are off', () => {
    const placed = checkoutPlacement({
      settings: defaultShopSettings(),
      grandTotal: 5000,
      lines,
      paymentMethod: 'COD',
    });
    assert.equal(placed.refusal, null);
    assert.equal(placed.status, 'confirmed');
    assert.equal(placed.reason, null);
  });

  it('holds a large order for staff once the value is on', () => {
    const settings = defaultShopSettings();
    settings.largeOrderValue = { enabled: true, amount: 5000 };
    const placed = checkoutPlacement({ settings, grandTotal: 5000, lines, paymentMethod: 'COD' });
    assert.equal(placed.refusal, null);
    assert.equal(placed.status, 'pending');
    assert.match(placed.reason!, /₹5,000/);
    assert.match(placed.reason!, /held/);
  });

  it('holds the order when one line reaches the quantity', () => {
    const settings = defaultShopSettings();
    settings.largeOrderQuantity = { enabled: true, amount: 10 };
    const placed = checkoutPlacement({ settings, grandTotal: 400, lines, paymentMethod: 'COD' });
    assert.equal(placed.status, 'pending');
    assert.match(placed.reason!, /Cement/);
  });

  it('leaves a smaller order confirmed', () => {
    const settings = defaultShopSettings();
    settings.largeOrderValue = { enabled: true, amount: 5000 };
    settings.largeOrderQuantity = { enabled: true, amount: 50 };
    const placed = checkoutPlacement({ settings, grandTotal: 4999.99, lines, paymentMethod: 'COD' });
    assert.equal(placed.status, 'confirmed');
  });

  it('refuses cash above the limit and writes nothing', () => {
    const settings = defaultShopSettings();
    settings.codLimit = { enabled: true, amount: 2000 };
    settings.largeOrderValue = { enabled: true, amount: 1000 };
    const placed = checkoutPlacement({ settings, grandTotal: 2000.01, lines, paymentMethod: 'COD' });
    assert.match(placed.refusal!, /stops at ₹2,000/);
    assert.equal(placed.reason, null);
  });

  it('allows cash exactly at the limit', () => {
    const settings = defaultShopSettings();
    settings.codLimit = { enabled: true, amount: 2000 };
    const placed = checkoutPlacement({ settings, grandTotal: 2000, lines, paymentMethod: 'COD' });
    assert.equal(placed.refusal, null);
    assert.equal(placed.status, 'confirmed');
  });
});
