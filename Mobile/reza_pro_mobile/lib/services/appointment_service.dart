import 'api_client.dart';
import '../mock_data.dart';
import 'session_store.dart';

class AppointmentService {
  Future<List<Map<String, dynamic>>> list({
    String? startDate,
    String? endDate,
    String? employeeId,
    String? status,
    int page = 1,
    int limit = 100,
  }) async {
    if (useMockData) {
      final sessionUser = await sessionStore.getUser();
      var data = getMockAppointments(sessionUser?.tenantId,
          startDate: startDate, endDate: endDate);

      // Filter by employeeId if provided
      if (employeeId != null && employeeId.isNotEmpty) {
        data = data.where((apt) => apt['employeeId'] == employeeId).toList();
      }

      // Filter by status if provided
      if (status != null && status.isNotEmpty) {
        data = data.where((apt) => apt['status'] == status).toList();
      }

      return data;
    }

    final res = await apiClient.get('/appointments', query: {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (employeeId != null && employeeId.isNotEmpty) 'employeeId': employeeId,
      if (status != null && status.isNotEmpty) 'status': status,
      'page': '$page',
      'limit': '$limit',
    });
    return List<Map<String, dynamic>>.from((res['appointments'] as List?) ?? []);
  }

  Future<Map<String, dynamic>> planAppointment(Map<String, dynamic> params) async {
    if (useMockData) {
      return {
        'alerts': [],
        'services': [],
        'recommendedAssignment': [],
        'estimatedEndTime': params['startTime'],
      };
    }
    final res = await apiClient.post('/appointments/plan', params);
    return res;
  }

  Future<Map<String, dynamic>> clientDiagnostics(Map<String, dynamic> params) async {
    if (useMockData) return {};
    return await apiClient.post('/appointments/client-diagnostics', params);
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> data) async {
    if (useMockData) {
      return {
        'id': generateId(),
        ...data,
      };
    }

    final res = await apiClient.post('/appointments', data);
    return Map<String, dynamic>.from(res['appointment'] as Map? ?? res);
  }

  Future<Map<String, dynamic>> update(String id, Map<String, dynamic> data) async {
    if (useMockData) {
      // For mock, just return the updated data
      return {
        'id': id,
        ...data,
      };
    }

    final res = await apiClient.put('/appointments/$id', data);
    return Map<String, dynamic>.from(res['appointment'] as Map? ?? res);
  }

  Future<void> delete(String id) async {
    if (!useMockData) {
      await apiClient.delete('/appointments/$id');
    }
  }
}

final appointmentService = AppointmentService();
