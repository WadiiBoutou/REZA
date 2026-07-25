import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../constants.dart';
import '../models/family_member.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../services/api_client.dart';
import '../services/booking_service.dart';
import '../services/discovery_service.dart';
import '../widgets/group_participants_section.dart';
import 'booking_confirmation_screen.dart';

class BookingScreen extends StatefulWidget {
  final String tenantId;
  final VenueItem venue;
  final ServiceItem? preselectedService;
  final List<ServiceItem> preselectedServices;
  final VoidCallback? onGoToBookings;

  const BookingScreen({
    super.key,
    required this.tenantId,
    required this.venue,
    this.preselectedService,
    this.preselectedServices = const [],
    this.onGoToBookings,
  });

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  int _step = 0;
  final List<ServiceItem> _selectedServices = [];
  DateTime? _selectedDate;
  String? _selectedTime;
  List<String> _timeSlots = [];
  bool _slotsLoading = false;

  String? _selectedEmployeeId;
  List<Map<String, dynamic>> _employeeAvailability = [];
  bool _employeeAvailabilityLoading = false;

  bool _submitting = false;

  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  bool _includeBooker = true;
  List<GuestParticipant> _participants = [];
  List<FamilyMember> _familyMembers = [];
  bool _familyLoading = false;

  Map<String, bool> _sameEmployeeForAllMap = {};

  Map<String, Map<String, String?>> _perServiceEmployeeMap = {};

  Map<String, List<Map<String, dynamic>>> _employeeAvailabilityMap = {};
  Map<String, bool> _availabilityLoadingPerPerson = {};

  Map<String, List<String>> _commonEmployeeIdsMap = {};

  bool _applyingResolvedState = false;

  String? _conflictMessage;

