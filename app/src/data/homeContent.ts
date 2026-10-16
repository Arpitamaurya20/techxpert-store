import type { Href } from 'expo-router';
import type { ImageSourcePropType } from 'react-native';

export type HeroSlide = {
  id: string;
  image: ImageSourcePropType;
  /** "dark" photos get white text; "light" photos get navy text. */
  tone: 'dark' | 'light';
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  href: Href;
};

/** Campaign banners. Photos show unbranded materials only. */
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'project-essentials',
    image: require('../../assets/images/hero-project-site.jpg'),
    tone: 'dark',
    eyebrow: 'Complete solutions\nfor every project',
    title: 'Quality Materials.\nStronger Spaces.',
    subtitle: 'Explore top brands, bulk pricing\nand exclusive offers.',
    cta: 'Shop Now',
    href: '/products',
  },
  {
    id: 'bulk-orders',
    image: require('../../assets/images/hero-bulk-yard.jpg'),
    tone: 'dark',
    eyebrow: 'Bulk orders',
    title: 'Buying for a site\nor project?',
    subtitle: 'Contractors & builders, talk to our team',
    cta: 'Enquire Now',
    href: '/help',
  },
  {
    id: 'diwali',
    image: require('../../assets/images/diwali-banner.jpg'),
    tone: 'light',
    eyebrow: 'Festive season',
    title: 'Diwali Special\non Building Essentials',
    subtitle: 'Get your home ready for the festival',
    cta: 'Shop Now',
    href: '/categories',
  },
];

/** The single row of shortcuts under the header, in display order, followed by "More". */
export const CATEGORY_SHORTCUTS: { categoryId: string; label: string }[] = [
  { categoryId: 'cement-plaster', label: 'Cement' },
  { categoryId: 'tiling-grouts', label: 'Tiles' },
  { categoryId: 'paints-putty', label: 'Paints' },
  { categoryId: 'plywood-mdf', label: 'Plywood' },
  { categoryId: 'plumbing-supplies', label: 'Plumbing' },
  { categoryId: 'electricals-lighting', label: 'Electrical' },
  { categoryId: 'tools-accessories', label: 'Tools' },
];

export type ProjectDeal = {
  categoryId: string;
  title: string;
  /** Second headline line in the card's main colour, e.g. "Bulk Savings". */
  highlight?: string;
  /** SAMPLE offer text, shown only with the sample catalogue until the backend sends offers. */
  sampleOffer: string;
  /** Shown instead of the offer once the live catalogue is connected. */
  tagline: string;
  tone: 'peach' | 'navy';
  image: ImageSourcePropType;
};

/** Project deal cards on Home; only shown when the category exists in the catalogue. */
export const PROJECT_DEALS: ProjectDeal[] = [
  {
    categoryId: 'cement-plaster',
    title: 'Cement',
    highlight: 'Bulk Savings',
    sampleOffer: 'Up to 15% off',
    tagline: 'For strong foundations',
    tone: 'peach',
    image: require('../../assets/images/subcategories/opc-cement.jpg'),
  },
  {
    categoryId: 'paints-putty',
    title: 'Paints & Primers',
    sampleOffer: 'Up to 20% off',
    tagline: 'Fresh walls, inside & out',
    tone: 'navy',
    image: require('../../assets/images/subcategories/interior-emulsion.jpg'),
  },
];

/** SAMPLE "Order Again" items from the demo catalogue, shown only before the store is connected. */
export const SAMPLE_ORDER_AGAIN_IDS = [
  'demo-cement-opc53',
  'demo-interior-emulsion',
  'demo-floor-tile',
  'demo-bwp-plywood',
];
