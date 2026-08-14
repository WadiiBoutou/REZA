/**
 * API Client for RezaPro Backend
 * Handles all API communication with the backend
 */

// Ensure API_BASE_URL always ends with /api
const getApiBaseUrl = () => {
  // In browser, check if we should use relative URLs (for Next.js rewrites)
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    const currentOrigin = window.location.origin;
    
    // If no explicit backend URL is set, use relative URL so Next.js rewrite can handle it
    if (!envUrl) {
      return '/api';
    }
    
    // Check if backend URL is on the same origin (for Next.js rewrites to work)
    try {
      const envUrlObj = new URL(envUrl);
      
      // If same origin, use relative URL for rewrite to work
      if (envUrlObj.origin === currentOrigin) {
        return '/api';
      }
      
      // Local backend URL from any localhost frontend port → use relative so Next rewrite proxies
      if (
        (envUrl === 'http://localhost:5000/api' || envUrl === 'http://127.0.0.1:5000/api') &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(currentOrigin)
      ) {
        return '/api';
      }
    } catch (e) {
      // If URL parsing fails, fall through to absolute URL
    }
  }
  
  // For server-side or different origin, use absolute URL
  const url = process.env.NEXT_PUBLIC_API_URL || 'https://api.reza.ma/api';
  // Remove trailing slash if present
  const cleanUrl = url.replace(/\/$/, '');
  // Ensure /api suffix is present
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Human-friendly French message for common HTTP statuses, used when the
 * server returns a non-JSON body (HTML error page from a proxy, a deploy
 * swap, etc.) so users never see raw parse errors like "Unexpected token '<'".
 */
function friendlyHttpMessage(status: number, fallback: string): string {
  if (status === 401) return 'Session expirée. Veuillez vous reconnecter.';
  if (status === 403) return "Accès refusé. Vous n'avez pas la permission d'effectuer cette action.";
  if (status === 404) return 'Ressource introuvable. Vérifiez que le lien est correct.';
  if (status === 408) return 'La requête a expiré. Veuillez réessayer.';
  if (status === 429) return 'Trop de requêtes. Veuillez réessayer dans quelques instants.';
  if (status === 500) return 'Erreur serveur. Veuillez réessayer dans quelques instants.';
  if (status === 502 || status === 503 || status === 504) return 'Le service est temporairement indisponible. Veuillez réessayer.';
  return fallback;
}

/**
 * Safely turn a non-OK response into an Error. Reads the body as text, parses
 * JSON when possible (backend errors), and falls back to a clean French
 * message when the body is HTML or unreadable. Never leaks parse exceptions.
 */
async function errorFromResponse(response: Response, fallback: string): Promise<Error> {
  const status = response.status;
  try {
    const text = await response.text();
    if (text && text.trim()) {
      try {
        const data = JSON.parse(text);
        const msg = data && (typeof data.message === 'string' ? data.message : (typeof data.error === 'string' ? data.error : ''));
        if (msg) return new Error(msg);
        return new Error(friendlyHttpMessage(status, fallback));
      } catch {
        // Non-JSON body (HTML etc.) — never surface it raw.
        return new Error(friendlyHttpMessage(status, fallback));
      }
    }
  } catch {
    // Body unreadable
  }
  return new Error(friendlyHttpMessage(status, fallback));
}

type PlanAlert = {
  severity: 'conflict' | 'warning' | 'info';
  type: string;
  message: string;
};

export interface ApiError {
  error: string;
  message: string;
}


