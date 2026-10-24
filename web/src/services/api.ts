import { getToken, clearSession } from './session';
import type { ModuleInfo, Permissions } from './access';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:5001';

let onUnauthorized: (() => void) | null = null;
let onPasswordChangeRequired: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/** Called when the server refuses a request until the temporary password is changed. */
export function setPasswordChangeHandler(handler: (() => void) | null) {
  onPasswordChangeRequired = handler;
}

export type HelpFaq = { id: number; question: string; answer: string; position: number };
export type HelpContent = {
  phone: string;
  phoneLabel: string;
  whatsapp: string;
  email: string;
  hours: string;
  faqs: HelpFaq[];
};
export type AboutFact = { value: string; label: string; position: number };
export type AboutValue = { icon: string; title: string; body: string; position: number };
export type AboutContent = {
  missionTitle: string;
  missionBody: string;
  facts: AboutFact[];
  values: AboutValue[];
};
export type PolicyBlock = string | string[];
export type PolicyDocument = {
  id: string;
  title: string;
  lastUpdated: string;
  sourceUrl: string;
  intro: string[];
  sections: { heading: string; blocks: PolicyBlock[] }[];
};
export type PoliciesContent = { policies: PolicyDocument[] };
export type PolicyDraft = {
  lastUpdated: string;
  sourceUrl: string;
  intro: string[];
  sections: { heading: string; blocks: PolicyBlock[] }[];
};
export type AboutDraft = {
  missionTitle: string;
  missionBody: string;
  facts: { value: string; label: string }[];
  values: { icon: string; title: string; body: string }[];
};
export type HelpDraft = {
  phone: string;
  phoneLabel: string;
  whatsapp: string;
  email: string;
  hours: string;
  faqs: { question: string; answer: string }[];
};

export type HomeShortcut = {
  categoryId: number;
  label: string;
  name: string;
  imageUrl: string;
  available: boolean;
};
export type HomeProject = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  calculator: string;
  categories: { categoryId: number; name: string; available: boolean }[];
};
export type HomeContent = { shortcuts: HomeShortcut[]; projects: HomeProject[] };
export type SearchIdeas = { suggestions: string[] };
export type HomeDeal = {
  categoryId: number;
  name: string;
  available: boolean;
  title: string;
  highlight: string;
  tagline: string;
  tone: string;
  imageUrl: string;
  position: number;
};
export type DealsContent = { deals: HomeDeal[] };
export type DealDraft = {
  categoryId: number;
  title: string;
  highlight: string;
  tagline: string;
  tone: string;
  imageUrl: string;
};
export type TalkLine = {
  productId: string;
  variantId: number;
  name: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  stockAtRequest: number;
  note: string | null;
};
export type TalkRequest = {
  id: string;
  name: string;
  phone: string;
  pincode: string;
  storeId: number;
  storeName: string | null;
  note: string | null;
  status: 'new' | 'closed';
  placedAt: string;
  totals: { subtotal: number; tax: number; delivery: number; grandTotal: number };
  lines: TalkLine[];
  message: string | null;
};
export type ShopRule = { enabled: boolean; amount: number | null };
export type ShopSettings = {
  largeOrderValue: ShopRule;
  largeOrderQuantity: ShopRule;
  codLimit: ShopRule;
  freeDeliveryFrom: ShopRule;
  deliveryFee: ShopRule;
  gstPercent: ShopRule;
};
export type TrustClaim = { label: string; icon: string; action: string; position: number };
export type TrustContent = { claims: TrustClaim[] };
export type TrustDraft = { label: string; icon: string; action: string };
export type HomeDraft = {
  shortcuts: { categoryId: number; label: string }[];
  projects: { title: string; subtitle: string; imageUrl: string; calculator: string; categoryIds: number[] }[];
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  };
};

/** `store`: a login made in this portal. `linked`: a Homecare login, which keeps its Homecare password. */
export type StaffKind = 'store' | 'linked';

export type StaffProfile = {
  id: number;
  name: string;
  email: string;
  kind: StaffKind;
  role: string;
  isSuperAdmin: boolean;
  /** Signed in with a temporary password; everything but changing it is refused. */
  mustChangePassword: boolean;
  storeRole: string | null;
  permissions: Permissions;
  /** Sees every store's orders, pincodes and customers. */
  wholeCompany?: boolean;
};

export type ScopeNode = { type: 'group' | 'store'; id: number };

export type StoreGroup = { id: number; name: string; kind: string; parentId: number | null };

export type StoreSummary = {
  id: number;
  code: string;
  name: string;
  groupId: number | null;
  active: boolean;
  contactNumber: string;
  email: string;
  address: string;
  pincodeCount: number;
};

/** Only the groups and stores inside the signed-in person's places. */
export type StoreTree = { groups: StoreGroup[]; stores: StoreSummary[]; wholeCompany: boolean };

