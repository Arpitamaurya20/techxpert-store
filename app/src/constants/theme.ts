import { Platform, type TextStyle } from 'react-native';

export const colors = {
  /** Navy: headers, headings and structure. */
  primary: '#0B2A5B',
  primaryLight: '#1F4FA3',
  /** Orange: buttons, links and other actions. Dark enough for white bold text. */
  accent: '#D9480F',
  accentPressed: '#B93C0B',
  accentSoft: '#FFF1E8',
  /** Green for positive states only (in stock, delivered, added). */
  success: '#1E7B45',
  successSoft: '#E8F5EC',
  background: '#FFFFFF',
  surface: '#F5F7FA',
  screen: '#F5F7FA',
  card: '#FFFFFF',
  /** Input and button outlines need more contrast than card edges. */
  border: '#D9E2EC',
  cardBorder: '#E5EAF0',
  text: '#172B4D',
  textMuted: '#667085',
  placeholder: '#8A9BAE',
  textOnDark: '#BCCCDC',
  white: '#FFFFFF',
  error: '#C62828',
  errorSoft: '#FDECEA',
  warning: '#8A5A00',
  warningSoft: '#FFF6E0',
  disabled: '#A7B6C5',
  /** Store headings and their secondary text. */
  homeInk: '#0B2A5B',
  homeInkMuted: '#5B6B82',
  /** Sampled from the Techxpert logo; the logo needs a light backdrop to read well. */
  logoBlue: '#0A84E0',
  logoRed: '#E8202A',
  logoBackdrop: '#EEF6FD',
  logoBackdropDeep: '#DCEBFA',
  /** Store design system: navy for structure, orange only for actions and promotions. */
  navy: '#0B2A5B',
  navyDeep: '#071C3D',
  navySoft: '#EEF3FB',
  /** Dark enough for white bold text and for orange text on white. */
  orange: '#D9480F',
  orangePressed: '#B93C0B',
  orangeSoft: '#FFF1E8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  pill: 999,
} as const;

/**
 * Poppins faces loaded in the root layout. Each weight is its own family, so
 * pick the face with `fontFamily` rather than `fontWeight`; Android does not
 * map `fontWeight` onto separately loaded font files.
 */
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 36, fontFamily: fonts.bold },
  title: { fontSize: 22, lineHeight: 30, fontFamily: fonts.bold },
  sectionTitle: { fontSize: 18, lineHeight: 26, fontFamily: fonts.bold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
  label: { fontSize: 14, lineHeight: 21, fontFamily: fonts.semiBold },
  caption: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular },
  small: { fontSize: 12, lineHeight: 18, fontFamily: fonts.medium },
  button: { fontSize: 16, lineHeight: 22, fontFamily: fonts.semiBold },
} as const;

export const cardShadow = Platform.select({
  web: { boxShadow: '0px 1px 3px rgba(16, 42, 67, 0.08)' },
  default: {
    shadowColor: '#102A43',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});

/**
 * Hides the browser's focus ring on text inputs; their wrappers show focus instead.
 * Safari draws the ring even at zero width unless the style is `none`, which
 * React Native's types don't list but react-native-web passes through.
 */
export const noInputOutline = Platform.select<TextStyle>({
  web: { outlineWidth: 0, outlineStyle: 'none' } as unknown as TextStyle,
  default: {},
});

/** Minimum touch target recommended by Android (48dp) and iOS (44pt). */
export const MIN_TOUCH_TARGET = 48;

/** Keeps forms readable on tablets and wide web browsers. */
export const MAX_CONTENT_WIDTH = 480;

/** Store pages stay centred instead of stretching across wide web screens. */
export const MAX_STORE_WIDTH = 1100;

export const SCREEN_PADDING = spacing.lg;
