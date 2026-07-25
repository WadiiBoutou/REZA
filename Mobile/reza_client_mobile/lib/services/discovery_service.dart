import 'api_client.dart';

class DiscoveryService {
  Future<List<Map<String, dynamic>>> searchTenants({
    String? search,
    String? category,
    String? city,
    double? lat,
    double? lng,
    double? radiusKm,
    int limit = 50,
  }) async {
    final q = <String, String>{'limit': '$limit'};
    if (search != null && search.isNotEmpty) q['search'] = search;
    if (category != null && category.isNotEmpty) q['category'] = category;
    if (city != null && city.isNotEmpty) q['city'] = city;
    if (lat != null) q['lat'] = '$lat';
    if (lng != null) q['lng'] = '$lng';
    if (radiusKm != null) q['radiusKm'] = '$radiusKm';
    final res = await apiClient.get('/public/tenants', query: q);
    return List<Map<String, dynamic>>.from((res['tenants'] as List?) ?? []);
  }

  Future<List<dynamic>> getCategories() async {
    final res = await apiClient.get('/public/categories');
    return (res['categories'] as List?) ?? [];
  }

  Future<Map<String, dynamic>> getTenant(String id) async {
    final res = await apiClient.get('/public/tenant/$id');
    return Map<String, dynamic>.from(res['tenant'] as Map);
  }

  Future<List<Map<String, dynamic>>> getServices(String tenantId) async {
    final res = await apiClient.get('/public/tenant/$tenantId/services');
    return List<Map<String, dynamic>>.from((res['services'] as List?) ?? []);
  }

  Future<List<Map<String, dynamic>>> getEmployees(String tenantId) async {
    final res = await apiClient.get('/public/tenant/$tenantId/employees');
    return List<Map<String, dynamic>>.from((res['employees'] as List?) ?? []);
  }

  Future<List<Map<String, dynamic>>> getReviews(String tenantId) async {
    final res = await apiClient.get(
      '/public/tenant/$tenantId/reviews',
      query: {'page': '1', 'limit': '50'},
    );
    return List<Map<String, dynamic>>.from((res['reviews'] as List?) ?? []);
  }

  Future<List<String>> getAvailableSlots({
    required String tenantId,
    required String date,
    required List<String> serviceIds,
  }) async {
    final qs = StringBuffer('date=${Uri.encodeQueryComponent(date)}');
    for (final id in serviceIds) {
      qs.write('&serviceIds=${Uri.encodeQueryComponent(id)}');
    }
    final res = await apiClient.get(
      '/public/tenant/$tenantId/available-slots?$qs',
    );
    return List<String>.from((res['slots'] as List?) ?? []);
  }

  /// Calls the backend employee-availability endpoint.
  /// Returns: { "employees": [...], "commonEmployeeIds": [...], "services": [...] }
  Future<Map<String, dynamic>> getEmployeeAvailability({
    required String tenantId,
    required String date,
    required String startTime,
    required List<String> serviceIds,
  }) async {
    final qs = StringBuffer('date=${Uri.encodeQueryComponent(date)}');
    qs.write('&startTime=${Uri.encodeQueryComponent(startTime)}');
    for (final id in serviceIds) {
      qs.write('&serviceIds=${Uri.encodeQueryComponent(id)}');
    }
    final res = await apiClient.get(
      '/public/tenant/$tenantId/employee-availability?$qs',
    );
    return res;
  }

  /// Resolves cross-participant conflicts via backend backtracking.
  /// POST /public/tenant/:tenantId/resolve-conflicts
  /// Returns: { resolved, conflict, message?, assignments?: [{ index, employeeId, locked, autoAssigned }] }
  Future<Map<String, dynamic>> resolveConflicts({
    required String tenantId,
    required String date,
    required int changedParticipantIndex,
    String? selectedEmployeeId,
    required List<Map<String, dynamic>> participants,
  }) async {
    final body = <String, dynamic>{
      'date': date,
      'changedParticipantIndex': changedParticipantIndex,
      'selectedEmployeeId': selectedEmployeeId,
      'participants': participants,
    };
    return apiClient.post('/public/tenant/$tenantId/resolve-conflicts', body);
  }
}

final discoveryService = DiscoveryService();
