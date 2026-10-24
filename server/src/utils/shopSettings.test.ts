import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
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
