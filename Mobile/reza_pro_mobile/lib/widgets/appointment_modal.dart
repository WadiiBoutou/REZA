import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../constants/app_colors.dart';
import '../models/appointment.dart';
import '../services/api_client.dart';
import '../services/appointment_service.dart';
import '../services/client_service.dart';
import '../services/employee_service.dart';
import '../services/service_catalog_service.dart';
import '../viewmodels/auth_viewmodel.dart';

Map<String, dynamic> buildAppointmentSubmissionPayload({
  required String? selectedClientId,
  required List<Map<String, dynamic>> selectedServices,
  required Map<String, String?> serviceEmployeeIds,
  required DateTime startLocal,
  required String? createTenantId,
  required String? notes,
  required int duration,
}) {
  final servicesPayload = selectedServices.map((s) {
    final svcId = s['id']?.toString() ?? '';
    return {
      'serviceId': svcId,
      if (serviceEmployeeIds[svcId] != null &&
          serviceEmployeeIds[svcId]!.isNotEmpty)
        'employeeId': serviceEmployeeIds[svcId],
    };
  }).toList();

  final firstEmpId = servicesPayload
      .map((p) => p['employeeId'] as String?)
      .firstWhere((e) => e != null && e.isNotEmpty, orElse: () => null);

  return {
    'clientId': selectedClientId,
    'services': servicesPayload,
    if (firstEmpId != null) 'employeeId': firstEmpId,
    'startTime': startLocal.toUtc().toIso8601String(),
    'duration': duration,
    if (createTenantId != null && createTenantId.isNotEmpty)
      'tenantId': createTenantId,
    if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    'status': 'CONFIRMED',
    'source': 'ADMIN',
  };
}

class NewAppointmentModal extends StatefulWidget {
  final DateTime selectedDate;
  final Function(Appointment) onAdd;
  final String? initialTime;

  const NewAppointmentModal({
    super.key,
    required this.selectedDate,
    required this.onAdd,
    this.initialTime,
  });

  @override
  State<NewAppointmentModal> createState() => _NewAppointmentModalState();
}

class _NewAppointmentModalState extends State<NewAppointmentModal> {
  final _notesController = TextEditingController();

  List<Map<String, dynamic>> _clients = [];
  List<Map<String, dynamic>> _services = [];
  List<Map<String, dynamic>> _employees = [];

  String? _selectedClientId;
  String _selectedTime = '09:00';
  List<Map<String, dynamic>> _selectedServices = [];
  Map<String, String?> _serviceEmployeeIds = {};
  Map<String, dynamic>? _plan;
  bool _planLoading = false;
  Timer? _planTimer;
  String? _createTenantId;
  Map<String, List<Map<String, dynamic>>> _clientAlerts = {};
  bool _loading = true;
  bool _submitting = false;
  String? _loadError;