export type StorePincodeLink = {
  linkId: number;
  pincodeId: number;
  pincode: string;
  areaName: string;
  active: boolean;
  deliveryActive: boolean;
  updatedAt: string | null;
};

export type PortalRole = {
  id: number;
  name: string;
  description: string;
  staffCount: number;
  permissions: Permissions;
  manageable: boolean;
};

export type StaffMember = {
  id: number;
  name: string;
  email: string;
  kind: StaffKind;
  active: boolean;
  /** Linked only: whether the Homecare login itself is switched on. */
  homecareActive: boolean | null;
  /** Hasn't replaced the temporary password yet. */
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  isSuperAdmin: boolean;
  roleId: number | null;
  roleName: string | null;
  scope: { all: boolean; nodes: Array<ScopeNode & { name: string }> };
  changeable: boolean;
};

export type RoleInput = { name: string; description: string; permissions: Permissions };

export type DeliveryPincode = {
  id: string;
  pincode: string;
  areaName: string;
  active: boolean;
  storeId: number | null;
  storeName: string | null;
  updatedAt: string | null;
};

export type StoreInput = {
  name?: string;
  groupId?: number | null;
  pincode?: string;
  contactNumber?: string;
  email?: string;
  address?: string;
  active?: boolean;
};

/** fetch, but a network failure reads as plain words instead of the browser's "Failed to fetch". */
async function reach(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new Error("Can't reach the server.");
  }
}

async function rawFetch(path: string, options?: RequestInit): Promise<ApiEnvelope<unknown>> {
  const token = getToken();
  const res = await reach(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-client': 'portal',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    clearSession();
    onUnauthorized?.();
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Session expired — please sign in again');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    if (res.status === 403 && errorBody.details?.code === 'PASSWORD_CHANGE_REQUIRED') onPasswordChangeRequired?.();
    throw new Error(errorBody.error || `The server had a problem (status ${res.status}).`);
  }

  return (await res.json()) as ApiEnvelope<unknown>;
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const json = await rawFetch(path, options);
  return (json.data !== undefined ? json.data : json) as T;
}

/** Campaign uploads are served by the API. Other relative paths stay on this portal. */
export function resolvePortalAsset(url: string): string {
  const raw = url.trim();
  if (raw.startsWith('/uploads/')) return `${API_BASE_URL}${raw}`;
  return raw;
}

