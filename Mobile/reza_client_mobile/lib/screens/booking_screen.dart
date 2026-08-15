import 'dart:convert';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../constants.dart';
import '../models/group_person.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../services/account_service.dart';
import '../services/api_client.dart';
import '../services/booking_service.dart';
import '../services/discovery_service.dart';
import 'booking_confirmation_screen.dart';
import 'group_person_picker_screen.dart';
import 'login_screen.dart';
import 'venue_detail_screen.dart';

/// Validate a phone number from any country (E.164 range only, not
/// country-specific): optional leading +, 7 to 15 digits, separators
/// (space, dash, dot, parens) tolerated.
bool _isValidPhoneNumber(String phone) {
  final cleaned = phone.replaceAll(RegExp(r'[\s\-().]'), '');
  if (!RegExp(r'^\+?\d+$').hasMatch(cleaned)) return false;
  final digits = cleaned.startsWith('+') ? cleaned.substring(1) : cleaned;
  return digits.length >= 7 && digits.length <= 15;
}

class BookingScreen extends StatefulWidget {
  final String tenantId;
  final VenueItem venue;
  final List<ServiceItem> selectedServices;
  final VoidCallback? onGoToBookings;
  final bool isGroupMode;
  final List<Map<String, dynamic>> accumulatedParticipants;
  final Map<String, dynamic>? prefillParticipant;

  const BookingScreen({
    super.key,
    required this.tenantId,
    required this.venue,
    required this.selectedServices,
    this.onGoToBookings,
    this.isGroupMode = false,
    this.accumulatedParticipants = const [],
    this.prefillParticipant,
  });

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  int _step = 0;
  List<ServiceItem> _selectedServices = [];
  DateTime? _selectedDate;
  List<DateTime> _bookableDates = [];
  String? _selectedTime;
  List<String> _timeSlots = [];
  bool _datesLoading = false;
  bool _slotsLoading = false;

  /// Maps date string (YYYY-MM-DD) to its available slots.
  /// Dates with empty list or missing entry have no available slots.
  Map<String, List<String>> _dateSlotMap = {};

  String? _selectedEmployeeId;

  bool _submitting = false;

  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  static const _anySentinel = '__any__';

  Map<String, Map<String, String?>> _perServiceEmployeeMap = {};

  /// Professional step sub-phase: 0 = choice card, 1 = per-service selection.
  int _professionalPhase = 0;
  /// Whether the user chose 'Sélectionner par prestation' (per-service mode).
  bool _perServiceMode = false;
  /// Salon employee roster (date-independent capability list, mirroring the web
  /// client's `employees` prop) — lets the professional step run BEFORE the
  /// date & time step.
  List<Map<String, dynamic>> _rosterEmployees = [];
  bool _rosterLoading = false;

