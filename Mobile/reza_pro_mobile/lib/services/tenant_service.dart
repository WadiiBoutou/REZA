import 'api_client.dart';
import '../mock_data.dart';
import 'session_store.dart';

class TenantService {
  Future<Map<String, dynamic>> getTenant() async {
    if (useMockData) {
      final sessionUser = await sessionStore.getUser();
      final salon = mockSalons.firstWhere(
          (s) => s.id == sessionUser?.tenantId,
          orElse: () => mockSalons.first);
      return {
        'id': salon.id,
        'name': salon.name,
        'city': salon.city,
      };
    }

    final res = await apiClient.get('/tenant');
    return Map<String, dynamic>.from(res['tenant'] as Map? ?? res);
  }

  Future<Map<String, dynamic>> getSettings() async {
    if (useMockData) {
      return {
        'timezone': 'Africa/Casablanca',
        'currency': 'MAD',
        'language': 'fr',
      };
    }

    try {
      final res = await apiClient.get('/tenant/settings');
      return Map<String, dynamic>.from(res['settings'] as Map? ?? res);
    } catch (_) {
      return {};
    }
  }

  Future<Map<String, dynamic>> dashboardStats() async {
    if (useMockData) {
      return {
        'todayAppointments': 1,
        'totalRevenue': 140,
      };
    }

    try {
      return await apiClient.get('/stats/dashboard');
    } catch (_) {
      try {
        return await apiClient.get('/dashboard');
      } catch (_) {
        return {};
      }
    }
  }

  /// Business hours (agenda opening hours, online booking on/off…).
  Future<Map<String, dynamic>> getBusinessHours() async {
    if (useMockData) {
      return {
        'onlineBooking': 'open',
        'agendaStart': '08:00',
        'agendaEnd': '23:55',
      };
    }
    try {
      final res = await apiClient.get('/tenant/settings/business-hours');
      return Map<String, dynamic>.from(res['businessHours'] as Map? ?? res);
    } catch (_) {
      return {};
    }
  }

  Future<void> updateBusinessHours(Map<String, dynamic> data) async {
    if (useMockData) return;
    await apiClient.put('/tenant/settings/business-hours', data);
  }

  /// Auto-confirm setting for online bookings.
  Future<Map<String, dynamic>> getAutoConfirm() async {
    if (useMockData) return {'enabled': true};
    try {
      final res = await apiClient.get('/tenant/settings/auto-confirm');
      return Map<String, dynamic>.from(res);
    } catch (_) {
      return {'enabled': false};
    }
  }

  Future<void> setAutoConfirm(bool enabled) async {
    if (useMockData) return;
    await apiClient.put('/tenant/settings/auto-confirm', {'enabled': enabled});
  }

  /// Update salon general info (name, phone, email, address, website…).
  Future<Map<String, dynamic>> updateTenant(Map<String, dynamic> data) async {
    if (useMockData) return {};
    final res = await apiClient.put('/tenant', data);
    return Map<String, dynamic>.from(res['tenant'] as Map? ?? res);
  }
}

final tenantService = TenantService();