export const api = {
  // Admin auth (cookie session)
  adminLogin: (email: string, password: string) =>
    fetchApi<{ token: string; admin: StaffProfile }>(
      '/auth/admin/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  adminLogout: () =>
    fetchApi<{ success: boolean }>('/auth/admin/logout', { method: 'POST' }),
  getAdminMe: () => fetchApi<StaffProfile>('/auth/admin/me'),
  /** Store logins only. This session gets a fresh cookie; other sessions end. */
  changeOwnPassword: (current: string, next: string) =>
    fetchApi<{ token: string; admin: StaffProfile }>('/auth/admin/password', {
      method: 'POST',
      body: JSON.stringify({ current, next }),
    }),

  // Categories
  getCategories: () => fetchApi<any[]>('/catalog/categories'),
  createCategory: (data: any) =>
    fetchApi<any>('/catalog/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) =>
    fetchApi<any>(`/catalog/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    fetchApi<{ success: boolean }>(`/catalog/categories/${id}`, { method: 'DELETE' }),

  getSubcategories: (categoryId?: string) => {
    const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
    return fetchApi<any[]>(`/catalog/subcategories${qs}`);
  },
  createSubcategory: (data: any) =>
    fetchApi<any>('/catalog/subcategories', { method: 'POST', body: JSON.stringify(data) }),
  updateSubcategory: (id: string, data: any) =>
    fetchApi<any>(`/catalog/subcategories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubcategory: (id: string) =>
    fetchApi<{ success: boolean }>(`/catalog/subcategories/${id}`, { method: 'DELETE' }),

  getBrands: () => fetchApi<any[]>('/catalog/brands'),

  // Products (paginated — use meta.total for catalogue size, not data.length)
  getProducts: async (params?: {
    search?: string;
    categoryId?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const json = await rawFetch(`/catalog/products${qs ? `?${qs}` : ''}`);
    const products = (json.data !== undefined ? json.data : json) as any[];
    return {
      products: Array.isArray(products) ? products : [],
      meta: {
        page: Number(json.meta?.page) || 1,
        limit: Number(json.meta?.limit) || products?.length || 50,
        total: Number(json.meta?.total) || (Array.isArray(products) ? products.length : 0),
        totalPages: Number(json.meta?.totalPages) || 1,
      },
    };
  },
  getProduct: (id: string) => fetchApi<any>(`/catalog/products/${id}`),
  createProduct: (data: any) =>
    fetchApi<any>('/catalog/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) =>
    fetchApi<any>(`/catalog/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getProductStoreStock: (id: string) =>
    fetchApi<{
      variants: {
        variantId: number;
        name: string;
        companyStock: number;
        stores: { storeId: number; name: string; quantity: number | null }[];
      }[];
    }>(`/catalog/products/${id}/store-stock`),
  deleteProduct: (id: string) =>
    fetchApi<{ success: boolean }>(`/catalog/products/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: () => fetchApi<any[]>('/orders?all=true'),
  placeStaffOrder: (body: unknown) =>
    fetchApi<{ id: string | number; orderNumber: string; source?: string | null }>('/orders/staff', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateOrderStatus: (id: string, status: string) =>
    fetchApi<any>(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Banners
  getBanners: () => fetchApi<any[]>('/cms/banners'),
  createBanner: (data: any) =>
    fetchApi<any>('/cms/banners', { method: 'POST', body: JSON.stringify(data) }),
  updateBanner: (id: string, data: any) =>
    fetchApi<any>(`/cms/banners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBanner: (id: string) =>
    fetchApi<{ success: boolean }>(`/cms/banners/${id}`, { method: 'DELETE' }),
  uploadBannerImage: async (file: File) => {
    const token = getToken();
    const body = new FormData();
    body.append('file', file);
    const res = await reach(`${API_BASE_URL}/cms/banners/media`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-client': 'portal',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as ApiEnvelope<{ imageUrl?: string }>;
    if (res.status === 401) {
      clearSession();
      onUnauthorized?.();
      throw new Error(json.error || 'Session expired — please sign in again');
    }
    if (!res.ok || !json.data?.imageUrl) {
      throw new Error(json.error || 'Could not store that image');
    }
    return { imageUrl: json.data.imageUrl };
  },

  // Homepage sections
  getSections: () => fetchApi<any[]>('/cms/sections'),
  updateSection: (id: string, data: any) =>
    fetchApi<any>(`/cms/sections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  reorderSections: (items: { id: string; position: number }[]) =>
    fetchApi<{ success: boolean }>('/cms/sections/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),
  resetSections: () => fetchApi<any[]>('/cms/sections/reset', { method: 'POST' }),

  getHome: () => fetchApi<HomeContent>('/cms/home'),
  saveHome: (body: HomeDraft) =>
    fetchApi<HomeContent>('/cms/home', { method: 'PUT', body: JSON.stringify(body) }),
  getSearchSuggestions: () => fetchApi<SearchIdeas>('/cms/search-suggestions'),
  saveSearchSuggestions: (suggestions: string[]) =>
    fetchApi<SearchIdeas>('/cms/search-suggestions', { method: 'PUT', body: JSON.stringify({ suggestions }) }),
  getDeals: () => fetchApi<DealsContent>('/cms/deals'),
  saveDeals: (deals: DealDraft[]) =>
    fetchApi<DealsContent>('/cms/deals', { method: 'PUT', body: JSON.stringify({ deals }) }),
  getTrustClaims: () => fetchApi<TrustContent>('/cms/trust'),
  saveTrustClaims: (claims: TrustDraft[]) =>
    fetchApi<TrustContent>('/cms/trust', { method: 'PUT', body: JSON.stringify({ claims }) }),
  getPolicies: () => fetchApi<PoliciesContent>('/cms/policies'),
  savePolicy: (id: string, body: PolicyDraft) =>
    fetchApi<PoliciesContent>(`/cms/policies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getAbout: () => fetchApi<AboutContent>('/cms/about'),
  saveAbout: (body: AboutDraft) =>
    fetchApi<AboutContent>('/cms/about', { method: 'PUT', body: JSON.stringify(body) }),
  getTalkRequests: () => fetchApi<TalkRequest[]>('/shop/requests'),
  setTalkRequestStatus: (id: string, status: 'new' | 'closed') =>
    fetchApi<TalkRequest>(`/shop/requests/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  getShopSettings: () => fetchApi<ShopSettings>('/shop/settings'),
  saveShopSettings: (body: ShopSettings) =>
    fetchApi<ShopSettings>('/shop/settings', { method: 'PUT', body: JSON.stringify(body) }),
  getHelp: () => fetchApi<HelpContent>('/cms/help'),
  saveHelp: (body: HelpDraft) =>
    fetchApi<HelpContent>('/cms/help', { method: 'PUT', body: JSON.stringify(body) }),

  // Bulk Pricing
  getBulkTiers: () => fetchApi<any[]>('/pricing/bulk-tiers'),
  calculateBulkPrice: (productId: string | number, quantity: number, basePrice: number) =>
    fetchApi<any>(
      `/pricing/calculate?${new URLSearchParams({
        productId: String(productId),
        quantity: String(quantity),
        basePrice: String(basePrice),
      })}`
    ),
  createBulkTier: (data: any) =>
    fetchApi<any>('/pricing/bulk-tiers', { method: 'POST', body: JSON.stringify(data) }),
  updateBulkTier: (id: string, data: any) =>
    fetchApi<any>(`/pricing/bulk-tiers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBulkTier: (id: string) =>
    fetchApi<{ success: boolean }>(`/pricing/bulk-tiers/${id}`, { method: 'DELETE' }),

  // Users (from homecare.users)
  getUsers: () => fetchApi<any[]>('/auth/users'),

  // Audit trail (persisted)
  getAuditLogs: (limit = 100) => fetchApi<any[]>(`/audit/logs?limit=${limit}`),
  createAuditLog: (data: {
    action: string;
    entity: string;
    details?: string;
    user?: string;
  }) => fetchApi<any>('/audit/logs', { method: 'POST', body: JSON.stringify(data) }),

  // Delivery pincodes
  getDeliveryPincodes: () => fetchApi<DeliveryPincode[]>('/delivery/pincodes'),
  addDeliveryPincode: (data: { pincode: string; areaName: string; storeId?: number | null }) =>
    fetchApi<DeliveryPincode>('/delivery/pincodes', { method: 'POST', body: JSON.stringify(data) }),
  setDeliveryPincodeActive: (id: string, active: boolean) =>
    fetchApi<DeliveryPincode>(`/delivery/pincodes/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }),

  // Roles & access
  getAccessRoles: () => fetchApi<{ modules: ModuleInfo[]; roles: PortalRole[] }>('/access/roles'),
  createAccessRole: (data: RoleInput) =>
    fetchApi<PortalRole>('/access/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateAccessRole: (id: number, data: RoleInput) =>
    fetchApi<PortalRole>(`/access/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccessRole: (id: number) =>
    fetchApi<{ success: boolean }>(`/access/roles/${id}`, { method: 'DELETE' }),
  getAccessStaff: () => fetchApi<StaffMember[]>('/access/staff'),
  assignStaffRole: (staffId: number, roleId: number | null) =>
    fetchApi<StaffMember>(`/access/staff/${staffId}`, { method: 'PUT', body: JSON.stringify({ roleId }) }),
  setStaffScope: (staffId: number, scope: { all: boolean; nodes: ScopeNode[] }) =>
    fetchApi<StaffMember>(`/access/staff/${staffId}/scope`, { method: 'PUT', body: JSON.stringify(scope) }),
  /** The temporary password comes back once and is never stored in plain text. */
  addStaffLogin: (data: { name: string; email: string }) =>
    fetchApi<{ staff: StaffMember; temporaryPassword: string }>('/access/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  findHomecareLogin: (email: string) =>
    fetchApi<{ name: string; email: string }>(
      `/access/staff/homecare-match?${new URLSearchParams({ email })}`
    ),
  linkHomecareLogin: (email: string) =>
    fetchApi<StaffMember>('/access/staff/link', { method: 'POST', body: JSON.stringify({ email }) }),
  updateStaff: (staffId: number, data: { name?: string; active?: boolean }) =>
    fetchApi<StaffMember>(`/access/staff/${staffId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetStaffPassword: (staffId: number) =>
    fetchApi<{ temporaryPassword: string }>(`/access/staff/${staffId}/reset-password`, { method: 'POST' }),

  // Stores & groups
  getStoreTree: () => fetchApi<StoreTree>('/stores/tree'),
  createStoreGroup: (data: { name: string; kind?: string; parentId?: number | null }) =>
    fetchApi<StoreGroup>('/stores/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateStoreGroup: (id: number, data: { name?: string; kind?: string; parentId?: number | null }) =>
    fetchApi<StoreGroup>(`/stores/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStoreGroup: (id: number) =>
    fetchApi<{ success: boolean }>(`/stores/groups/${id}`, { method: 'DELETE' }),
  createStore: (data: StoreInput) =>
    fetchApi<StoreSummary>('/stores', { method: 'POST', body: JSON.stringify(data) }),
  updateStore: (id: number, data: StoreInput) =>
    fetchApi<StoreSummary>(`/stores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getStorePincodes: (storeId: number) => fetchApi<StorePincodeLink[]>(`/stores/${storeId}/pincodes`),
  linkStorePincode: (storeId: number, pincode: string) =>
    fetchApi<StorePincodeLink[]>(`/stores/${storeId}/pincodes`, {
      method: 'POST',
      body: JSON.stringify({ pincode }),
    }),
  unlinkStorePincode: (storeId: number, pincodeId: number) =>
    fetchApi<StorePincodeLink[]>(`/stores/${storeId}/pincodes/${pincodeId}`, { method: 'DELETE' }),

  // Health
  getHealth: () => fetchApi<{ status: string; service: string; endpoints: string[] }>('/health'),
};
