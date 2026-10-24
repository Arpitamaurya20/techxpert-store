export const HELP_FAQ_MAX = 50;

export type HelpFaqInput = { question: string; answer: string };

export type HelpInput = {
  phone: string;
  phoneLabel: string;
  whatsapp: string;
  email: string;
  hours: string;
  faqs: HelpFaqInput[];
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** A dialable number, or blank. Spaces and dashes are removed. */
function phone(value: unknown, label: string): string {
  const raw = text(value).replace(/[\s-]/g, '');
  if (!raw) return '';
  if (!/^\+?[0-9]{10,15}$/.test(raw)) {
    throw Object.assign(new Error(`Enter the ${label} as digits, or leave it blank.`), { statusCode: 400 });
  }
  return raw;
}

/** The help page staff can save before any of it has been written. Blank fields stay blank. */
export function validateHelpBody(body: unknown): HelpInput {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const phoneLabel = text(source.phoneLabel);
  const email = text(source.email);
  const hours = text(source.hours);
  if (phoneLabel.length > 40) {
    throw Object.assign(new Error('The phone label must be 40 characters or less.'), { statusCode: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Enter an email address, or leave it blank.'), { statusCode: 400 });
  }
  if (email.length > 120) {
    throw Object.assign(new Error('The email address must be 120 characters or less.'), { statusCode: 400 });
  }
  if (hours.length > 80) {
    throw Object.assign(new Error('Working hours must be 80 characters or less.'), { statusCode: 400 });
  }
  if (source.faqs != null && !Array.isArray(source.faqs)) {
    throw Object.assign(new Error('Questions must be a list.'), { statusCode: 400 });
  }
  const rows = Array.isArray(source.faqs) ? source.faqs : [];
  if (rows.length > HELP_FAQ_MAX) {
    throw Object.assign(new Error(`You can publish up to ${HELP_FAQ_MAX} questions.`), { statusCode: 400 });
  }
  const faqs = rows.map((row) => {
    const item = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    const question = text(item.question);
    const answer = text(item.answer);
    if (!question || !answer) {
      throw Object.assign(new Error('Each question needs a question and an answer.'), { statusCode: 400 });
    }
    if (question.length > 300) {
      throw Object.assign(new Error('A question must be 300 characters or less.'), { statusCode: 400 });
    }
    if (answer.length > 2000) {
      throw Object.assign(new Error('An answer must be 2,000 characters or less.'), { statusCode: 400 });
    }
    return { question, answer };
  });

  return {
    phone: phone(source.phone, 'phone number'),
    phoneLabel,
    whatsapp: phone(source.whatsapp, 'WhatsApp number'),
    email,
    hours,
    faqs,
  };
}
