import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants.dart';
import 'booking_screen.dart';

class BookingSummaryScreen extends StatefulWidget {
  final String tenantId;
  final VenueItem venue;
  final Set<String> selectedServiceIds;
  final VoidCallback? onGoToBookings;
  final bool isGroupMode;
  final List<Map<String, dynamic>> accumulatedParticipants;
  final Map<String, dynamic>? prefillParticipant;

  const BookingSummaryScreen({
    super.key,
    required this.tenantId,
    required this.venue,
    required this.selectedServiceIds,
    this.onGoToBookings,
    this.isGroupMode = false,
    this.accumulatedParticipants = const [],
    this.prefillParticipant,
  });

  @override
  State<BookingSummaryScreen> createState() => _BookingSummaryScreenState();
}

class _BookingSummaryScreenState extends State<BookingSummaryScreen> {
  late List<ServiceItem> _selectedServices;

  @override
  void initState() {
    super.initState();
    _selectedServices = widget.venue.services
        .where((s) => widget.selectedServiceIds.contains(s.id.isNotEmpty ? s.id : s.name))
        .toList();
    if (_selectedServices.isEmpty && widget.prefillParticipant != null) {
      // New group participant: copy the main client's (booker's) services by
      // default so they can add/remove from there, like the web client.
      // The booker is always accumulatedParticipants.first.
      final inheritedIds = <String>{};
      final booker = widget.accumulatedParticipants.isNotEmpty
          ? widget.accumulatedParticipants.first
          : null;
      inheritedIds.addAll(List<String>.from(booker?['serviceIds'] ?? []));
      // Fallback: if the booker had none, inherit from whoever did.
      if (inheritedIds.isEmpty) {
        for (final p in widget.accumulatedParticipants) {
          inheritedIds.addAll(List<String>.from(p['serviceIds'] ?? []));
        }
      }
      _selectedServices = widget.venue.services
          .where((s) => inheritedIds.contains(s.id.isNotEmpty ? s.id : s.name))
          .toList();
    }
    if (_selectedServices.isEmpty && widget.venue.services.isNotEmpty) {
      _selectedServices = [widget.venue.services.first];
    }
  }

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

  void _continue() {
    if (_selectedServices.isEmpty) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BookingScreen(
          tenantId: widget.tenantId,
          venue: widget.venue,
          selectedServices: _selectedServices,
          onGoToBookings: widget.onGoToBookings,
          isGroupMode: widget.isGroupMode,
          accumulatedParticipants: widget.accumulatedParticipants,
          prefillParticipant: widget.prefillParticipant,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(child: _buildBody()),
            if (_selectedServices.isNotEmpty) _buildBottomBar(),
          ],
        ),
      ),
    );
  }

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
              IconButton(
                icon: const Icon(Icons.arrow_back, color: AppColors.textDark, size: 22),
                onPressed: () => Navigator.pop(context),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close, color: AppColors.textDark, size: 22),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
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

  Widget _buildBody() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
      children: [
        Text(
          _selectedServices.isEmpty
              ? 'Sélectionnez les\nprestations'
              : 'Vos prestations',
          style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textDark),
        ),
        const SizedBox(height: 12),
        ..._selectedServices.asMap().entries.map((entry) {
          final index = entry.key;
          final service = entry.value;
          return _SummaryServiceCard(
            service: service,
            showReorder: _selectedServices.length > 1,
            onRemove: () {
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
        if (widget.isGroupMode && widget.accumulatedParticipants.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.people_rounded, size: 20, color: AppColors.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${widget.accumulatedParticipants.length} personne${widget.accumulatedParticipants.length > 1 ? 's' : ''} déjà enregistrée${widget.accumulatedParticipants.length > 1 ? 's' : ''}',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
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
            return StatefulBuilder(
              builder: (context, setModalState) {
                return Column(
                  children: [
                    Container(
                      color: Colors.white,
                      child: Padding(
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
                              setModalState(() {});
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
      },
    );
  }

  Widget _buildBottomBar() {
    final label = '${_selectedServices.length} article${_selectedServices.length > 1 ? 's' : ''} · $_durationLabel';
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
                Text('${_totalPrice.toInt()} MAD',
                    style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textDark)),
                Text(label, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray)),
              ],
            ),
          ),
          GestureDetector(
            onTap: _continue,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(28),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Continuez',
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                  const SizedBox(width: 6),
                  const Icon(Icons.arrow_forward, color: Colors.white, size: 18),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryServiceCard extends StatelessWidget {
  final ServiceItem service;
  final bool showReorder;
  final VoidCallback onRemove;
  final VoidCallback? onMoveUp;
  final VoidCallback? onMoveDown;

  const _SummaryServiceCard({
    required this.service,
    this.showReorder = false,
    required this.onRemove,
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
        border: Border.all(color: AppColors.primary, width: 1.5),
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
                child: Text(service.name.toUpperCase(),
                    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textDark, letterSpacing: 0.5)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(durationLabel, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
          if (service.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(service.description, maxLines: 2, overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray, height: 1.4)),
          ],
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${service.price.toInt()} MAD',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textDark)),
              GestureDetector(
                onTap: onRemove,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary),
                  ),
                  child: const Icon(Icons.close, size: 20, color: Colors.white),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
