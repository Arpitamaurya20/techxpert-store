const API_BASE_URL = 'http://localhost:5001';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-client': 'portal',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
  }

  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

export const api = {
  // Categories
  getCategories: () => fetchApi<any[]>('/catalog/categories'),
  getSubcategories: () => fetchApi<any[]>('/catalog/subcategories'),
  getBrands: () => fetchApi<any[]>('/catalog/brands'),

  // Products
  getProducts: (params?: { search?: string; categoryId?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    const qs = query.toString();
    return fetchApi<any[]>(`/catalog/products${qs ? `?${qs}` : ''}`);
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

  // Bulk Pricing
  getBulkTiers: () => fetchApi<any[]>('/pricing/bulk-tiers'),
  createBulkTier: (data: any) =>
    fetchApi<any>('/pricing/bulk-tiers', { method: 'POST', body: JSON.stringify(data) }),
  deleteBulkTier: (id: string) =>
    fetchApi<{ success: boolean }>(`/pricing/bulk-tiers/${id}`, { method: 'DELETE' }),

  // Health
  getHealth: () => fetchApi<{ status: string; service: string; endpoints: string[] }>('/health'),
};
