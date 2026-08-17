import 'api_client.dart';

class CashTransactionService {
  Future<List<Map<String, dynamic>>> list({
    String? startDate,
    String? endDate,
    String? type,
    int page = 1,
    int limit = 50,
  }) async {

    final res = await apiClient.get('/cash-transactions', query: {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (type != null && type != 'all') 'type': type,
      'page': '$page',
      'limit': '$limit',
    });
    return List<Map<String, dynamic>>.from(
        (res['cashTransactions'] as List?) ??
            (res['transactions'] as List?) ??
            (res['data'] as List?) ??
            []);
  }

  Future<Map<String, dynamic>> create({
    required String type, // DEPOSIT | WITHDRAWAL | REFUND
    required double amount,
    required String paymentMethod,
    String? notes,
    String? tenantId,
  }) async {

    final res = await apiClient.post('/cash-transactions', {
      'type': type,
      'amount': amount,
      'paymentMethod': paymentMethod,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
    });
    return Map<String, dynamic>.from(
        res['cashTransaction'] as Map? ?? res['transaction'] as Map? ?? res);
  }
}

final cashTransactionService = CashTransactionService();
