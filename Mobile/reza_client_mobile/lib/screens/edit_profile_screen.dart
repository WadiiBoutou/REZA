import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../constants.dart';
import '../models/venue_mapper.dart';
import '../services/account_service.dart';
import '../services/api_client.dart';
import '../services/session_store.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../widgets/avatar_picker.dart';

/// Full-screen "Mes informations" editor — avatar, name, phone, gender,
/// birthdate. Replaces the old small dialog.
class EditProfileScreen extends StatefulWidget {
  final SessionUser user;

  const EditProfileScreen({super.key, required this.user});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final TextEditingController _firstCtrl;
  late final TextEditingController _lastCtrl;
  late final TextEditingController _phoneCtrl;

  String? _avatarUrl;
  bool _loading = true;
  bool _uploadingAvatar = false;
  bool _saving = false;
  String? _gender;
  DateTime? _birthdate;

  @override
  void initState() {
    super.initState();
    _firstCtrl = TextEditingController(text: widget.user.firstName);
    _lastCtrl = TextEditingController(text: widget.user.lastName);
    _phoneCtrl = TextEditingController(text: widget.user.phone ?? '');
    _loadProfile();
  }

  @override
  void dispose() {
    _firstCtrl.dispose();
    _lastCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await accountService.getProfile(widget.user.email);
      if (!mounted) return;
      setState(() {
        _avatarUrl = profile['avatar']?.toString() ?? widget.user.avatar ?? '';
        _gender = profile['gender']?.toString();
        final dob = profile['dateOfBirth'];
        if (dob != null) {
          final d = DateTime.tryParse(dob.toString());
          if (d != null) _birthdate = d;
        }
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickAvatar() async {
    final picked = await pickAvatarImage(context);
    if (picked == null || !mounted) return;
    try {
      final bytes = await picked.readAsBytes();
      setState(() => _uploadingAvatar = true);
      final ext = picked.name.contains('.') ? picked.name.split('.').last.toLowerCase() : 'jpg';
      final mime = ext == 'png' ? 'image/png' : ext == 'webp' ? 'image/webp' : 'image/jpeg';
      final res = await apiClient.uploadAvatar(bytes, 'avatar.$ext', mime);
      if (!mounted) return;
      setState(() {
        _avatarUrl = (res['avatar'] as String?) ?? '';
        _uploadingAvatar = false;
      });
      if (_avatarUrl!.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Impossible de télécharger l'image. Réessayez.")),
        );
      }
    } catch (_) {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _pickBirthdate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthdate ?? DateTime(now.year - 20, now.month, now.day),
      firstDate: DateTime(now.year - 100),
      lastDate: now,
      helpText: 'Date de naissance',
    );
    if (picked != null && mounted) setState(() => _birthdate = picked);
  }

  Future<void> _save() async {
    final first = _firstCtrl.text.trim();
    final last = _lastCtrl.text.trim();
    if (first.isEmpty || last.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Prénom et nom sont requis.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final res = await accountService.updateProfile(widget.user.email, {
        'firstName': first,
        'lastName': last,
        if (_phoneCtrl.text.trim().isNotEmpty) 'phone': _phoneCtrl.text.trim(),
        'gender': _gender ?? '',
        'avatar': _avatarUrl ?? '',
        if (_birthdate != null) 'dateOfBirth': DateFormat('yyyy-MM-dd').format(_birthdate!),
      });
      final client = res['client'] as Map<String, dynamic>? ?? res;
      final updated = SessionUser(
        id: client['id']?.toString() ?? widget.user.id,
        email: client['email']?.toString() ?? widget.user.email,
        firstName: client['firstName']?.toString() ?? first,
        lastName: client['lastName']?.toString() ?? last,
        phone: client['phone']?.toString() ?? _phoneCtrl.text.trim(),
        avatar: client['avatar']?.toString() ?? _avatarUrl ?? widget.user.avatar,
      );
      await sessionStore.save(updated);
      if (!mounted) return;
      await context.read<AuthViewModel>().refreshFromStore();
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil mis à jour')),
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: AppColors.textDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Mes informations',
          style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textDark),
        ),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Avatar
                  Center(
                    child: GestureDetector(
                      onTap: _uploadingAvatar ? null : _pickAvatar,
                      child: Stack(
                        children: [
                          _avatarCircle(),
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              width: 30,
                              height: 30,
                              decoration: BoxDecoration(
                                color: AppColors.textDark,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                              ),
                              child: _uploadingAvatar
                                  ? const Padding(
                                      padding: EdgeInsets.all(7),
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(Icons.photo_camera_rounded, size: 15, color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  _label('Prénom *'),
                  const SizedBox(height: 6),
                  _field(_firstCtrl),
                  const SizedBox(height: 16),
                  _label('Nom *'),
                  const SizedBox(height: 6),
                  _field(_lastCtrl),
                  const SizedBox(height: 16),
                  _label('Email'),
                  const SizedBox(height: 6),
                  Text(
                    widget.user.email,
                    style: GoogleFonts.inter(fontSize: 15, color: AppColors.textGray),
                  ),
                  const SizedBox(height: 16),
                  _label('Téléphone'),
                  const SizedBox(height: 6),
                  _field(_phoneCtrl, keyboard: TextInputType.phone),
                  const SizedBox(height: 16),
                  _label('Genre'),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _genderChip('female', 'Femme', Icons.female),
                      const SizedBox(width: 12),
                      _genderChip('male', 'Homme', Icons.male),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _label('Date de naissance'),
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: _pickBirthdate,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.cake_outlined, size: 18, color: AppColors.textGray),
                          const SizedBox(width: 10),
                          Text(
                            _birthdate == null ? 'Sélectionner une date' : DateFormat('dd/MM/yyyy').format(_birthdate!),
                            style: GoogleFonts.inter(
                              fontSize: 15,
                              color: _birthdate == null ? AppColors.textLight : AppColors.textDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _save,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.textDark,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text(
                              'Enregistrer',
                              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700),
                            ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _avatarCircle() {
    final img = avatarProvider(_avatarUrl ?? '');
    final placeholder = Container(
      width: 96,
      height: 96,
      decoration: const BoxDecoration(color: AppColors.surface, shape: BoxShape.circle),
      child: const Icon(Icons.person_outline_rounded, size: 44, color: AppColors.textGray),
    );
    if (img == null) return placeholder;
    return ClipOval(
      child: SizedBox(
        width: 96,
        height: 96,
        child: Image(image: img, fit: BoxFit.cover, errorBuilder: (_, __, ___) => placeholder),
      ),
    );
  }

  Widget _label(String text) {
    return Text(text, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark));
  }

  Widget _field(TextEditingController c, {TextInputType? keyboard}) {
    return TextField(
      controller: c,
      keyboardType: keyboard,
      style: GoogleFonts.inter(fontSize: 15),
      decoration: InputDecoration(
        filled: true,
        fillColor: Colors.white,
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
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      ),
    );
  }

  Widget _genderChip(String value, String label, IconData icon) {
    final selected = _gender == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _gender = selected ? null : value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? AppColors.textDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? AppColors.textDark : AppColors.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: selected ? Colors.white : AppColors.textGray),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : AppColors.textDark,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
