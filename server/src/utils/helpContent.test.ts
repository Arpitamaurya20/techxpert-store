import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HELP_FAQ_MAX, validateHelpBody } from './helpContent.js';

describe('validateHelpBody', () => {
  it('accepts an empty page', () => {
    assert.deepEqual(validateHelpBody({}), {
      phone: '',
      phoneLabel: '',
      whatsapp: '',
      email: '',
      hours: '',
      faqs: [],
    });
  });

  it('keeps a filled page and strips spaces from numbers', () => {
    const help = validateHelpBody({
      phone: '1800 120 1343',
      phoneLabel: '1800-120-1343',
      whatsapp: '+91 98765 43210',
      email: 'info@techxpertindia.in',
      hours: '24×7',
      faqs: [{ question: ' How do I order? ', answer: ' From the cart. ' }],
    });
    assert.equal(help.phone, '18001201343');
    assert.equal(help.whatsapp, '+919876543210');
    assert.deepEqual(help.faqs, [{ question: 'How do I order?', answer: 'From the cart.' }]);
  });

  it('refuses a number, email or question that is not usable', () => {
    assert.throws(() => validateHelpBody({ phone: 'call-us' }), /digits/);
    assert.throws(() => validateHelpBody({ email: 'not-an-email' }), /email address/);
    assert.throws(() => validateHelpBody({ faqs: [{ question: 'Why?', answer: '  ' }] }), /question and an answer/);
  });

  it('refuses more questions than the page can hold', () => {
    const faqs = Array.from({ length: HELP_FAQ_MAX + 1 }, (_, i) => ({ question: `Q${i}`, answer: 'A' }));
    assert.throws(() => validateHelpBody({ faqs }), /50 questions/);
  });
});
