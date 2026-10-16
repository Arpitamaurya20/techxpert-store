export type LanguageOption = {
  code: string;
  label: string;
  nativeLabel?: string;
  /** False until the app's text has been translated into this language. */
  available: boolean;
};

/** The app's text exists only in English; other languages are listed once translations are added. */
export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', available: true },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', available: false },
];

export const CURRENT_LANGUAGE = LANGUAGES[0];
