import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMysqlConnectivityError, mysqlOrFileStore } from './mysqlErrors.js';

describe('isMysqlConnectivityError', () => {
  it('treats connection failures as down', () => {
    assert.equal(isMysqlConnectivityError({ code: 'ECONNREFUSED' }), true);
    assert.equal(isMysqlConnectivityError({ code: 'ER_ACCESS_DENIED_ERROR' }), true);
  });

  it('treats bad SQL as not down', () => {
    assert.equal(isMysqlConnectivityError({ code: 'ER_TRUNCATED_WRONG_VALUE' }), false);
    assert.equal(isMysqlConnectivityError({ code: 'ER_NO_SUCH_TABLE' }), false);
    assert.equal(isMysqlConnectivityError({ code: 'ER_BAD_FIELD_ERROR' }), false);
  });
});

describe('mysqlOrFileStore', () => {
  it('surfaces missing-table errors instead of a generic unavailable message', async () => {
    await assert.rejects(
      () =>
        mysqlOrFileStore('cms.createBanner', { code: 'ER_NO_SUCH_TABLE', sqlMessage: "Table 'x' doesn't exist" }, () => null),
      /Missing table for cms.createBanner/
    );
  });

  it('surfaces value errors with the SQL message', async () => {
    await assert.rejects(
      () =>
        mysqlOrFileStore(
          'cms.createBanner',
          { code: 'ER_TRUNCATED_WRONG_VALUE', sqlMessage: "Incorrect datetime value: '2026-11-10T10:00:00.000Z'" },
          () => null
        ),
      /Incorrect datetime value/
    );
  });
});
