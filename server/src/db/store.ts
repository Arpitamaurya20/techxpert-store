import fs from 'fs';
import path from 'path';
import {
  Category,
  Subcategory,
  Brand,
  Product,
  Order,
  Banner,
  BulkPriceTier,
  User,
  AuditLogEntry,
  SEED_CATEGORIES,
  SEED_SUBCATEGORIES,
  SEED_BRANDS,
  SEED_PRODUCTS,
  SEED_ORDERS,
  SEED_USERS,
  SEED_BANNERS,
  SEED_BULK_TIERS,
} from '../data/seedData.js';

interface StoreData {
  categories: Category[];
  subcategories: Subcategory[];
  brands: Brand[];
  products: Product[];
  orders: Order[];
  banners: Banner[];
  bulkTiers: BulkPriceTier[];
  users: User[];
  auditLogs: AuditLogEntry[];
}

const DB_FILE = path.join(process.cwd(), 'database.json');

class DataStore {
  private data: StoreData;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): StoreData {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<StoreData>;
        return {
          categories: parsed.categories || [...SEED_CATEGORIES],
          subcategories: parsed.subcategories || [...SEED_SUBCATEGORIES],
          brands: parsed.brands || [...SEED_BRANDS],
          products: parsed.products || [...SEED_PRODUCTS],
          orders: parsed.orders || [...SEED_ORDERS],
          banners: parsed.banners || [...SEED_BANNERS],
          bulkTiers: parsed.bulkTiers || [...SEED_BULK_TIERS],
          users: parsed.users || [...SEED_USERS],
          auditLogs: parsed.auditLogs || [],
        };
      }
    } catch (e) {
      console.warn('Could not read existing database.json, initializing from seed.', e);
    }

    const initial: StoreData = {
      categories: [...SEED_CATEGORIES],
      subcategories: [...SEED_SUBCATEGORIES],
      brands: [...SEED_BRANDS],
      products: [...SEED_PRODUCTS],
      orders: [...SEED_ORDERS],
      banners: [...SEED_BANNERS],
      bulkTiers: [...SEED_BULK_TIERS],
      users: [...SEED_USERS],
      auditLogs: [],
    };
    this.saveData(initial);
    return initial;
  }

  private saveData(data: StoreData) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist database.json', e);
    }
  }

  private persist() {
    this.saveData(this.data);
  }

  // Categories
  getCategories(): Category[] {
    return this.data.categories;
  }

  createCategory(category: Category): Category {
    this.data.categories.push(category);
    this.persist();
    return category;
  }

  updateCategory(id: string, updates: Partial<Category>): Category | null {
    const idx = this.data.categories.findIndex((c) => String(c.id) === String(id));
    if (idx === -1) return null;
    this.data.categories[idx] = { ...this.data.categories[idx], ...updates };
    this.persist();
    return this.data.categories[idx];
  }

  deleteCategory(id: string): boolean {
    const before = this.data.categories.length;
    this.data.categories = this.data.categories.filter((c) => String(c.id) !== String(id));
    this.data.subcategories = this.data.subcategories.filter(
      (s) => String(s.categoryId) !== String(id)
    );
    if (this.data.categories.length !== before) {
      this.persist();
      return true;
    }
    return false;
  }

  // Subcategories
  getSubcategories(categoryId?: string): Subcategory[] {
    let list = [...this.data.subcategories];
    if (categoryId) {
      list = list.filter((s) => String(s.categoryId) === String(categoryId));
    }
    return list;
  }

  createSubcategory(sub: Subcategory): Subcategory {
    this.data.subcategories.push(sub);
    this.persist();
    return sub;
  }

  updateSubcategory(id: string, updates: Partial<Subcategory>): Subcategory | null {
    const idx = this.data.subcategories.findIndex((s) => String(s.id) === String(id));
    if (idx === -1) return null;
    this.data.subcategories[idx] = { ...this.data.subcategories[idx], ...updates };
    this.persist();
    return this.data.subcategories[idx];
  }

  deleteSubcategory(id: string): boolean {
    const before = this.data.subcategories.length;
    this.data.subcategories = this.data.subcategories.filter((s) => String(s.id) !== String(id));
    if (this.data.subcategories.length !== before) {
      this.persist();
      return true;
    }
    return false;
  }

  // Brands
  getBrands(): Brand[] {
    return this.data.brands;
  }

  // Products
  getProducts(params?: {
    search?: string;
    categoryId?: string;
    brandId?: string;
    featured?: boolean;
    limit?: number;
  }): Product[] {
    let list = [...this.data.products];

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
      );
    }

    if (params?.categoryId) {
      list = list.filter((p) => p.categoryId === params.categoryId);
    }

    if (params?.brandId) {
      list = list.filter((p) => p.brandId === params.brandId);
    }

    if (params?.featured !== undefined) {
      list = list.filter((p) => p.featured === params.featured);
    }

    if (params?.limit && params.limit > 0) {
      list = list.slice(0, params.limit);
    }

    return list;
  }

  getProductById(id: string): Product | undefined {
    return this.data.products.find((p) => p.id === id);
  }

  createProduct(product: Product): Product {
    this.data.products.push(product);
    this.persist();
    return product;
  }

  updateProduct(id: string, updates: Partial<Product>): Product | null {
    const idx = this.data.products.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.products[idx] = { ...this.data.products[idx], ...updates };
    this.persist();
    return this.data.products[idx];
  }

  deleteProduct(id: string): boolean {
    const before = this.data.products.length;
    this.data.products = this.data.products.filter((p) => p.id !== id);
    if (this.data.products.length !== before) {
      this.persist();
      return true;
    }
    return false;
  }

  // Orders
  getOrders(userId?: string): Order[] {
    if (userId) {
      return this.data.orders.filter((o) => o.userId === userId || !o.userId);
    }
    return [...this.data.orders].sort(
      (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
    );
  }

  createOrder(order: Order): Order {
    this.data.orders.unshift(order);
    this.persist();
    return order;
  }

  updateOrderStatus(id: string, status: Order['status']): Order | null {
    const order = this.data.orders.find((o) => o.id === id);
    if (!order) return null;
    order.status = status;
    this.persist();
    return order;
  }

  // Banners
  getBanners(): Banner[] {
    return [...this.data.banners].sort((a, b) => a.position - b.position);
  }

  createBanner(banner: Banner): Banner {
    this.data.banners.push(banner);
    this.persist();
    return banner;
  }

  updateBanner(id: string, updates: Partial<Banner>): Banner | null {
    const idx = this.data.banners.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    this.data.banners[idx] = { ...this.data.banners[idx], ...updates };
    this.persist();
    return this.data.banners[idx];
  }

  deleteBanner(id: string): boolean {
    const before = this.data.banners.length;
    this.data.banners = this.data.banners.filter((b) => b.id !== id);
    if (this.data.banners.length !== before) {
      this.persist();
      return true;
    }
    return false;
  }

  // Bulk Tiers
  getBulkTiers(): BulkPriceTier[] {
    return this.data.bulkTiers;
  }

  createBulkTier(tier: BulkPriceTier): BulkPriceTier {
    this.data.bulkTiers.push(tier);
    this.persist();
    return tier;
  }

  updateBulkTier(id: string, updates: Partial<BulkPriceTier>): BulkPriceTier | null {
    const idx = this.data.bulkTiers.findIndex((tier) => tier.id === id);
    if (idx === -1) return null;
    this.data.bulkTiers[idx] = { ...this.data.bulkTiers[idx], ...updates };
    this.persist();
    return this.data.bulkTiers[idx];
  }

  deleteBulkTier(id: string): boolean {
    const before = this.data.bulkTiers.length;
    this.data.bulkTiers = this.data.bulkTiers.filter((t) => t.id !== id);
    if (this.data.bulkTiers.length !== before) {
      this.persist();
      return true;
    }
    return false;
  }

  // Users
  findUserByIdentifier(identifier: string): User | undefined {
    return this.data.users.find(
      (u) => u.mobile === identifier || u.email.toLowerCase() === identifier.toLowerCase()
    );
  }

  findUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.persist();
    return user;
  }

  // Audit logs (file-backed fallback when MySQL is unavailable)
  getAuditLogs(limit = 100): AuditLogEntry[] {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    return [...this.data.auditLogs]
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, limit);
  }

  createAuditLog(entry: AuditLogEntry): AuditLogEntry {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    this.data.auditLogs.unshift(entry);
    // Cap local file growth
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.persist();
    return entry;
  }
}

export const store = new DataStore();
