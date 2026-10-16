import { PRIVACY_POLICY } from '@/data/legal/privacyPolicy';
import { TERMS_AND_CONDITIONS } from '@/data/legal/termsAndConditions';

export type PolicyId = 'privacy' | 'terms' | 'cancellation' | 'shipping';

/** A paragraph, or a list of bullet points. */
export type PolicyBlock = string | string[];

export type PolicyContent = {
  lastUpdated: string;
  /** The page the text was copied from, opened by "View on website". */
  sourceUrl: string;
  intro: string[];
  sections: { heading: string; blocks: PolicyBlock[] }[];
};

export type Policy = {
  id: PolicyId;
  title: string;
  /**
   * The official policy text, exactly as published by Techxpert India.
   * Leave as `null` until it is published; the app then tells customers to
   * contact support instead of showing made-up terms.
   */
  content: PolicyContent | null;
};

export const POLICIES: Policy[] = [
  { id: 'privacy', title: 'Privacy policy', content: PRIVACY_POLICY },
  { id: 'terms', title: 'Terms & Conditions', content: TERMS_AND_CONDITIONS },
  { id: 'cancellation', title: 'Cancellation & Refunds', content: null },
  { id: 'shipping', title: 'Shipping & Delivery', content: null },
];

export function getPolicy(id: string | undefined): Policy | undefined {
  return POLICIES.find((policy) => policy.id === id);
}
