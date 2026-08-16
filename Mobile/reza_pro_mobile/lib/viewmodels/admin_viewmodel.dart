import 'package:flutter/foundation.dart';
import '../services/api_client.dart';
import '../services/employee_service.dart';
import '../services/service_catalog_service.dart';
import '../services/tenant_service.dart';

class AdminViewModel extends ChangeNotifier {
  List<Map<String, dynamic>> services = [];
  List<Map<String, dynamic>> staff = [];
  Map<String, dynamic> tenant = {};
  Map<String, dynamic> stats = {};
  bool loading = true;
  String? error;

  /// Agenda parameters backed by real tenant settings.
  bool paramsLoading = false;
  String? paramsError;
  String agendaStart = '08:00';
  String agendaEnd = '23:55';
  bool autoConfirm = false;
  bool onlineBookingOpen = true;

  Future<void> loadAll() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        serviceCatalogService.list(),
        employeeService.list(),
        tenantService.getTenant(),
        tenantService.dashboardStats(),
      ]);
      services = List<Map<String, dynamic>>.from(results[0] as List);
      staff = List<Map<String, dynamic>>.from(results[1] as List);
      tenant = Map<String, dynamic>.from(results[2] as Map);
      stats = Map<String, dynamic>.from(results[3] as Map);
      loading = false;
      notifyListeners();
      await loadAgendaParams();
    } on ApiException catch (e) {
      error = e.message;
      loading = false;
      notifyListeners();
    } catch (_) {
      error = 'Impossible de charger l\'admin';
      loading = false;
      notifyListeners();
    }
  }

  /// Load the real agenda settings (hours, online booking, auto-confirm).
  Future<void> loadAgendaParams() async {
    paramsLoading = true;
    paramsError = null;
    notifyListeners();
    try {
      final hours = await tenantService.getBusinessHours();
      final ac = await tenantService.getAutoConfirm();
      agendaStart = hours['agendaStart']?.toString() ?? '08:00';
      agendaEnd = hours['agendaEnd']?.toString() ?? '23:55';
      onlineBookingOpen = (hours['onlineBooking'] ?? 'open').toString() == 'open';
      autoConfirm = ac['enabled'] == true;
      paramsLoading = false;
      notifyListeners();
    } catch (_) {
      paramsError = 'Impossible de charger les paramètres';
      paramsLoading = false;
      notifyListeners();
    }
  }

  /// Persist agenda settings. Returns an error message on failure, else null.
  Future<String?> saveAgendaParams({
    String? start,
    String? end,
    bool? onlineBooking,
    bool? autoConfirmEnabled,
  }) async {
    paramsLoading = true;
    paramsError = null;
    notifyListeners();
    try {
      await tenantService.updateBusinessHours({
        'agendaStart': start ?? agendaStart,
        'agendaEnd': end ?? agendaEnd,
        'onlineBooking': onlineBooking ?? (onlineBookingOpen ? 'open' : 'closed'),
      });
      if (autoConfirmEnabled != null) {
        await tenantService.setAutoConfirm(autoConfirmEnabled);
      }
      await loadAgendaParams();
      return null;
    } catch (e) {
      paramsLoading = false;
      notifyListeners();
      return e is ApiException ? e.message : 'Erreur lors de la sauvegarde';
    }
  }

  Future<void> createService({
    required String name,
    required double price,
    required int duration,
  }) async {
    await serviceCatalogService.create({
      'name': name,
      'duration': duration,
      'price': price,
      'priceType': 'FIXED',
    });
    await loadAll();
  }

  Future<void> createEmployee({
    required String firstName,
    required String lastName,
    required String phone,
    String? email,
    String? role,
  }) async {
    await employeeService.create({
      'firstName': firstName,
      'lastName': lastName,
      'phone': phone,
      if (email != null && email.isNotEmpty) 'email': email,
      if (role != null && role.isNotEmpty) 'agendaSettings': {'role': role},
      'isActive': true,
    });
    await loadAll();
  }

  /// Update salon general info (name, phone, email, address, website…).
  /// Returns an error message on failure, else null.
  Future<String?> updateTenantInfo(Map<String, dynamic> data) async {
    try {
      final updated = await tenantService.updateTenant(data);
      tenant = {...tenant, ...updated, ...data};
      notifyListeners();
      return null;
    } catch (e) {
      return e is ApiException ? e.message : 'Erreur lors de la mise à jour';
    }
  }
}
