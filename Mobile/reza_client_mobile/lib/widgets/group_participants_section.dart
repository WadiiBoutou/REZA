import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants.dart';
import '../models/family_member.dart';

class GuestParticipant {
  final String id;
  final String name;
  final String? familyMemberId;
  final bool sameServicesAsBooker;
  final List<String> serviceIds;
  final bool followsBookerSchedule;
  final String? customDate;
  final String? customTime;
  final String? employeeId;

  const GuestParticipant({
    required this.id,
    required this.name,
    this.familyMemberId,
    this.sameServicesAsBooker = true,
    this.serviceIds = const [],
    this.followsBookerSchedule = true,
    this.customDate,
    this.customTime,
    this.employeeId,
  });

  GuestParticipant copyWith({
    String? name,
    bool? sameServicesAsBooker,
    List<String>? serviceIds,
    bool? followsBookerSchedule,
    String? customDate,
    String? customTime,
    String? employeeId,
  }) {
    return GuestParticipant(
      id: id,
      name: name ?? this.name,
      familyMemberId: familyMemberId,
      sameServicesAsBooker: sameServicesAsBooker ?? this.sameServicesAsBooker,
      serviceIds: serviceIds ?? this.serviceIds,
      followsBookerSchedule: followsBookerSchedule ?? this.followsBookerSchedule,
      customDate: customDate ?? this.customDate,
      customTime: customTime ?? this.customTime,
      employeeId: employeeId ?? this.employeeId,
    );
  }
}

class GroupParticipantsSection extends StatefulWidget {
  final List<GuestParticipant> participants;
  final ValueChanged<List<GuestParticipant>> onChanged;
  final bool includeBooker;
  final ValueChanged<bool> onIncludeBookerChange;
  final double bookerTotal;
  final List<ServiceItem> allServices;
  final List<FamilyMember> familyMembers;
  final bool familyLoading;
  final bool isAuthenticated;
  final VoidCallback? onLoginTap;

  const GroupParticipantsSection({
    super.key,
    required this.participants,
    required this.onChanged,
    required this.includeBooker,
    required this.onIncludeBookerChange,
    required this.bookerTotal,
    required this.allServices,
    this.familyMembers = const [],
    this.familyLoading = false,
    this.isAuthenticated = false,
    this.onLoginTap,
  });

  @override
  State<GroupParticipantsSection> createState() => _GroupParticipantsSectionState();
}

class _GroupParticipantsSectionState extends State<GroupParticipantsSection> {
  final Map<String, TextEditingController> _nameCtrls = {};

  @override
  void didUpdateWidget(covariant GroupParticipantsSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    final ids = widget.participants.map((p) => p.id).toSet();
    _nameCtrls.keys.where((k) => !ids.contains(k)).toList().forEach((k) {
      _nameCtrls.remove(k)?.dispose();
    });
    for (final p in widget.participants) {
      if (p.familyMemberId != null) continue;
      final c = _nameCtrls.putIfAbsent(p.id, () => TextEditingController(text: p.name));
      if (c.text != p.name && !c.selection.isValid) {
        c.text = p.name;
      }
    }
  }

