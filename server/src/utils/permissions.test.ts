import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  can,
  emptyPermissions,
  fullPermissions,
  grantsBeyond,
  hasAnyAccess,
  normalizePermissions,
  permissionsFromRows,
} from './permissions.js';

describe('normalizePermissions', () => {
  it('turns view on when edit or delete is granted', () => {
    const p = normalizePermissions({ products: { edit: true }, banners: { delete: true } });
    assert.deepEqual(p.products, { view: true, edit: true, delete: false });
    assert.deepEqual(p.banners, { view: true, edit: false, delete: true });
  });

  it('drops levels a module does not offer and unknown modules', () => {
    const p = normalizePermissions({
      orders: { view: true, edit: true, delete: true },
      customers: { edit: true },
      payroll: { view: true },
    });
    assert.deepEqual(p.orders, { view: true, edit: true, delete: false });
    assert.deepEqual(p.customers, { view: false, edit: false, delete: false });
    assert.equal('payroll' in p, false);
  });

  it('only accepts literal true', () => {
    const p = normalizePermissions({ products: { view: 'true', edit: 1 } });
    assert.deepEqual(p.products, { view: false, edit: false, delete: false });
  });

  it('returns no access for junk input', () => {
    assert.equal(hasAnyAccess(normalizePermissions(null)), false);
    assert.equal(hasAnyAccess(normalizePermissions('all')), false);
  });
});

describe('permissionsFromRows', () => {
  it('reads tinyint columns', () => {
    const p = permissionsFromRows([{ module: 'pricing', canView: 1, canEdit: 1, canDelete: 0 }]);
    assert.equal(can(p, 'pricing', 'edit'), true);
    assert.equal(can(p, 'pricing', 'delete'), false);
    assert.equal(can(p, 'products', 'view'), false);
  });
});

describe('fullPermissions', () => {
  it('grants every level each module offers and nothing else', () => {
    const p = fullPermissions();
    assert.equal(can(p, 'access', 'delete'), true);
    assert.equal(can(p, 'orders', 'delete'), false);
    assert.equal(can(p, 'audit', 'edit'), false);
  });
});

describe('grantsBeyond', () => {
  it('is empty when the request is within the holder', () => {
    const holder = normalizePermissions({ products: { edit: true }, orders: { view: true } });
    const requested = normalizePermissions({ products: { view: true } });
    assert.deepEqual(grantsBeyond(requested, holder), []);
  });

  it('names each grant the holder lacks', () => {
    const holder = normalizePermissions({ products: { edit: true } });
    const requested = normalizePermissions({ products: { delete: true }, orders: { edit: true } });
    assert.deepEqual(grantsBeyond(requested, holder), [
      'Products: Delete',
      'Orders: View',
      'Orders: Edit',
    ]);
  });

  it('lets full access cover anything', () => {
    assert.deepEqual(grantsBeyond(fullPermissions(), fullPermissions()), []);
    assert.deepEqual(grantsBeyond(emptyPermissions(), emptyPermissions()), []);
  });
});
