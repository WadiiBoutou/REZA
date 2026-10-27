import 'api_client.dart';

class ClientListResult {
  final List<Map<String, dynamic>> clients;
  final int total;

  const ClientListResult({required this.clients, required this.total});
}

class ClientService {
  Future<List<Map<String, dynamic>>> list({String? search, int page = 1, int limit = 100}) async {
    final result = await listWithMeta(search: search, page: page, limit: limit);
    return result.clients;
  }

  Future<ClientListResult> listWithMeta({
    String? search,
    int page = 1,
    int limit = 100,
  }) async {
    final res = await apiClient.get('/clients', query: {
      if (search != null && search.isNotEmpty) 'search': search,
      'page': '$page',
      'limit': '$limit',
    });
    final clients = List<Map<String, dynamic>>.from((res['clients'] as List?) ?? []);
    final pagination = res['pagination'];
    var total = clients.length;
    if (pagination is Map && pagination['total'] is num) {
      total = (pagination['total'] as num).toInt();
    } else if (res['total'] is num) {
      total = (res['total'] as num).toInt();
    }
    return ClientListResult(clients: clients, total: total);
  }

  /// Walks server pages until the full result set is in memory.
  /// Stops if a page repeats ids, so a handler that ignores `page` cannot loop.
  Future<List<Map<String, dynamic>>> listAll({String? search}) async {
    const batch = 100;
    final seen = <String>{};
    final all = <Map<String, dynamic>>[];
    var page = 1;
    var total = 0;
    while (page <= 20) {
      final result = await listWithMeta(search: search, page: page, limit: batch);
      total = result.total;
      var added = 0;
      for (final client in result.clients) {
        final id = client['id']?.toString() ?? '';
        if (id.isNotEmpty && !seen.add(id)) continue;
        all.add(client);
        added++;
      }
      if (added == 0 || all.length >= total) break;
      page++;
    }
    return all;
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
