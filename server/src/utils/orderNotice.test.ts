import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  confirmationAttempt,
  confirmationText,
  noticePhone,
  noticeTransport,
  orderAccepted,
  prpAccepted,
  prpOrderBody,
  readOrderNotice,
  safeDetail,
} from './orderNotice.js';

describe('order confirmation copy', () => {
  it('names the order and the total, and no phone number', () => {
    const text = confirmationText('TX-ORD-100001-123', 333.82);
    assert.equal(text, 'Techxpert order TX-ORD-100001-123 is confirmed. Total ₹333.82.');
    assert.equal(text.includes('99999'), false);
  });

  it('keeps a 10-digit mobile and drops anything shorter', () => {
    assert.equal(noticePhone('9876543210'), '9876543210');
    assert.equal(noticePhone('+91 98765 43210'), '9876543210');
    assert.equal(noticePhone('12345'), null);
    assert.equal(noticePhone(''), null);
  });

  it('strips a phone number out of a provider error', () => {
    const detail = safeDetail('Failed for 9876543210');
    assert.equal(detail.includes('9876543210'), false);
    assert.equal(detail.includes('…'), true);
  });
});

describe('when a confirmation is sent', () => {
  it('waits while the order is pending, and sends once it is confirmed', () => {
    assert.equal(orderAccepted('pending'), false);
    assert.equal(orderAccepted('cancelled'), false);
    assert.equal(orderAccepted('confirmed'), true);
    assert.equal(
      confirmationAttempt({ channel: 'sms', status: 'pending', existing: null, manual: false }),
      'skip'
    );
    assert.equal(
      confirmationAttempt({ channel: 'sms', status: 'confirmed', existing: null, manual: false }),
      'send'
    );
  });

  it('does not send again after one was sent, and does not retry a failure on its own', () => {
    assert.equal(
      confirmationAttempt({ channel: 'sms', status: 'processing', existing: 'sent', manual: false }),
      'skip'
    );
    assert.equal(
      confirmationAttempt({ channel: 'sms', status: 'confirmed', existing: 'failed', manual: false }),
      'skip'
    );
    assert.equal(
      confirmationAttempt({ channel: 'sms', status: 'confirmed', existing: 'failed', manual: true }),
      'send'
    );
  });

  it('stays quiet while confirmation is switched off', () => {
    assert.equal(
      confirmationAttempt({ channel: 'off', status: 'confirmed', existing: null, manual: false }),
      'skip'
    );
    assert.equal(
      confirmationAttempt({ channel: 'off', status: 'confirmed', existing: null, manual: true }),
      'off'
    );
  });

  it('accepts only the three choices', () => {
    assert.equal(readOrderNotice('off'), 'off');
    assert.equal(readOrderNotice('whatsapp'), 'whatsapp');
    assert.throws(() => readOrderNotice('email'), /text message, or WhatsApp/);
  });
});

describe('noticeTransport', () => {
  it('does not use the sign-in template when the order template is missing', () => {
    const transport = noticeTransport('sms', {
      SMS_PROVIDER: 'prp',
      PRP_SMS_API_KEY: 'key',
      PRP_SMS_TEMPLATE_NAME: 'TECHXPERT OTP',
    });
    assert.equal(transport.kind, 'missing');
  });

  it('uses the PRP order template when it is set', () => {
    const transport = noticeTransport('sms', {
      ORDER_SMS_PROVIDER: 'prp',
      PRP_SMS_API_KEY: 'key',
      PRP_ORDER_TEMPLATE_NAME: 'TECHXPERT ORDER',
      PRP_SMS_SENDER: 'TECHX',
    });
    assert.equal(transport.kind, 'prp');
    if (transport.kind !== 'prp') return;
    const body = prpOrderBody(transport, '9876543210', 'TX-ORD-1', '333.82');
    assert.equal(body.templateName, 'TECHXPERT ORDER');
    assert.equal(body.smsReciever[0].templateParams, 'TX-ORD-1|333.82');
    assert.equal(prpAccepted(true, { isSuccess: true }), true);
    assert.equal(prpAccepted(true, { isSuccess: false }), false);
  });

  it('does not reuse the WhatsApp sign-in template', () => {
    const transport = noticeTransport('whatsapp', {
      SMS_PROVIDER: 'chatmybot',
      CHATMYBOT_ACCESS_TOKEN: 'token',
      CHATMYBOT_TEMPLATE_ID: 'otp-template',
    });
    assert.equal(transport.kind, 'missing');
  });
});
