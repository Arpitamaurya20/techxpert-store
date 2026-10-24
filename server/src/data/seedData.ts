export interface Category {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  icon?: string;
  description?: string;
  productCount?: number;
  featured?: boolean;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  imageUrl?: string;
  searchTerm?: string;
}

export interface Brand {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  subcategoryId?: string;
  brandId?: string;
  brandName?: string;
  sku?: string;
  imageUrl?: string;
  images?: string[];
  price?: number;
  originalPrice?: number;
  unit?: string;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  stockQuantity?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  quantityStep?: number;
  description?: string;
  specifications?: { label: string; value: string }[];
  shareUrl?: string;
  featured?: boolean;
  createdAt?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  unit?: string;
  imageUrl?: string;
  categoryId?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  placedAt: string;
  status:
    | 'placed'
    | 'confirmed'
    | 'packed'
    | 'shipped'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
    | 'returned';
  items: OrderItem[];
  total: number;
  deliveryAddress?: string;
  customerName?: string;
  customerMobile?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaType: 'category' | 'product' | 'external' | 'deals';
  ctaTarget: string;
  status: 'draft' | 'scheduled' | 'published' | 'paused' | 'archived';
  startsAt?: string;
  endsAt?: string;
  position: number;
  termsText?: string;
  locationScope?: string;
  updatedAt: string;
}

export interface HomepageSection {
  id: string;
  type: string;
  title: string;
  enabled: boolean;
  position: number;
  description: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: 'banner' | 'section' | 'bulk_tier' | 'product' | 'publish' | 'order' | 'category' | 'delivery' | 'access' | 'store' | 'help' | 'about' | 'policy';
  details: string;
  user: string;
  /** ISO-8601 timestamp for persistence; portal may format for display */
  timestamp: string;
}

export interface BulkPriceTier {
  id: string;
  productId?: string;
  productName?: string;
  minQty: number;
  maxQty?: number;
  discountType: 'percentage' | 'fixed_price';
  discountValue: number;
  terms: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  passwordHash: string;
  deliveryLocation?: { pincode: string; city: string };
  role: 'customer' | 'contractor' | 'admin';
}

export const SEED_CATEGORIES: Category[] = [
  { id: 'cement-plaster', name: 'Cement & Plaster', icon: 'wall', productCount: 24, featured: true },
  { id: 'tiling-grouts', name: 'Tiling & Grouts', icon: 'texture-box', productCount: 42, featured: true },
  { id: 'paints-putty', name: 'Paints & Putty', icon: 'format-paint', productCount: 68, featured: true },
  { id: 'plywood-mdf', name: 'Plywood & MDF', icon: 'layers-outline', productCount: 31, featured: true },
  { id: 'adhesives-sealants', name: 'Adhesives & Sealants', icon: 'bottle-tonic-outline', productCount: 19, featured: true },
  { id: 'electricals-lighting', name: 'Electricals & Lighting', icon: 'lightbulb-on-outline', productCount: 54, featured: true },
  { id: 'bath-sanitary', name: 'Bath & Sanitary', icon: 'shower-head', productCount: 37, featured: true },
  { id: 'furniture-fittings', name: 'Furniture Fittings', icon: 'cupboard-outline', productCount: 88 },
  { id: 'locks-handles', name: 'Locks & Handles', icon: 'lock-outline', productCount: 45 },
  { id: 'plumbing-supplies', name: 'Plumbing Supplies', icon: 'pipe', productCount: 52 },
  { id: 'waterproofing', name: 'Waterproofing', icon: 'umbrella-outline', productCount: 16 },
  { id: 'tools-accessories', name: 'Tools & Accessories', icon: 'hammer-wrench', productCount: 63 },
  { id: 'safety-equipment', name: 'Safety Equipment', icon: 'hard-hat', productCount: 29 },
];

