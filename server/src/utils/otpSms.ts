import { prpAccepted, safeDetail } from './orderNotice.js';

export type OtpTransport =
  | { kind: 'missing'; detail: string }
  | { kind: 'console' }
  | { kind: 'prp'; apiKey: string; sender: string; templateName: string };

const NOT_CONFIGURED = 'The sign-in code could not be sent. Ask for a new one.';

/**
 * The sign-in text. This is Homecare's OTP template, never the order-confirmation template.
 * A missing provider does not pretend the text was sent.
 */
export function otpTransport(env: NodeJS.ProcessEnv): OtpTransport {
  const provider = (env.OTP_SMS_PROVIDER || env.SMS_PROVIDER || '').trim().toLowerCase();
  if (provider === 'console') {
    if (env.NODE_ENV === 'production') return { kind: 'missing', detail: NOT_CONFIGURED };
    return { kind: 'console' };
  }
  if (provider !== 'prp' && provider !== 'bulksms') return { kind: 'missing', detail: NOT_CONFIGURED };
  const apiKey = (env.PRP_SMS_API_KEY || '').trim();
  const templateName = (env.PRP_SMS_TEMPLATE_NAME || 'TECHXPERT OTP').trim();
  if (!apiKey || !templateName) return { kind: 'missing', detail: NOT_CONFIGURED };
  return {
    kind: 'prp',
    apiKey,
    sender: (env.PRP_SMS_SENDER || 'TECHX').trim() || 'TECHX',
    templateName,
  };
}

export function prpOtpBody(transport: Extract<OtpTransport, { kind: 'prp' }>, phone: string, otp: string) {
  return {
    sender: transport.sender,
    templateName: transport.templateName,
    smsReciever: [{ mobileNo: phone, templateParams: otp }],
  };
}

/** Sends the sign-in code. The code itself is never written to the result. */
export async function sendSignInCode(
  phone: string,
  otp: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch
): Promise<{ sent: true } | { sent: false; detail: string }> {
  const transport = otpTransport(env);
  if (transport.kind === 'missing') return { sent: false, detail: transport.detail };
  if (transport.kind === 'console') return { sent: true };

  try {
    const res = await fetchImpl('https://api.bulksmsadmin.com/BulkSMSapi/keyApiSendSMS/SendSmsTemplateName', {
      method: 'POST',
      headers: { apikey: transport.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(prpOtpBody(transport, phone, otp)),
    });
    const data = await res.json().catch(() => ({}));
    if (prpAccepted(res.ok, data)) return { sent: true };
    return { sent: false, detail: NOT_CONFIGURED };
  } catch (err) {
    return { sent: false, detail: safeDetail((err as Error)?.message) || NOT_CONFIGURED };
  }
}
