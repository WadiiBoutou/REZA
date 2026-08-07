import 'api_client.dart';

class DiscoveryService {
  Future<List<Map<String, dynamic>>> searchTenants({
    String? search,
    List<String>? categories,
    String? city,
    double? lat,
    double? lng,
    double? radiusKm,
    int limit = 50,
  }) async {
    final q = <String, String>{'limit': '$limit'};
    if (search != null && search.isNotEmpty) q['search'] = search;
    // Multiple categories → comma-separated list consumed by the backend's
    // `categories` param (OR semantics). Single category kept for the
    // search-results modal which still passes one label.
    if (categories != null && categories.isNotEmpty) {
      q['categories'] = categories.join(',');
    }
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
    List<Map<String, dynamic>>? participants,
    List<Map<String, dynamic>>? existingParticipants,
    String? clientId,
    String? clientPhone,
    String? clientEmail,
  }) async {
    final query = <String, String>{'date': date};
    for (final id in serviceIds) {
      query['serviceIds'] = (query['serviceIds'] == null ? '' : '${query['serviceIds']},') + id;
    }
    if (clientId != null) {
      query['clientId'] = clientId;
    }
    if (clientPhone != null) {
      query['clientPhone'] = clientPhone;
    }
    if (clientEmail != null) {
      query['clientEmail'] = clientEmail;
    }
    final body = <String, dynamic>{
      'date': date,
      if (participants != null) 'participants': participants,
      if (existingParticipants != null && existingParticipants.isNotEmpty) 'existingParticipants': existingParticipants,
      if (clientId != null) 'clientId': clientId,
      if (clientPhone != null) 'clientPhone': clientPhone,
      if (clientEmail != null) 'clientEmail': clientEmail,
    };
    final res = await apiClient.post(
      '/public/tenant/$tenantId/available-slots',
      body,
      query: query,
    );
    return List<String>.from((res['slots'] as List?) ?? []);
  }

  /// Calls the backend employee-availability endpoint.
  /// Returns: { "employees": [...], "services": [...] }
  Future<Map<String, dynamic>> getEmployeeAvailability({
    required String tenantId,
    required String date,
    required String startTime,
    required List<String> serviceIds,
    List<Map<String, dynamic>>? existingParticipants,
  }) async {
    final qs = StringBuffer('date=${Uri.encodeQueryComponent(date)}');
    qs.write('&startTime=${Uri.encodeQueryComponent(startTime)}');
    for (final id in serviceIds) {
      qs.write('&serviceIds=${Uri.encodeQueryComponent(id)}');
    }
    if (existingParticipants != null && existingParticipants.isNotEmpty) {
      final body = <String, dynamic>{
        'date': date,
        'startTime': startTime,
        'serviceIds': serviceIds,
        'existingParticipants': existingParticipants,
      };
      final res = await apiClient.post(
        '/public/tenant/$tenantId/employee-availability',
        body,
      );
      return res;
    }
    final res = await apiClient.get(
      '/public/tenant/$tenantId/employee-availability?$qs',
    );
    return res;
  }

  /// Validates adding a new participant against existing locked constraints.
  /// POST /public/tenant/:tenantId/validate-participant
  /// Returns: { valid, conflict, message?, assignments? }
  Future<Map<String, dynamic>> validateParticipant({
    required String tenantId,
    required String date,
    required List<Map<String, dynamic>> participants,
    required Map<String, dynamic> newParticipant,
  }) async {
    final body = <String, dynamic>{
      'date': date,
      'participants': participants,
      'newParticipant': newParticipant,
    };
    return apiClient.post('/public/tenant/$tenantId/validate-participant', body);
  }
}

final discoveryService = DiscoveryService();
