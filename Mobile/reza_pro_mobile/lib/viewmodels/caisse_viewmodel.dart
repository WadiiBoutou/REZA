import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import '../services/api_client.dart';
import '../services/cash_transaction_service.dart';
import '../services/client_service.dart';
import '../services/employee_service.dart';
import '../services/invoice_service.dart';
import '../services/service_catalog_service.dart';

class CaisseViewModel extends ChangeNotifier {
  int selectedPeriod = 0;
  final periods = const ['Aujourd\'hui', 'Cette semaine', 'Ce mois', 'Tous'];
  List<Map<String, dynamic>> _allTransactions = [];
  List<Map<String, dynamic>> clients = [];
  List<Map<String, dynamic>> catalogServices = [];
  List<Map<String, dynamic>> employees = [];
  bool loading = true;
  bool saleBusy = false;
  String? error;
  /// Monotonic request id — only the latest `load()` may publish its result,
  /// so a slow/overlapping response can't clobber newer data (intermittent
  /// “aucune transaction” until a manual refresh).
  int _loadSeq = 0;

  static const int pageSize = 8;
  int currentPage = 1;
  String searchQuery = '';

  static const paymentMethodLabels = <String, String>{
    'CASH': 'Espèces',
    'CARD': 'Carte',
    'BANK_TRANSFER': 'Virement',
    'CHECK': 'Chèque',
  };

  String _methodLabel(String? m) {
    switch ((m ?? '').toUpperCase()) {
      case 'CASH':
        return 'Espèces';
      case 'CARD':
        return 'Carte';
      case 'BANK_TRANSFER':
        return 'Virement';
      case 'CHECK':
        return 'Chèque';
      case 'ONLINE':
        return 'En ligne';
      default:
        return m?.isNotEmpty == true ? m! : '—';
    }
  }

