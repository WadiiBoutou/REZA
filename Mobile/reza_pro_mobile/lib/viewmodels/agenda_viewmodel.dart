import 'package:flutter/foundation.dart';
import '../models/appointment.dart';
import '../services/api_client.dart';
import '../services/appointment_service.dart';
import '../services/employee_service.dart';
import '../services/invoice_service.dart';

class AgendaViewModel extends ChangeNotifier {
  DateTime selectedDate = DateTime.now();
  String selectedEmployeeId = '';
  String selectedStatus = 'Tous';
  List<Appointment> appointments = [];
  /// Month-wide cache for calendar dots (same idea as Web Sidebar).
  List<Appointment> monthAppointments = [];
  DateTime? _monthLoadedFor;
  List<Map<String, dynamic>> employees = [];
  bool loading = true;
  String? error;
  bool statusBusy = false;

  /// Match web floor filters — no « En cours » as primary filter
  final statuses = const [
    'Tous',
    'Confirmé',
    'En attente',
    'Terminé',
    'Absent',
    'Annulé',
  ];

  Future<void> bootstrap() async {
    await Future.wait([
      loadEmployees(),
      loadAppointments(),
      loadMonthAppointments(),
    ]);
  }

  Future<void> loadEmployees() async {
    try {
      employees = await employeeService.list(active: true);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> loadAppointments() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final day = DateTime(selectedDate.year, selectedDate.month, selectedDate.day);
      final start = day.toIso8601String();
      final end = day
          .add(const Duration(days: 1))
          .subtract(const Duration(milliseconds: 1))
          .toIso8601String();
      final raw = await appointmentService.list(
        startDate: start,
        endDate: end,
        employeeId: selectedEmployeeId.isEmpty ? null : selectedEmployeeId,
      );
      appointments = raw.map(Appointment.fromJson).toList();
      loading = false;
      notifyListeners();
    } on ApiException catch (e) {
      error = e.message;
      loading = false;
      notifyListeners();
    } catch (_) {
      error = 'Impossible de charger les rendez-vous';
      loading = false;
      notifyListeners();
    }
  }

  List<Appointment> get filteredAppointments {
    return appointments.where(_matchesAgendaFilters).toList();
  }

  /// Same rules as Web `matchesAgendaFilters`: statut + employé.
  bool _matchesAgendaFilters(Appointment a) {
    if (selectedStatus != 'Tous') {
      const statusMap = {
        'Confirmé': 'confirmed',
        'En attente': 'pending',
        'Terminé': 'completed',
        'Absent': 'no_show',
        'Annulé': 'cancelled',
      };
      final target = statusMap[selectedStatus];
      if (target != null && a.status != target) return false;
    }
    if (selectedEmployeeId.isNotEmpty) {
      if (a.employeeId != selectedEmployeeId) {
        return false;
      }
    }
    return true;
  }

  /// Days (date-only) that have ≥1 RDV after current filters — for calendar dots.
  Set<DateTime> get daysWithAppointments {
    final days = <DateTime>{};
    for (final a in monthAppointments) {
      if (!_matchesAgendaFilters(a)) continue;
      final s = a.startTime ?? a.date;
      days.add(DateTime(s.year, s.month, s.day));
    }
    return days;
  }

  Future<void> loadMonthAppointments({
    DateTime? forMonth,
    bool force = false,
  }) async {
    final pivot = forMonth ?? selectedDate;
    final monthKey = DateTime(pivot.year, pivot.month);
    if (!force &&
        _monthLoadedFor != null &&
        _monthLoadedFor!.year == monthKey.year &&
        _monthLoadedFor!.month == monthKey.month) {
      notifyListeners();
      return;
    }
    try {
      final monthStart = DateTime(pivot.year, pivot.month, 1);
      final monthEnd = DateTime(pivot.year, pivot.month + 1, 0, 23, 59, 59);
      final raw = await appointmentService.list(
        startDate: monthStart.toIso8601String(),
        endDate: monthEnd.toIso8601String(),
        limit: 1000,
      );
      monthAppointments = raw.map(Appointment.fromJson).toList();
      _monthLoadedFor = monthKey;
      notifyListeners();
    } catch (_) {
      monthAppointments = [];
      _monthLoadedFor = monthKey;
      notifyListeners();
    }
  }

  Future<void> ensureMonthLoaded(DateTime month) async {
    final key = DateTime(month.year, month.month);
    if (_monthLoadedFor?.year == key.year &&
        _monthLoadedFor?.month == key.month) {
      return;
    }
    await loadMonthAppointments(forMonth: month);
  }

