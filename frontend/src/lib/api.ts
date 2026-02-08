import axios from 'axios';

const API_BASE_URL = '/api';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  check: () => api.get('/auth/check'),
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) => 
    api.post('/auth/register', { email, password, name }),
  me: () => api.get('/auth/me'),
  updateProfile: (data: { name?: string; email?: string }) => 
    api.put('/auth/profile', data),
  changePassword: (currentPassword: string, newPassword: string) => 
    api.put('/auth/password', { currentPassword, newPassword }),
};

// Customers API
export const customersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) => 
    api.get('/customers', { params }),
  get: (id: string) => api.get(`/customers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/customers', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/customers/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportTemplate: () => api.get('/customers/export/template', { responseType: 'blob' }),
};

// Categories API
export const categoriesApi = {
  list: () => api.get('/categories'),
  get: (id: string) => api.get(`/categories/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/categories', data),
  update: (id: string, data: { name: string; description?: string }) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Items API
export const itemsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; categoryId?: string }) => 
    api.get('/items', { params }),
  get: (id: string) => api.get(`/items/${id}`),
  create: (data: Record<string, unknown>) => api.post('/items', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/items/${id}`, data),
  delete: (id: string) => api.delete(`/items/${id}`),
  toggle: (id: string) => api.patch(`/items/${id}/toggle`),
};

// Suppliers API
export const suppliersApi = {
  list: (params?: { search?: string }) => api.get('/suppliers', { params }),
  get: (id: string) => api.get(`/suppliers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/suppliers', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/suppliers/${id}`),
};

// Materials API
export const materialsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; type?: string; supplierId?: string }) => 
    api.get('/materials', { params }),
  get: (id: string) => api.get(`/materials/${id}`),
  create: (data: Record<string, unknown>) => api.post('/materials', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/materials/${id}`, data),
  delete: (id: string) => api.delete(`/materials/${id}`),
  import: (file: File, supplierId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (supplierId) formData.append('supplierId', supplierId);
    return api.post('/materials/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportTemplate: () => api.get('/materials/export/template', { responseType: 'blob' }),
  types: () => api.get('/materials/types'),
  toggleStock: (id: string, inStock?: boolean) => api.patch(`/materials/${id}/stock`, { inStock }),
};

// Quotes API
export const quotesApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; customerId?: string }) => 
    api.get('/quotes', { params }),
  get: (id: string) => api.get(`/quotes/${id}`),
  create: (data: Record<string, unknown>) => api.post('/quotes', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/quotes/${id}`, data),
  delete: (id: string) => api.delete(`/quotes/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/quotes/${id}/status`, { status }),
  duplicate: (id: string) => api.post(`/quotes/${id}/duplicate`),
  getPdf: (id: string) => api.get(`/quotes/${id}/pdf`, { responseType: 'blob' }),
  // Quote items
  addItem: (quoteId: string, data: Record<string, unknown>) => 
    api.post(`/quotes/${quoteId}/items`, data),
  updateItem: (quoteId: string, itemId: string, data: Record<string, unknown>) => 
    api.put(`/quotes/${quoteId}/items/${itemId}`, data),
  deleteItem: (quoteId: string, itemId: string) => 
    api.delete(`/quotes/${quoteId}/items/${itemId}`),
  // Versions
  getVersions: (id: string) => api.get(`/quotes/${id}/versions`),
  restoreVersion: (id: string, versionNum: number) => 
    api.post(`/quotes/${id}/restore/${versionNum}`),
};

// Prices API
export const pricesApi = {
  getMetals: () => api.get('/prices/metals'),
  getMetal: (type: string, karat?: number) => 
    api.get(`/prices/metals/${type}`, { params: { karat } }),
  getExchangeRates: () => api.get('/prices/exchange'),
  getExchangeRate: (from: string, to: string) => 
    api.get(`/prices/exchange/${from}/${to}`),
  refresh: () => api.post('/prices/refresh'),
  calculate: (metalType: string, grams: number, karat?: number) => 
    api.get('/prices/calculate', { params: { metalType, grams, karat } }),
  convert: (amount: number, from: string, to: string) => 
    api.get('/prices/convert', { params: { amount, from, to } }),
  getConfig: () => api.get('/prices/config'),
};

// Settings API
export const settingsApi = {
  getAll: () => api.get('/settings'),
  get: (key: string) => api.get(`/settings/${key}`),
  update: (key: string, value: string) => api.put(`/settings/${key}`, { value }),
  updateAll: (settings: Record<string, string>) => api.put('/settings', settings),
  reset: () => api.post('/settings/reset'),
  getDefaults: () => api.get('/settings/defaults/list'),
};

export default api;