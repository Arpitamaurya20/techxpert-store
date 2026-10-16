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
  | 'hero_carousel'
  | 'category_shortcuts'
  | 'trust_strip'
  | 'diwali_banner'
  | 'featured_products'
  | 'order_again_rail'
  | 'category_grid'
  | 'bulk_enquiry';

export interface HomepageSection {
  id: string;
  type: SectionType;
  title: string;
  enabled: boolean;
  position: number;
  description: string;
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
  unit: string;
  price: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  stockQuantity: number;
  featured?: boolean;
  description: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  activeProducts: number;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: 'banner' | 'section' | 'bulk_tier' | 'product' | 'publish';
  details: string;
  user: string;
  timestamp: string;
}