  List<String> get employeeDropdownLabels => [
        'Tous',
        ...employees.map((e) {
          final name = '${e['firstName'] ?? ''} ${e['lastName'] ?? ''}'.trim();
          return name.isEmpty ? (e['id']?.toString() ?? '?') : name;
        }),
      ];

  String get selectedEmployeeLabel {
    if (selectedEmployeeId.isEmpty) return 'Tous';
    for (final e in employees) {
      if (e['id']?.toString() == selectedEmployeeId) {
        final name = '${e['firstName'] ?? ''} ${e['lastName'] ?? ''}'.trim();
        return name.isEmpty ? 'Collaborateur' : name;
      }
    }
    return 'Tous';
  }

  Future<void> setDate(DateTime d) async {
    selectedDate = d;
    notifyListeners();
    await Future.wait([
      loadAppointments(),
      loadMonthAppointments(forMonth: d),
    ]);
  }

  Future<void> setEmployeeId(String id) async {
    selectedEmployeeId = id;
    notifyListeners();
    await loadAppointments();
  }

  Future<void> setEmployeeByLabel(String? label) async {
    if (label == null || label == 'Tous') {
      selectedEmployeeId = '';
    } else {
      final match = employees.firstWhere(
        (e) {
          final name = '${e['firstName'] ?? ''} ${e['lastName'] ?? ''}'.trim();
          return name == label;
        },
        orElse: () => {},
      );
      selectedEmployeeId = match['id']?.toString() ?? '';
    }
    notifyListeners();
    await loadAppointments();
  }

  void setStatus(String status) {
    selectedStatus = status;
    notifyListeners();
  }

  void _patchLocalStatus(String id, String uiStatus) {
    final idx = appointments.indexWhere((a) => a.id == id);
    if (idx != -1) {
      appointments[idx] = appointments[idx].copyWith(status: uiStatus);
    }
    final mIdx = monthAppointments.indexWhere((a) => a.id == id);
    if (mIdx != -1) {
      monthAppointments[mIdx] =
          monthAppointments[mIdx].copyWith(status: uiStatus);
    }
    notifyListeners();
  }

  Future<void> updateStatus(Appointment app, String uiStatus) async {
    statusBusy = true;
    notifyListeners();
    try {
      await appointmentService.update(app.id, {
        'status': Appointment.backendStatus(uiStatus),
      });
      _patchLocalStatus(app.id, uiStatus);
    } finally {
      statusBusy = false;
      notifyListeners();
    }
  }

  /// Terminé sans caisse
  Future<void> completeWithoutCaisse(Appointment app) async {
    await updateStatus(app, 'completed');
  }

  /// Terminé avec caisse
  Future<String> completeWithCaisse(
    Appointment app, {
    required String paymentMethod,
  }) async {
    statusBusy = true;
    notifyListeners();
    try {
      if (app.clientId.isEmpty) {
        await appointmentService.update(app.id, {'status': 'COMPLETED'});
        _patchLocalStatus(app.id, 'completed');
        return 'Client manquant — rendez-vous terminé sans caisse';
      }

      // Build items from multi-service list, falling back to primary service.
      final serviceLines = app.services.isNotEmpty
          ? app.services
          : (app.serviceId.isNotEmpty
              ? [
                  AppointmentServiceLine(
                    serviceId: app.serviceId,
                    name: app.service,
                    duration: app.totalDuration > 0 ? app.totalDuration : app.duration,
                    price: app.servicePrice ?? 0,
                  )
                ]
              : <AppointmentServiceLine>[]);

      if (serviceLines.isEmpty) {
        throw ApiException(
            'Service manquant — impossible d\'ajouter à la caisse');
      }

      // Each service line needs a price; if any is missing, reject early.
      final items = serviceLines
          .where((s) => (s.serviceId?.isNotEmpty ?? false))
          .map((s) => {
                'serviceId': s.serviceId!,
                'price': s.price > 0 ? s.price : null,
                'quantity': 1,
              })
          .toList();

      if (items.isEmpty) {
        throw ApiException(
            'Service manquant — impossible d\'ajouter à la caisse');
      }

      final missingPrice = items.any((i) => i['price'] == null);
      if (missingPrice) {
        throw ApiException(
            'Prix du service manquant. Mettez à jour le catalogue ou encaissez depuis la Caisse.');
      }

      await invoiceService.createSale(
        clientId: app.clientId,
        items: items,
        paymentMethod: paymentMethod,
        notes: serviceLines.map((s) => s.name).join(', '),
        appointmentId: app.id,
        tenantId: app.tenantId,
      );
      await appointmentService.update(app.id, {'status': 'COMPLETED'});
      _patchLocalStatus(app.id, 'completed');
      return 'Rendez-vous terminé et ajouté à la caisse';
    } finally {
      statusBusy = false;
      notifyListeners();
    }
  }
}