  String _statusUi(String? s) {
    switch ((s ?? '').toUpperCase()) {
      case 'PAID':
        return 'paid';
      case 'PENDING':
        return 'pending';
      case 'CANCELLED':
      case 'REFUNDED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  /// Start of the selected period (inclusive), local time.
  DateTime _periodStart() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (selectedPeriod == 0) return today;
    if (selectedPeriod == 1) {
      return today.subtract(Duration(days: today.weekday - 1));
    }
    // Calendar month: first day of the month to now (matches Web).
    return DateTime(now.year, now.month, 1);
  }

  /// Date range sent to the backend. "Tous" sends no bounds.
  (String?, String?) _periodRange() {
    if (selectedPeriod == 3) return (null, null);
    final start = _periodStart();
    final now = DateTime.now();
    return (start.toUtc().toIso8601String(), now.toUtc().toIso8601String());
  }

  double servicePrice(Map<String, dynamic> s) {
    return (s['price'] as num?)?.toDouble() ??
        (s['priceFrom'] as num?)?.toDouble() ??
        0.0;
  }

  List<Map<String, dynamic>> get transactions {
    final q = searchQuery.trim().toLowerCase();
    if (q.isEmpty) return _allTransactions;
    return _allTransactions.where((t) {
      final haystack = [
        t['client'],
        t['service'],
        t['method'],
        t['id'],
      ].map((value) => (value ?? '').toString().toLowerCase()).join(' ');
      return haystack.contains(q);
    }).toList();
  }

  int get totalPages {
    final count = transactions.length;
    if (count == 0) return 1;
    return (count / pageSize).ceil();
  }

  List<Map<String, dynamic>> get pageTransactions {
    final all = transactions;
    if (all.isEmpty) return const [];
    final start = (currentPage - 1) * pageSize;
    if (start >= all.length) return const [];
    final end = start + pageSize > all.length ? all.length : start + pageSize;
    return all.sublist(start, end);
  }

  void setSearch(String query) {
    if (query == searchQuery) return;
    searchQuery = query;
    currentPage = 1;
    notifyListeners();
  }

  void nextPage() {
    if (currentPage >= totalPages) return;
    currentPage++;
    notifyListeners();
  }

  void previousPage() {
    if (currentPage <= 1) return;
    currentPage--;
    notifyListeners();
  }

  void _clampPage() {
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
  }

  Map<String, dynamic> _mapInvoice(Map<String, dynamic> inv) {
    final created =
        DateTime.tryParse(inv['createdAt']?.toString() ?? '')?.toLocal();
    final client = inv['client'] as Map<String, dynamic>?;
    final appointment = inv['appointment'] as Map<String, dynamic>?;
    final service = appointment?['service'] as Map<String, dynamic>?;
    final items = (inv['items'] as List?) ?? [];
    var serviceLabel = service?['name']?.toString() ?? '';
    if (serviceLabel.isEmpty && items.isNotEmpty) {
      serviceLabel = items
          .map((item) {
            final it = item as Map;
            final svc = it['service'] as Map?;
            return svc?['name']?.toString() ??
                it['serviceName']?.toString() ??
                it['description']?.toString() ??
                '';
          })
          .where((name) => name.isNotEmpty)
          .join(', ');
    }
    if (serviceLabel.isEmpty) serviceLabel = 'Facture';

    final clientName = client != null
        ? '${client['firstName'] ?? ''} ${client['lastName'] ?? ''}'.trim()
        : 'Client';
    return {
      'id': inv['invoiceNumber']?.toString() ?? inv['id']?.toString() ?? '',
      'client': clientName.isEmpty ? 'Client' : clientName,
      'service': serviceLabel,
      'amount': (inv['total'] as num?)?.toDouble() ??
          (inv['amount'] as num?)?.toDouble() ??
          0.0,
      'method': _methodLabel(inv['paymentMethod']?.toString()),
      'status': _statusUi(inv['status']?.toString()),
      'time': created != null ? DateFormat('HH:mm').format(created) : '--:--',
      'employee': '—',
      '_sortAt': created ?? DateTime.fromMillisecondsSinceEpoch(0),
    };
  }

  Future<void> load({bool resetPage = false}) async {
    final seq = ++_loadSeq;
    if (resetPage) currentPage = 1;

    loading = true;
    error = null;
    notifyListeners();
    try {
      final (startDate, endDate) = _periodRange();
      final raw = await invoiceService.list(
        startDate: startDate,
        endDate: endDate,
      );
      // A newer load started while this request was in flight — discard ours.
      if (seq != _loadSeq) return;
      final mapped = raw.map(_mapInvoice).toList()
        ..sort((a, b) {
          final aDate = a['_sortAt'] as DateTime;
          final bDate = b['_sortAt'] as DateTime;
          return bDate.compareTo(aDate);
        });
      _allTransactions = mapped;
      _clampPage();
      loading = false;
      notifyListeners();
    } on ApiException catch (e) {
      if (seq != _loadSeq) return;
      error = e.message;
      loading = false;
      notifyListeners();
    } catch (_) {
      if (seq != _loadSeq) return;
      error = 'Impossible de charger la caisse';
      loading = false;
      notifyListeners();
    }
  }

  Future<void> loadSaleOptions() async {
    try {
      final results = await Future.wait([
        clientService.list(limit: 200),
        serviceCatalogService.list(),
        employeeService.list(active: true),
      ]);
      clients = results[0];
      catalogServices = results[1];
      employees = results[2];
      notifyListeners();
    } catch (_) {}
  }

  Future<void> setPeriod(int i) async {
    if (selectedPeriod == i) return;
    selectedPeriod = i;
    currentPage = 1;
    notifyListeners();
    await load();
  }

  double get totalRevenue => transactions
      .where((t) => t['status'] == 'paid')
      .fold(0.0, (sum, t) => sum + (t['amount'] as double));

  double get pendingRevenue => transactions
      .where((t) => t['status'] == 'pending')
      .fold(0.0, (sum, t) => sum + (t['amount'] as double));

  int get paidCount =>
      transactions.where((t) => t['status'] == 'paid').length;

  Future<void> createSale({
    required String clientId,
    required List<String> serviceIds,
    required String paymentMethod,
    double? amountOverride,
    String? notes,
    String? tenantId,
    Map<String, String?>? serviceEmployeeIds,
  }) async {
    if (clientId.isEmpty) {
      throw ApiException('Veuillez sélectionner un client');
    }
    if (serviceIds.isEmpty) {
      throw ApiException('Veuillez sélectionner au moins un service');
    }
    final items = serviceIds.map((id) {
      final s = catalogServices.firstWhere(
        (x) => x['id']?.toString() == id,
        orElse: () => <String, dynamic>{},
      );
      final price = servicePrice(s);
      final empId = serviceEmployeeIds?[id];
      return {
        'serviceId': id,
        if (price > 0) 'price': price,
        'quantity': 1,
        if (empId != null && empId.isNotEmpty) 'employeeId': empId,
      };
    }).toList();

    final sum = serviceIds.fold<double>(0, (acc, id) {
      final s = catalogServices.firstWhere(
        (x) => x['id']?.toString() == id,
        orElse: () => <String, dynamic>{},
      );
      return acc + servicePrice(s);
    });
    final amount = amountOverride ?? sum;
    if (amount <= 0) {
      throw ApiException('Montant invalide');
    }

    saleBusy = true;
    notifyListeners();
    try {
      await invoiceService.createSale(
        clientId: clientId,
        items: items,
        paymentMethod: paymentMethod,
        amount: amountOverride != null && amountOverride != sum
            ? amountOverride
            : null,
        notes: notes,
        tenantId: tenantId,
      );
      currentPage = 1;
      await load();
    } finally {
      saleBusy = false;
      notifyListeners();
    }
  }

  Future<void> createCashMovement({
    required String type,
    required double amount,
    required String paymentMethod,
    String? notes,
    String? tenantId,
  }) async {
    if (amount <= 0) throw ApiException('Montant invalide');
    saleBusy = true;
    notifyListeners();
    try {
      await cashTransactionService.create(
        type: type,
        amount: amount,
        paymentMethod: paymentMethod,
        notes: notes,
        tenantId: tenantId,
      );
      currentPage = 1;
      await load();
    } finally {
      saleBusy = false;
      notifyListeners();
    }
  }
}
