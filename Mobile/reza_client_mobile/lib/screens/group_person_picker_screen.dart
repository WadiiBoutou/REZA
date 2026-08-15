import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../constants.dart';
import '../models/family_member.dart';
import '../models/group_person.dart';
import '../services/account_service.dart';
import '../viewmodels/auth_viewmodel.dart';

/// Normalize a phone to comparable national form: digits only, then map the
/// local formats so "+212612345678", "00212612345678" and "0612345678" all
/// compare equal (mirrors the web client logic).
String _normPhone(String? p) {
  var d = (p ?? '').replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('00')) d = d.substring(2);
  if (d.startsWith('212') && d.length > 9) d = d.substring(3);
  if (d.startsWith('0')) d = d.substring(1);
  return d;
}

/// Validate a phone number from any country (E.164 range only, not
/// country-specific): optional leading +, 7 to 15 digits, separators
/// (space, dash, dot, parens) tolerated.
bool _isValidPhoneNumber(String phone) {
  final cleaned = phone.replaceAll(RegExp(r'[\s\-().]'), '');
  if (!RegExp(r'^\+?\d+$').hasMatch(cleaned)) return false;
  final digits = cleaned.startsWith('+') ? cleaned.substring(1) : cleaned;
  return digits.length >= 7 && digits.length <= 15;
}

/// Normalize a name: lower-case, single spaces.
String _normName(String? n) => (n ?? '').trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

/// Screen for selecting who the next group-booking person is.
/// Shows existing proches + option to add a new guest.
/// Returns a [GroupPerson] via Navigator.pop.
///
/// [alreadyAdded] lists the people already accumulated in THIS in-progress
/// group-booking session (booker + prior participants). A proche matching one
/// of them is hidden/greyed out, and a guest whose name+phone matches one is
/// rejected — preventing the same person from being added twice to one booking.
class GroupPersonPickerScreen extends StatefulWidget {
  const GroupPersonPickerScreen({super.key, this.alreadyAdded = const []});

  final List<GroupPerson> alreadyAdded;

  @override
  State<GroupPersonPickerScreen> createState() => _GroupPersonPickerScreenState();
}