  @override
  void initState() {
    super.initState();
    _selectedServices = List.from(widget.selectedServices);
    _loadRoster();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _loadBookableDates();
      if (!mounted) return;
      if (widget.prefillParticipant != null) {
        final p = widget.prefillParticipant!;
        _firstNameController.text = (p['firstName'] ?? '').toString();
        _lastNameController.text = (p['lastName'] ?? '').toString();
        _phoneController.text = (p['phone'] ?? '').toString();
        _emailController.text = (p['email'] ?? '').toString();
      } else {
        final user = context.read<AuthViewModel>().user;
        if (user != null) {
          _emailController.text = user.email;
          _firstNameController.text = user.firstName;
          _lastNameController.text = user.lastName;
          _phoneController.text = user.phone ?? '';
        }
      }
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  List<DateTime> get _nextDays {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return List.generate(14, (i) => today.add(Duration(days: i)));
  }

  /// Transform accumulated participants into the backend existingParticipants format,
  /// but ONLY include participants whose booking date matches [targetDate].
  List<Map<String, dynamic>>? _buildExistingParticipantsForDate(DateTime targetDate) {
    if (widget.accumulatedParticipants.isEmpty) return null;
    final targetKey = _dateApi(targetDate);
    final relevant = <Map<String, dynamic>>[];
    for (final p in widget.accumulatedParticipants) {
      final se = p['serviceEmployees'];
      final svcIds = List<String>.from(p['serviceIds'] ?? []);
      final startIso = p['startTimeIso'] ?? '';
      if (startIso.isEmpty) continue;
      final startTime = DateTime.tryParse(startIso)?.toLocal();
      if (startTime == null) continue;
      final pDateKey = _dateApi(startTime);
      if (pDateKey != targetKey) continue;
      final timeStr = '${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}';
      int totalDur = 0;
      for (final s in _selectedServices) {
        if (svcIds.contains(s.id)) totalDur += s.durationMin;
      }
      if (totalDur == 0) totalDur = 60;
      relevant.add(<String, dynamic>{
        'serviceIds': svcIds,
        'startTime': timeStr,
        'duration': totalDur,
        if (se != null) 'serviceEmployees': List<Map<String, dynamic>>.from(se),
      });
    }
    return relevant.isNotEmpty ? relevant : null;
  }

  Future<List<String>> _fetchSlotsForDate(DateTime date) async {
    final ids = _selectedServices.map((s) => s.id).where((id) => id.isNotEmpty).toList();
    if (ids.isEmpty) return [];
    final auth = context.read<AuthViewModel>();

    final existingParticipants = _buildExistingParticipantsForDate(date);

    return discoveryService.getAvailableSlots(
      tenantId: widget.tenantId,
      date: _dateApi(date),
      serviceIds: ids,
      existingParticipants: existingParticipants,
      clientId: auth.user?.id,
      clientPhone: auth.user?.phone,
      clientEmail: auth.user?.email,
    );
  }

  Future<void> _loadBookableDates() async {
    if (_selectedServices.isEmpty) return;
    setState(() {
      _datesLoading = true;
      _selectedTime = null;
      _timeSlots = [];
      _dateSlotMap = {};
    });

    try {
      final dates = _nextDays;

      // Fetch slots for all 14 days in parallel to know which days are bookable.
      final results = await Future.wait(
        dates.map((d) => _fetchSlotsForDate(d)),
      );

      if (!mounted) return;

      final slotMap = <String, List<String>>{};
      for (var i = 0; i < dates.length; i++) {
        slotMap[_dateApi(dates[i])] = results[i];
      }

      final targetDate = _selectedDate ?? dates.first;
      final targetKey = _dateApi(targetDate);

      // If the target date has no slots, auto-select the first available date.
      var effectiveDate = targetDate;
      var effectiveKey = targetKey;
      if ((slotMap[targetKey]?.isEmpty ?? true) && slotMap.isNotEmpty) {
        for (final d in dates) {
          final k = _dateApi(d);
          if (slotMap[k]?.isNotEmpty ?? false) {
            effectiveDate = d;
            effectiveKey = k;
            break;
          }
        }
      }

      setState(() {
        _bookableDates = dates;
        _dateSlotMap = slotMap;
        _selectedDate = effectiveDate;
        _timeSlots = slotMap[effectiveKey] ?? [];
        _datesLoading = false;
        _slotsLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _bookableDates = _nextDays;
        _dateSlotMap = {};
        _selectedDate ??= _bookableDates.isNotEmpty ? _bookableDates.first : null;
        _datesLoading = false;
      });
      await _loadSlots();
    }
  }

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

  List<String> get _serviceIds =>
      _selectedServices.map((s) => s.id).where((id) => id.isNotEmpty).toList();

  /// Loads the salon's employee roster (no date/time needed) so the
  /// professional step can run BEFORE the date & time step, mirroring web.
  Future<void> _loadRoster() async {
    if (_rosterEmployees.isNotEmpty || _rosterLoading) return;
    setState(() => _rosterLoading = true);
    try {
      final roster = await discoveryService.getEmployees(widget.tenantId);
      if (!mounted) return;
      setState(() {
        _rosterEmployees = roster;
        _rosterLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _rosterLoading = false);
    }
  }

  /// Employees capable of performing [svc] (from the roster). An employee with
  /// no service mapping is treated as capable of everything, like the web.
  List<Map<String, dynamic>> _capableEmployeesForService(ServiceItem svc) {
    if (_rosterEmployees.isEmpty) return [];
    return _rosterEmployees.where((emp) {
      final services = emp['services'] as List?;
      if (services == null || services.isEmpty) return true;
      return services.any((s) {
        if (s is Map) {
          // Roster services come back as {id, name, category}; be defensive
          // and also accept a serviceId key (parity with the web filter).
          final sid = s['id']?.toString() ?? s['serviceId']?.toString();
          final sname = s['name']?.toString();
          return sid == svc.id || sid == svc.name || sname == svc.name || sname == svc.id;
        }
        return s.toString() == svc.id || s.toString() == svc.name;
      });
    }).toList();
  }

  /// Resolves every 'Sans préférence' selection to the first capable employee
  /// in the background — the user still sees 'Sans préférence' in the UI, but
  /// the booking locks a real employee before the date step, like the web.
  Map<String, String> _resolvePerServiceAny() {
    final resolved = <String, String>{};
    for (final svc in _selectedServices) {
      final key = svc.id.isNotEmpty ? svc.id : svc.name;
      final current = _perServiceEmployeeMap['booker']?[key];
      if (current != null && current != _anySentinel && current.isNotEmpty) {
        resolved[key] = current;
      } else {
        final capable = _capableEmployeesForService(svc);
        resolved[key] = capable.isNotEmpty
            ? (capable.first['id']?.toString() ?? _anySentinel)
            : _anySentinel;
      }
    }
    return resolved;
  }

  Future<void> _loadSlots() async {
    if (_selectedDate == null || _selectedServices.isEmpty) return;
    setState(() {
      _slotsLoading = true;
      _selectedTime = null;
      // Keep _selectedEmployeeId + _perServiceEmployeeMap: the professional
      // step already ran, so changing the date must NOT wipe employee choices.
    });
    try {
      final slots = await _fetchSlotsForDate(_selectedDate!);
      if (!mounted) return;
      setState(() {
        _timeSlots = slots;
        _slotsLoading = false;
        // Update the slot map for this date
        if (_selectedDate != null) {
          _dateSlotMap[_dateApi(_selectedDate!)] = slots;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _timeSlots = [];
        _slotsLoading = false;
      });
    }
  }

  void _onEmployeeChanged(String serviceId, String? employeeId) {
    final current = Map<String, String?>.from(_perServiceEmployeeMap['booker'] ?? {});
    current[serviceId] = employeeId;

    String? overallEmployeeId;
    final distinct = current.values.whereType<String>().toSet();
    overallEmployeeId = distinct.length == 1 ? distinct.first : null;

    setState(() {
      _perServiceEmployeeMap['booker'] = current;
      _selectedEmployeeId = overallEmployeeId;
    });
  }

  void _goBack() {
    if (_step == 0 && _professionalPhase == 1) {
      // Back from the per-service step → the professional choice card.
      setState(() => _professionalPhase = 0);
    } else if (_step == 3) {
      // Back from the recap → the contact step (if shown) or the date step.
      setState(() => _step = _needsContactStep() ? 2 : 1);
    } else if (_step > 0) {
      setState(() => _step--);
    } else {
      Navigator.pop(context);
    }
  }

  void _continueFromDateTime() {
    // Authenticated users with complete info skip 'Vos informations' and land
    // directly on the recap (mirrors the web's conditional step 4).
    setState(() => _step = _needsContactStep() ? 2 : 3);
  }

  /// True when every selected service has an employee choice (or 'Sans préférence').
  bool get _perServiceSelectionComplete {
    final map = _perServiceEmployeeMap['booker'] ?? {};
    return _selectedServices.every((svc) {
      final key = svc.id.isNotEmpty ? svc.id : svc.name;
      final val = map[key];
      return val != null && (val == _anySentinel || val.isNotEmpty);
    });
  }

  /// Continue from the professional choice card (phase 0).
  void _continueFromProfessionalChoice() {
    if (!_perServiceMode) {
      // 'Sans préférence' — auto-assign in the background, then go to date.
      setState(() {
        _perServiceEmployeeMap['booker'] = _resolvePerServiceAny();
        _selectedEmployeeId = _anySentinel;
        _step = 1;
      });
      return;
    }
    // 'Sélectionner par prestation' — pre-fill all services with 'Sans
    // préférence', then show the per-service step (phase 1).
    final updated = Map<String, String?>.from(_perServiceEmployeeMap['booker'] ?? {});
    for (final svc in _selectedServices) {
      final key = svc.id.isNotEmpty ? svc.id : svc.name;
      updated.putIfAbsent(key, () => _anySentinel);
    }
    setState(() {
      _perServiceEmployeeMap['booker'] = updated;
      _professionalPhase = 1;
    });
  }

  void _continueFromProfessional() {
    // Phase 1 — resolve any remaining 'Sans préférence', then go to date.
    setState(() {
      _perServiceEmployeeMap['booker'] = _resolvePerServiceAny();
      _selectedEmployeeId = _anySentinel;
      _step = 1;
    });
  }

  /// True when the current person's contact info can't be derived from the
  /// session (guest booker) or the person picker (participant without
  /// name/phone) — in that case the 'Vos informations' step is shown before
  /// the recap, mirroring the web's conditional step 4.
  bool _needsContactStep() {
    if (widget.prefillParticipant != null) {
      final p = widget.prefillParticipant!;
      // Saved proche: all their info is already on the DB — skip the form.
      if (p['familyMemberId'] != null) return false;
      final name = '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim();
      final phone = (p['phone'] ?? '').toString();
      return name.isEmpty || phone.isEmpty;
    }
    final user = context.read<AuthViewModel>().user;
    if (user == null) return true; // guest booker → must provide contact info
    // `user` is promoted to non-null here; firstName is non-nullable.
    return user.firstName.trim().isEmpty || (user.phone ?? '').trim().isEmpty;
  }

  /// Build the participant payload for the backend, or null (with an error
  /// snackbar) when required fields are missing.
  Map<String, dynamic>? _buildParticipantData() {
    final auth = context.read<AuthViewModel>();
    final user = auth.user;
    final isAddingGuest = widget.prefillParticipant != null;

    String pickField({
      required bool overrideWithInput,
      required String? userValue,
      required String inputValue,
    }) {
      if (!overrideWithInput && userValue != null && userValue.isNotEmpty) {
        return userValue;
      }
      return inputValue;
    }

    final firstName = pickField(
      overrideWithInput: isAddingGuest,
      userValue: user?.firstName,
      inputValue: _firstNameController.text.trim(),
    );
    final lastName = pickField(
      overrideWithInput: isAddingGuest,
      userValue: user?.lastName,
      inputValue: _lastNameController.text.trim(),
    );
    final phone = pickField(
      overrideWithInput: isAddingGuest,
      userValue: user?.phone,
      inputValue: _phoneController.text.trim(),
    );
    final email = pickField(
      overrideWithInput: isAddingGuest,
      userValue: user?.email,
      inputValue: _emailController.text.trim(),
    );

    if (firstName.isEmpty || phone.isEmpty || (!isAddingGuest && lastName.isEmpty)) {
      _showError('Veuillez remplir tous les champs obligatoires.');
      return null;
    }
    if (phone.isNotEmpty && !_isValidPhoneNumber(phone)) {
      _showError('Format de numéro invalide. Entrez un vrai numéro de téléphone.');
      return null;
    }
    if (_selectedDate == null || _selectedTime == null) {
      _showError('Veuillez choisir une date et une heure.');
      return null;
    }

    final serviceIds = _serviceIds;
    if (serviceIds.isEmpty) {
      _showError('Erreur lors de la création de la réservation.');
      return null;
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

    final bookerPerSvcMap = _perServiceEmployeeMap['booker'];

    List<Map<String, dynamic>>? serviceEmployees;
    if (bookerPerSvcMap != null && bookerPerSvcMap.isNotEmpty) {
      final entries = <Map<String, dynamic>>[];
      for (final sid in serviceIds) {
        final empId = bookerPerSvcMap[sid];
        if (empId != null && empId.isNotEmpty && empId != _anySentinel) {
          entries.add({'serviceId': sid, 'employeeId': empId});
        } else {
          entries.add({'serviceId': sid, 'employeeId': null});
        }
      }
      serviceEmployees = entries.isNotEmpty ? entries : null;
    } else {
      final aggregate = _selectedEmployeeId == _anySentinel ? null : _selectedEmployeeId;
      if (aggregate != null && aggregate.isNotEmpty) {
        serviceEmployees = serviceIds
            .map((sid) => {'serviceId': sid, 'employeeId': aggregate})
            .toList();
      }
    }

    // Snapshot of service details + employee names so the recap can render
    // THIS person's card accurately even after their services differ from
    // the current screen's selection (each participant has their own set).
    final serviceDetails = _selectedServices.map((s) => <String, dynamic>{
      'serviceId': s.id.isNotEmpty ? s.id : s.name,
      'name': s.name,
      'durationMin': s.durationMin,
      'price': s.price,
    }).toList();
    final employeeNames = <String, String>{};
    for (final svc in _selectedServices) {
      final key = svc.id.isNotEmpty ? svc.id : svc.name;
      final eid = bookerPerSvcMap?[key];
      if (eid != null && eid.isNotEmpty && eid != _anySentinel) {
        employeeNames[key] = _employeeNameForId(eid);
      }
    }

    return <String, dynamic>{
      'firstName': firstName,
      'lastName': lastName,
      'phone': phone,
      if (email.isNotEmpty) 'email': email,
      // Carry the family-member id so a later step can prevent re-adding the
      // same proche to this group-booking session.
      if (widget.prefillParticipant?['familyMemberId'] != null)
        'familyMemberId': widget.prefillParticipant!['familyMemberId'],
      // Avatar for the recap (proche photos; booker uses the session avatar).
      if (widget.prefillParticipant?['avatar'] != null)
        'avatar': widget.prefillParticipant!['avatar'],
      'serviceIds': serviceIds,
      'startTimeIso': startLocal.toUtc().toIso8601String(),
      if (serviceEmployees != null) 'serviceEmployees': serviceEmployees,
      'serviceDetails': serviceDetails,
      if (employeeNames.isNotEmpty) 'employeeNames': employeeNames,
    };
  }

  /// 'Vos informations' → recap (light validation; the real check runs at confirm).
  void _continueFromContact() {
    if (_buildParticipantData() == null) return;
    setState(() => _step = 3);
  }

  /// Recap → finalize: single booking or the whole group.
  Future<void> _confirmBooking() async {
    if (_submitting) return;
    final participantData = _buildParticipantData();
    if (participantData == null) return;
    if (widget.isGroupMode) {
      final allParticipants = [...widget.accumulatedParticipants, participantData];
      await _finalizeGroupBooking(allParticipants);
    } else {
      await _submitSingleBooking(participantData);
    }
  }

  /// Recap → pick another person for the group, then relaunch their flow with
  /// the accumulated participants so far.
  Future<void> _addAnotherPerson() async {
    if (_submitting) return;
    final participantData = _buildParticipantData();
    if (participantData == null) return;
    final allParticipants = [...widget.accumulatedParticipants, participantData];

    final auth = context.read<AuthViewModel>();
    if (!auth.isAuthenticated || auth.email == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Veuillez vous connecter d'abord", style: GoogleFonts.inter(fontSize: 13)),
          backgroundColor: AppColors.primary,
          behavior: SnackBarBehavior.floating,
        ),
      );
      final loginResult = await Navigator.push<bool>(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen(returnResultOnSuccess: true)),
      );
      if (loginResult != true || !mounted) return;
    }

    // People already accumulated in THIS session (booker + prior
    // participants) — used by the picker to block duplicates.
    final alreadyAdded = allParticipants
        .map((p) => GroupPerson(
              firstName: (p['firstName'] ?? '').toString(),
              lastName: (p['lastName'] ?? '').toString(),
              phone: (p['phone'] ?? '').toString().isEmpty
                  ? null
                  : p['phone'].toString(),
              familyMemberId: p['familyMemberId']?.toString(),
            ))
        .toList();

    final person = await Navigator.push<GroupPerson>(
      context,
      MaterialPageRoute(
        builder: (_) => GroupPersonPickerScreen(alreadyAdded: alreadyAdded),
      ),
    );
    if (!mounted || person == null) return;      if (person.saveAsProche) {
      try {
        final currentAuth = context.read<AuthViewModel>();
        await accountService.createFamilyMember(
          clientEmail: currentAuth.email!,
          firstName: person.firstName,
          lastName: person.lastName,
          phone: person.phone,
          relationship: person.relationship?.isNotEmpty == true
              ? person.relationship!
              : 'Ami(e)',
        );
      } catch (_) {}
    }
    if (!mounted) return;

    Navigator.popUntil(context, (route) => route.isFirst);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => VenueDetailScreen(
          tenantId: widget.tenantId,
          onGoToBookings: widget.onGoToBookings,
          autoStartGroupBooking: true,
          accumulatedParticipants: allParticipants,
          prefillParticipant: {
            'firstName': person.firstName,
            'lastName': person.lastName,
            'phone': person.phone ?? '',
            if (person.email != null) 'email': person.email,
            if (person.familyMemberId != null) 'familyMemberId': person.familyMemberId,
            if (person.avatar != null) 'avatar': person.avatar,
          },
        ),
      ),
    );
  }

  Future<void> _submitSingleBooking(Map<String, dynamic> participant) async {
    setState(() => _submitting = true);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
    );

    try {
      final result = await bookingService.createBooking(
        tenantId: widget.tenantId,
        firstName: participant['firstName'],
        lastName: participant['lastName'],
        phone: participant['phone'],
        email: participant['email'],
        serviceIds: List<String>.from(participant['serviceIds']),
        startTimeIso: participant['startTimeIso'],
        serviceEmployees: participant['serviceEmployees'] != null
            ? List<Map<String, dynamic>>.from(participant['serviceEmployees'])
            : null,
      );
      if (!mounted) return;
      Navigator.pop(context);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => BookingConfirmationScreen(
            venue: widget.venue,
            services: _selectedServices,
            date: _formatFullDate(_selectedDate!),
            time: _selectedTime!,
            bookingResult: result,
            onGoToBookings: widget.onGoToBookings,
          ),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        Navigator.pop(context);
        _showError(e.message);
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

  Future<void> _finalizeGroupBooking(List<Map<String, dynamic>> allParticipants) async {
    setState(() => _submitting = true);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
    );

    try {
      final booker = allParticipants.first;
      final guests = allParticipants.skip(1).map((p) {
        final se = p['serviceEmployees'];
        return {
          'name': '${p['firstName']} ${p['lastName']}',
          'sameServicesAsBooker': false,
          'serviceIds': p['serviceIds'],
          'startTime': p['startTimeIso'],
          if (se != null) 'serviceEmployees': se,
          if (p['phone'] != null && (p['phone'] as String).isNotEmpty) 'phone': p['phone'],
          if (p['email'] != null && (p['email'] as String).isNotEmpty) 'email': p['email'],
        };
      }).toList();

      final result = await bookingService.createBooking(
        tenantId: widget.tenantId,
        firstName: booker['firstName'],
        lastName: booker['lastName'],
        phone: booker['phone'],
        email: booker['email'],
        serviceIds: List<String>.from(booker['serviceIds']),
        startTimeIso: booker['startTimeIso'],
        serviceEmployees: booker['serviceEmployees'] != null
            ? List<Map<String, dynamic>>.from(booker['serviceEmployees'])
            : null,
        participants: guests.isNotEmpty ? guests : null,
      );
      if (!mounted) return;
      Navigator.pop(context);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => BookingConfirmationScreen(
            venue: widget.venue,
            services: _selectedServices,
            date: _formatFullDate(_selectedDate!),
            time: _selectedTime!,
            bookingResult: result,
            onGoToBookings: widget.onGoToBookings,
          ),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        Navigator.pop(context);
        _showError(e.message);
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

  Widget _stepBody() {
    if (_step == 0) return _buildProfessionalStep();
    if (_step == 1) return _buildDateTimeStep();
    if (_step == 2) return _buildGuestStep();
    return _buildRecapStep();
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

  /// Whether this screen is configuring a participant (vs the booker).
  bool get _isParticipant => widget.prefillParticipant != null;
  String get _personLabel {
    if (!_isParticipant) return 'Pour vous';
    final p = widget.prefillParticipant!;
    final name = '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim();
    return name.isNotEmpty ? 'Pour $name' : 'Pour vous';
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              IconButton(icon: const Icon(Icons.arrow_back, color: AppColors.textDark, size: 22), onPressed: _goBack),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close, color: AppColors.textDark, size: 22),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          // The 'Pour vous / Pour [Nom]' banner is only meaningful while the
          // user is configuring someone mid-flow. On the recap (step 3) every
          // participant is already individually labeled, so hide it there.
          if (_step != 3)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: _isParticipant
                      ? AppColors.primary.withValues(alpha: 0.08)
                      : AppColors.purpleAccent.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  _personLabel,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _isParticipant ? AppColors.primary : AppColors.purpleAccent,
                  ),
                ),
              ),
            ),
        ],
      ),
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
        if (_datesLoading)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
          )
        else if (_bookableDates.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Text(
              'Aucune date disponible pour le moment.',
              style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
            ),
          )
        else
          SizedBox(
            height: 82,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: _bookableDates.length,
              itemBuilder: (context, index) {
                final date = _bookableDates[index];
                final dateKey = _dateApi(date);
                final isSelected = _selectedDate?.day == date.day &&
                    _selectedDate?.month == date.month &&
                    _selectedDate?.year == date.year;
                final hasSlots = _dateSlotMap.isNotEmpty
                    ? (_dateSlotMap[dateKey]?.isNotEmpty ?? false)
                    : true;
                return GestureDetector(
                  onTap: hasSlots
                      ? () {
                          setState(() {
                            _selectedDate = date;
                            _selectedTime = null;
                          });
                          _loadSlots();
                        }
                      : null,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.only(right: 10),
                    width: 60,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.purpleAccent
                          : hasSlots
                              ? Colors.white
                              : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.purpleAccent
                            : hasSlots
                                ? AppColors.border
                                : Colors.grey.shade300,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _dayAbbr(date),
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: isSelected
                                ? Colors.white70
                                : hasSlots
                                    ? AppColors.textGray
                                    : Colors.grey.shade400,
                          ),
                        ),
                        Text(
                          '${date.day}',
                          style: GoogleFonts.inter(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: isSelected
                                ? Colors.white
                                : hasSlots
                                    ? AppColors.textDark
                                    : Colors.grey.shade400,
                          ),
                        ),
                        Text(
                          _monthAbbr(date),
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            color: isSelected
                                ? Colors.white70
                                : hasSlots
                                    ? AppColors.textGray
                                    : Colors.grey.shade400,
                          ),
                        ),
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
            _professionalPhase == 0
                ? 'Choisissez votre\nprofessionnel'
                : 'Professionnel par\npersonnel',
            style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textDark),
          ),
        ),
        Expanded(
          child: _rosterLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))                  : _rosterEmployees.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Aucun professionnel disponible.',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Vous pouvez continuer : l\'attribution des professionnels se fera automatiquement.',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(fontSize: 12, color: AppColors.textLight),
                            ),
                          ],
                        ),
                      ),
                    )
                  : _professionalPhase == 0
                      ? _buildProfessionalChoice()
                      : _buildPerServiceSelection(),
        ),
        _bottomBar(
          priceLabel: '${_totalPrice.toInt()} MAD',
          subtitle: _professionalPhase == 0
              ? (_perServiceMode ? 'Sélection par personnel' : 'Attribution automatique')
              : _perServiceSelectionComplete
                  ? 'Prestations assignées'
                  : 'Sélectionnez pour chaque prestation',
          onContinue: _rosterLoading
              ? null
              : _professionalPhase == 0
                  ? _continueFromProfessionalChoice
                  : (_perServiceSelectionComplete ? _continueFromProfessional : null),
        ),
      ],
    );
  }

  /// Phase 0: choice card — 'Sans préférence' (default) or per-service.
  Widget _buildProfessionalChoice() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      children: [
        Text(
          'Comment souhaitez-vous choisir le(s) professionnel(s) pour vos prestations ?',
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray, height: 1.4),
        ),
        const SizedBox(height: 16),
        _ProfessionalChoiceCard(
          icon: Icons.shuffle_rounded,
          title: 'Sans préférence',
          subtitle: 'Attribution automatique — les meilleurs professionnels disponibles seront choisis pour chaque service.',
          selected: !_perServiceMode,
          onTap: () => setState(() {
            _perServiceMode = false;
            _selectedEmployeeId = _anySentinel;
            _perServiceEmployeeMap['booker'] = {};
          }),
        ),
        const SizedBox(height: 12),
        _ProfessionalChoiceCard(
          icon: Icons.groups_rounded,
          title: 'Sélectionner par personnel',
          subtitle: 'Choisissez un professionnel différent pour chaque prestation.',
          selected: _perServiceMode,
          onTap: () => setState(() => _perServiceMode = true),
        ),
      ],
    );
  }

  /// Phase 1: per-service employee selection (only in per-service mode).
  Widget _buildPerServiceSelection() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      children: [
        Text(
          'Sélectionnez un professionnel pour chaque prestation.',
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray, height: 1.4),
        ),
        const SizedBox(height: 16),
        ..._selectedServices.map((svc) {
          final key = svc.id.isNotEmpty ? svc.id : svc.name;
          final currentEmpId = _perServiceEmployeeMap['booker']?[key];
          final capable = _capableEmployeesForService(svc);
          return Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  svc.name,
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textDark),
                ),
                const SizedBox(height: 8),
                ..._buildAnyCard(capable, currentEmpId, () => _onEmployeeChanged(key, _anySentinel)),
                ...capable.map((emp) {
                  final id = emp['id']?.toString() ?? '';
                  final firstName = emp['firstName']?.toString() ?? '';
                  final lastName = emp['lastName']?.toString() ?? '';
                  final name = '$firstName $lastName'.trim();
                  return _EmployeeCard(
                    id: id,
                    name: name.isEmpty ? 'Professionnel' : name,
                    avatarUrl: emp['avatar']?.toString(),
                    available: true,
                    isSelected: currentEmpId == id,
                    onTap: () => _onEmployeeChanged(key, id),
                  );
                }),
              ],
            ),
          );
        }),
      ],
    );
  }

  List<Widget> _buildAnyCard(List<Map<String, dynamic>> employees, String? selectedId, VoidCallback onSelect) {
    // Roster entries have no 'available' flag (no date picked yet) — treat them
    // as available. Availability-based lists carry explicit true/false.
    final anyRealAvailable = employees.isEmpty ||
        employees.any((emp) => emp['available'] == null || emp['available'] == true);
    return [
      GestureDetector(
        onTap: anyRealAvailable ? onSelect : null,
        child: Opacity(
          opacity: anyRealAvailable ? 1.0 : 0.4,
          child: Container(
            margin: const EdgeInsets.only(bottom: 4),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: selectedId == _anySentinel ? AppColors.purpleLight : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selectedId == _anySentinel ? AppColors.purpleAccent : AppColors.border,
                width: selectedId == _anySentinel ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: AppColors.chipBg,
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.shuffle, size: 18, color: AppColors.textGray),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sans préférence',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textDark,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        anyRealAvailable ? 'Disponible' : 'Indisponible',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: AppColors.textGray,
                        ),
                      ),
                    ],
                  ),
                ),
                if (selectedId == _anySentinel)
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
      ),
      const SizedBox(height: 4),
    ];
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
              onPressed: _submitting ? null : _continueFromContact,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text('Continuer', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Recap step (final) — mirrors the web's phase 4/5: appointment state,
  //  prior participants, 'Ajouter une personne' (group only) and confirm.
  // ═══════════════════════════════════════════════════════════════

  double get _groupTotal {
    var total = _totalPrice;
    for (final p in widget.accumulatedParticipants) {
      final details = p['serviceDetails'];
      if (details is List && details.isNotEmpty) {
        // Snapshot: each participant has their own service set.
        for (final d in details) {
          if (d is Map) {
            total += ((d['price'] as num?) ?? 0).toDouble();
          }
        }
      } else {
        // Fallback for older payloads: filter the current selection.
        final svcIds = List<String>.from(p['serviceIds'] ?? []);
        for (final s in _selectedServices) {
          if (svcIds.contains(s.id.isNotEmpty ? s.id : s.name)) total += s.price;
        }
      }
    }
    return total;
  }

  String _durationLabel(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h > 0 && m > 0) return '$h h $m min';
    if (h > 0) return '$h h';
    return '$m min';
  }

  String _employeeNameForId(String? id) {
    if (id == null || id.isEmpty || id == _anySentinel) return 'Attribution automatique';
    for (final emp in _rosterEmployees) {
      if (emp['id']?.toString() == id) {
        final first = emp['firstName']?.toString() ?? '';
        final last = emp['lastName']?.toString() ?? '';
        final name = '$first $last'.trim();
        return name.isEmpty ? 'Professionnel' : name;
      }
    }
    return 'Professionnel';
  }

  /// Interleave subtle dividers between recap service rows so each line reads
  /// as its own unit instead of a dense block of text.
  List<Widget> _withServiceDividers(List<Widget> rows) {
    final out = <Widget>[];
    for (var i = 0; i < rows.length; i++) {
      out.add(rows[i]);
      if (i < rows.length - 1) {
        out.add(const Divider(height: 17, thickness: 1, color: AppColors.border));
      }
    }
    return out;
  }

  /// Display contact line for the current person (picker data, auth user, or
  /// whatever was typed in the contact form — in that priority order).
  String _currentContactLine() {
    if (widget.prefillParticipant != null) {
      final p = widget.prefillParticipant!;
      final name = '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim();
      final phone = (p['phone'] ?? '').toString();
      return phone.isNotEmpty ? '$name · $phone' : name;
    }
    final user = context.read<AuthViewModel>().user;
    final name = _firstNameController.text.trim().isNotEmpty
        ? '${_firstNameController.text.trim()} ${_lastNameController.text.trim()}'.trim()
        : '${user?.firstName ?? ''} ${user?.lastName ?? ''}'.trim();
    final phone = _phoneController.text.trim().isNotEmpty
        ? _phoneController.text.trim()
        : (user?.phone ?? '');
    return phone.isNotEmpty ? '$name · $phone' : name;
  }

  /// Current person's per-service employee map (serviceId -> employeeId).
  Map<String, String> _currentPersonEmployees() {
    final map = _perServiceEmployeeMap['booker'] ?? {};
    final out = <String, String>{};
    for (final svc in _selectedServices) {
      final key = svc.id.isNotEmpty ? svc.id : svc.name;
      final eid = map[key]?.toString();
      if (eid != null && eid.isNotEmpty) out[key] = eid;
    }
    return out;
  }

  Widget _buildRecapStep() {
    final personName = _personLabel;
    final contact = _currentContactLine();
    final currentEmps = _currentPersonEmployees();

    final servicesRows = _selectedServices.map((s) {
      final key = s.id.isNotEmpty ? s.id : s.name;
      return _RecapServiceRow(
        name: s.name,
        durationLabel: _durationLabel(s.durationMin),
        price: s.price,
        employee: _employeeNameForId(currentEmps[key]),
      );
    }).toList();

    final priorCards = widget.accumulatedParticipants.map((p) {
      // Prefer the snapshot (each participant has their own service set);
      // fall back to filtering the current selection for older payloads.
      final details = p['serviceDetails'];
      final employeeNames = p['employeeNames'];
      final startIso = p['startTimeIso']?.toString() ?? '';
      String dateTime = '';
      if (startIso.isNotEmpty) {
        final t = DateTime.tryParse(startIso)?.toLocal();
        if (t != null) {
          final d = DateTime(t.year, t.month, t.day);
          dateTime =
              '${_formatFullDate(d)} à ${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
        }
      }

      List<Widget> rows = [];
      if (details is List && details.isNotEmpty) {
        rows = details.map((d) {
          final key = (d is Map) ? (d['serviceId']?.toString() ?? '') : '';
          String emp = '';
          if (employeeNames is Map) {
            emp = (employeeNames[key] ?? '').toString();
          }
          return _RecapServiceRow(
            name: (d is Map ? d['name'] ?? '' : '').toString(),
            durationLabel: _durationLabel(((d is Map ? d['durationMin'] : null) as num?)?.toInt() ?? 0),
            price: ((d is Map ? d['price'] : null) as num?)?.toDouble() ?? 0,
            employee: emp.isEmpty ? 'Attribution automatique' : emp,
          );
        }).toList();
      } else {
        final pSvcIds = List<String>.from(p['serviceIds'] ?? []);
        final pServices = _selectedServices
            .where((s) => pSvcIds.contains(s.id.isNotEmpty ? s.id : s.name))
            .toList();
        final seMap = <String, String>{};
        final se = p['serviceEmployees'];
        if (se is List) {
          for (final e in se) {
            if (e is Map) {
              final sid = e['serviceId']?.toString();
              final eid = e['employeeId']?.toString();
              if (sid != null && eid != null && sid.isNotEmpty && eid.isNotEmpty) {
                seMap[sid] = eid;
              }
            }
          }
        }
        rows = pServices.map((s) {
          final key = s.id.isNotEmpty ? s.id : s.name;
          return _RecapServiceRow(
            name: s.name,
            durationLabel: _durationLabel(s.durationMin),
            price: s.price,
            employee: _employeeNameForId(seMap[key]),
          );
        }).toList();
      }

      return _RecapPersonCard(
        name: '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim(),
        avatarUrl: (p['avatar'] ?? '').toString(),
        isBooker: false,
        dateTime: dateTime,
        contact: null,
        services: _withServiceDividers(rows),
      );
    }).toList();

    final total = widget.isGroupMode ? _groupTotal : _totalPrice;
    final peopleCount = widget.accumulatedParticipants.length + 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
          child: Text(
            'Récapitulatif de la réservation',
            style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textDark),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            children: [
              _RecapPersonCard(
                name: personName,
                avatarUrl: context.read<AuthViewModel>().user?.avatar ?? '',
                isBooker: true,
                dateTime: '${_formatFullDate(_selectedDate!)} à $_selectedTime',
                contact: contact,
                services: _withServiceDividers(servicesRows),
              ),
              ...priorCards,
              if (widget.isGroupMode) ...[const SizedBox(height: 4), _AddPersonCard(onTap: _addAnotherPerson)],
            ],
          ),
        ),
        _bottomBar(
          priceLabel: '${total.toInt()} MAD',
          subtitle: widget.isGroupMode
              ? '$peopleCount personne${peopleCount > 1 ? 's' : ''} · ${_selectedServices.length} prestation${_selectedServices.length > 1 ? 's' : ''}'
              : '${_selectedServices.length} prestation${_selectedServices.length > 1 ? 's' : ''}',
          onContinue: _confirmBooking,
          label: 'Confirmer',
        ),
      ],
    );
  }

  Widget _bottomBar({
    required String priceLabel,
    String? subtitle,
    VoidCallback? onContinue,
    String label = 'Continuez',
  }) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -4))],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  priceLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textDark, height: 1.2),
                ),
                if (subtitle != null) ...[const SizedBox(height: 3), Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray, height: 1.3),
                )],
              ],
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: onContinue,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: BoxDecoration(
                color: onContinue != null ? AppColors.primary : AppColors.border,
                borderRadius: BorderRadius.circular(28),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: onContinue != null ? Colors.white : AppColors.textGray,
                    ),
                  ),
                  if (onContinue != null) ...[const SizedBox(width: 6), const Icon(Icons.arrow_forward, color: Colors.white, size: 18)],
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