export const SEED_SUBCATEGORIES: Subcategory[] = [
  { id: 'opc-cement', categoryId: 'cement-plaster', name: 'OPC Cement', searchTerm: 'opc' },
  { id: 'ppc-cement', categoryId: 'cement-plaster', name: 'PPC Cement', searchTerm: 'ppc' },
  { id: 'white-cement', categoryId: 'cement-plaster', name: 'White Cement' },
  { id: 'gypsum-plaster', categoryId: 'cement-plaster', name: 'Gypsum Plaster', searchTerm: 'gypsum' },
  { id: 'tile-grout', categoryId: 'tiling-grouts', name: 'Tile Grout', searchTerm: 'grout' },
  { id: 'wall-tiles', categoryId: 'tiling-grouts', name: 'Wall Tiles', searchTerm: 'wall tile' },
  { id: 'floor-tiles', categoryId: 'tiling-grouts', name: 'Floor Tiles', searchTerm: 'floor tile' },
  { id: 'tile-spacers', categoryId: 'tiling-grouts', name: 'Tile Spacers', searchTerm: 'spacers' },
  { id: 'wall-putty', categoryId: 'paints-putty', name: 'Wall Putty', searchTerm: 'putty' },
  { id: 'interior-emulsion', categoryId: 'paints-putty', name: 'Interior Emulsion', searchTerm: 'interior' },
  { id: 'exterior-emulsion', categoryId: 'paints-putty', name: 'Exterior Emulsion', searchTerm: 'exterior' },
  { id: 'primer', categoryId: 'paints-putty', name: 'Primer' },
  { id: 'plywood', categoryId: 'plywood-mdf', name: 'Plywood' },
  { id: 'mdf-board', categoryId: 'plywood-mdf', name: 'MDF Board', searchTerm: 'mdf' },
  { id: 'laminates', categoryId: 'plywood-mdf', name: 'Laminates', searchTerm: 'laminate' },
  { id: 'tile-adhesive', categoryId: 'adhesives-sealants', name: 'Tile Adhesive' },
  { id: 'silicone-sealant', categoryId: 'adhesives-sealants', name: 'Silicone Sealant', searchTerm: 'silicone' },
  { id: 'wood-adhesive', categoryId: 'adhesives-sealants', name: 'Wood Adhesive' },
  { id: 'pvc-pipes', categoryId: 'plumbing-supplies', name: 'PVC Pipes', searchTerm: 'pipe' },
  { id: 'cpvc-fittings', categoryId: 'plumbing-supplies', name: 'CPVC Fittings', searchTerm: 'fitting' },
  { id: 'wires-cables', categoryId: 'electricals-lighting', name: 'Wires & Cables', searchTerm: 'wire' },
  { id: 'switches', categoryId: 'electricals-lighting', name: 'Switches', searchTerm: 'switch' },
];