class _GroupPersonPickerScreenState extends State<GroupPersonPickerScreen> {
  List<FamilyMember> _proches = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadProches();
  }

  Future<void> _loadProches() async {
    final auth = context.read<AuthViewModel>();
    if (auth.email == null) {
      setState(() {
        _error = 'Vous devez être connecté.';
        _loading = false;
      });
      return;
    }
    try {
      final members = await accountService.getFamilyMembers(auth.email!);
      if (!mounted) return;
      setState(() {
        _proches = members;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Erreur de chargement.';
        _loading = false;
      });
    }
  }

  void _selectProche(FamilyMember member) {
    // Same person = same family-member id (proches are unique per account).
    // Also block by name+phone so a proche matching an already-added guest
    // (or the booker) can't be added twice under a different id.
    final alreadyAdded = widget.alreadyAdded.any((p) {
      if (p.familyMemberId != null && p.familyMemberId == member.id) return true;
      final pPhone = _normPhone(p.phone);
      final mPhone = _normPhone(member.phone);
      return _normName(p.displayName) == _normName(member.name) &&
          pPhone.isNotEmpty &&
          mPhone.isNotEmpty &&
          pPhone == mPhone;
    });
    if (alreadyAdded) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${member.name} a déjà été ajouté à cette réservation.'),
          backgroundColor: AppColors.primary,
        ),
      );
      return;
    }
    Navigator.pop(
      context,
      GroupPerson(
        firstName: member.firstName,
        lastName: member.lastName,
        phone: member.phone,
        email: member.email,
        relationship: member.relationship,
        familyMemberId: member.id,
        avatar: member.avatar,
      ),
    );
  }

  void _openNewGuestForm() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _NewGuestForm(
        alreadyAdded: widget.alreadyAdded,
        onConfirm: (person) => Navigator.pop(context, person),
      ),
    ).then((result) {
      if (result != null && result is GroupPerson) {
        Navigator.pop(context, result);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.close, color: AppColors.textDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Qui sera concerné ?',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textDark,
          ),
        ),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center, style: GoogleFonts.inter(color: AppColors.textGray)),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadProches,
                          child: const Text('Réessayer'),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 100),
                  children: [
                    // ── Existing proches ──────────────────
                    if (_proches.isNotEmpty) ...[
                      Text(
                        'Vos proches',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textGray,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ..._proches.map((m) {
                        final added = widget.alreadyAdded.any((p) {
                          if (p.familyMemberId != null && p.familyMemberId == m.id) return true;
                          final pPhone = _normPhone(p.phone);
                          final mPhone = _normPhone(m.phone);
                          return _normName(p.displayName) == _normName(m.name) &&
                              pPhone.isNotEmpty &&
                              mPhone.isNotEmpty &&
                              pPhone == mPhone;
                        });
                        return _ProcheCard(
                          member: m,
                          isAdded: added,
                          onTap: () => _selectProche(m),
                        );
                      }),
                      const SizedBox(height: 24),
                    ],

                    // ── Add someone new ───────────────────
                    Text(
                      _proches.isEmpty
                          ? 'Ajoutez une personne pour cette réservation'
                          : 'Autre personne',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textGray,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _AddGuestCard(onTap: _openNewGuestForm),
                  ],
                ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  Proche card
// ═══════════════════════════════════════════════════════════════

class _ProcheCard extends StatelessWidget {
  final FamilyMember member;
  final VoidCallback onTap;
  final bool isAdded;

  const _ProcheCard({required this.member, required this.onTap, this.isAdded = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Opacity(
        opacity: isAdded ? 0.45 : 1,
        child: Material(
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: isAdded ? AppColors.border : AppColors.border),
          ),
          child: InkWell(
            onTap: isAdded ? null : onTap,
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  // Avatar
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      shape: BoxShape.circle,
                    ),
                    child: ClipOval(
                      child: (member.avatar ?? '').trim().isNotEmpty
                          ? Image.network(
                              member.avatar!,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) => Center(
                                child: Text(
                                  member.initials,
                                  style: GoogleFonts.inter(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                            )
                          : Center(
                              child: Text(
                                member.initials,
                                style: GoogleFonts.inter(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  // Name + relationship
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          member.name,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textDark,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isAdded ? 'Déjà ajouté à cette réservation' : member.relationship,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: isAdded ? AppColors.textGray : AppColors.textGray,
                          ),
                        ),
                      ],
                    ),
                  ),
                  isAdded
                      ? Icon(Icons.check_circle_rounded, color: AppColors.available, size: 20)
                      : Icon(Icons.chevron_right_rounded, color: AppColors.textGray),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  Add new guest card
// ═══════════════════════════════════════════════════════════════

class _AddGuestCard extends StatelessWidget {
  final VoidCallback onTap;
  const _AddGuestCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.available.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.person_add_rounded, color: AppColors.available, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ajouter quelqu\'un',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Saisissez le nom d\'une personne',
                      style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: AppColors.textGray),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  New guest form (bottom sheet)
// ═══════════════════════════════════════════════════════════════

class _NewGuestForm extends StatefulWidget {
  final ValueChanged<GroupPerson> onConfirm;
  final List<GroupPerson> alreadyAdded;
  const _NewGuestForm({required this.onConfirm, this.alreadyAdded = const []});

  @override
  State<_NewGuestForm> createState() => _NewGuestFormState();
}

class _NewGuestFormState extends State<_NewGuestForm> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  bool _saveAsProche = false;
  String? _duplicateError;

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  bool _isDuplicateGuest() {
    if (widget.alreadyAdded.isEmpty) return false;
    final name = _normName('${_firstNameCtrl.text.trim()} ${_lastNameCtrl.text.trim()}');
    final phone = _normPhone(_phoneCtrl.text);
    if (phone.isEmpty || name.isEmpty) return false;
    // A guest is a duplicate when BOTH name and phone match an already-added
    // participant in this session (phone is the reliable signal).
    return widget.alreadyAdded.any((p) {
      final pName = _normName(p.displayName);
      final pPhone = _normPhone(p.phone);
      return pPhone.isNotEmpty && pName == name && pPhone == phone;
    });
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    if (_isDuplicateGuest()) {
      setState(() {
        _duplicateError = 'Cette personne a déjà été ajoutée à cette réservation.';
      });
      return;
    }
    setState(() => _duplicateError = null);
    widget.onConfirm(GroupPerson(
      firstName: _firstNameCtrl.text.trim(),
      lastName: _lastNameCtrl.text.trim(),
      phone: _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      saveAsProche: _saveAsProche,
      relationship: '', // Not required for one-time guest
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        20,
        24,
        MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
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
            Text(
              'Nouvelle personne',
              style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textDark),
            ),
            const SizedBox(height: 16),

            // First name
            TextFormField(
              controller: _firstNameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: _inputDecoration('Prénom *'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
            ),
            const SizedBox(height: 12),

            // Last name
            TextFormField(
              controller: _lastNameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: _inputDecoration('Nom'),
            ),
            const SizedBox(height: 12),

            // Phone
            TextFormField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              onChanged: (_) => setState(() => _duplicateError = null),
              decoration: _inputDecoration('Téléphone *'),
              validator: (v) {
                final t = (v ?? '').trim();
                if (t.isEmpty) return 'Requis';
                if (!_isValidPhoneNumber(t)) return 'Format de numéro invalide';
                return null;
              },
            ),
            if (_duplicateError != null) ...[
              const SizedBox(height: 8),
              Text(
                _duplicateError!,
                style: GoogleFonts.inter(fontSize: 12, color: Colors.red.shade700),
              ),
            ],
            const SizedBox(height: 16),

            // Save as proche toggle
            Row(
              children: [
                SizedBox(
                  height: 24,
                  width: 24,
                  child: Checkbox(
                    value: _saveAsProche,
                    onChanged: (v) => setState(() => _saveAsProche = v ?? false),
                    activeColor: AppColors.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Enregistrer comme proche pour la prochaine fois ?',
                    style: GoogleFonts.inter(fontSize: 13, color: AppColors.textDark),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Submit
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: Text(
                  'Continuer',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.inter(color: AppColors.textGray.withValues(alpha: 0.6)),
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }
}