/// Circular employee avatar — shows the profile photo when available, and
/// falls back to the name initial otherwise (booking step 2).
class _EmployeeAvatar extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  const _EmployeeAvatar({required this.name, this.avatarUrl});

  @override
  Widget build(BuildContext context) {
    final initials = name.isNotEmpty ? name[0].toUpperCase() : '?';
    final fallback = Container(
      width: 36,
      height: 36,
      decoration: const BoxDecoration(
        color: AppColors.chipBg,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          initials,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.textGray,
          ),
        ),
      ),
    );

    final url = avatarUrl?.trim() ?? '';
    if (url.isEmpty) return fallback;

    return ClipOval(
      child: SizedBox(
        width: 36,
        height: 36,
        child: Image.network(
          url,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => fallback,
          loadingBuilder: (context, child, progress) {
            if (progress == null) return child;
            return Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: AppColors.chipBg,
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textGray),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _EmployeeCard extends StatelessWidget {
  final String? id;
  final String name;
  final String? avatarUrl;
  final bool available;
  final bool isSelected;
  final VoidCallback? onTap;

  const _EmployeeCard({
    this.id,
    required this.name,
    this.avatarUrl,
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
              _EmployeeAvatar(
                name: name,
                avatarUrl: avatarUrl,
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

class _RecapServiceRow extends StatelessWidget {
  final String name;
  final String durationLabel;
  final double price;
  final String employee;

  const _RecapServiceRow({
    required this.name,
    required this.durationLabel,
    required this.price,
    this.employee = 'Attribution automatique',
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              employee == 'Attribution automatique' ? name : '$name par $employee',
              style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark, height: 1.3),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '$durationLabel · ${price.toInt()} MAD',
            style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray, height: 1.3),
          ),
        ],
      ),
    );
  }
}

/// Round participant avatar for the recap — fetches http or base64 data: URLs
/// (proche photos are often stored as data URIs), with a crown over the
/// booker's avatar to mark who is creating the appointment.
class _PersonAvatar extends StatelessWidget {
  final String name;
  final String avatarUrl;
  final bool isBooker;
  const _PersonAvatar({required this.name, required this.avatarUrl, this.isBooker = false});

  @override
  Widget build(BuildContext context) {
    final initials = name.isNotEmpty ? name[0].toUpperCase() : '?';
    Widget fallback({Color? bg, Color? fg}) => Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: bg ?? AppColors.primary.withValues(alpha: 0.08),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              initials,
              style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: fg ?? AppColors.primary),
            ),
          ),
        );

    final src = avatarUrl.trim();
    Widget avatar;
    if (src.isEmpty) {
      avatar = fallback();
    } else if (src.startsWith('data:')) {
      try {
        avatar = ClipOval(
          child: SizedBox(
            width: 38,
            height: 38,
            child: Image.memory(
              base64Decode(src.split(',').last),
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => fallback(bg: AppColors.chipBg, fg: AppColors.textGray),
            ),
          ),
        );
      } catch (_) {
        avatar = fallback();
      }
    } else {
      avatar = ClipOval(
        child: SizedBox(
          width: 38,
          height: 38,
          child: Image.network(
            src,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => fallback(bg: AppColors.chipBg, fg: AppColors.textGray),
          ),
        ),
      );
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        avatar,
        if (isBooker)
          Positioned(
            top: -9,
            right: -8,
            child: Icon(FontAwesomeIcons.crown, size: 15, color: const Color(0xFFF59E0B)),
          ),
      ],
    );
  }
}

