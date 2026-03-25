/**
 * ZapOut API Client - Centralized API calls with error handling
 * Following fullstack-dev: Typed fetch wrapper with automatic auth token
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(status, body) {
    const message = body?.error?.message || body?.detail || `API Error ${status}`;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error?.code || 'UNKNOWN';
    this.details = body?.error?.details || {};
  }
}

/**
 * Get user-friendly error message from API error
 */
export function getErrorMessage(error) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return 'Ungültige Anfrage. Bitte überprüfe deine Eingabe.';
      case 401:
        return 'Nicht angemeldet. Bitte neu einloggen.';
      case 403:
        return 'Keine Berechtigung für diese Aktion.';
      case 404:
        return 'Ressource nicht gefunden.';
      case 409:
        return 'Konflikt mit bestehenden Daten.';
      case 422:
        if (error.details?.field_errors?.length) {
          return error.details.field_errors.map(f => f.message || f.field).join('. ');
        }
        return 'Validierungsfehler. Bitte überprüfe deine Eingabe.';
      case 429:
        return 'Zu viele Anfragen. Bitte kurz warten.';
      case 500:
        return 'Serverfehler. Bitte später erneut versuchen.';
      case 502:
        return 'Externer Service nicht verfügbar.';
      default:
        return error.message || 'Ein Fehler ist aufgetreten.';
    }
  }

  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return 'Keine Verbindung zum Server. Prüfe deine Internetverbindung.';
  }

  if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
    return 'Netzwerkfehler. Bitte erneut versuchen.';
  }

  return 'Ein unerwarteter Fehler ist aufgetreten.';
}

/**
 * Get auth token from storage
 */
function getAuthToken() {
  return localStorage.getItem('zapout_token');
}

/**
 * Core API fetch function
 */
async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle no content
  if (response.status === 204) {
    return undefined;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body;
}

/**
 * API Client methods
 */
export const api = {
  // Auth
  login: (email, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (email, password) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),

  // Payments
  getPayments: () => apiFetch('/payments'),

  createPayment: (amount, description) =>
    apiFetch('/payments', {
      method: 'POST',
      body: JSON.stringify({ amount_cents: amount, description }),
    }),

  getPayment: id => apiFetch(`/payments/${id}`),

  // Cashu
  getCashuBalance: () => apiFetch('/cashu/balance'),

  getMints: () => apiFetch('/cashu/mints'),

  addMint: url => apiFetch('/cashu/mints', { method: 'POST', body: JSON.stringify({ url }) }),

  removeMint: url => apiFetch(`/cashu/mints?url=${encodeURIComponent(url)}`, { method: 'DELETE' }),

  // Products
  getProducts: () => apiFetch('/products'),

  createProduct: product =>
    apiFetch('/products', { method: 'POST', body: JSON.stringify(product) }),

  updateProduct: (id, product) =>
    apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),

  deleteProduct: id => apiFetch(`/products/${id}`, { method: 'DELETE' }),

  // Cart
  getCart: () => apiFetch('/cart'),

  addToCart: item => apiFetch('/cart/items', { method: 'POST', body: JSON.stringify(item) }),

  updateCartItem: (itemId, quantity) =>
    apiFetch(`/cart/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),

  removeCartItem: itemId => apiFetch(`/cart/items/${itemId}`, { method: 'DELETE' }),

  clearCart: () => apiFetch('/cart', { method: 'DELETE' }),

  checkout: () => apiFetch('/cart/checkout', { method: 'POST' }),

  // Lightning
  getLightningStatus: () => apiFetch('/lightning/status'),

  // BTC Price
  getBtcPrice: () => apiFetch('/btc/price'),
};

export { API_URL };
