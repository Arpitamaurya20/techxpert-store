export type BannerStatus = 'draft' | 'scheduled' | 'published' | 'paused' | 'archived';

export type CtaType = 'category' | 'product' | 'external' | 'deals';

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaType: CtaType;
  ctaTarget: string;
  status: BannerStatus;
  startsAt?: string;
  endsAt?: string;
  position: number;
  termsText?: string;
  locationScope?: string;
  updatedAt: string;
}

export type SectionType =
  | 'category_shortcuts'
  | 'hero_carousel'
  | 'trust_strip'
  | 'category_grid'
  | 'order_again_rail'
  | 'offer_tiles'
  | 'product_rail'
  | 'bulk_enquiry';

export interface HomepageSection {
  id: string;
  /** App-known section types; API may also return legacy/DB codes */
  type: SectionType | string;
  title: string;
  enabled: boolean;
  position: number;
  description: string;
  sectionCode?: string;
}

export interface BulkPriceTier {
  id: string;
  productId?: string;
  categoryId?: string;
  productName?: string;
  minQty: number;
  maxQty?: number;
  discountType: 'percentage' | 'fixed_price';
  discountValue: number;
  terms: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  sku?: string;
  imageUrl?: string;
  brandName?: string;
  unit: string;
  /** Lowest active selling price; null when the product has no active price and cannot be sold. */
  price: number | null;
  originalPrice?: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  stockQuantity: number;
  featured?: boolean;
  description: string;
}


export interface Category {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  imageUrl?: string;
  description?: string;
  displayOrder?: number;
  productCount?: number;
  activeProducts?: number;
  featured?: boolean;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  displayOrder?: number;
  searchTerm?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: 'banner' | 'section' | 'bulk_tier' | 'product' | 'publish' | 'order' | 'category' | 'delivery' | 'access';
  details: string;
  user: string;
  /** ISO timestamp from API (viewer formats for display) */
  timestamp: string;
}