  final List<String> _times = [
    '08:00',
    '08:30',
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '12:00',
    '12:30',
    '13:00',
    '13:30',
    '14:00',
    '14:30',
    '15:00',
    '15:30',
    '16:00',
    '16:30',
    '17:00',
    '17:30',
    '18:00',
    '18:30',
    '19:00',
    '19:30',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialTime != null) {
      _selectedTime = widget.initialTime!;
    }
    _loadData();
  }

  Future<T> _runWithSalonScope<T>(
      String? tenantId, Future<T> Function() action) async {
    final previousFilter = apiClient.getSalonFilter();
    apiClient.setSalonFilter(
        tenantId != null && tenantId.isNotEmpty ? [tenantId] : 'all');
    try {
      return await action();
    } finally {
      apiClient.setSalonFilter(previousFilter);
    }
  }

  void _showSnackBar(String message, {Color? backgroundColor}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.outfit(fontSize: 13)),
        backgroundColor: backgroundColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _loadData() async {
    final auth = context.read<AuthViewModel>();
    if (auth.isSalonFilterMulti) {
      setState(() {
        _createTenantId = null;
        _clients = [];
        _services = [];
        _employees = [];
        _selectedClientId = null;
        _selectedServices = [];
        _serviceEmployeeIds = {};
        _loading = false;
        _loadError = null;
      });
      return;
    }
    final scopeIds = auth.effectiveSalonIds;
    final scope = scopeIds.length == 1 ? scopeIds.first : null;
    setState(() {
      _loading = true;
      _loadError = null;
      _createTenantId = scope;
    });
    try {
      final results = await _runWithSalonScope(
          scope,
          () async => Future.wait([
                clientService.list(limit: 200),
                serviceCatalogService.list(),
                employeeService.list(active: true),
              ]));
      if (!mounted) return;
      setState(() {
        _clients = results[0];
        _services = results[1];
        _employees = results[2];
        if (_clients.isNotEmpty) {
          _selectedClientId = _clients.first['id']?.toString();
        }
        _loading = false;
      });
      _loadClientAlerts();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadError = 'Impossible de charger les données';
        _loading = false;
      });
    }
  }

  Future<void> _reloadScoped() async {
    final tenantId = _createTenantId;
    if (tenantId == null || tenantId.isEmpty) return;
    setState(() {
      _loading = true;
      _loadError = null;
      _selectedClientId = null;
      _selectedServices = [];
      _serviceEmployeeIds = {};
      _plan = null;
      _clientAlerts = {};
    });
    try {
      final results = await _runWithSalonScope(
          tenantId,
          () async => Future.wait([
                clientService.list(limit: 200),
                serviceCatalogService.list(),
                employeeService.list(active: true),
              ]));
      if (!mounted) return;
      setState(() {
        _clients = results[0];
        _services = results[1];
        _employees = results[2];
        if (_clients.isNotEmpty) {
          _selectedClientId = _clients.first['id']?.toString();
        }
        _loading = false;
      });
      _loadClientAlerts();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadError = 'Impossible de charger les données';
        _loading = false;
      });
    }
  }

  Future<void> _loadClientAlerts() async {
    final tenantId = _createTenantId;
    if (tenantId == null || tenantId.isEmpty) return;
    if (_selectedTime.length < 4) {
      setState(() => _clientAlerts = {});
      return;
    }
    try {
      final result = await _runWithSalonScope(
          tenantId,
          () async => appointmentService.clientDiagnostics({
                'date':
                    '${widget.selectedDate.year}-${widget.selectedDate.month.toString().padLeft(2, '0')}-${widget.selectedDate.day.toString().padLeft(2, '0')}',
                'startTime': _selectedTime,
                if (tenantId.isNotEmpty) 'tenantId': tenantId,
              }));
      if (!mounted) return;
      final alerts = result['clientAlerts'];
      if (alerts is Map) {
        setState(() {
          _clientAlerts = alerts.map((k, v) {
            final list = <Map<String, dynamic>>[];
            if (v is List) {
              for (final item in v) {
                if (item is Map) {
                  list.add(Map<String, dynamic>.from(item));
                }
              }
            }
            return MapEntry(k.toString(), list);
          });
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _planTimer?.cancel();
    _notesController.dispose();
    super.dispose();
  }

  bool get _needsSalonSelection {
    final auth = context.read<AuthViewModel>();
    return auth.isSalonFilterMulti &&
        (_createTenantId == null || _createTenantId!.isEmpty);
  }

  bool get _canProceed => !_needsSalonSelection;

  List<Map<String, dynamic>> get _enrichedClients {
    if (_clientAlerts.isEmpty) return _clients;
    return _clients.map((c) {
      final cId = c['id']?.toString() ?? '';
      final alerts = _clientAlerts[cId];
      if (alerts != null && alerts.isNotEmpty) {
        return {
          ...c,
          'available': false,
          'reason': alerts.first['message']?.toString() ?? '',
        };
      }
      return c;
    }).toList();
  }

  List<Map<String, dynamic>> get _selectedClientConflicts {
    if (_selectedClientId == null || _selectedClientId!.isEmpty)
      return const [];
    final alerts = _clientAlerts[_selectedClientId!];
    if (alerts == null || alerts.isEmpty) return const [];
    return alerts;
  }

  Widget _buildSalonGate() {
    final auth = context.read<AuthViewModel>();
    if (!auth.hasMultipleSalons || !auth.isSalonFilterMulti) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'SALON',
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textLight,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.surfaceGray,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _createTenantId != null && _createTenantId!.isNotEmpty
                    ? _createTenantId
                    : null,
                isExpanded: true,
                hint: Text(
                  'Choisir un salon *',
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textLight,
                  ),
                ),
                icon: const Icon(Icons.expand_more_rounded,
                    size: 20, color: AppColors.textGray),
                style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textDark),
                items: auth.salons
                    .where((s) => auth.effectiveSalonIds.contains(s.id))
                    .map((s) => DropdownMenuItem(
                          value: s.id,
                          child: Text(s.name),
                        ))
                    .toList(),
                onChanged: (id) {
                  if (id == null || id.isEmpty) return;
                  setState(() {
                    _createTenantId = id;
                  });
                  _reloadScoped();
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  int get _totalDuration => _selectedServices.fold<int>(
      0, (sum, s) => sum + ((s['duration'] as num?)?.toInt() ?? 0));

  double get _totalPrice => _selectedServices.fold<double>(
      0,
      (sum, s) =>
          sum +
          ((s['price'] as num?)?.toDouble() ??
              (s['priceFrom'] as num?)?.toDouble() ??
              0));

  String get _servicesLabel {
    if (_selectedServices.isEmpty) return 'Sélectionner une prestation';
    return '${_selectedServices.length} prestation${_selectedServices.length > 1 ? 's' : ''} · ${_totalDuration} min · ${_totalPrice.toStringAsFixed(0)} MAD';
  }

  Future<void> _submit() async {
    if (_needsSalonSelection) {
      _showSnackBar('Veuillez sélectionner un salon',
          backgroundColor: AppColors.cancelled);
      return;
    }
    if (_selectedClientId == null || _selectedServices.isEmpty) {
      _showSnackBar('Sélectionnez un client et au moins une prestation',
          backgroundColor: AppColors.cancelled);
      return;
    }

    final parts = _selectedTime.split(':');
    final hour = int.parse(parts[0]);
    final minute = int.parse(parts[1]);
    final startLocal = DateTime(
      widget.selectedDate.year,
      widget.selectedDate.month,
      widget.selectedDate.day,
      hour,
      minute,
    );

    setState(() => _submitting = true);
    try {
      final tenantId = _createTenantId;
      final payload = buildAppointmentSubmissionPayload(
        selectedClientId: _selectedClientId,
        selectedServices: _selectedServices,
        serviceEmployeeIds: _serviceEmployeeIds,
        startLocal: startLocal,
        createTenantId: tenantId,
        notes: _notesController.text,
        duration: _totalDuration,
      );
      final created = await _runWithSalonScope(
          tenantId, () async => appointmentService.create(payload));
      if (!mounted) return;
      final appointment = Appointment.fromJson(created);
      widget.onAdd(appointment);
      Navigator.pop(context);
      _showSnackBar('Rendez-vous ajouté avec succès',
          backgroundColor: AppColors.confirmed);
    } on ApiException catch (e) {
      if (!mounted) return;
      _showSnackBar(e.message, backgroundColor: AppColors.cancelled);
    } catch (_) {
      if (!mounted) return;
      _showSnackBar('Création impossible',
          backgroundColor: AppColors.cancelled);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _openServicePicker(BuildContext context) async {
    // Track local state for the picker so it doesn't commit until "Terminé"
    final localSelected = List<Map<String, dynamic>>.from(_selectedServices);
    final selectedIds = localSelected.map((s) => s['id']?.toString()).toSet();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            final available = _services
                .where((s) => !selectedIds.contains(s['id']?.toString()))
                .toList();

            return DraggableScrollableSheet(
              initialChildSize: 0.75,
              maxChildSize: 0.9,
              minChildSize: 0.4,
              builder: (ctx, scrollCtrl) => Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                ),
                child: ListView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
                  children: [
                    // Handle
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Title
                    Text(
                      'Sélectionner les prestations',
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Cochez les services à ajouter',
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: AppColors.textGray,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Available services (checkbox list)
                    if (available.isEmpty && localSelected.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text(
                            'Aucune prestation disponible',
                            style:
                                GoogleFonts.outfit(color: AppColors.textLight),
                          ),
                        ),
                      ),
                    if (available.isNotEmpty) ...[
                      _sectionLabel('PRESTATIONS DISPONIBLES'),
                      const SizedBox(height: 8),
                      ...available.map((svc) {
                        final svcId = svc['id']?.toString() ?? '';
                        final svcName = svc['name']?.toString() ?? 'Service';
                        final svcDuration =
                            (svc['duration'] as num?)?.toInt() ?? 0;
                        final svcPrice = (svc['price'] as num?)?.toDouble() ??
                            (svc['priceFrom'] as num?)?.toDouble() ??
                            0;
                        return CheckboxListTile(
                          key: ValueKey('avail-$svcId'),
                          value: false,
                          onChanged: (_) {
                            setLocal(() {
                              localSelected.add(svc);
                              selectedIds.add(svcId);
                            });
                          },
                          title: Text(
                            svcName,
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textDark,
                            ),
                          ),
                          subtitle: Text(
                            '${svcDuration} min · ${svcPrice.toStringAsFixed(0)} MAD',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              color: AppColors.textGray,
                            ),
                          ),
                          activeColor: AppColors.primary,
                          controlAffinity: ListTileControlAffinity.trailing,
                          dense: true,
                        );
                      }),
                      const SizedBox(height: 12),
                    ],

                    // Selected services (reorderable list)
                    if (localSelected.isNotEmpty) ...[
                      _sectionLabel('PRESTATIONS SÉLECTIONNÉES'),
                      const SizedBox(height: 8),
                      ReorderableListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        buildDefaultDragHandles: false,
                        itemCount: localSelected.length,
                        onReorder: (oldIndex, newIndex) {
                          setLocal(() {
                            if (newIndex > oldIndex) newIndex--;
                            final item = localSelected.removeAt(oldIndex);
                            localSelected.insert(newIndex, item);
                          });
                        },
                        itemBuilder: (ctx, index) {
                          final svc = localSelected[index];
                          final svcId = svc['id']?.toString() ?? '';
                          final svcName = svc['name']?.toString() ?? 'Service';
                          final svcDuration =
                              (svc['duration'] as num?)?.toInt() ?? 0;
                          final svcPrice = (svc['price'] as num?)?.toDouble() ??
                              (svc['priceFrom'] as num?)?.toDouble() ??
                              0;
                          return ListTile(
                            key: ValueKey('sel-$svcId'),
                            leading: ReorderableDragStartListener(
                              index: index,
                              child: Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(
                                  Icons.drag_handle,
                                  color: AppColors.primary,
                                  size: 20,
                                ),
                              ),
                            ),
                            title: Text(
                              svcName,
                              style: GoogleFonts.outfit(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textDark,
                              ),
                            ),
                            subtitle: Text(
                              '${svcDuration} min · ${svcPrice.toStringAsFixed(0)} MAD',
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: AppColors.textGray,
                              ),
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.remove_circle_outline,
                                  color: AppColors.cancelled, size: 22),
                              onPressed: () {
                                setLocal(() {
                                  localSelected.removeAt(index);
                                  selectedIds.remove(svcId);
                                });
                              },
                            ),
                            dense: true,
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Total: ${localSelected.fold<int>(0, (sum, s) => sum + ((s['duration'] as num?)?.toInt() ?? 0))} min · ${localSelected.fold<double>(0, (sum, s) => sum + ((s['price'] as num?)?.toDouble() ?? (s['priceFrom'] as num?)?.toDouble() ?? 0)).toStringAsFixed(0)} MAD',
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          color: AppColors.textGray,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),
                    // Confirm button
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: () {
                          setState(() {
                            _selectedServices = localSelected;
                            final newIds = <String>{};
                            for (final svc in _selectedServices) {
                              final id = svc['id']?.toString() ?? '';
                              newIds.add(id);
                              if (!_serviceEmployeeIds.containsKey(id)) {
                                _serviceEmployeeIds[id] = _employees.isNotEmpty
                                    ? _employees.first['id']?.toString()
                                    : null;
                              }
                            }
                            _serviceEmployeeIds
                                .removeWhere((k, _) => !newIds.contains(k));
                          });
                          _fetchPlan();
                          Navigator.pop(ctx);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(26),
                          ),
                        ),
                        child: Text(
                          'Terminé',
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _fetchPlan() async {
    if (_selectedClientId == null || _selectedServices.isEmpty) {
      setState(() {
        _plan = null;
        _planLoading = false;
      });
      return;
    }
    _planTimer?.cancel();
    _planTimer = Timer(const Duration(milliseconds: 400), () async {
      if (!mounted) return;
      setState(() => _planLoading = true);
      _loadClientAlerts();
      try {
        final parts = _selectedTime.split(':');
        final startLocal = DateTime(
          widget.selectedDate.year,
          widget.selectedDate.month,
          widget.selectedDate.day,
          int.parse(parts[0]),
          int.parse(parts[1]),
        );
        final tenantId = _createTenantId;
        final payload = {
          'serviceIds':
              _selectedServices.map((s) => s['id']?.toString() ?? '').toList(),
          'date':
              '${widget.selectedDate.year}-${widget.selectedDate.month.toString().padLeft(2, '0')}-${widget.selectedDate.day.toString().padLeft(2, '0')}',
          'startTime': _selectedTime,
          'clientId': _selectedClientId,
          if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
          if (_serviceEmployeeIds.isNotEmpty)
            'assignments': _selectedServices
                .map((s) => {
                      'serviceId': s['id']?.toString() ?? '',
                      'employeeId':
                          _serviceEmployeeIds[s['id']?.toString()] ?? null,
                    })
                .toList(),
        };
        final result = await _runWithSalonScope(
            tenantId, () async => appointmentService.planAppointment(payload));
        if (!mounted) return;
        setState(() {
          _plan = result;
          _planLoading = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _plan = null;
          _planLoading = false;
        });
      }
    });
  }

  String _label(Map<String, dynamic> item, {bool service = false}) {
    if (service) return item['name']?.toString() ?? 'Service';
    return '${item['firstName'] ?? ''} ${item['lastName'] ?? ''}'.trim();
  }

  List<Map<String, dynamic>> _enrichedEmployeesForService(String serviceId) {
    if (_plan == null) return _employees;
    final services = _plan!['services'] as List?;
    if (services == null) return _employees;
    final svcPlan = services
        .cast<Map<String, dynamic>>()
        .where(
          (s) => s['serviceId'] == serviceId,
        )
        .toList();
    if (svcPlan.isEmpty) return _employees;
    final planEmployees =
        (svcPlan.first['employees'] as List?)?.cast<Map<String, dynamic>>() ??
            [];
    if (planEmployees.isEmpty) return _employees;
    return _employees.map((emp) {
      final empId = emp['id']?.toString();
      final planEmp = planEmployees
          .cast<Map<String, dynamic>>()
          .where(
            (p) => p['employeeId'] == empId,
          )
          .toList();
      final p = planEmp.isNotEmpty ? planEmp.first : <String, dynamic>{};
      return {
        ...emp,
        'available': p['available'] ?? true,
        'recommended': p['recommended'] ?? false,
        'reason': p['reason'],
      };
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (ctx, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(28),
            topRight: Radius.circular(28),
          ),
        ),
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary))
            : _loadError != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_loadError!, textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          ElevatedButton(
                            onPressed: _loadData,
                            child: const Text('Réessayer'),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView(
                    controller: scrollCtrl,
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.add_rounded,
                                color: AppColors.primary, size: 22),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Nouveau rendez-vous',
                                style: GoogleFonts.outfit(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textDark,
                                ),
                              ),
                              Text(
                                DateFormat('EEEE d MMMM yyyy', 'fr_FR')
                                    .format(widget.selectedDate),
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  color: AppColors.textGray,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      _buildSalonGate(),
                      if (_needsSalonSelection) ...[
                        Padding(
                          padding: const EdgeInsets.only(top: 32),
                          child: Center(
                            child: Column(
                              children: [
                                Icon(Icons.store_rounded,
                                    size: 48, color: AppColors.textLight),
                                const SizedBox(height: 12),
                                Text(
                                  'Veuillez sélectionner un salon\ndans le champ ci-dessus.',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.outfit(
                                    fontSize: 14,
                                    color: AppColors.textGray,
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ] else ...[
                        _sectionLabel('CLIENT'),
                        const SizedBox(height: 8),
                        _idDropdown(
                          'Client',
                          _selectedClientId,
                          _enrichedClients,
                          (v) {
                            setState(() => _selectedClientId = v);
                            _loadClientAlerts();
                            _fetchPlan();
                          },
                          compactUnavailableLabel: true,
                        ),
                        const SizedBox(height: 20),
                        _sectionLabel('PRESTATIONS'),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: () => _openServicePicker(context),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 14),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceGray,
                              border: Border.all(color: AppColors.border),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    _servicesLabel,
                                    style: GoogleFonts.outfit(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: _selectedServices.isEmpty
                                          ? AppColors.textLight
                                          : AppColors.textDark,
                                    ),
                                  ),
                                ),
                                const Icon(Icons.edit_rounded,
                                    size: 18, color: AppColors.textGray),
                              ],
                            ),
                          ),
                        ),
                        if (_selectedServices.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          ..._selectedServices.asMap().entries.map((entry) {
                            final idx = entry.key;
                            final svc = entry.value;
                            final svcId = svc['id']?.toString() ?? '';
                            final svcName =
                                svc['name']?.toString() ?? 'Service';
                            final svcDuration =
                                (svc['duration'] as num?)?.toInt() ?? 0;
                            return Container(
                              key: ValueKey('svc-emp-$svcId'),
                              margin: const EdgeInsets.only(top: 8),
                              padding:
                                  const EdgeInsets.fromLTRB(12, 10, 12, 10),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceGray,
                                border: Border.all(color: AppColors.border),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 20,
                                        height: 20,
                                        decoration: BoxDecoration(
                                          color: AppColors.primary
                                              .withOpacity(0.1),
                                          borderRadius:
                                              BorderRadius.circular(6),
                                        ),
                                        child: Center(
                                          child: Text(
                                            '${idx + 1}',
                                            style: GoogleFonts.outfit(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w800,
                                              color: AppColors.primary,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          svcName,
                                          style: GoogleFonts.outfit(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textDark,
                                          ),
                                        ),
                                      ),
                                      Text(
                                        '${svcDuration} min',
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          color: AppColors.textGray,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Collaborateur',
                                    style: GoogleFonts.outfit(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textLight,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  _idDropdown(
                                    '',
                                    _serviceEmployeeIds[svcId] ?? '',
                                    _enrichedEmployeesForService(svcId),
                                    (v) {
                                      setState(() {
                                        _serviceEmployeeIds[svcId] = v;
                                      });
                                      _fetchPlan();
                                    },
                                    optional: true,
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          'Total: ${_totalDuration} min · ${_totalPrice.toStringAsFixed(0)} MAD',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            color: AppColors.textGray,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 20),
                        _sectionLabel('PLANIFICATION'),
                        const SizedBox(height: 8),
                        _timePicker(),
                        const SizedBox(height: 16),
                        _planningStatusPanel(),
                        const SizedBox(height: 20),
                        _sectionLabel('NOTES'),
                        const SizedBox(height: 8),
                        _textField(_notesController, 'Notes (facultatif)',
                            'Informations supplémentaires...',
                            maxLines: 3),
                        const SizedBox(height: 28),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton.icon(
                            onPressed: _submitting ? null : _submit,
                            icon: _submitting
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white),
                                  )
                                : const Icon(Icons.check_rounded, size: 20),
                            label: Text(
                              'Créer le rendez-vous',
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(26),
                              ),
                            ),
                          ),
                        ),
                      ], // end else block
                    ],
                  ),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: GoogleFonts.outfit(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.textLight,
        letterSpacing: 1.2,
      ),
    );
  }

  Widget _textField(
    TextEditingController ctrl,
    String label,
    String hint, {
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          maxLines: maxLines,
          style: GoogleFonts.outfit(fontSize: 14, color: AppColors.textDark),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle:
                GoogleFonts.outfit(fontSize: 13, color: AppColors.textLight),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            filled: true,
            fillColor: AppColors.surfaceGray,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _idDropdown(
    String label,
    String? value,
    List<Map<String, dynamic>> items,
    ValueChanged<String?> onChanged, {
    bool asService = false,
    bool optional = false,
    bool compactUnavailableLabel = false,
  }) {
    final menuItems = <DropdownMenuItem<String>>[
      if (optional) const DropdownMenuItem(value: '', child: Text('Aucun')),
      ...items.map((e) {
        final id = e['id']?.toString() ?? '';
        final available = asService ? true : (e['available'] as bool? ?? true);
        final recommended =
            asService ? false : (e['recommended'] as bool? ?? false);
        final reason = asService ? null : (e['reason'] as String?);
        return DropdownMenuItem(
          value: id,
          child: Row(
            children: [
              Flexible(
                child: Text(
                  _label(e, service: asService),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (recommended)
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Recommandé',
                      style: TextStyle(
                        fontSize: 10,
                        color: Color(0xFF059669),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              if (!available && reason != null && reason.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning_amber_rounded,
                          size: 14, color: Color(0xFFD97706)),
                      const SizedBox(width: 2),
                      Text(
                        compactUnavailableLabel ? 'Client occupé' : reason,
                        style: TextStyle(
                          fontSize: 10,
                          color: Color(0xFFD97706),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        );
      }),
    ];
    final effectiveValue =
        value != null && menuItems.any((m) => m.value == value)
            ? value
            : (menuItems.isNotEmpty ? menuItems.first.value : null);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: AppColors.surfaceGray,
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(12),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: effectiveValue,
              isExpanded: true,
              icon: const Icon(Icons.expand_more_rounded,
                  size: 20, color: AppColors.textGray),
              style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textDark),
              items: menuItems,
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _timePicker() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Heure',
            style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.textDark)),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _times.map((t) {
              final selected = t == _selectedTime;
              return GestureDetector(
                onTap: () {
                  setState(() => _selectedTime = t);
                  _loadClientAlerts();
                  _fetchPlan();
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.only(right: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primary : Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: selected ? AppColors.primary : AppColors.border,
                    ),
                  ),
                  child: Text(
                    t,
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: selected ? Colors.white : AppColors.textGray,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _planningStatusPanel() {
    if (_planLoading) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surfaceGray,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.textGray,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'Analyse du planning…',
              style: GoogleFonts.outfit(
                fontSize: 13,
                color: AppColors.textGray,
              ),
            ),
          ],
        ),
      );
    }

    final diagnosticConflicts = _selectedClientConflicts;
    final planningAlerts = _plan != null && _plan!['alerts'] is List
        ? (_plan!['alerts'] as List).cast<Map<String, dynamic>>()
        : <Map<String, dynamic>>[];
    final warnings =
        planningAlerts.where((a) => a['severity'] == 'warning').toList();
    final conflicts =
        planningAlerts.where((a) => a['severity'] == 'conflict').toList();
    final hasSummary = warnings.isNotEmpty ||
        conflicts.isNotEmpty ||
        diagnosticConflicts.isNotEmpty;
    if (hasSummary) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surfaceGray,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'ÉTAT DU PLANNING',
              style: GoogleFonts.outfit(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.textLight,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 10),
            if (warnings.isNotEmpty) ...[
              Row(
                children: [
                  Icon(Icons.warning_amber_rounded,
                      size: 16, color: AppColors.pending),
                  const SizedBox(width: 6),
                  Text(
                    'Avertissements',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.pending,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              ...warnings.map((w) => Padding(
                    padding: const EdgeInsets.only(left: 22, top: 2),
                    child: Text(
                      '• ${w['message'] ?? ''}',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        color: AppColors.pending,
                      ),
                    ),
                  )),
            ],
            if ((warnings.isNotEmpty || diagnosticConflicts.isNotEmpty) &&
                conflicts.isNotEmpty)
              const SizedBox(height: 8),
            if (conflicts.isNotEmpty) ...[
              Row(
                children: [
                  Icon(Icons.error_outline_rounded,
                      size: 16, color: AppColors.cancelled),
                  const SizedBox(width: 6),
                  Text(
                    'Conflits',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.cancelled,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              ...conflicts.map((c) => Padding(
                    padding: const EdgeInsets.only(left: 22, top: 2),
                    child: Text(
                      '• ${c['message'] ?? ''}',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        color: AppColors.cancelled,
                      ),
                    ),
                  )),
            ],
            if (diagnosticConflicts.isNotEmpty) ...[
              Row(
                children: [
                  Icon(Icons.error_outline_rounded,
                      size: 16, color: AppColors.cancelled),
                  const SizedBox(width: 6),
                  Text(
                    'Conflits client',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.cancelled,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              ...diagnosticConflicts.map((c) => Padding(
                    padding: const EdgeInsets.only(left: 22, top: 2),
                    child: Text(
                      '• ${c['message'] ?? ''}',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        color: AppColors.cancelled,
                      ),
                    ),
                  )),
            ],
            if (_plan != null && _plan!['estimatedEndTime'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  'Fin estimée : ${_plan!['estimatedEndTime']}',
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    color: AppColors.textGray,
                  ),
                ),
              ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }
}