class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  /** 'all' or concrete salon tenant ids for X-Salon-Ids */
  private salonFilter: 'all' | string[] = 'all';

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
      try {
        const raw = localStorage.getItem('activeSalonIds');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            if (parsed.length === 1 && parsed[0] === 'all') this.salonFilter = 'all';
            else if (parsed.every((x: unknown) => typeof x === 'string')) {
              this.salonFilter = parsed as string[];
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  setSalonFilter(filter: 'all' | string[]) {
    this.salonFilter = filter === 'all' || filter.length === 0 ? 'all' : filter;
  }

  getSalonFilter(): 'all' | string[] {
    return this.salonFilter;
  }

  private salonHeaders(salonIds?: string | string[]): Record<string, string> | undefined {
    if (!salonIds) return undefined;
    const ids = Array.isArray(salonIds) ? salonIds : [salonIds];
    if (ids.length === 0) return undefined;
    return { 'X-Salon-Ids': ids.join(',') };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Always refresh token from localStorage on each request to ensure it's up to date
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      if (storedToken !== this.token) {
        this.token = storedToken;
      }
    }
    
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Get current token (always check localStorage to ensure it's fresh)
    let currentToken: string | null = null;
    if (typeof window !== 'undefined') {
      currentToken = localStorage.getItem('token');
      // Update instance token if different
      if (currentToken !== this.token) {
        this.token = currentToken;
      }
    } else {
      currentToken = this.token;
    }
    
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    } else {
      // Only log warning for non-auth endpoints to avoid spam
      if (!endpoint.includes('/auth/')) {
        console.error(`[API] No token found for request to: ${endpoint}. Please log in again.`);
        console.error(`[API] localStorage.getItem('token'):`, typeof window !== 'undefined' ? localStorage.getItem('token') : 'N/A');
      }
    }

    // Multi-salon filter (skip auth/public paths)
    if (
      currentToken &&
      !endpoint.startsWith('/auth/') &&
      !endpoint.startsWith('/public/') &&
      !headers['X-Salon-Ids']
    ) {
      if (this.salonFilter === 'all') {
        headers['X-Salon-Ids'] = 'all';
      } else if (Array.isArray(this.salonFilter) && this.salonFilter.length > 0) {
        headers['X-Salon-Ids'] = this.salonFilter.join(',');
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (fetchError: any) {
      // Handle network errors (CORS, connection refused, etc.)
      const networkError = new Error(
        fetchError?.message || 'Network error: Unable to connect to server. Please check if the server is running.'
      ) as any;
      networkError.name = fetchError?.name || 'NetworkError';
      networkError.status = 0;
      networkError.statusText = 'Network Error';
      networkError.originalError = fetchError;
      throw networkError;
    }

    // Clone response for error handling (response body can only be read once)
    const responseClone = response.clone();
    
    if (!response.ok) {
      // If unauthorized, clear token (but only if we had a token to begin with)
      if (response.status === 401) {
        // Don't clear token on login/register attempts – there's no session to invalidate
        const isAuthAttempt = endpoint === '/auth/login' || endpoint === '/auth/register';
        if (!isAuthAttempt && (this.token || (typeof window !== 'undefined' && localStorage.getItem('token')))) {
          console.warn('Token expired or invalid, clearing authentication');
          this.setToken(null);
        }
        // Don't redirect automatically - let the app handle it
      }
      
      let errorMessage: string = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        // Try to get error message from response
        const contentType = responseClone.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await responseClone.json();
          // Handle different error response formats
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          } else if (errorData?.error) {
            errorMessage = errorData.error;
          } else if (errorData?.errors && Array.isArray(errorData.errors)) {
            errorMessage = errorData.errors.map((e: any) => e.message || e).join(', ');
          }
        } else {
          // Try to get text response
          const text = await responseClone.text();
          if (text && text.trim()) {
            errorMessage = text.trim().startsWith('<') ? friendlyHttpMessage(response.status, errorMessage) : text;
          }
        }
      } catch (parseError) {
        // If parsing fails, use default message
        console.error('Error parsing error response:', parseError);
        errorMessage = friendlyHttpMessage(response.status, errorMessage);
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).statusText = response.statusText;
      throw error;
    }

    // Handle successful responses
    const contentType = response.headers.get('content-type');
    
    // Handle empty responses (204 No Content, etc.)
    if (response.status === 204 || !contentType) {
      return {} as T;
    }
    
    // Parse JSON response
    if (contentType.includes('application/json')) {
      const text = await response.text();
      if (!text || text.trim() === '') {
        return {} as T;
      }
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error('Invalid JSON response from server');
      }
    }
    
    // For other content types, return empty object
    return {} as T;
  }

  // Auth endpoints
  async login(email: string, password: string) {
    try {
      const data = await this.request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.token) {
        this.setToken(data.token);
      } else {
        console.error('[API] No token in login response!', data);
      }
      return data;
    } catch (error: any) {
      // Use console.warn (not console.error) to avoid triggering Next.js error overlay
      // for expected auth failures like wrong credentials
      const errorInfo: any = {
        type: error?.constructor?.name || typeof error,
        message: error?.message || String(error),
        status: error?.status,
        statusText: error?.statusText,
      };
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorInfo.networkError = true;
        errorInfo.details = 'Network error - check if server is running and CORS is configured';
      }
      
      console.warn('[API] Login failed:', errorInfo);
      
      throw error;
    }
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    tenantId?: string;
    createTenant?: boolean;
    tenantName?: string;
    tenantEmail?: string;
    tenantCity?: string;
    avatar?: string;
  }) {
    const data = await this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    this.setToken(data.token);
    return data;
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  async uploadAuthAvatar(file: File) {
    const formData = new FormData();
    formData.append('avatar', file);
    const url = `${this.baseURL}/auth/upload-avatar`;
    const headers: HeadersInit = {};
    const currentToken = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    const response = await fetch(url, { method: 'POST', headers, body: formData });
    if (!response.ok) {
      throw await errorFromResponse(response, 'Impossible de téléverser la photo de profil');
    }
    return response.json() as Promise<{ avatar: string }>;
  }

  async updateAuthProfile(data: { firstName?: string; lastName?: string; phone?: string }) {
    return this.request<{ user: any }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async sendPasswordCode(currentPassword: string) {
    return this.request<{ message: string }>('/auth/send-password-code', {
      method: 'POST',
      body: JSON.stringify({ currentPassword }),
    });
  }

  async changePassword(code: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ code, newPassword }),
    });
  }

  async logout() {
    await this.request('/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  // Multi-salon endpoints
  async getSalons() {
    return this.request<{
      salons: {
        id: string;
        name: string;
        email?: string;
        phone?: string | null;
        address?: string | null;
        city: string | null;
        category?: string | null;
        shortDescription?: string | null;
        coverImage?: string | null;
        subscriptionActive: boolean;
      }[];
      salonLimit: number;
      subscription: any;
      account: { id: string; isActive: boolean } | null;
    }>('/salons');
  }

  private async salonMultipart(
    method: 'POST' | 'PATCH',
    path: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      category?: string;
      shortDescription?: string;
      coverImage?: File;
      latitude?: number;
      longitude?: number;
    },
    failMessage: string
  ) {
    const formData = new FormData();
    if (data.name !== undefined) formData.append('name', data.name);
    if (data.email !== undefined) formData.append('email', data.email);
    if (data.phone !== undefined) formData.append('phone', data.phone);
    if (data.city !== undefined) formData.append('city', data.city);
    if (data.category !== undefined) formData.append('category', data.category);
    if (data.shortDescription !== undefined) formData.append('shortDescription', data.shortDescription);
    if (data.address !== undefined) formData.append('address', data.address);
    if (data.latitude !== undefined) formData.append('latitude', String(data.latitude));
    if (data.longitude !== undefined) formData.append('longitude', String(data.longitude));
    if (data.coverImage) formData.append('coverImage', data.coverImage);

    const url = `${this.baseURL}${path}`;
    const headers: HeadersInit = {};
    const currentToken = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw await errorFromResponse(response, failMessage);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Réponse du serveur invalide. Veuillez réessayer.');
    }
  }

  async createSalon(data: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    city: string;
    category: string;
    shortDescription: string;
    coverImage: File;
    latitude: number;
    longitude: number;
  }) {
    return this.salonMultipart('POST', '/salons', data, 'Impossible de créer le salon') as Promise<{
      salon: {
        id: string;
        name: string;
        city: string | null;
        subscriptionActive: boolean;
        coverImage?: string | null;
        latitude?: number | null;
        longitude?: number | null;
      };
    }>;
  }

  async updateSalon(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      category?: string;
      shortDescription?: string;
      coverImage?: File;
      latitude?: number;
      longitude?: number;
    }
  ) {
    return this.salonMultipart('PATCH', `/salons/${id}`, data, 'Impossible de mettre à jour le salon') as Promise<{
      salon: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        address: string | null;
        city: string | null;
        category: string | null;
        shortDescription: string | null;
        coverImage: string | null;
        subscriptionActive: boolean;
        latitude: number | null;
        longitude: number | null;
      };
    }>;
  }

  async deleteSalon(id: string) {
    return this.request<{
      success: boolean;
      softDeleted: boolean;
      salons: any[];
      salonLimit: number;
      subscription: any;
      account: any;
      activeTenantId?: string;
      token?: string;
      switchedTo?: { id: string; name: string };
    }>(`/salons/${id}`, { method: 'DELETE' });
  }

  /** Switch active salon: backend re-issues a token scoped to that salon. */
  async switchSalon(tenantId: string) {
    const data = await this.request<{ token: string; user: any; salons: any[]; activeTenantId: string; subscription: any; salonLimit: number }>(
      '/auth/switch-salon',
      { method: 'POST', body: JSON.stringify({ tenantId }) }
    );
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  // Subscription endpoints (virement billing)
  /** Full billing overview: config, live bill, salon coverage, payment history. */
  async getBillingOverview() {
    return this.request<{
      account: any;
      subscription: any;
      bill: any;
      salons: any[];
      payments: any[];
    }>('/subscription');
  }

  /** Minimal subscription info for auth context. */
  async getSubscription() {
    return this.request<{ account: any; subscription: any }>('/subscription');
  }

  /** Declare a virement payment for the current bill. */
  async declarePayment(input: { amount?: number; reference?: string; payerName?: string; salonIds?: string[] } = {}) {
    return this.request<{ payment: { id: string; amount: number; status: string; createdAt: string } }>(
      '/subscription/declare-payment',
      { method: 'POST', body: JSON.stringify(input) }
    );
  }

  /** Payment history for the account owner. */
  async getPayments() {
    return this.request<{ payments: any[] }>('/subscription/payments');
  }

  /** Subscription invoice history (SUBSCRIPTION-type invoices for this account). */
  async getSubscriptionInvoices() {
    return this.request<{ invoices: any[] }>('/tenant/subscription-invoices');
  }

  // Superadmin endpoints
  async superAdminGetAccounts(params?: { page?: number; limit?: number; q?: string }) {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.q) qs.set('q', params.q);
    const query = qs.toString();
    return this.request<{
      accounts: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/superadmin/accounts${query ? `?${query}` : ''}`);
  }

  async superAdminUpdateAccount(
    accountId: string,
    data: {
      isActive?: boolean;
      subscriptionStatus?: 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
      currentPeriodEnd?: string | null;
    }
  ) {
    return this.request<{ success: boolean }>(`/superadmin/accounts/${accountId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async superAdminGetBillingConfig() {
    return this.request<{ config: any }>('/superadmin/billing-config');
  }

  async superAdminUpdateBillingConfig(data: {
    pricePerSalon?: number;
    freeEmployeeThreshold?: number;
    pricePerEmployee?: number;
    employeeTiers?: { min: number; max: number | null; price: number }[] | null;
    currency?: string;
  }) {
    return this.request<{ config: any }>('/superadmin/billing-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async superAdminGetPayments(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const qs = status ? `?status=${status}` : '';
    return this.request<{ payments: any[]; total: number }>(`/superadmin/payments${qs}`);
  }

  async superAdminApprovePayment(paymentId: string) {
    return this.request<{ success: boolean }>(`/superadmin/payments/${paymentId}/approve`, {
      method: 'POST',
    });
  }

  async superAdminRejectPayment(paymentId: string, reason?: string) {
    return this.request<{ success: boolean }>(`/superadmin/payments/${paymentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /** Superadmin notifications (tenant-less; PAYMENT_DECLARED etc.). */
  async superAdminGetNotifications(params?: { unreadOnly?: boolean; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.append('unreadOnly', 'true');
    if (params?.limit) query.append('limit', String(params.limit));
    const qs = query.toString();
    return this.request<{ notifications: any[]; unreadCount: number }>(
      `/superadmin/notifications${qs ? `?${qs}` : ''}`
    );
  }

  async superAdminMarkNotificationRead(notificationId: string) {
    return this.request<{ success: boolean }>(`/superadmin/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  async superAdminMarkAllNotificationsRead() {
    return this.request<{ success: boolean }>('/superadmin/notifications/read-all', {
      method: 'PATCH',
    });
  }

  async verifyEmail(token: string, email: string) {
    return this.request<{
      token?: string;
      user?: any;
      message: string;
      emailVerified: boolean;
      salons?: any[];
      activeTenantId?: string | null;
      subscription?: any;
      salonLimit?: number;
    }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token, email }),
    });
  }

  async resendVerificationEmail(email: string) {
    return this.request<{ message: string }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Client endpoints
  async getClients(
    params?: { search?: string; status?: string; page?: number; limit?: number },
    opts?: { salonIds?: string | string[] }
  ) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.request<any>(`/clients?${query.toString()}`, {
      headers: this.salonHeaders(opts?.salonIds),
    });
  }

  async getClient(id: string) {
    return this.request<any>(`/clients/${id}`);
  }

  async createClient(clientData: any) {
    return this.request<any>('/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
  }

  async updateClient(id: string, clientData: any) {
    return this.request<any>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData),
    });
  }

  async deleteClient(id: string) {
    return this.request<any>(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  // Duplicate detection and merging
  async getDuplicateClients() {
    return this.request<any>('/clients/duplicates');
  }

  async mergeClients(primaryClientId: string, duplicateClientIds: string[], fields?: Record<string, any>) {
    return this.request<any>('/clients/merge', {
      method: 'POST',
      body: JSON.stringify({ primaryClientId, duplicateClientIds, fields }),
    });
  }

  async getTopClients(params?: {
    limit?: number;
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    return this.request<any>(`/stats/clients/top?${query.toString()}`);
  }

  async getNewClientsStats(params?: {
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    return this.request<any>(`/stats/clients/new?${query.toString()}`);
  }

  async getClientFrequencyStats(params?: {
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    return this.request<any>(`/stats/clients/frequency?${query.toString()}`);
  }

  // Service endpoints
  async getServices(
    params?: { category?: string; search?: string },
    opts?: { salonIds?: string | string[] }
  ) {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    const queryString = query.toString();
    return this.request<any>(`/services${queryString ? `?${queryString}` : ''}`, {
      headers: this.salonHeaders(opts?.salonIds),
    });
  }

  async updateCategories(
    categories: string[],
    opts?: { salonIds?: string | string[] }
  ) {
    return this.request<any>('/services/categories', {
      method: 'PUT',
      body: JSON.stringify({ categories }),
      headers: this.salonHeaders(opts?.salonIds),
    });
  }

  async getService(id: string) {
    return this.request<any>(`/services/${id}`);
  }

  async createService(serviceData: any) {
    return this.request<any>('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  }

  async updateService(id: string, serviceData: any) {
    return this.request<any>(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData),
    });
  }

  async deleteService(id: string) {
    return this.request<any>(`/services/${id}`, {
      method: 'DELETE',
    });
  }

  // Employee endpoints
  async getEmployees(
    params?: { active?: boolean; search?: string },
    opts?: { salonIds?: string | string[] }
  ) {
    const query = new URLSearchParams();
    if (params?.active !== undefined) query.append('active', params.active.toString());
    if (params?.search) query.append('search', params.search);
    return this.request<any>(`/employees?${query.toString()}`, {
      headers: this.salonHeaders(opts?.salonIds),
    });
  }

  async getEmployee(id: string) {
    return this.request<any>(`/employees/${id}`);
  }

  async createEmployee(employeeData: any) {
    return this.request<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
  }

  async updateEmployee(id: string, employeeData: any) {
    return this.request<any>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
  }

  async deleteEmployee(id: string) {
    return this.request<any>(`/employees/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadEmployeeAvatar(file: File): Promise<{ avatar: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    const url = `${this.baseURL}/employees/upload-avatar`;
    const headers: HeadersInit = {};

    const currentToken = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw await errorFromResponse(response, "Erreur lors de l'upload de la photo");
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Réponse du serveur invalide. Veuillez réessayer.');
    }
  }

  async uploadClientAvatar(file: File): Promise<{ avatar: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    const url = `${this.baseURL}/clients/upload-avatar`;
    const headers: HeadersInit = {};

    const currentToken = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw await errorFromResponse(response, "Erreur lors de l'upload de la photo");
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Réponse du serveur invalide. Veuillez réessayer.');
    }
  }

  // Appointment endpoints
  async getAppointments(params?: {
    startDate?: string;
    endDate?: string;
    cancelledStartDate?: string;
    cancelledEndDate?: string;
    clientId?: string;
    employeeId?: string;
    serviceId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.cancelledStartDate) query.append('cancelledStartDate', params.cancelledStartDate);
    if (params?.cancelledEndDate) query.append('cancelledEndDate', params.cancelledEndDate);
    if (params?.clientId) query.append('clientId', params.clientId);
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    if (params?.serviceId) query.append('serviceId', params.serviceId);
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.request<any>(`/appointments?${query.toString()}`);
  }

  async getAppointment(id: string) {
    return this.request<any>(`/appointments/${id}`);
  }

  async planAppointment(params: {
    serviceIds: string[];
    date: string;
    startTime: string;
    clientId?: string;
    tenantId?: string;
    assignments?: { serviceId: string; employeeId: string | null }[];
  }) {
    return this.request<any>('/appointments/plan', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async clientDiagnostics(params: { date: string; startTime: string; estimatedDuration?: number; tenantId?: string }) {
    return this.request<{ clientAlerts: Record<string, PlanAlert[]> }>('/appointments/client-diagnostics', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createAppointment(appointmentData: any) {
    return this.request<any>('/appointments', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    });
  }

  async updateAppointment(id: string, appointmentData: any) {
    return this.request<any>(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(appointmentData),
    });
  }

  /**
   * Dry-run validation for a drag-drop move. Checks client double-bookings,
   * per-employee windows and business hours WITHOUT writing anything.
   * Returns { conflicts: string[] } — empty array = safe to move.
   */
  async validateMove(id: string, data: { startTime: string; tenantId?: string }) {
    return this.request<{ conflicts: string[] }>(`/appointments/${id}/validate-move`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAppointment(id: string) {
    return this.request<any>(`/appointments/${id}`, {
      method: 'DELETE',
    });
  }

  // Invoice endpoints
  async getInvoices(params?: {
    clientId?: string;
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.clientId) query.append('clientId', params.clientId);
    if (params?.status) query.append('status', params.status);
    if (params?.type) query.append('type', params.type);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.request<any>(`/invoices?${query.toString()}`);
  }

  async getInvoice(id: string) {
    return this.request<any>(`/invoices/${id}`);
  }

  async createInvoice(invoiceData: any) {
    return this.request<any>('/invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    });
  }

  /** Flow A — Encaisser une vente (PAID invoice + service line items) */
  async createSale(saleData: {
    clientId: string;
    items: Array<{
      serviceId: string;
      price?: number;
      quantity?: number;
      /** Optional per-item employee assignment for manual caisse sales */
      employeeId?: string;
    }>;
    amount?: number;
    tax?: number;
    paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHECK' | 'ONLINE';
    notes?: string;
    tenantId?: string;
    appointmentId?: string;
  }) {
    return this.request<any>('/invoices/sale', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  }

  async createGroupSale(data: {
    bookingGroupId: string;
    payerParticipantId?: string;
    payerClientId?: string;
    paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHECK' | 'ONLINE';
    tax?: number;
    notes?: string;
    tenantId?: string;
  }) {
    return this.request<any>('/invoices/group-sale', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async separateGroupSale(data: {
    bookingGroupId: string;
    paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHECK' | 'ONLINE';
    tax?: number;
    tenantId?: string;
  }) {
    return this.request<any>('/invoices/separate-group-sale', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getGroupDetails(groupId: string) {
    return this.request<any>(`/invoices/group-details/${groupId}`);
  }

  async getPendingGroups() {
    return this.request<any>('/invoices/pending-groups');
  }

  async updateInvoice(id: string, invoiceData: any) {
    return this.request<any>(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(invoiceData),
    });
  }

  // Review endpoints
  async getReviews(params?: { status?: string; clientId?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.clientId) query.append('clientId', params.clientId);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.request<any>(`/reviews?${query.toString()}`);
  }

  async createReview(reviewData: any) {
    return this.request<any>('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData),
    });
  }

  async moderateReview(id: string, status: 'APPROVED' | 'REJECTED' | 'PENDING', rejectReason?: string) {
    return this.request<any>(`/reviews/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, ...(rejectReason ? { rejectReason } : {}) }),
    });
  }

  /** Permanently delete a review — backend restricts this to REJECTED reviews. */
  async deleteReview(id: string) {
    return this.request<{ success: boolean }>(`/reviews/${id}`, {
      method: 'DELETE',
    });
  }

  // Dashboard review endpoints
  async getApprovedReviews() {
    return this.request<any>('/dashboard/clients/mes-avis/avis-moderes');
  }

  async getRejectedReviews() {
    return this.request<any>('/dashboard/clients/mes-avis/avis-refuses');
  }

  async getReviewStatistics() {
    return this.request<any>('/dashboard/clients/statistiques/avis');
  }

  // Statistics endpoints
  async getStatsOverview(params?: { startDate?: string; endDate?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    return this.request<any>(`/stats/overview?${query.toString()}`);
  }

  async getAppointmentStats(params?: { startDate?: string; endDate?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    return this.request<any>(`/stats/appointments?${query.toString()}`);
  }

  async getRevenueStats(params?: { startDate?: string; endDate?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    return this.request<any>(`/stats/revenue?${query.toString()}`);
  }

  // Tenant endpoints
  async getTenant() {
    return this.request<any>('/tenant');
  }

  async updateTenant(tenantData: any) {
    return this.request<any>('/tenant', {
      method: 'PUT',
      body: JSON.stringify(tenantData),
    });
  }

  async uploadCoverImage(file: File): Promise<{ coverImage: string }> {
    const formData = new FormData();
    formData.append('coverImage', file);

    const url = `${this.baseURL}/tenant/upload-cover-image`;
    const headers: HeadersInit = {};

    // Get current token (refresh from localStorage if needed)
    const currentToken = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw await errorFromResponse(response, "Erreur lors de l'upload de l'image de couverture");
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Réponse du serveur invalide. Veuillez réessayer.');
    }
  }

  async uploadHeaderImage(file: File): Promise<{ headerImage: string }> {
    const formData = new FormData();
    formData.append('headerImage', file);

    const url = `${this.baseURL}/tenant/upload-header-image`;
    const headers: HeadersInit = {};

    // Get current token (refresh from localStorage if needed)
    const currentToken = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    } else {
      console.error('[API] No token found for header image upload!');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw await errorFromResponse(response, "Erreur lors de l'upload de l'image d'en-tête");
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Réponse du serveur invalide. Veuillez réessayer.');
    }
  }

  async getHeaderImage(): Promise<{ headerImage: string | null }> {
    try {
      // Use query parameter to prevent caching instead of headers (to avoid CORS issues)
      const cacheBuster = `?t=${Date.now()}`;
      const response = await this.request<{ headerImage: string | null }>(`/tenant/header-image${cacheBuster}`, {
        method: 'GET'
      });
      return response;
    } catch (error) {
      console.error('[API] getHeaderImage error:', error);
      console.error('[API] getHeaderImage error details:', {
        message: (error as any)?.message,
        status: (error as any)?.status,
        statusText: (error as any)?.statusText
      });
      throw error;
    }
  }

  async getTenantSettings() {
    return this.request<any>('/tenant/settings');
  }

  async updateTenantSettings(settings: any) {
    return this.request<any>('/tenant/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }


  // Appointment notification emails endpoints
  async getAppointmentNotificationEmails() {
    const response = await this.request<{ emails: string[] }>('/tenant/notifications/appointment-emails');
    return { emails: response.emails || [] };
  }

  async updateAppointmentNotificationEmails(emails: string[]) {
    return this.request<{ emails: string[] }>('/tenant/notifications/appointment-emails', {
      method: 'PUT',
      body: JSON.stringify({ emails }),
    });
  }

  // Notification endpoints
  async getNotifications(params?: { unreadOnly?: boolean; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.append('unreadOnly', 'true');
    if (params?.limit) query.append('limit', params.limit.toString());
    const queryString = query.toString();
    return this.request<{ notifications: any[]; grouped: any; unreadCount: number }>(
      `/notifications${queryString ? `?${queryString}` : ''}`
    );
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request<any>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request<{ success: boolean }>('/notifications/read-all', {
      method: 'PATCH',
    });
  }

  async deleteAllNotifications() {
    return this.request<{ success: boolean; deletedCount: number }>('/notifications', {
      method: 'DELETE',
    });
  }

  // Business hours and scheduling endpoints (pass salonIds to scope to one salon)
  async getBusinessHours(opts?: { salonIds?: string | string[] }) {
    return this.request<any>('/tenant/settings/business-hours', {
      headers: this.salonHeaders(opts?.salonIds),
    });
  }

  async updateBusinessHours(
    data: {
      onlineBooking?: 'open' | 'closed';
      schedules?: any[];
      exceptionalSchedules?: any[];
      agendaStart?: string;
      agendaEnd?: string;
      bookingDelay?: any;
      cancellationDelay?: any;
      advanceBooking?: any;
      blockedDates?: string[];
    },
    opts?: { salonIds?: string | string[] }
  ) {
    return this.request<any>('/tenant/settings/business-hours', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: this.salonHeaders(opts?.salonIds),
    });
  }


  // Dashboard statistics endpoints
  async getDashboardStats(params?: {
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    return this.request<any>(`/stats/dashboard?${query.toString()}`);
  }

  // Autres statistics endpoints
  async getAutresStats(params?: {
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    return this.request<any>(`/stats/autres?${query.toString()}`);
  }

  // Prestations statistics endpoints
  async getPrestationsStats(params?: {
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    return this.request<any>(`/stats/prestations?${query.toString()}`);
  }

  // Collaborateurs statistics endpoints
  async getCollaborateursStats(params?: {
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
    categoryId?: string;
    serviceId?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    if (params?.categoryId) query.append('categoryId', params.categoryId);
    if (params?.serviceId) query.append('serviceId', params.serviceId);
    return this.request<any>(`/stats/collaborateurs?${query.toString()}`);
  }

  // RDV daily statistics endpoints
  async getRdvStats(params?: {
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    return this.request<any>(`/stats/rdv?${query.toString()}`);
  }


  // Occupation statistics endpoints
  async getOccupationVueEnsemble(params?: {
    month?: number;
    year?: number;
    employeeId?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    return this.request<any>(`/stats/occupation/vue-ensemble?${query.toString()}`);
  }

  async getOccupationCollaborateurs(params?: {
    period?: 'week' | 'month' | 'year' | 'all';
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
    categoryId?: string;
    serviceId?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    if (params?.categoryId) query.append('categoryId', params.categoryId);
    if (params?.serviceId) query.append('serviceId', params.serviceId);
    return this.request<any>(`/stats/occupation/collaborateurs?${query.toString()}`);
  }

  async getOccupationPrestations(params?: {
    month?: number;
    year?: number;
    employeeId?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.month !== undefined) query.append('month', params.month.toString());
    if (params?.year !== undefined) query.append('year', params.year.toString());
    if (params?.employeeId) query.append('employeeId', params.employeeId);
    return this.request<any>(`/stats/occupation/prestations?${query.toString()}`);
  }

  // Accepted payment methods (simple text names for dropdowns)
  async getAcceptedPaymentMethods() {
    return this.request<{ methods: string[] }>('/tenant/settings/accepted-payment-methods');
  }

  async addAcceptedPaymentMethod(name: string) {
    return this.request<{ methods: string[] }>('/tenant/settings/accepted-payment-methods', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteAcceptedPaymentMethod(name: string) {
    return this.request<{ methods: string[] }>(`/tenant/settings/accepted-payment-methods/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  // Auto-confirm settings
  async getAutoConfirmSettings() {
    return this.request<{ enabled: boolean }>('/tenant/settings/auto-confirm');
  }

  async updateAutoConfirmSettings(enabled: boolean) {
    return this.request<{ enabled: boolean }>('/tenant/settings/auto-confirm', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  // Payment methods endpoints (bank instruments)
  async getPaymentMethods() {
    return this.request<any>('/tenant/payment-methods');
  }

  async addPaymentMethod(data: {
    type: 'moroccan_transfer' | 'card';
    iban?: string;
    cardNumber?: string;
    cardName?: string;
    cardExpiry?: string;
    cardCvc?: string;
    last4?: string;
  }) {
    return this.request<any>('/tenant/payment-methods', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePaymentMethod(id: string, data: { isDefault?: boolean }) {
    return this.request<any>(`/tenant/payment-methods/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePaymentMethod(id: string) {
    return this.request<any>(`/tenant/payment-methods/${id}`, {
      method: 'DELETE',
    });
  }

  async getAppointmentDisplaySettings() {
    return this.request<any>('/tenant/settings/appointment-display');
  }

  async updateAppointmentDisplaySettings(settings: { showColorInRDV: boolean; fields: any[] }) {
    return this.request<any>('/tenant/settings/appointment-display', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Cash Transaction endpoints
  async getCashTransactions(params?: {
    startDate?: string;
    endDate?: string;
    type?: 'DEPOSIT' | 'WITHDRAWAL' | 'REFUND' | 'all';
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.type && params.type !== 'all') query.append('type', params.type);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.request<any>(`/cash-transactions?${query.toString()}`);
  }

  async getCashTransaction(id: string) {
    return this.request<any>(`/cash-transactions/${id}`);
  }

  async createCashTransaction(transactionData: {
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'REFUND';
    amount: number;
    paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHECK' | 'ONLINE';
    notes?: string;
    tenantId?: string;
  }) {
    return this.request<any>('/cash-transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async deleteCashTransaction(id: string) {
    return this.request<any>(`/cash-transactions/${id}`, {
      method: 'DELETE',
    });
  }

  // Subscription invoices (SUBSCRIPTION type)

}

export const api = new ApiClient(API_BASE_URL);

