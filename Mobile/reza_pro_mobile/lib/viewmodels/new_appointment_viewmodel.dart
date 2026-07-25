import 'package:flutter/foundation.dart';
import '../models/appointment.dart';
import '../services/api_client.dart';
import '../services/appointment_service.dart';
import '../services/client_service.dart';
import '../services/employee_service.dart';
import '../services/service_catalog_service.dart';

class NewAppointmentViewModel extends ChangeNotifier {
  final DateTime selectedDate;

  NewAppointmentViewModel(this.selectedDate);

  List<Map<String, dynamic>> clients = [];
  List<Map<String, dynamic>> services = [];
  List<Map<String, dynamic>> employees = [];

  String? clientId;
  List<Map<String, dynamic>> selectedServices = [];
  String? employeeId;
  String selectedTime = '09:00';
  bool loading = true;
  bool submitting = false;
  String? error;
  String notes = '';

  int get totalDuration => selectedServices.fold<int>(
      0, (sum, s) => sum + ((s['duration'] as num?)?.toInt() ?? 0));

  double get totalPrice => selectedServices.fold<double>(
      0,
      (sum, s) =>
          sum +
          ((s['price'] as num?)?.toDouble() ??
              (s['priceFrom'] as num?)?.toDouble() ??
              0));

  final times = const [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  ];

  final durations = const [15, 30, 45, 60, 75, 90, 120];

  Future<void> loadOptions() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        clientService.list(limit: 200),
        serviceCatalogService.list(),
        employeeService.list(active: true),
      ]);
      clients = results[0];
      services = results[1];
      employees = results[2];
      if (clients.isNotEmpty) clientId = clients.first['id']?.toString();
      if (employees.isNotEmpty) {
        employeeId = employees.first['id']?.toString();
      }
      loading = false;
      notifyListeners();
    } on ApiException catch (e) {
      error = e.message;
      loading = false;
      notifyListeners();
    } catch (_) {
      error = 'Chargement impossible';
      loading = false;
      notifyListeners();
    }
  }

  void toggleService(Map<String, dynamic> svc) {
    final id = svc['id']?.toString();
    final idx = selectedServices.indexWhere(
        (s) => s['id']?.toString() == id);
    if (idx >= 0) {
      selectedServices.removeAt(idx);
    } else {
      selectedServices.add(svc);
    }
    notifyListeners();
  }

  void reorderServices(int oldIndex, int newIndex) {
    if (newIndex > oldIndex) newIndex--;
    final item = selectedServices.removeAt(oldIndex);
    selectedServices.insert(newIndex, item);
    notifyListeners();
  }

  void setSelectedServices(List<Map<String, dynamic>> list) {
    selectedServices = list;
    notifyListeners();
  }

  void setClient(String? id) {
    clientId = id;
    notifyListeners();
  }

  void setEmployee(String? id) {
    employeeId = id;
    notifyListeners();
  }

  void setTime(String t) {
    selectedTime = t;
    notifyListeners();
  }

  void setNotes(String n) {
    notes = n;
  }

  String labelClient(Map<String, dynamic> c) {
    final name = '${c['firstName'] ?? ''} ${c['lastName'] ?? ''}'.trim();
    return name.isEmpty ? (c['email']?.toString() ?? 'Client') : name;
  }

  String labelEmployee(Map<String, dynamic> e) {
    final name = '${e['firstName'] ?? ''} ${e['lastName'] ?? ''}'.trim();
    return name.isEmpty ? 'Collaborateur' : name;
  }

  Future<Appointment> submit() async {
    if (clientId == null || selectedServices.isEmpty) {
      throw ApiException('Sélectionnez client et au moins une prestation');
    }
    final parts = selectedTime.split(':');
    final start = DateTime(
      selectedDate.year,
      selectedDate.month,
      selectedDate.day,
      int.parse(parts[0]),
      int.parse(parts[1]),
    );
    submitting = true;
    notifyListeners();
    try {
      final created = await appointmentService.create({
        'clientId': clientId,
        'services': selectedServices.map((s) => {
          'serviceId': s['id']?.toString(),
          if (employeeId != null && employeeId!.isNotEmpty)
            'employeeId': employeeId,
        }).toList(),
        if (employeeId != null && employeeId!.isNotEmpty) 'employeeId': employeeId,
        'startTime': start.toUtc().toIso8601String(),
        'duration': totalDuration,
        if (notes.trim().isNotEmpty) 'notes': notes.trim(),
        'status': 'CONFIRMED',
        'source': 'ADMIN',
      });
      return Appointment.fromJson(created);
    } finally {
      submitting = false;
      notifyListeners();
    }
  }
}