export const SEED_BRANDS: Brand[] = [
  { id: 'ultratech', name: 'UltraTech Cement' },
  { id: 'jk-lakshmi-cement', name: 'JK Lakshmi Cement' },
  { id: 'asian-paints', name: 'Asian Paints' },
  { id: 'berger', name: 'Berger Paints' },
  { id: 'pidilite', name: 'Pidilite' },
  { id: 'fevicol', name: 'Fevicol' },
  { id: 'dr-fixit', name: 'Dr. Fixit' },
  { id: 'centuryply', name: 'CenturyPly' },
  { id: 'action-tesa', name: 'Action TESA' },
  { id: 'polycab', name: 'Polycab' },
  { id: 'havells', name: 'Havells' },
  { id: 'jaquar', name: 'Jaquar' },
  { id: 'bosch', name: 'Bosch' },
];

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'cement-opc53',
    name: 'OPC 53 Grade Cement',
    categoryId: 'cement-plaster',
    categoryName: 'Cement & Plaster',
    subcategoryId: 'opc-cement',
    brandId: 'ultratech',
    brandName: 'UltraTech Cement',
    sku: 'TX-CEM-053',
    unit: '50 kg bag',
    price: 420,
    originalPrice: 450,
    stockStatus: 'in_stock',
    stockQuantity: 400,
    minOrderQuantity: 1,
    maxOrderQuantity: 100,
    featured: true,
    description: 'Ultra-high strength Portland cement for high-rise columns, beams, and slabs.',
    specifications: [
      { label: 'Grade', value: '53 Grade IS 12269' },
      { label: 'Setting Time', value: 'Initial 30 min, Final 600 min' },
      { label: 'Packaging', value: '50kg HDPE laminated bag' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cement-ppc',
    name: 'PPC Blended Cement',
    categoryId: 'cement-plaster',
    categoryName: 'Cement & Plaster',
    subcategoryId: 'ppc-cement',
    brandId: 'jk-lakshmi-cement',
    brandName: 'JK Lakshmi Cement',
    sku: 'TX-CEM-PPC',
    unit: '50 kg bag',
    price: 395,
    originalPrice: 420,
    stockStatus: 'in_stock',
    stockQuantity: 280,
    minOrderQuantity: 1,
    maxOrderQuantity: 100,
    featured: true,
    description: 'Fly-ash modified Portland pozzolana cement for crack-resistant plastering and brick masonry.',
    specifications: [
      { label: 'Type', value: 'IS 1489 Part 1' },
      { label: 'Packaging', value: '50kg Moisture-proof bag' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'birla-white-cement',
    name: 'Birla White Wall Seal Cement',
    categoryId: 'cement-plaster',
    categoryName: 'Cement & Plaster',
    subcategoryId: 'white-cement',
    brandId: 'ultratech',
    brandName: 'UltraTech Birla White',
    sku: 'TX-CEM-WHT',
    unit: '5 kg bag',
    price: 210,
    stockStatus: 'low_stock',
    stockQuantity: 8,
    minOrderQuantity: 1,
    description: 'High-whiteness cement for architectural decorative joints, marble laying, and grouting.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'gypsum-wall-plaster',
    name: 'Gypsum Wall Plaster Superfine',
    categoryId: 'cement-plaster',
    categoryName: 'Cement & Plaster',
    subcategoryId: 'gypsum-plaster',
    brandId: 'sakarni',
    brandName: 'Sakarni',
    sku: 'TX-PLAS-GYP',
    unit: '25 kg bag',
    price: 340,
    stockStatus: 'in_stock',
    stockQuantity: 120,
    description: 'One-coat direct application plaster for internal brick and RCC ceilings.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fevicol-marine-adhesive',
    name: 'Fevicol Marine Waterproof Adhesive',
    categoryId: 'adhesives-sealants',
    categoryName: 'Adhesives & Sealants',
    subcategoryId: 'wood-adhesive',
    brandId: 'fevicol',
    brandName: 'Fevicol',
    sku: 'TX-ADH-MAR',
    unit: '5 kg can',
    price: 1350,
    originalPrice: 1450,
    stockStatus: 'in_stock',
    stockQuantity: 65,
    featured: true,
    description: 'Advanced waterproof adhesive meeting European D3 water resistance norms.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'asian-paints-tractor-emulsion',
    name: 'Tractor Emulsion Smooth Finish',
    categoryId: 'paints-putty',
    categoryName: 'Paints & Putty',
    subcategoryId: 'interior-emulsion',
    brandId: 'asian-paints',
    brandName: 'Asian Paints',
    sku: 'TX-PNT-TRC',
    unit: '20 L drum',
    price: 2850,
    originalPrice: 3200,
    stockStatus: 'in_stock',
    stockQuantity: 40,
    featured: true,
    description: 'Washable interior acrylic emulsion providing twice the coverage of regular distemper.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'dr-fixit-pidifin-2k',
    name: 'Dr. Fixit Pidifin 2K Waterproofing',
    categoryId: 'waterproofing',
    categoryName: 'Waterproofing',
    subcategoryId: 'membranes',
    brandId: 'dr-fixit',
    brandName: 'Dr. Fixit',
    sku: 'TX-WPR-2K',
    unit: '15 kg set',
    price: 2450,
    stockStatus: 'in_stock',
    stockQuantity: 30,
    featured: true,
    description: 'Two-component acrylic cementitious waterproof coating for sunken slabs and water tanks.',
    createdAt: new Date().toISOString(),
  },
];

export const SEED_ORDERS: Order[] = [
  {
    id: 'ord-1001',
    orderNumber: 'TX-2026-8912',
    placedAt: '2026-10-16T08:30:00Z',
    status: 'out_for_delivery',
    total: 21000,
    deliveryAddress: 'Plot 45, Sector 62, Noida, Uttar Pradesh - 201309',
    customerName: 'Rajesh Sharma (Contractor)',
    customerMobile: '9876543210',
    items: [
      {
        productId: 'cement-opc53',
        name: 'OPC 53 Grade Cement',
        quantity: 50,
        unitPrice: 420,
        unit: '50 kg bag',
        categoryId: 'cement-plaster',
      },
    ],
  },
  {
    id: 'ord-1002',
    orderNumber: 'TX-2026-8913',
    placedAt: '2026-10-15T14:10:00Z',
    status: 'delivered',
    total: 8200,
    deliveryAddress: 'B-12, Green Glen Layout, Bellandur, Bengaluru - 560103',
    customerName: 'Anil Kumar',
    customerMobile: '9812345678',
    items: [
      {
        productId: 'fevicol-marine-adhesive',
        name: 'Fevicol Marine Waterproof Adhesive',
        quantity: 4,
        unitPrice: 1350,
        unit: '5 kg can',
        categoryId: 'adhesives-sealants',
      },
      {
        productId: 'asian-paints-tractor-emulsion',
        name: 'Tractor Emulsion Smooth Finish',
        quantity: 1,
        unitPrice: 2800,
        unit: '20 L drum',
        categoryId: 'paints-putty',
      },
    ],
  },
  {
    id: 'ord-1003',
    orderNumber: 'TX-2026-8914',
    placedAt: '2026-10-16T11:45:00Z',
    status: 'confirmed',
    total: 11850,
    deliveryAddress: 'Civil Lines, Site 2, Gurgaon, Haryana - 122001',
    customerName: 'Vikas Site Engineer',
    customerMobile: '9988776655',
    items: [
      {
        productId: 'cement-ppc',
        name: 'PPC Blended Cement',
        quantity: 30,
        unitPrice: 395,
        unit: '50 kg bag',
        categoryId: 'cement-plaster',
      },
    ],
  },
];

export const SEED_USERS: User[] = [
  {
    id: 'usr-1',
    name: 'Rajesh Sharma',
    email: 'contractor@techxpert.in',
    mobile: '9876543210',
    passwordHash: 'password123',
    deliveryLocation: { pincode: '201309', city: 'Noida' },
    role: 'contractor',
  },
  {
    id: 'usr-admin',
    name: 'Arpit Maurya',
    email: 'admin@techxpert.in',
    mobile: '9999988888',
    passwordHash: 'admin123',
    role: 'admin',
  },
];

export const SEED_BANNERS: Banner[] = [
  {
    id: 'banner-diwali-2026',
    title: 'Diwali Special Offer',
    subtitle: 'Extra 10% on Bulk Building Materials & Finishing',
    imageUrl: '/images/diwali-banner.jpg',
    ctaLabel: 'Shop Festive Deals',
    ctaType: 'deals',
    ctaTarget: '/category/cement-plaster',
    status: 'published',
    startsAt: '2026-10-15T00:00:00Z',
    endsAt: '2026-11-05T23:59:59Z',
    position: 1,
    termsText: 'Valid on orders exceeding ₹25,000. Limited period seasonal offer.',
    locationScope: 'All serviceable zones',
    updatedAt: '2026-10-16 11:30 AM',
  },
  {
    id: 'banner-project-essentials',
    title: 'Project Essentials',
    subtitle: 'High Grade Cement, Structural Steel & Aggregates Delivered On-Site',
    imageUrl: '/images/home-hero-cream.jpg',
    ctaLabel: 'Explore Catalog',
    ctaType: 'category',
    ctaTarget: '/category/cement-plaster',
    status: 'published',
    position: 2,
    termsText: 'Direct dispatch from certified distribution warehouses.',
    locationScope: 'Delhi NCR, Mumbai, Bengaluru',
    updatedAt: '2026-10-16 09:15 AM',
  },
];

export const SEED_BULK_TIERS: BulkPriceTier[] = [
  {
    id: 'tier-cement-1',
    productId: 'cement-opc53',
    productName: 'OPC 53 Grade Cement',
    minQty: 10,
    maxQty: 49,
    discountType: 'percentage',
    discountValue: 4,
    terms: 'Savings of ₹16.80/bag on site orders',
  },
  {
    id: 'tier-cement-2',
    productId: 'cement-opc53',
    productName: 'OPC 53 Grade Cement',
    minQty: 50,
    maxQty: 99,
    discountType: 'percentage',
    discountValue: 8,
    terms: 'Savings of ₹33.60/bag + Free forklift pallet offload',
  },
  {
    id: 'tier-cement-3',
    productId: 'cement-opc53',
    productName: 'OPC 53 Grade Cement',
    minQty: 100,
    discountType: 'percentage',
    discountValue: 12,
    terms: 'Contractor bulk dispatch rate (₹369.60/bag)',
  },
];
