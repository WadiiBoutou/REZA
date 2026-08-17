import 'api_client.dart';

class ClientService {
  Future<List<Map<String, dynamic>>> list({String? search, int page = 1, int limit = 100}) async {

    final res = await apiClient.get('/clients', query: {
      if (search != null && search.isNotEmpty) 'search': search,
      'page': '$page',
      'limit': '$limit',
    });
    return List<Map<String, dynamic>>.from((res['clients'] as List?) ?? []);
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> data) async {

    final res = await apiClient.post('/clients', data);
    return Map<String, dynamic>.from(res['client'] as Map? ?? res);
  }

  Future<Map<String, dynamic>> update(String id, Map<String, dynamic> data) async {

    final res = await apiClient.put('/clients/$id', data);
    return Map<String, dynamic>.from(res['client'] as Map? ?? res);
  }

  Future<void> delete(String id) async {
  await apiClient.delete('/clients/$id');
  }
}

final clientService = ClientService();
