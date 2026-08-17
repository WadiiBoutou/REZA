import 'api_client.dart';

class EmployeeService {
  Future<List<Map<String, dynamic>>> list({bool? active}) async {

    final res = await apiClient.get('/employees', query: {
      if (active != null) 'active': active.toString(),
    });
    return List<Map<String, dynamic>>.from((res['employees'] as List?) ?? []);
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> data) async {

    final res = await apiClient.post('/employees', data);
    return Map<String, dynamic>.from(res['employee'] as Map? ?? res);
  }

  Future<Map<String, dynamic>> update(String id, Map<String, dynamic> data) async {

    final res = await apiClient.put('/employees/$id', data);
    return Map<String, dynamic>.from(res['employee'] as Map? ?? res);
  }

  Future<void> delete(String id) async {
  await apiClient.delete('/employees/$id');
  }
}

final employeeService = EmployeeService();
