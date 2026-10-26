import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { problemAlert } from './staffAlert.js';
import { readProblemClose, readProblemNote } from './orderProblem.js';

describe('readProblemNote', () => {
  it('keeps a short note and refuses a blank or a long one', () => {
    assert.equal(readProblemNote({ note: '  The fan did not arrive.  ' }), 'The fan did not arrive.');
    assert.throws(() => readProblemNote({}), /what went wrong/);
    assert.throws(() => readProblemNote({ note: '   ' }), /what went wrong/);
    assert.throws(() => readProblemNote({ note: 'x'.repeat(401) }), /400 characters/);
  });
});

describe('readProblemClose', () => {
  it('accepts closed and refuses anything else', () => {
    assert.doesNotThrow(() => readProblemClose({ status: 'closed' }));
    assert.throws(() => readProblemClose({ status: 'new' }), /closed/);
    assert.throws(() => readProblemClose({}), /closed/);
  });
});

describe('problemAlert', () => {
  it('names the order and drops a phone number from the note', () => {
    const alert = problemAlert({ orderNumber: 'TX-ORD-9', note: 'Call 9810098100 about the fan' });
    assert.equal(alert.headline, 'TX-ORD-9');
    assert.match(alert.detail, /^Problem reported\./);
    assert.doesNotMatch(`${alert.headline} ${alert.detail}`, /\d{10}/);
  });
});
