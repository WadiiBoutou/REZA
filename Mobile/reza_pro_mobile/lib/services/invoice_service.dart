import 'api_client.dart';
import '../mock_data.dart';
import 'session_store.dart';

class InvoiceService {
  Future<List<Map<String, dynamic>>> list({
    String? startDate,
    String? endDate,
    String? status,
    int page = 1,
    int limit = 50,
  }) async {
    if (useMockData) {
      final sessionUser = await sessionStore.getUser();
      var data = getMockInvoices(sessionUser?.tenantId);

      if (status != null && status.isNotEmpty) {
        data = data.where((inv) => inv['status'] == status).toList();
      }

      return data;
    }

    final res = await apiClient.get('/invoices', query: {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (status != null) 'status': status,
      'page': '$page',
      'limit': '$limit',
    });
    return List<Map<String, dynamic>>.from((res['invoices'] as List?) ?? []);
  }

  Future<Map<String, dynamic>> stats({String? startDate, String? endDate}) async {
    if (useMockData) {
      final sessionUser = await sessionStore.getUser();
      final invoices = getMockInvoices(sessionUser?.tenantId);
      final totalRevenue = invoices
          .where((inv) => inv['status'] == 'PAID')
          .fold(0.0, (sum, inv) => sum + (inv['total'] as double));
      return {
        'totalRevenue': totalRevenue,
      };
    }

    try {
      return await apiClient.get('/invoices/stats', query: {
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
      });
    } catch (_) {
      return {};
    }
  }

  // Flow A — encaisser une vente (PAID invoice + line items)
  Future<Map<String, dynamic>> createSale({
    required String clientId,
    required List<Map<String, dynamic>> items,
    required String paymentMethod,
    double? amount,
    double? tax,
    String? notes,
    String? tenantId,
    String? appointmentId,
  }) async {
    if (useMockData) {
      return {
        'id': generateId(),
        'invoiceNumber': 'INV-MOCK-${DateTime.now().millisecondsSinceEpoch}',
        'clientId': clientId,
        'items': items,
        'paymentMethod': paymentMethod,
        'amount': amount,
        'tax': tax,
        'total': amount,
        'status': 'PAID',
        'paidAt': DateTime.now().toIso8601String(),
        'createdAt': DateTime.now().toIso8601String(),
      };
    }

    final body = <String, dynamic>{
      'clientId': clientId,
      'items': items,
      'paymentMethod': paymentMethod,
      if (amount != null) 'amount': amount,
      if (tax != null) 'tax': tax,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
      if (appointmentId != null && appointmentId.isNotEmpty)
        'appointmentId': appointmentId,
    };
    final res = await apiClient.post('/invoices/sale', body);
    return Map<String, dynamic>.from(res['invoice'] as Map? ?? res);
  }

  // Group billing — list of billable booking groups (>1 participant, not invoiced)
  Future<List<Map<String, dynamic>>> getPendingGroups() async {
    if (useMockData) return [];
    final res = await apiClient.get('/invoices/pending-groups');
    return List<Map<String, dynamic>>.from((res['groups'] as List?) ?? []);
  }

  // Group billing — full details of one group (participants, services, employees)
  Future<Map<String, dynamic>> getGroupDetails(String groupId) async {
    if (useMockData) return {};
    final res = await apiClient.get('/invoices/group-details/$groupId');
    return Map<String, dynamic>.from(res['group'] as Map? ?? res);
  }

  // Group billing — one combined invoice covering the whole group, paid by one participant
  Future<Map<String, dynamic>> createGroupSale({
    required String bookingGroupId,
    required String payerClientId,
    required String paymentMethod,
    double? tax,
    String? notes,
    String? tenantId,
  }) async {
    if (useMockData) {
      return {'id': generateId(), 'status': 'PAID'};
    }

    final body = <String, dynamic>{
      'bookingGroupId': bookingGroupId,
      'payerClientId': payerClientId,
      'paymentMethod': paymentMethod,
      if (tax != null) 'tax': tax,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
    };
    final res = await apiClient.post('/invoices/group-sale', body);
    return Map<String, dynamic>.from(res['invoice'] as Map? ?? res);
  }

  // Group billing — one invoice per participant, each billed to their own client
  Future<List<Map<String, dynamic>>> separateGroupSale({
    required String bookingGroupId,
    required String paymentMethod,
    double? tax,
    String? tenantId,
  }) async {
    if (useMockData) return [];

    final body = <String, dynamic>{
      'bookingGroupId': bookingGroupId,
      'paymentMethod': paymentMethod,
      if (tax != null) 'tax': tax,
      if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
    };
    final res = await apiClient.post('/invoices/separate-group-sale', body);
    return List<Map<String, dynamic>>.from((res['invoices'] as List?) ?? []);
  }
}

final invoiceService = InvoiceService();
