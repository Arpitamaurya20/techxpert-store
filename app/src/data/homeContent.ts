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

/** The category grid under the header, in display order, followed by "More". */
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

export type ShopProject = {
  id: string;
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
  /** Categories needed for this job, in the order a customer usually buys them. */
  categoryIds: string[];
};

/** "Shop by Project" cards on Home; each opens a page listing the categories for that job. */
export const SHOP_PROJECTS: ShopProject[] = [
  {
    id: 'bathroom',
    title: 'Bathroom',
    subtitle: 'Fittings, tiles & waterproofing',
    image: require('../../assets/images/subcategories/showers.jpg'),
    categoryIds: ['bath-sanitary', 'plumbing-supplies', 'tiling-grouts', 'waterproofing', 'adhesives-sealants'],
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    subtitle: 'Boards, fittings & taps',
    image: require('../../assets/images/subcategories/cabinet-hinges.jpg'),
    categoryIds: ['plywood-mdf', 'furniture-fittings', 'plumbing-supplies', 'tiling-grouts', 'electricals-lighting'],
  },
  {
    id: 'painting',
    title: 'Painting',
    subtitle: 'Putty, primer & paints',
    image: require('../../assets/images/subcategories/interior-emulsion.jpg'),
    categoryIds: ['paints-putty', 'waterproofing', 'tools-accessories'],
  },
  {
    id: 'construction',
    title: 'New Construction',
    subtitle: 'Cement, plumbing & electricals',
    image: require('../../assets/images/subcategories/opc-cement.jpg'),
    categoryIds: [
      'cement-plaster',
      'waterproofing',
      'plumbing-supplies',
      'electricals-lighting',
      'tools-accessories',
      'safety-equipment',
    ],
  },
  {
    id: 'flooring',
    title: 'Flooring',
    subtitle: 'Tiles, adhesive & grout',
    image: require('../../assets/images/subcategories/floor-tiles.jpg'),
    categoryIds: ['tiling-grouts', 'adhesives-sealants', 'tools-accessories'],
  },
  {
    id: 'electrical',
    title: 'Electrical Work',
    subtitle: 'Wires, switches & lights',
    image: require('../../assets/images/subcategories/switches.jpg'),
    categoryIds: ['electricals-lighting', 'tools-accessories', 'safety-equipment'],
  },
];

export function getShopProject(id: string | undefined): ShopProject | undefined {
  return SHOP_PROJECTS.find((project) => project.id === id);
}

/** Search ideas shown as chips on Home; these are suggestions, not live popularity data. */
export const SEARCH_SUGGESTIONS = ['Cement', 'Wall putty', 'PVC pipes', 'Floor tiles', 'LED bulbs', 'Plywood'];

/** SAMPLE "Order Again" items from the demo catalogue, shown only before the store is connected. */
export const SAMPLE_ORDER_AGAIN_IDS = [
  'demo-cement-opc53',
  'demo-interior-emulsion',
  'demo-floor-tile',
  'demo-bwp-plywood',
];
