/** Where the data on screen came from. Demo data must always be labelled in the UI. */
export type DataSource = 'api' | 'demo';

export type CatalogResult<T> = {
  data: T;
  source: DataSource;
};

export type Category = {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  /** MaterialCommunityIcons name, used when there is no image. */
  icon?: string;
  description?: string;
  /** Only shown when the backend sends it; never estimated in the app. */
  productCount?: number;
  /** True only when the backend marks the category as featured/popular. */
  featured?: boolean;
};

/** A product type inside a category, e.g. "White Cement" in Cement & Plaster. */
export type Subcategory = {
  id: string;
  categoryId: string;
  name: string;
  imageUrl?: string;
  /** Text used to search the parent category's products; defaults to `name`. */
  searchTerm?: string;
};

export type Brand = {
  id: string;
  name: string;
  logoUrl?: string;
};

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type ProductSpecification = {
  label: string;
  value: string;
};

export type Product = {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  /** Product type inside the category, when the backend sends it. */
  subcategoryId?: string;
  brandId?: string;
  brandName?: string;
  sku?: string;
  /** Primary photo. */
  imageUrl?: string;
  /** Further photos for the details gallery, excluding `imageUrl`. */
  images?: string[];
  /** Selling price in rupees. Missing means the price is unavailable; it is never guessed. */
  price?: number;
  /** Only present when the backend confirms an MRP/strike-through price. */
  originalPrice?: number;
  unit?: string;
  stockStatus?: StockStatus;
  /** Units available; used to cap cart quantity when the backend sends it. */
  stockQuantity?: number;
  /** Smallest quantity that can be ordered (defaults to 1). */
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  /** Quantities must go up in this step, e.g. 5 for "sold in multiples of 5" (defaults to 1). */
  quantityStep?: number;
  description?: string;
  /** Short selling points for the "Key Features" list; only shown when the backend sends them. */
  highlights?: string[];
  /** Average customer rating out of 5; only shown when the backend sends it. */
  rating?: number;
  reviewCount?: number;
  /** Only attributes the backend sends, in its order. */
  specifications?: ProductSpecification[];
  /** Public product page on the store website; Share is offered only when present. */
  shareUrl?: string;
  featured?: boolean;
  /** ISO date the product was added; "Newest" sorting is offered only when every product has one. */
  createdAt?: string;
};

export type ProductQuery = {
  search?: string;
  categoryId?: string;
  brandId?: string;
  featured?: boolean;
  limit?: number;
};
