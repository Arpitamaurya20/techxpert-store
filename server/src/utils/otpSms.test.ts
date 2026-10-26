import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { otpTransport, prpOtpBody, sendSignInCode } from './otpSms.js';

describe('otpTransport', () => {
  it('does not use the order template', () => {
    const transport = otpTransport({
      OTP_SMS_PROVIDER: 'prp',
      PRP_SMS_API_KEY: 'key',
      PRP_ORDER_TEMPLATE_NAME: 'order-template',
      PRP_SMS_TEMPLATE_NAME: 'TECHXPERT OTP',
    });
    assert.equal(transport.kind, 'prp');
    if (transport.kind === 'prp') assert.equal(transport.templateName, 'TECHXPERT OTP');
  });

  it('refuses a console sender in production', () => {
    assert.equal(otpTransport({ NODE_ENV: 'production', OTP_SMS_PROVIDER: 'console' }).kind, 'missing');
  });

  it('sends the code as the sign-in template value', () => {
    const body = prpOtpBody(
      { kind: 'prp', apiKey: 'key', sender: 'TECHX', templateName: 'TECHXPERT OTP' },
      '9876543210',
      '123456'
    );
    assert.equal(body.templateName, 'TECHXPERT OTP');
    assert.equal(body.smsReciever[0].templateParams, '123456');
  });
});

describe('sendSignInCode', () => {
  it('does not claim a text was sent when no provider is set', async () => {
    const result = await sendSignInCode('9876543210', '123456', {});
    assert.equal(result.sent, false);
  });

  it('accepts a PRP success without returning the code', async () => {
    const result = await sendSignInCode('9876543210', '654321', { OTP_SMS_PROVIDER: 'prp', PRP_SMS_API_KEY: 'key' }, async () =>
      new Response(JSON.stringify({ isSuccess: true }), { status: 200 })
    );
    assert.deepEqual(result, { sent: true });
  });
});