class _RecapPersonCard extends StatelessWidget {
  final String name;
  final String avatarUrl;
  final bool isBooker;
  final String dateTime;
  final String? contact;
  final List<Widget> services;

  const _RecapPersonCard({
    required this.name,
    this.avatarUrl = '',
    this.isBooker = false,
    required this.dateTime,
    this.contact,
    required this.services,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _PersonAvatar(name: name, avatarUrl: avatarUrl, isBooker: isBooker),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                    if (contact != null && contact!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Text(contact!, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray)),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (dateTime.isNotEmpty) ...[const SizedBox(height: 16), Text(dateTime, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark))],
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 6),
          ...services,
        ],
      ),
    );
  }
}

class _AddPersonCard extends StatelessWidget {
  final VoidCallback onTap;
  const _AddPersonCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.primary.withValues(alpha: 0.06),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: AppColors.primary.withValues(alpha: 0.35)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                child: const Icon(Icons.person_add_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ajouter une personne à la réservation',
                      style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textDark),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Choisissez un proche ou un invité',
                      style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textGray),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfessionalChoiceCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  const _ProfessionalChoiceCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? AppColors.purpleLight : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.purpleAccent : AppColors.border,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: selected ? AppColors.purpleAccent : AppColors.chipBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: selected ? Colors.white : AppColors.textGray, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textDark,
                          ),
                        ),
                      ),
                      if (selected)
                        const Icon(Icons.check_circle_rounded, color: AppColors.purpleAccent, size: 20),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.textGray,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
