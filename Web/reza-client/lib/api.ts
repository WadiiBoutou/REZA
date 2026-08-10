const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/backend-api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      // Create error with the message from API
      const apiError = new Error(error.message || `HTTP error! status: ${response.status}`);
      // Store status code and full error data for better error handling
      (apiError as any).status = response.status;
      (apiError as any).statusText = response.statusText;
      (apiError as any).data = error;
      // Don't log expected client errors (4xx) as console errors
      // These are user input errors and should be displayed in UI only
      throw apiError;
    }

    return response.json();
  }

  // Public endpoints
  async getTenant(identifier: string) {
    return this.request<{ tenant: any }>(`/public/tenant/${identifier}`);
  }

  async getTenantServices(tenantId: string, category?: string) {
    const query = category ? `?category=${category}` : '';
    return this.request<{ services: any[] }>(`/public/tenant/${tenantId}/services${query}`);
  }

  async getTenantEmployees(tenantId: string) {
    return this.request<{ employees: any[] }>(`/public/tenant/${tenantId}/employees`);
  }

  async getTenantReviews(tenantId: string, page: number = 1, limit: number = 50) {
    return this.request<{ reviews: any[]; pagination: any; stats: any }>(
      `/public/tenant/${tenantId}/reviews?page=${page}&limit=${limit}`
    );
  }

  // Featured "elite" professionals across subscribed salons (homepage team section)
  async getFeaturedEmployees(limit: number = 8) {
    return this.request<{ employees: any[] }>(
      `/public/employees/featured?limit=${limit}`
    );
  }

  // Public pricing info (per-salon one-time fee + monthly employee tiers)
  async getPublicBillingConfig() {
    return this.request<{
      pricePerSalon: number;
      pricePerEmployee: number;
      currency: string;
      freeEmployeeThreshold: number;
      employeeTiers: { min: number; max: number | null; price: number }[] | null;
    }>(`/public/billing-config`);
  }

  async searchTenants(
    search?: string,
    category?: string,
    city?: string,
    limit: number = 50,
    geo?: { lat?: number; lng?: number; radiusKm?: number }
  ) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (city) params.append('city', city);
    if (geo?.lat != null) params.append('lat', String(geo.lat));
    if (geo?.lng != null) params.append('lng', String(geo.lng));
    if (geo?.radiusKm != null) params.append('radiusKm', String(geo.radiusKm));
    params.append('limit', limit.toString());
    return this.request<{ tenants: any[] }>(`/public/tenants?${params.toString()}`);
  }

  async getCategories() {
    return this.request<{ categories: any[] }>('/public/categories');
  }

  // Get unique cities from all tenants
  async getCities(category?: string) {
    const response = await this.searchTenants(undefined, category, undefined, 1000);
    const citiesMap = new Map<string, number>();
    
    (response.tenants || []).forEach((tenant: any) => {
      if (tenant.city) {
        const count = citiesMap.get(tenant.city) || 0;
        citiesMap.set(tenant.city, count + 1);
      }
    });
    
    return Array.from(citiesMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);
  }

  // Public booking endpoint
  async createBooking(data: {
    tenantId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    serviceIds: string[];
    startTime: string;
    employeeId?: string | null;
    /** Per-service employee assignment for the booker (when "Même employé" is unchecked). */
    serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>;
    notes?: string;
    participants?: Array<{
      name: string;
      clientId?: string;
      phone?: string;
      email?: string;
      sameServicesAsBooker?: boolean;
      serviceIds?: string[];
      employeeId?: string | null;
      /** Per-service employee assignment for this participant. */
      serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>;
      startTime?: string;
    }>;
    /** false = contact only; appointments for participants only */
    includeBooker?: boolean;
  }) {
    return this.request<{
      bookingGroup: any;
      appointments: any[];
      client: any;
      pricing: { participants: any[]; grandTotal: number };
    }>('/public/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get available time slots for a tenant
  async getAvailableSlots(
    tenantId: string,
    date: string,
    serviceIds: string[],
    employeeId?: string,
    existingParticipants?: Array<{
      serviceIds: string[];
      startTime: string;
      serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>;
    }>,
    clientEmail?: string,
    serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>,
  ) {
    const params = new URLSearchParams();
    params.append('date', date);
    serviceIds.forEach(id => params.append('serviceIds', id));
    if (employeeId) params.append('employeeId', employeeId);
    if (clientEmail) params.append('clientEmail', clientEmail);
    if (existingParticipants && existingParticipants.length > 0) {
      const serialized = JSON.stringify(existingParticipants);
      params.append('existingParticipants', serialized);
    }
    if (serviceEmployees && serviceEmployees.length > 0) {
      params.append('serviceEmployees', JSON.stringify(serviceEmployees));
    }
    return this.request<{ slots: string[] }>(`/public/tenant/${tenantId}/available-slots?${params.toString()}`);
  }

  // Check which days in a date range have at least 1 available slot (lightweight existence check)
  async getAvailableDays(tenantId: string, from: string, to: string, serviceIds: string[]) {
    const params = new URLSearchParams();
    params.append('from', from);
    params.append('to', to);
    serviceIds.forEach(id => params.append('serviceIds', id));
    return this.request<{ days: string[] }>(`/public/tenant/${tenantId}/available-days?${params.toString()}`);
  }

  // Get per-employee availability status for date + time + services
  async getEmployeeAvailability(tenantId: string, date: string, startTime: string, serviceIds: string[]) {
    const params = new URLSearchParams();
    params.append('date', date);
    params.append('startTime', startTime);
    serviceIds.forEach(id => params.append('serviceIds', id));
    return this.request<{
      employees: Array<{
        id: string;
        firstName: string;
        lastName: string;
        available: boolean;
        reason: string | null;
        recommended: boolean;
      }>;
      commonEmployeeIds: string[];
      services: Array<{
        serviceId: string;
        serviceName: string;
        employees: Array<{
          id: string;
          firstName: string;
          lastName: string;
          available: boolean;
          reason: string | null;
          recommended: boolean;
        }>;
      }>;
    }>(`/public/tenant/${tenantId}/employee-availability?${params.toString()}`);
  }

  // Resolve cross-participant conflicts via backend backtracking
  // Backend receives: date, changedParticipantIndex, selectedEmployeeId, participants[].currentEmployeeId
  async resolveConflicts(
    tenantId: string,
    date: string,
    changedParticipantIndex: number,
    selectedEmployeeId: string | null,
    participants: Array<{
      index: number;
      serviceIds: string[];
      startTime: string;
      duration: number;
      currentEmployeeId: string | null;
    }>,
  ) {
    return this.request<{
      resolved: boolean;
      conflict: boolean;
      message?: string;
      assignments?: Array<{
        index: number;
        employeeId: string;
        locked: boolean;
        autoAssigned: boolean;
      }>;
    }>(`/public/tenant/${tenantId}/resolve-conflicts`, {
      method: 'POST',
      body: JSON.stringify({ date, changedParticipantIndex, selectedEmployeeId, participants }),
    });
  }

  // Create a public review
  async createReview(data: {
    tenantId: string;
    appointmentId?: string;
    employeeId?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    rating: number;
    comment?: string;
  }) {
    return this.request<{ review: any; message: string }>('/public/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get client appointments by email
  async getClientAppointments(email: string, status?: string, limit: number = 100, sortBy?: 'createdAt' | 'startTime') {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    if (sortBy) params.append('sortBy', sortBy);
    return this.request<{ appointments: any[]; client: any }>(
      `/public/client/${encodeURIComponent(email)}/appointments?${params.toString()}`
    );
  }

  // Get client reviews by email
  async getClientReviews(email: string, limit: number = 50) {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    return this.request<{ reviews: any[] }>(
      `/public/client/${encodeURIComponent(email)}/reviews?${params.toString()}`
    );
  }

  // Update a review
  async updateReview(reviewId: string, data: {
    email: string;
    rating?: number;
    comment?: string;
    detailedRatings?: {
      quality: number;
      professionalism: number;
      cleanliness: number;
      value: number;
    };
  }) {
    return this.request<{ review: any; message: string }>(`/public/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Delete a review
  async deleteReview(reviewId: string, email: string) {
    const params = new URLSearchParams();
    params.append('email', email);
    return this.request<{ message: string }>(`/public/reviews/${reviewId}?${params.toString()}`, {
      method: 'DELETE',
    });
  }

  // Get client notifications by email
  async getClientNotifications(email: string, options?: { unreadOnly?: boolean; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.unreadOnly) params.append('unreadOnly', 'true');
    if (options?.limit) params.append('limit', options.limit.toString());
    const queryString = params.toString();
    return this.request<{ notifications: any[]; grouped: any; unreadCount: number }>(
      `/public/client/${encodeURIComponent(email)}/notifications${queryString ? `?${queryString}` : ''}`
    );
  }

  // Mark client notification as read
  async markClientNotificationAsRead(notificationId: string) {
    return this.request(`/public/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  // Family Members / Proches endpoints (public, use email only - no tenantId needed)
  async getClientFamilyMembers(email: string) {
    return this.request<{ familyMembers: any[] }>(
      `/public/client/${encodeURIComponent(email)}/family-members`
    );
  }

  async createFamilyMember(data: {
    clientEmail: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    relationship: string;
    avatar?: string;
  }) {
    return this.request<{ familyMember: any }>('/public/family-members', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateFamilyMember(id: string, data: {
    clientEmail: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    relationship?: string;
    avatar?: string;
  }) {
    return this.request<{ familyMember: any }>(`/public/family-members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteFamilyMember(id: string, clientEmail: string) {
    const params = new URLSearchParams();
    params.append('clientEmail', clientEmail);
    return this.request<{ message: string }>(`/public/family-members/${id}?${params.toString()}`, {
      method: 'DELETE'
    });
  }

  // Client authentication
  async clientLogin(email: string, password: string) {
    return this.request<{ client: any; message: string }>('/public/auth/client-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async clientRegister(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    return this.request<{ client: any; message: string }>('/public/auth/client-register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Client password reset
  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/public/auth/client-forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request<{ message: string }>('/public/auth/client-reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // Favorites endpoints
  async getClientFavorites(email: string) {
    return this.request<{ favorites: any[]; count: number }>(
      `/public/client/${encodeURIComponent(email)}/favorites`
    );
  }

  async addFavorite(clientEmail: string, tenantId: string) {
    return this.request<{ favorite: any; message: string }>('/public/favorites', {
      method: 'POST',
      body: JSON.stringify({ clientEmail, tenantId }),
    });
  }

  async removeFavorite(favoriteId: string, clientEmail: string) {
    const params = new URLSearchParams();
    params.append('clientEmail', clientEmail);
    return this.request<{ message: string }>(`/public/favorites/${favoriteId}?${params.toString()}`, {
      method: 'DELETE',
    });
  }

  // Update client profile
  async updateClientProfile(email: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    avatar?: string | null;
  }) {
    return this.request<{ client: any; message: string }>(`/public/client/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Cancel an appointment
  async cancelAppointment(appointmentId: string, email: string) {
    return this.request<{ appointment: any; message: string }>(`/public/appointments/${appointmentId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ email }),
    });
  }

  // Change client password
  async changeClientPassword(email: string, data: {
    currentPassword: string;
    newPassword: string;
  }) {
    return this.request<{ message: string }>(`/public/client/${encodeURIComponent(email)}/change-password`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Newsletter subscription
  async subscribeToNewsletter(email: string) {
    return this.request<{ message: string; subscription?: any }>('/public/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async unsubscribeFromNewsletter(email: string) {
    return this.request<{ message: string }>('/public/newsletter/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
}

export const api = new ApiClient();
export default api;
