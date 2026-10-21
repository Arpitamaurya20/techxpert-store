export type IdentifierType = 'email' | 'mobile';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
const LOOKS_LIKE_PHONE_PATTERN = /^[+\d\s()-]+$/;

/** Anything made only of digits, spaces, "+", "-" or brackets is treated as a mobile number. */
export function detectIdentifierType(value: string): IdentifierType {
  return LOOKS_LIKE_PHONE_PATTERN.test(value.trim()) ? 'mobile' : 'email';
}

/**
 * Converts common Indian formats to a plain 10-digit number:
 * "+91 98765 43210", "919876543210" and "09876543210" all become "9876543210".
 */
export function normalizeIndianMobile(value: string): string {
  let digits = value.replace(/[\s()-]/g, '');

  if (digits.startsWith('+91')) {
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidIndianMobile(value: string): boolean {
  return INDIAN_MOBILE_PATTERN.test(normalizeIndianMobile(value));
}

export function validateIdentifier(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Enter your mobile number or email address.';
  }

  if (detectIdentifierType(trimmed) === 'mobile') {
    return isValidIndianMobile(trimmed)
      ? undefined
      : 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
  }

  return isValidEmail(trimmed) ? undefined : 'Enter a valid email address, for example name@example.com.';
}

/** Password rules (length, complexity) are enforced at registration, so sign-in only checks it is present. */
export function validatePassword(value: string): string | undefined {
  return value.length === 0 ? 'Enter your password.' : undefined;
}

const INDIAN_PINCODE_PATTERN = /^[1-9]\d{5}$/;

export function validatePincode(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter your 6-digit pincode.';
  return INDIAN_PINCODE_PATTERN.test(trimmed) ? undefined : 'Enter a valid 6-digit Indian pincode.';
}

export function validateCity(value: string): string | undefined {
  return value.trim().length >= 2 ? undefined : 'Enter your city or area.';
}

export function validateFullName(value: string): string | undefined {
  return value.trim().length >= 2 ? undefined : 'Enter your full name.';
}

export function validateMobile(value: string): string | undefined {
  if (!value.trim()) return 'Enter your 10-digit mobile number.';
  return isValidIndianMobile(value) ? undefined : 'Enter a valid 10-digit Indian mobile number.';
}

export function validateAddressLine(value: string): string | undefined {
  return value.trim().length >= 5 ? undefined : 'Enter your house, building and street.';
}

export type LoginFormValues = {
  identifier: string;
  password: string;
};

export type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>;

export type LoginFormResult =
  | { isValid: false; errors: LoginFormErrors }
  | {
      isValid: true;
      errors: LoginFormErrors;
      identifier: string;
      identifierType: IdentifierType;
    };

export function validateLoginForm(values: LoginFormValues): LoginFormResult {
  const errors: LoginFormErrors = {
    identifier: validateIdentifier(values.identifier),
    password: validatePassword(values.password),
  };

  if (errors.identifier || errors.password) {
    return { isValid: false, errors };
  }

  const trimmed = values.identifier.trim();
  const identifierType = detectIdentifierType(trimmed);

  return {
    isValid: true,
    errors,
    identifierType,
    identifier: identifierType === 'mobile' ? normalizeIndianMobile(trimmed) : trimmed,
  };
}
