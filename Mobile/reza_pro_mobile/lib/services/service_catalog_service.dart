import 'api_client.dart';

class ServiceCatalogService {
  Future<List<Map<String, dynamic>>> list({String? search}) async {

    final res = await apiClient.get('/services', query: {
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return List<Map<String, dynamic>>.from((res['services'] as List?) ?? []);
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> data) async {

    final res = await apiClient.post('/services', data);
    return Map<String, dynamic>.from(res['service'] as Map? ?? res);
  }

  Future<Map<String, dynamic>> update(String id, Map<String, dynamic> data) async {

    final res = await apiClient.put('/services/$id', data);
    return Map<String, dynamic>.from(res['service'] as Map? ?? res);
  }

  Future<void> delete(String id) async {
  await apiClient.delete('/services/$id');
  }
}

final serviceCatalogService = ServiceCatalogService();
