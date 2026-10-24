/** A rule staff can switch off. The amount is remembered so switching it back on keeps the number. */
export type ShopRule = { enabled: boolean; amount: number | null };

export type ShopSettings = {
  largeOrderValue: ShopRule;
  largeOrderQuantity: ShopRule;
  codLimit: ShopRule;
  freeDeliveryFrom: ShopRule;
  deliveryFee: ShopRule;
  gstPercent: ShopRule;
};

/** What the cart charges. A null free-delivery line means the fee applies to every order that has one. */
export type ShopMoneyRules = {
  taxRate: number;
  freeDeliveryFrom: number | null;
  deliveryCharge: number;
};

export const SHOP_SETTING_KEYS = [
  'largeOrderValue',
  'largeOrderQuantity',
  'codLimit',
  'freeDeliveryFrom',
  'deliveryFee',
  'gstPercent',
] as const;

export type ShopSettingKey = (typeof SHOP_SETTING_KEYS)[number];

const LIMITS: Record<ShopSettingKey, { max: number; whole: boolean; label: string }> = {
  largeOrderValue: { max: 10_000_000, whole: false, label: 'Large-order value' },
  largeOrderQuantity: { max: 99_999, whole: true, label: 'Large-order quantity' },
  codLimit: { max: 10_000_000, whole: false, label: 'Cash on delivery limit' },
  freeDeliveryFrom: { max: 10_000_000, whole: false, label: 'Free delivery from' },
  deliveryFee: { max: 100_000, whole: false, label: 'Delivery fee' },
  gstPercent: { max: 100, whole: false, label: 'GST' },
};

export function defaultShopSettings(): ShopSettings {
  return {
    largeOrderValue: { enabled: false, amount: null },
    largeOrderQuantity: { enabled: false, amount: null },
    codLimit: { enabled: false, amount: null },
    freeDeliveryFrom: { enabled: true, amount: 2000 },
    deliveryFee: { enabled: true, amount: 99 },
    gstPercent: { enabled: true, amount: 18 },
  };
}

export function moneyRulesFrom(settings: ShopSettings): ShopMoneyRules {
  const gst = settings.gstPercent.enabled ? Number(settings.gstPercent.amount) || 0 : 0;
  const fee = settings.deliveryFee.enabled ? Number(settings.deliveryFee.amount) || 0 : 0;
  const free = settings.freeDeliveryFrom.enabled ? Number(settings.freeDeliveryFrom.amount) : null;
  return {
    taxRate: Math.round(gst * 100) / 10000,
    deliveryCharge: roundMoney(fee),
    freeDeliveryFrom: free == null ? null : roundMoney(free),
  };
}

/** The numbers a customer can be told. A switched-off rule is null. */
export function publicShopRules(settings: ShopSettings) {
  const money = moneyRulesFrom(settings);
  return {
    deliveryFee: settings.deliveryFee.enabled ? money.deliveryCharge : null,
    freeDeliveryFrom: money.freeDeliveryFrom,
    gstPercent: settings.gstPercent.enabled ? Number(settings.gstPercent.amount) || 0 : null,
    largeOrderValue: shown(settings.largeOrderValue),
    largeOrderQuantity: shown(settings.largeOrderQuantity),
    codLimit: shown(settings.codLimit),
  };
}

/**
 * Every key must be present, so an empty body cannot switch the shop rules off.
 * A switched-on rule needs its amount. A switched-off rule may keep a remembered amount.
 */
export function validateShopSettings(body: unknown): ShopSettings {
  if (!body || typeof body !== 'object') throw ruleError('Save every shop rule.');
  const source = body as Record<string, unknown>;
  const next = defaultShopSettings();
  for (const key of SHOP_SETTING_KEYS) {
    if (source[key] === undefined) throw ruleError('Save every shop rule. Leave one out and nothing is changed.');
    next[key] = readRule(key, source[key]);
  }
  return next;
}

export function shopSettingsFromRows(
  rows: { key: string; value: unknown; enabled: unknown }[]
): ShopSettings {
  const next = defaultShopSettings();
  for (const row of rows) {
    if (!(SHOP_SETTING_KEYS as readonly string[]).includes(row.key)) continue;
    const key = row.key as ShopSettingKey;
    const enabled = Number(row.enabled) === 1;
    const amount = row.value == null || row.value === '' ? null : Number(row.value);
    next[key] = {
      enabled,
      amount: amount != null && Number.isFinite(amount) ? amount : null,
    };
  }
  return next;
}

function shown(rule: ShopRule): number | null {
  return rule.enabled ? rule.amount : null;
}

function readRule(key: ShopSettingKey, raw: unknown): ShopRule {
  const spec = LIMITS[key];
  if (!raw || typeof raw !== 'object') throw ruleError(`${spec.label} needs a number, or switch it off.`);
  const body = raw as Record<string, unknown>;
  if (typeof body.enabled !== 'boolean') throw ruleError(`${spec.label} must be switched on or off.`);
  if (body.amount == null || body.amount === '') {
    if (body.enabled) throw ruleError(`${spec.label} needs a number while it is switched on.`);
    return { enabled: false, amount: null };
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > spec.max) {
    throw ruleError(`${spec.label} is a number from 0 to ${spec.max.toLocaleString('en-IN')}.`);
  }
  if (spec.whole && !Number.isInteger(amount)) throw ruleError(`${spec.label} is a whole number.`);
  const rounded = spec.whole ? amount : roundMoney(amount);
  if (body.enabled && rounded <= 0 && key !== 'deliveryFee' && key !== 'gstPercent' && key !== 'freeDeliveryFrom') {
    throw ruleError(`${spec.label} is at least 1 while it is switched on.`);
  }
  return { enabled: body.enabled, amount: rounded };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function ruleError(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400 });
}
