import { getToken, clearSession } from './session';
import type { ModuleInfo, Permissions } from './access';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:5001';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

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

export type StaffProfile = {
  id: number;
  name: string;
  email: string;
  role: string;
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
  homecareRole: string;
  active: boolean;
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

async function rawFetch(path: string, options?: RequestInit): Promise<ApiEnvelope<unknown>> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
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
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
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
  createProduct: (data: any) =>
    fetchApi<any>('/catalog/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) =>
    fetchApi<any>(`/catalog/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string) =>
    fetchApi<{ success: boolean }>(`/catalog/products/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: () => fetchApi<any[]>('/orders?all=true'),
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
    const res = await fetch(`${API_BASE_URL}/cms/banners/media`, {
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

  // Bulk Pricing
  getBulkTiers: () => fetchApi<any[]>('/pricing/bulk-tiers'),
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
  assignStaffRole: (adminId: number, roleId: number | null) =>
    fetchApi<StaffMember>(`/access/staff/${adminId}`, { method: 'PUT', body: JSON.stringify({ roleId }) }),
  setStaffScope: (adminId: number, scope: { all: boolean; nodes: ScopeNode[] }) =>
    fetchApi<StaffMember>(`/access/staff/${adminId}/scope`, { method: 'PUT', body: JSON.stringify(scope) }),

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
