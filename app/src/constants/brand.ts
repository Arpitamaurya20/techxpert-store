import type { ImageSourcePropType } from 'react-native';

export const BRAND = {
  name: 'TECHXPERT',
  region: 'INDIA',
  fullName: 'Techxpert India',
  tagline: 'Construction materials & hardware',
} as const;

/** Published store contacts, shared by Help and About. */
export const SUPPORT = {
  phone: '18001201343',
  phoneLabel: '1800-120-1343',
  email: 'info@techxpertindia.in',
  hours: '24×7 · All days',
} as const;

/** Company details as published on https://techxpertindia.com. */
export const COMPANY = {
  legalName: 'Techxpert Facilities India Private Limited',
  certification: 'An ISO 9001, 14001 and ISO 45001 Certified Company',
  slogan: 'भरोसे का दूसरा नाम TECHXPERT',
  address: 'A-812, 8th Floor, Tower A, Logix Cyber Park, Sector-62, Noida, Uttar Pradesh 201309, India',
  website: 'https://techxpertindia.com',
  websiteLabel: 'techxpertindia.com',
} as const;

/**
 * The official Techxpert logo (animated, transparent background, 800×213).
 * Its blue, red and black artwork only reads on light backgrounds. Set to
 * `null` to fall back to the text wordmark.
 */
export const BRAND_LOGO: ImageSourcePropType | null = require('../../assets/images/techxpert-logo.gif');

/** Width ÷ height of `BRAND_LOGO`, so it is never stretched. */
export const BRAND_LOGO_ASPECT_RATIO = 800 / 213;