  @override
  void dispose() {
    for (final c in _nameCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  Set<String> get _selectedFamilyIds =>
      widget.participants.map((p) => p.familyMemberId).whereType<String>().toSet();

  double _guestSubtotal(GuestParticipant p) {
    if (p.sameServicesAsBooker) return widget.bookerTotal;
    return widget.allServices
        .where((s) => p.serviceIds.contains(s.id) || p.serviceIds.contains(s.name))
        .fold(0.0, (sum, s) => sum + s.price);
  }

  double get grandTotal =>
      (widget.includeBooker ? widget.bookerTotal : 0) +
      widget.participants.fold(0.0, (sum, p) => sum + _guestSubtotal(p));

  bool get hasAnyone => widget.includeBooker || widget.participants.isNotEmpty;

  void _addGuest() {
    final id = 'guest-${DateTime.now().millisecondsSinceEpoch}';
    _nameCtrls[id] = TextEditingController();
    widget.onChanged([
      ...widget.participants,
      GuestParticipant(id: id, name: ''),
    ]);
  }

  void _toggleFamily(FamilyMember m) {
    if (_selectedFamilyIds.contains(m.id)) {
      widget.onChanged(widget.participants.where((p) => p.familyMemberId != m.id).toList());
      return;
    }
    widget.onChanged([
      ...widget.participants,
      GuestParticipant(
        id: 'family-${m.id}',
        familyMemberId: m.id,
        name: m.name,
      ),
    ]);
  }

  void _update(String id, GuestParticipant Function(GuestParticipant) fn) {
    widget.onChanged(widget.participants.map((p) => p.id == id ? fn(p) : p).toList());
  }

  void _remove(String id) {
    _nameCtrls.remove(id)?.dispose();
    widget.onChanged(widget.participants.where((p) => p.id != id).toList());
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAF8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.25), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.groups_outlined, color: AppColors.primary, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pour qui réservez-vous ?',
                      style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textDark),
                    ),
                    Text(
                      'Ajoutez des proches ou invités',
                      style: GoogleFonts.inter(fontSize: 11, color: AppColors.textGray),
                    ),
                  ],
                ),
              ),
              TextButton.icon(
                onPressed: _addGuest,
                icon: const Icon(Icons.add, size: 16),
                label: Text('Ajouter', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600)),
                style: TextButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: Size.zero,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _chip(
                      label: 'Moi',
                      selected: widget.includeBooker,
                      onTap: () => widget.onIncludeBookerChange(!widget.includeBooker),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text('Mes proches', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (!widget.isAuthenticated)
                  GestureDetector(
                    onTap: widget.onLoginTap,
                    child: Text(
                      'Connectez-vous pour choisir vos proches',
                      style: GoogleFonts.inter(fontSize: 13, color: AppColors.primary, decoration: TextDecoration.underline),
                    ),
                  )
                else if (widget.familyLoading)
                  Text('Chargement…', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textLight))
                else if (widget.familyMembers.isEmpty)
                  Text(
                    'Aucun proche — ajoutez-en dans l’onglet Proches',
                    style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: widget.familyMembers.map((m) {
                      final selected = _selectedFamilyIds.contains(m.id);
                      final label = m.relationship.isNotEmpty ? '${m.name} · ${m.relationship}' : m.name;
                      return _chip(label: label, selected: selected, onTap: () => _toggleFamily(m));
                    }).toList(),
                  ),
              ],
            ),
          ),
          if (!hasAnyone) ...[
            const SizedBox(height: 10),
            Text(
              'Sélectionnez au moins Moi ou un proche / invité.',
              style: GoogleFonts.inter(fontSize: 13, color: Colors.amber.shade900),
            ),
          ],
          const SizedBox(height: 12),
          ...widget.participants.map(_participantCard),
          if (hasAnyone) ...[
            const SizedBox(height: 8),
            const Divider(),
            if (widget.includeBooker) _priceRow('Moi', widget.bookerTotal),
            ...widget.participants.map((p) => _priceRow(p.name.isEmpty ? 'Invité' : p.name, _guestSubtotal(p))),
            const SizedBox(height: 4),
            _priceRow('Total groupe', grandTotal, bold: true),
            Text(
              'Paiement sur place à l’établissement.',
              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textLight),
            ),
          ],
        ],
      ),
    );
  }

  Widget _chip({required String label, required bool selected, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.textDark,
          ),
        ),
      ),
    );
  }

  Widget _priceRow(String label, double amount, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: bold ? 14 : 13,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
              color: AppColors.textDark,
            ),
          ),
          Text(
            '${amount.toInt()} MAD',
            style: GoogleFonts.inter(
              fontSize: bold ? 14 : 13,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              color: AppColors.textDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _participantCard(GuestParticipant p) {
    final fromFamily = p.familyMemberId != null;
    final nameCtrl = fromFamily ? null : _nameCtrls.putIfAbsent(p.id, () => TextEditingController(text: p.name));

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: fromFamily
                    ? Text(
                        p.name,
                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textDark),
                      )
                    : TextField(
                        controller: nameCtrl,
                        onChanged: (v) => _update(p.id, (x) => x.copyWith(name: v)),
                        style: GoogleFonts.inter(fontSize: 14, color: AppColors.textDark),
                        decoration: InputDecoration(
                          hintText: 'Prénom ou nom',
                          hintStyle: GoogleFonts.inter(color: AppColors.textLight),
                          isDense: true,
                          border: const UnderlineInputBorder(),
                          enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: AppColors.border)),
                          focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: AppColors.primary)),
                        ),
                      ),
              ),
              if (fromFamily)
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Text(
                    'PROCHE',
                    style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.primary),
                  ),
                ),
              IconButton(
                icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.textLight),
                onPressed: () => _remove(p.id),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              SizedBox(
                height: 20,
                width: 20,
                child: Checkbox(
                  value: p.sameServicesAsBooker,
                  activeColor: AppColors.primary,
                  onChanged: (v) => _update(
                    p.id,
                    (x) => x.copyWith(sameServicesAsBooker: v ?? true, serviceIds: (v ?? true) ? [] : x.serviceIds),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text('Mêmes prestations', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textDark)),
            ],
          ),
          if (!p.sameServicesAsBooker) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: widget.allServices.map((s) {
                final sid = s.id.isNotEmpty ? s.id : s.name;
                final selected = p.serviceIds.contains(sid);
                return GestureDetector(
                  onTap: () {
                    final next = selected
                        ? p.serviceIds.where((id) => id != sid).toList()
                        : [...p.serviceIds, sid];
                    _update(p.id, (x) => x.copyWith(serviceIds: next));
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primary : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: selected ? AppColors.primary : AppColors.border),
                    ),
                    child: Text(
                      s.name,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: selected ? Colors.white : AppColors.textDark,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
          const SizedBox(height: 6),
          Text(
            'Sous-total : ${_guestSubtotal(p).toInt()} MAD',
            style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray),
          ),
        ],
      ),
    );
  }
}
