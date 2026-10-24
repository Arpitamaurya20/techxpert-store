import { storePool } from '../db/mysql.js';
import { AuditService } from './auditService.js';
import {
  SHOP_SETTING_KEYS,
  defaultShopSettings,
  moneyRulesFrom,
  publicShopRules,
  shopSettingsFromRows,
  validateShopSettings,
  type ShopMoneyRules,
  type ShopSettings,
} from '../utils/shopSettings.js';

const KEY_COLUMN: Record<(typeof SHOP_SETTING_KEYS)[number], string> = {
  largeOrderValue: 'largeOrderValue',
  largeOrderQuantity: 'largeOrderQuantity',
  codLimit: 'codLimit',
  freeDeliveryFrom: 'freeDeliveryFrom',
  deliveryFee: 'deliveryFee',
  gstPercent: 'gstPercent',
};

export class ShopSettingsService {
  /** Built-in rules when the table is missing, so a cart still prices. */
  static async read(): Promise<ShopSettings> {
    try {
      const [rows] = await storePool.query<any[]>(
        `SELECT SettingKey as \`key\`, SettingValue as value, Enabled as enabled FROM shop_settings`
      );
      return shopSettingsFromRows(rows);
    } catch (err) {
      console.warn('[ShopSettings] using built-in rules', err);
      return defaultShopSettings();
    }
  }

  static async moneyRules(): Promise<ShopMoneyRules> {
    return moneyRulesFrom(await ShopSettingsService.read());
  }

  static async publicRules() {
    return publicShopRules(await ShopSettingsService.read());
  }

  static async save(body: unknown, actorName: string): Promise<ShopSettings> {
    const next = validateShopSettings(body);
    const conn = await storePool.getConnection();
    try {
      await conn.beginTransaction();
      for (const key of SHOP_SETTING_KEYS) {
        const rule = next[key];
        await conn.query(
          `INSERT INTO shop_settings (SettingKey, SettingValue, Enabled)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue), Enabled = VALUES(Enabled)`,
          [KEY_COLUMN[key], rule.amount == null ? null : String(rule.amount), rule.enabled ? 1 : 0]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      throw Object.assign(new Error('Shop settings are not ready. Run the shop settings SQL, then save again.'), {
        statusCode: 503,
      });
    } finally {
      conn.release();
    }

    await AuditService.create({
      action: 'Saved shop settings',
      entity: 'setting',
      details: describe(next),
      user: actorName,
    }).catch((err) => console.warn('[ShopSettings] audit write failed', err));

    return next;
  }
}

function describe(settings: ShopSettings): string {
  const part = (label: string, rule: ShopSettings[keyof ShopSettings], suffix = '') =>
    rule.enabled && rule.amount != null ? `${label} ${rule.amount}${suffix}` : `${label} off`;
  return [
    part('Large-order value', settings.largeOrderValue),
    part('Large-order quantity', settings.largeOrderQuantity),
    part('Cash on delivery limit', settings.codLimit),
    part('Free delivery from', settings.freeDeliveryFrom),
    part('Delivery fee', settings.deliveryFee),
    part('GST', settings.gstPercent, '%'),
  ].join('. ');
}