  @override
  void initState() {
    super.initState();
    if (widget.preselectedService != null) {
      _selectedServices.add(widget.preselectedService!);
    }
    for (final s in widget.preselectedServices) {
      if (!_selectedServices.any((x) => x.id == s.id)) {
        _selectedServices.add(s);
      }
    }
    if (_selectedServices.isNotEmpty) {
      _step = 1;
    }
    _selectedDate = DateTime.now();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final user = context.read<AuthViewModel>().user;
      if (user != null) {
        _emailController.text = user.email;
        _firstNameController.text = user.firstName;
        _lastNameController.text = user.lastName;
        _phoneController.text = user.phone ?? '';
        _loadFamily();
      }
    });
  }

  Future<void> _loadFamily() async {
    setState(() => _familyLoading = true);
    try {
      final user = context.read<AuthViewModel>().user;
      final res = await apiClient.get(
        '/public/client/${Uri.encodeComponent(user!.email)}/family-members',
      );
      final list = (res['familyMembers'] as List?) ?? [];
      if (!mounted) return;
      setState(() {
        _familyMembers = list.map((e) => FamilyMember.fromJson(e as Map<String, dynamic>)).toList();
        _familyLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _familyLoading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  List<DateTime> get _nextDays => List.generate(14, (i) => DateTime.now().add(Duration(days: i)));

  String _dayAbbr(DateTime d) {
    const days = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
    return days[d.weekday - 1];
  }

  String _monthAbbr(DateTime d) {
    const months = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    return months[d.month - 1];
  }

  String _formatFullDate(DateTime d) {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return '${days[d.weekday - 1]} ${d.day} ${months[d.month - 1]}';
  }

  String _dateApi(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  double get _totalPrice =>
      _selectedServices.fold(0.0, (sum, s) => sum + s.price);
  int get _totalDuration =>
      _selectedServices.fold(0, (sum, s) => sum + s.durationMin);

  String get _durationLabel {
    final h = _totalDuration ~/ 60;
    final m = _totalDuration % 60;
    if (h > 0 && m > 0) return '$h h $m min';
    if (h > 0) return '$h h';
    return '$m min';
  }

  bool get _hasParticipants => !_includeBooker || _participants.isNotEmpty;

  String _timeForPerson(String personKey) {
    if (personKey == 'booker') return _selectedTime ?? '';
    final p = _participants.where((p) => p.id == personKey).firstOrNull;
    if (p != null && !p.followsBookerSchedule && p.customTime != null) {
      return p.customTime!;
    }
    return _selectedTime ?? '';
  }

  String? _dateForPerson(String personKey) {
    if (personKey == 'booker') return _selectedDate != null ? _dateApi(_selectedDate!) : null;
    final p = _participants.where((p) => p.id == personKey).firstOrNull;
    if (p != null && !p.followsBookerSchedule && p.customDate != null) {
      return p.customDate!;
    }
    return _selectedDate != null ? _dateApi(_selectedDate!) : null;
  }

  List<String> _serviceIdsForPerson(String personKey) {
    if (personKey == 'booker') {
      return _selectedServices.map((s) => s.id).where((id) => id.isNotEmpty).toList();
    }
    final p = _participants.where((p) => p.id == personKey).firstOrNull;
    if (p == null) return [];
    if (p.sameServicesAsBooker) {
      return _selectedServices.map((s) => s.id).where((id) => id.isNotEmpty).toList();
    }
    return p.serviceIds.where((id) => id.isNotEmpty).toList();
  }

  List<ServiceItem> _servicesForPerson(String personKey) {
    final ids = _serviceIdsForPerson(personKey).toSet();
    if (personKey == 'booker') {
      return _selectedServices;
    }
    final p = _participants.where((p) => p.id == personKey).firstOrNull;
    if (p == null) return [];
    if (p.sameServicesAsBooker) {
      return _selectedServices;
    }
    return widget.venue.services.where((s) => ids.contains(s.id) || ids.contains(s.name)).toList();
  }

  int _durationForPerson(String personKey) {
    final svcs = _servicesForPerson(personKey);
    return svcs.fold(0, (sum, s) => sum + s.durationMin);
  }

  Future<void> _loadSlots() async {
    if (_selectedDate == null || _selectedServices.isEmpty) return;
    final ids = _selectedServices.map((s) => s.id).where((id) => id.isNotEmpty).toList();
    if (ids.isEmpty) {
      setState(() => _timeSlots = []);
      return;
    }
    setState(() {
      _slotsLoading = true;
      _selectedTime = null;
      _employeeAvailability = [];
      _selectedEmployeeId = null;
    });
    try {
      final slots = await discoveryService.getAvailableSlots(
        tenantId: widget.tenantId,
        date: _dateApi(_selectedDate!),
        serviceIds: ids,
      );
      if (!mounted) return;
      setState(() {
        _timeSlots = slots;
        _slotsLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _timeSlots = [];
        _slotsLoading = false;
      });
    }
  }

  Future<void> _loadEmployeeAvailability() async {
    if (_selectedDate == null || _selectedTime == null || _selectedServices.isEmpty) return;
    final serviceIds = _selectedServices.map((s) => s.id).where((id) => id.isNotEmpty).toList();
    if (serviceIds.isEmpty) return;
    setState(() {
      _employeeAvailabilityLoading = true;
      _selectedEmployeeId = null;
    });
    try {
      final res = await discoveryService.getEmployeeAvailability(
        tenantId: widget.tenantId,
        date: _dateApi(_selectedDate!),
        startTime: _selectedTime!,
        serviceIds: serviceIds,
      );
      if (!mounted) return;
      setState(() {
        _employeeAvailability = (res['employees'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _employeeAvailabilityLoading = false;
        final common = (res['commonEmployeeIds'] as List?)
            ?.map((e) => e.toString())
            .toList() ?? [];
        _commonEmployeeIdsMap['booker'] = common;
        _employeeAvailabilityMap['booker'] = (res['employees'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _employeeAvailability = [];
        _employeeAvailabilityLoading = false;
      });
    }
  }

  Future<void> _loadEmployeeAvailabilityForPerson(String personKey) async {
    final time = _timeForPerson(personKey);
    final dateStr = _dateForPerson(personKey);
    if (time.isEmpty || dateStr == null) return;
    final serviceIds = _serviceIdsForPerson(personKey);
    if (serviceIds.isEmpty) return;

    setState(() => _availabilityLoadingPerPerson[personKey] = true);

    try {
      final res = await discoveryService.getEmployeeAvailability(
        tenantId: widget.tenantId,
        date: dateStr,
        startTime: time,
        serviceIds: serviceIds,
      );
      if (!mounted) return;
      setState(() {
        _employeeAvailabilityMap[personKey] =
            (res['employees'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _commonEmployeeIdsMap[personKey] = (res['commonEmployeeIds'] as List?)
            ?.map((e) => e.toString())
            .toList() ?? [];
        _availabilityLoadingPerPerson[personKey] = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _employeeAvailabilityMap[personKey] = [];
        _availabilityLoadingPerPerson[personKey] = false;
      });
    }
  }

  Future<void> _resolveConflicts(String changedPersonKey, String? newEmployeeId) async {
    if (_applyingResolvedState) return;
    if (!_hasParticipants) return;
    final dateStr = _selectedDate != null ? _dateApi(_selectedDate!) : '';
    if (dateStr.isEmpty || _selectedTime == null) return;

    final participantsPayload = <Map<String, dynamic>>[];
    int changedIndex = -1;
    int idx = 0;

    if (_includeBooker) {
      final emp = _selectedEmployeeId;
      participantsPayload.add({
        'index': idx,
        'serviceIds': _serviceIdsForPerson('booker'),
        'startTime': _selectedTime!,
        'duration': _durationForPerson('booker'),
        'currentEmployeeId': emp,
      });
      if (changedPersonKey == 'booker') changedIndex = idx;
      idx++;
    }

    for (final p in _participants) {
      final time = p.followsBookerSchedule ? _selectedTime! : (p.customTime ?? _selectedTime!);
      final svcIds = p.sameServicesAsBooker
          ? _serviceIdsForPerson('booker')
          : p.serviceIds.where((id) => id.isNotEmpty).toList();
      participantsPayload.add({
        'index': idx,
        'serviceIds': svcIds,
        'startTime': time,
        'duration': _durationForPerson(p.id),
        'currentEmployeeId': p.employeeId,
      });
      if (changedPersonKey == p.id) changedIndex = idx;
      idx++;
    }

    if (participantsPayload.length < 2) return;

    final selectedEmpId = newEmployeeId;
    if (changedIndex < 0) return;
    if (mounted) setState(() => _conflictMessage = null);

    try {
      final result = await discoveryService.resolveConflicts(
        tenantId: widget.tenantId,
        date: dateStr,
        changedParticipantIndex: changedIndex,
        selectedEmployeeId: selectedEmpId,
        participants: participantsPayload,
      );
      if (!mounted) return;

      if (result['resolved'] == true && result['assignments'] != null) {
        final assignments = result['assignments'] as List;

        final autoCount = assignments.where((a) =>
            a['autoAssigned'] == true &&
            a['employeeId']?.toString() != newEmployeeId).length;

        _applyingResolvedState = true;

        for (final a in assignments) {
          final aIdx = a['index'] as int;
          final eId = a['employeeId']?.toString();

          String personKey;
          if (_includeBooker && aIdx == 0) {
            personKey = 'booker';
          } else {
            final pIdx = _includeBooker ? aIdx - 1 : aIdx;
            if (pIdx >= 0 && pIdx < _participants.length) {
              personKey = _participants[pIdx].id;
            } else {
              continue;
            }
          }

          if (personKey == 'booker') {
            setState(() => _selectedEmployeeId = eId);
          } else {
            setState(() {
              _participants = _participants.map((p) =>
                  p.id == personKey ? p.copyWith(employeeId: eId) : p).toList();
            });
          }
          final pServices = _servicesForPerson(personKey);
          if (eId != null && pServices.isNotEmpty) {
            setState(() {
              _perServiceEmployeeMap[personKey] = Map.fromEntries(
                pServices.map((s) => MapEntry(s.id.isNotEmpty ? s.id : s.name, eId)),
              );
            });
          }
        }

        Future.microtask(() {
          if (mounted) setState(() => _applyingResolvedState = false);
        });

        if (autoCount > 0) {
          _showToast('Les collaborateurs ont été réaffectés automatiquement afin d\'éviter un conflit.');
        }
      } else if (result['conflict'] == true) {
        final msg = result['message']?.toString() ??
            'Aucun collaborateur disponible pour satisfaire toutes les contraintes.';
        setState(() => _conflictMessage = msg);
        Future.delayed(const Duration(seconds: 6), () {
          if (mounted && _conflictMessage == msg) {
            setState(() => _conflictMessage = null);
          }
        });
      }
    } catch (_) {
    }
  }

  void _onEmployeeChangedForPerson(String personKey, String serviceId, String? employeeId) {
    if (_applyingResolvedState) return;

    final current = Map<String, String?>.from(_perServiceEmployeeMap[personKey] ?? {});
    current[serviceId] = employeeId;

    setState(() {
      _perServiceEmployeeMap[personKey] = current;
      if (personKey == 'booker') {
        _selectedEmployeeId = employeeId;
      } else {
        _participants = _participants.map((p) =>
            p.id == personKey ? p.copyWith(employeeId: employeeId) : p).toList();
      }
    });

    _resolveConflicts(personKey, employeeId);
  }

  void _onPersonEmployeeChanged(String personKey, String? employeeId) {
    if (_applyingResolvedState) return;

    final svcs = _servicesForPerson(personKey);
    final updated = Map<String, String?>.fromEntries(
      svcs.map((s) => MapEntry(s.id.isNotEmpty ? s.id : s.name, employeeId)),
    );

    setState(() {
      _perServiceEmployeeMap[personKey] = updated;
      if (personKey == 'booker') {
        _selectedEmployeeId = employeeId;
      } else {
        _participants = _participants.map((p) =>
            p.id == personKey ? p.copyWith(employeeId: employeeId) : p).toList();
      }
      _sameEmployeeForAllMap[personKey] = true;
    });

    _resolveConflicts(personKey, employeeId);
  }

  void _goBack() {
    if (_step > 0) {
      setState(() => _step--);
    } else {
      Navigator.pop(context);
    }
  }

  void _continueFromServices() {
    setState(() => _step = 1);
    _loadSlots();
  }

  void _continueFromDateTime() {
    setState(() {
      _step = 2;
      _employeeAvailability = [];
      _selectedEmployeeId = null;
    });
    _loadEmployeeAvailability().then((_) {
      for (final p in _participants) {
        if (!p.followsBookerSchedule) {
          _loadEmployeeAvailabilityForPerson(p.id);
        }
      }
    });
  }

  void _continueFromProfessional() {
    final auth = context.read<AuthViewModel>();
    final user = auth.user;
    final hasPhone = user?.phone != null && user!.phone!.isNotEmpty;
    if (!auth.isAuthenticated || !hasPhone) {
      setState(() => _step = 3);
    } else {
      _submitBooking();
    }
  }

  Future<void> _submitBooking() async {
    if (_submitting) return;
    final auth = context.read<AuthViewModel>();
    final user = auth.user;

    final firstName = (user?.firstName.isNotEmpty == true)
        ? user!.firstName
        : _firstNameController.text.trim();
    final lastName = (user?.lastName.isNotEmpty == true)
        ? user!.lastName
        : _lastNameController.text.trim();
    final phone = (user?.phone != null && user!.phone!.isNotEmpty)
        ? user.phone!
        : _phoneController.text.trim();
    final email = user?.email ?? _emailController.text.trim();

    if (firstName.isEmpty || lastName.isEmpty || phone.isEmpty) {
      _showError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (_selectedDate == null || _selectedTime == null) {
      _showError('Veuillez choisir une date et une heure.');
      return;
    }

    final serviceIds = _selectedServices.map((s) => s.id).where((id) => id.isNotEmpty).toList();
    if (serviceIds.isEmpty) {
      _showError('Erreur lors de la création de la réservation.');
      return;
    }

    final parts = _selectedTime!.split(':');
    final hour = int.tryParse(parts[0]) ?? 0;
    final minute = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
    final startLocal = DateTime(
      _selectedDate!.year,
      _selectedDate!.month,
      _selectedDate!.day,
      hour,
      minute,
    );

    final participantsPayload = <Map<String, dynamic>>[];
    for (final p in _participants) {
      final pTime = p.followsBookerSchedule ? _selectedTime! : (p.customTime ?? _selectedTime!);
      final pSvcs = p.sameServicesAsBooker
          ? serviceIds
          : p.serviceIds.where((id) => id.isNotEmpty).toList();

      final pParts = pTime.split(':');
      final pHour = int.tryParse(pParts[0]) ?? 0;
      final pMinute = pParts.length > 1 ? int.tryParse(pParts[1]) ?? 0 : 0;
      final pDate = DateTime(
        _selectedDate!.year,
        _selectedDate!.month,
        _selectedDate!.day,
        pHour,
        pMinute,
      );

      final pPayload = <String, dynamic>{
        'firstName': p.name,
        'lastName': '',
        'serviceIds': pSvcs,
        'startTime': pDate.toUtc().toIso8601String(),
      };
      final pEmp = p.employeeId;
      if (pEmp != null && pEmp.isNotEmpty) {
        pPayload['employeeId'] = pEmp;
      }
      participantsPayload.add(pPayload);
    }

    setState(() => _submitting = true);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
    );

    try {
      final result = await bookingService.createBooking(
        tenantId: widget.tenantId,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email.isNotEmpty ? email : null,
        serviceIds: serviceIds,
        startTimeIso: startLocal.toUtc().toIso8601String(),
        employeeId: _selectedEmployeeId,
        participants: participantsPayload.isNotEmpty ? participantsPayload : null,
      );
      if (!mounted) return;
      Navigator.pop(context);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => BookingConfirmationScreen(
            venue: widget.venue,
            service: _selectedServices.first,
            date: _formatFullDate(_selectedDate!),
            time: _selectedTime!,
            bookingResult: result,
            onGoToBookings: widget.onGoToBookings,
          ),
        ),
      );
    } on ApiException {
      if (mounted) {
        Navigator.pop(context);
        _showError('Erreur lors de la création de la réservation.');
      }
    } catch (_) {
      if (mounted) {
        Navigator.pop(context);
        _showError('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: GoogleFonts.inter(fontSize: 13)),
        backgroundColor: AppColors.textDark,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showToast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: GoogleFonts.inter(fontSize: 13)),
        backgroundColor: AppColors.primary,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  Widget _stepBody() {
    if (_step == 0) return _buildServicesParticipantsStep();
    if (_step == 1) return _buildDateTimeStep();
    if (_step == 2) return _buildProfessionalStep();
    return _buildGuestStep();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
                child: KeyedSubtree(
                  key: ValueKey('$_step'),
                  child: _stepBody(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          IconButton(icon: const Icon(Icons.arrow_back, color: AppColors.textDark, size: 22), onPressed: _goBack),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close, color: AppColors.textDark, size: 22),
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }

  Widget _buildServicesParticipantsStep() {
    final title = _selectedServices.isEmpty
        ? 'Sélectionnez les\nprestations'
        : 'Vos prestations';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
          child: Text(
            title,
            style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textDark),
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
            children: [
              ..._selectedServices.asMap().entries.map((entry) {
                final index = entry.key;
                final service = entry.value;
                return _ServiceCard(
                  service: service,
                  isAdded: true,
                  showReorder: _selectedServices.length > 1,
                  onToggle: () {
                    setState(() {
                      _selectedServices.removeAt(index);
                    });
                  },
                  onMoveUp: index > 0
                      ? () {
                          setState(() {
                            final tmp = _selectedServices[index];
                            _selectedServices[index] = _selectedServices[index - 1];
                            _selectedServices[index - 1] = tmp;
                          });
                        }
                      : null,
                  onMoveDown: index < _selectedServices.length - 1
                      ? () {
                          setState(() {
                            final tmp = _selectedServices[index];
                            _selectedServices[index] = _selectedServices[index + 1];
                            _selectedServices[index + 1] = tmp;
                          });
                        }
                      : null,
                );
              }),
              const SizedBox(height: 6),
              Center(
                child: TextButton.icon(
                  onPressed: () => _showServicePicker(),
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(
                    'Ajouter une prestation',
                    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                  style: TextButton.styleFrom(foregroundColor: AppColors.primary),
                ),
              ),
              const SizedBox(height: 16),
              if (_selectedServices.isNotEmpty) ...[
                GroupParticipantsSection(
                  participants: _participants,
                  onChanged: (list) => setState(() => _participants = list),
                  includeBooker: _includeBooker,
                  onIncludeBookerChange: (v) => setState(() => _includeBooker = v),
                  bookerTotal: _totalPrice,
                  allServices: widget.venue.services,
                  familyMembers: _familyMembers,
                  familyLoading: _familyLoading,
                  isAuthenticated: context.read<AuthViewModel>().isAuthenticated,
                  onLoginTap: () {
                    Navigator.pop(context);
                  },
                ),
              ],
            ],
          ),
        ),
        if (_selectedServices.isNotEmpty) _bottomBar(
          priceLabel: '${_totalPrice.toInt()} MAD',
          subtitle: '${_selectedServices.length} article${_selectedServices.length > 1 ? 's' : ''} · $_durationLabel',
          onContinue: _continueFromServices,
        ),
      ],
    );
  }

  void _showServicePicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.5,
          maxChildSize: 0.85,
          minChildSize: 0.3,
          expand: false,
          builder: (_, scroll) {
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Ajouter une prestation',
                          style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: ListView.separated(
                    controller: scroll,
                    padding: const EdgeInsets.all(16),
                    itemCount: widget.venue.services.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final s = widget.venue.services[i];
                      final id = s.id.isNotEmpty ? s.id : s.name;
                      final selected = _selectedServices.any((x) => (x.id.isNotEmpty ? x.id : x.name) == id);
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
                        ),
                        title: Text(s.name, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                        subtitle: Text('${s.price.toInt()} MAD · ${s.durationMin} min',
                            style: GoogleFonts.inter(color: AppColors.textGray, fontSize: 13)),
                        trailing: Icon(selected ? Icons.remove_circle_outline : Icons.add_circle_outline),
                        onTap: () {
                          setState(() {
                            if (selected) {
                              _selectedServices.removeWhere((x) => (x.id.isNotEmpty ? x.id : x.name) == id);
                            } else {
                              _selectedServices.add(s);
                            }
                          });
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildDateTimeStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
          child: Text("Sélectionnez la date et\nl'heure", style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textDark)),
        ),
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text('Sélectionner une date', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textDark)),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 82,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: _nextDays.length,
            itemBuilder: (context, index) {
              final date = _nextDays[index];
              final isSelected = _selectedDate?.day == date.day &&
                  _selectedDate?.month == date.month &&
                  _selectedDate?.year == date.year;
              return GestureDetector(
                onTap: () {
                  setState(() {
                    _selectedDate = date;
                    _selectedTime = null;
                  });
                  _loadSlots();
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(right: 10),
                  width: 60,
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.purpleAccent : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: isSelected ? AppColors.purpleAccent : AppColors.border),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_dayAbbr(date), style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w500, color: isSelected ? Colors.white70 : AppColors.textGray)),
                      Text('${date.day}', style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: isSelected ? Colors.white : AppColors.textDark)),
                      Text(_monthAbbr(date), style: GoogleFonts.inter(fontSize: 10, color: isSelected ? Colors.white70 : AppColors.textGray)),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text('Choisissez une heure', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textDark)),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: _slotsLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _timeSlots.isEmpty
                  ? Center(child: Text('Aucun créneau disponible', style: GoogleFonts.inter(color: AppColors.textGray)))
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                      itemCount: _timeSlots.length,
                      itemBuilder: (context, index) {
                        final time = _timeSlots[index];
                        final isSelected = _selectedTime == time;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedTime = time),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: isSelected ? AppColors.purpleAccent : AppColors.border, width: isSelected ? 2 : 1),
                            ),
                            child: Text(time, style: GoogleFonts.inter(fontSize: 15, fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400, color: isSelected ? AppColors.purpleAccent : AppColors.textDark)),
                          ),
                        );
                      },
                    ),
        ),
        _bottomBar(
          priceLabel: '${_totalPrice.toInt()} MAD',
          subtitle: null,
          onContinue: _selectedTime != null ? _continueFromDateTime : null,
        ),
      ],
    );
  }

  Widget _buildProfessionalStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Text(
            'Choisissez votre\nprofessionnel',
            style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textDark),
          ),
        ),
        if (_conflictMessage != null)
          Container(
            margin: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.amber.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Colors.amber.shade700, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _conflictMessage!,
                    style: GoogleFonts.inter(fontSize: 13, color: Colors.amber.shade900),
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: _employeeAvailabilityLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _employeeAvailability.isEmpty && !_hasParticipants
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          'Aucun professionnel disponible à ce créneau.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
                        ),
                      ),
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                      children: [
                        if (_includeBooker) ...[
                          _personSection('booker', 'Moi'),
                          const SizedBox(height: 16),
                        ],
                        ..._participants.map((p) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: _personSection(p.id, p.name.isEmpty ? 'Invité' : p.name),
                          );
                        }),
                      ],
                    ),
        ),
        _bottomBar(
          priceLabel: '${_totalPrice.toInt()} MAD',
          subtitle: _selectedEmployeeId == null && !_hasParticipants ? 'Attribution automatique' : null,
          onContinue: (_employeeAvailability.isNotEmpty || _hasParticipants)
              ? _continueFromProfessional
              : null,
        ),
      ],
    );
  }

  Widget _personSection(String personKey, String label) {
    final svcs = _servicesForPerson(personKey);
    if (svcs.isEmpty) return const SizedBox.shrink();

    final employees = _employeeAvailabilityMap[personKey] ?? _employeeAvailability;
    final isLoading = _availabilityLoadingPerPerson[personKey] ?? false;
    final sameForAll = _sameEmployeeForAllMap[personKey] ?? true;
    final personEmpId = personKey == 'booker' ? _selectedEmployeeId : _participants.where((p) => p.id == personKey).firstOrNull?.employeeId;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    label.isNotEmpty ? label[0].toUpperCase() : '?',
                    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(label, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textDark)),
            ],
          ),
          const SizedBox(height: 12),
          if (svcs.length > 1) ...[
            Row(
              children: [
                SizedBox(
                  height: 22,
                  width: 22,
                  child: Checkbox(
                    value: sameForAll,
                    activeColor: AppColors.primary,
                    onChanged: (v) {
                      final useSame = v ?? true;
                      setState(() => _sameEmployeeForAllMap[personKey] = useSame);
                      if (useSame && personEmpId != null) {
                        _onPersonEmployeeChanged(personKey, personEmpId);
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Text('Même employé pour tous', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textDark)),
              ],
            ),
            const SizedBox(height: 8),
          ],
          if (isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            )
          else if (employees.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Aucun professionnel disponible pour ce créneau.',
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
              ),
            )
          else ...[
            if (sameForAll || svcs.length == 1) ...[
              _EmployeeCard(
                id: null,
                name: 'N\'importe qui',
                available: true,
                isSelected: personEmpId == null,
                onTap: () => _onPersonEmployeeChanged(personKey, null),
              ),
              const SizedBox(height: 4),
              ...employees.map((emp) {
                final id = emp['employee']?['id']?.toString() ?? emp['id']?.toString() ?? '';
                final firstName = emp['employee']?['firstName']?.toString() ?? emp['firstName']?.toString() ?? '';
                final lastName = emp['employee']?['lastName']?.toString() ?? emp['lastName']?.toString() ?? '';
                final available = emp['available'] == true;
                return _EmployeeCard(
                  id: id,
                  name: '$firstName $lastName'.trim(),
                  available: available,
                  isSelected: personEmpId == id,
                  onTap: available ? () => _onPersonEmployeeChanged(personKey, id) : null,
                );
              }),
            ] else ...[
              ...svcs.map((svc) {
                final svcId = svc.id.isNotEmpty ? svc.id : svc.name;
                final currentEmpId = _perServiceEmployeeMap[personKey]?[svcId];

                final serviceEmployees = employees.where((emp) {
                  final empServices = emp['services'] as List?;
                  if (empServices == null || empServices.isEmpty) return true;
                  return empServices.any((e) =>
                    e.toString() == svc.name ||
                    e.toString() == svc.id ||
                    e.toString() == svcId);
                }).toList();

                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        svc.name,
                        style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark),
                      ),
                      const SizedBox(height: 6),
                      ..._buildEmployeeOptions(personKey, svcId, currentEmpId, serviceEmployees),
                    ],
                  ),
                );
              }),
            ],
          ],
        ],
      ),
    );
  }

  List<Widget> _buildEmployeeOptions(
      String personKey, String svcId, String? currentEmpId, List<Map<String, dynamic>> employees) {
    final items = <Widget>[];
    items.add(_EmployeeCard(
      id: null,
      name: 'N\'importe qui',
      available: true,
      isSelected: currentEmpId == null,
      onTap: () => _onEmployeeChangedForPerson(personKey, svcId, null),
    ));
    items.add(const SizedBox(height: 4));
    for (final emp in employees) {
      final id = emp['employee']?['id']?.toString() ?? emp['id']?.toString() ?? '';
      final firstName = emp['employee']?['firstName']?.toString() ?? emp['firstName']?.toString() ?? '';
      final lastName = emp['employee']?['lastName']?.toString() ?? emp['lastName']?.toString() ?? '';
      final available = emp['available'] == true;
      final name = '$firstName $lastName'.trim();
      items.add(_EmployeeCard(
        id: id,
        name: name.isEmpty ? 'Professionnel' : name,
        available: available,
        isSelected: currentEmpId == id,
        onTap: available
            ? () => _onEmployeeChangedForPerson(personKey, svcId, id)
            : null,
      ));
      items.add(const SizedBox(height: 4));
    }
    return items;
  }

  Widget _buildGuestStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Vos informations', style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textDark)),
          const SizedBox(height: 8),
          Text(
            'Nécessaire pour confirmer la réservation.',
            style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
          ),
          const SizedBox(height: 24),
          _field('Prénom', _firstNameController),
          const SizedBox(height: 12),
          _field('Nom', _lastNameController),
          const SizedBox(height: 12),
          _field('Téléphone', _phoneController, keyboard: TextInputType.phone),
          const SizedBox(height: 12),
          _field('Email', _emailController, keyboard: TextInputType.emailAddress),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submitBooking,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text('Confirmer la réservation', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bottomBar({
    required String priceLabel,
    String? subtitle,
    VoidCallback? onContinue,
  }) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -4))],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(priceLabel, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textDark)),
                if (subtitle != null)
                  Text(subtitle, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray)),
              ],
            ),
          ),
          GestureDetector(
            onTap: onContinue,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              decoration: BoxDecoration(
                color: onContinue != null ? AppColors.primary : AppColors.border,
                borderRadius: BorderRadius.circular(28),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Continuez',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: onContinue != null ? Colors.white : AppColors.textGray,
                    ),
                  ),
                  if (onContinue != null) ...[
                    const SizedBox(width: 6),
                    const Icon(Icons.arrow_forward, color: Colors.white, size: 18),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController c, {TextInputType? keyboard}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textDark)),
        const SizedBox(height: 8),
        TextField(
          controller: c,
          keyboardType: keyboard,
          style: GoogleFonts.inter(fontSize: 15, color: AppColors.textDark),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final ServiceItem service;
  final bool isAdded;
  final bool showReorder;
  final VoidCallback onToggle;
  final VoidCallback? onMoveUp;
  final VoidCallback? onMoveDown;

  const _ServiceCard({
    required this.service,
    required this.isAdded,
    this.showReorder = false,
    required this.onToggle,
    this.onMoveUp,
    this.onMoveDown,
  });

  @override
  Widget build(BuildContext context) {
    final durationLabel = service.durationMin >= 60
        ? '${service.durationMin ~/ 60} h${service.durationMin % 60 > 0 ? ' ${service.durationMin % 60} min' : ''}'
        : '${service.durationMin} min';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isAdded ? AppColors.primary : AppColors.border, width: isAdded ? 1.5 : 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (showReorder) ...[
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (onMoveUp != null)
                      GestureDetector(
                        onTap: onMoveUp,
                        child: const Icon(Icons.keyboard_arrow_up, size: 18, color: AppColors.textGray),
                      ),
                    if (onMoveDown != null)
                      GestureDetector(
                        onTap: onMoveDown,
                        child: const Icon(Icons.keyboard_arrow_down, size: 18, color: AppColors.textGray),
                      ),
                  ],
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Text(service.name.toUpperCase(), style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textDark, letterSpacing: 0.5)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(durationLabel, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
          if (service.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(service.description, maxLines: 2, overflow: TextOverflow.ellipsis, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray, height: 1.4)),
          ],
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${service.price.toInt()} MAD', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textDark)),
              GestureDetector(
                onTap: onToggle,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isAdded ? AppColors.primary : Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: isAdded ? AppColors.primary : AppColors.border),
                  ),
                  child: Icon(isAdded ? Icons.close : Icons.add, size: 20, color: isAdded ? Colors.white : AppColors.textDark),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmployeeCard extends StatelessWidget {
  final String? id;
  final String name;
  final bool available;
  final bool isSelected;
  final VoidCallback? onTap;

  const _EmployeeCard({
    this.id,
    required this.name,
    this.available = true,
    required this.isSelected,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final opacity = available ? 1.0 : 0.4;
    return Opacity(
      opacity: opacity,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.only(bottom: 4),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.purpleLight : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppColors.purpleAccent : AppColors.border,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.chipBg,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textGray,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      available ? 'Disponible' : 'Indisponible',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: available ? AppColors.textGray : AppColors.textLight,
                      ),
                    ),
                  ],
                ),
              ),
              if (isSelected)
                Container(
                  width: 22,
                  height: 22,
                  decoration: const BoxDecoration(
                    color: AppColors.purpleAccent,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check, size: 13, color: Colors.white),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
