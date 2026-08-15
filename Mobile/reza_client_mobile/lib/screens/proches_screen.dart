import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../constants.dart';
import '../models/family_member.dart';
import '../models/venue_mapper.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../viewmodels/proches_viewmodel.dart';
import '../services/account_service.dart';
import '../services/api_client.dart';
import '../services/booking_for_proche.dart';
import 'login_screen.dart';

class ProchesScreen extends StatelessWidget {
  final VoidCallback? onExplore;

  const ProchesScreen({super.key, this.onExplore});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ProchesViewModel(),
      child: _ProchesBody(onExplore: onExplore),
    );
  }
}

class _ProchesBody extends StatefulWidget {
  final VoidCallback? onExplore;
  const _ProchesBody({this.onExplore});
  @override
  State<_ProchesBody> createState() => _ProchesScreenState();
}

class _ProchesScreenState extends State<_ProchesBody> {
  ProchesViewModel get _pvm => context.watch<ProchesViewModel>();
  List<FamilyMember> get _members => _pvm.members;
  bool get _loading => _pvm.loading;
  String? get _error => _pvm.error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final auth = context.read<AuthViewModel>();
    await context.read<ProchesViewModel>().load(auth.email);
  }

  Future<void> _bookFor(FamilyMember m) async {
    await setBookingForProche(BookingForProche.fromMember(m));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Choisissez un salon pour réserver pour ${m.firstName}',
          style: GoogleFonts.inter(fontSize: 13),
        ),
        backgroundColor: AppColors.textDark,
        behavior: SnackBarBehavior.floating,
      ),
    );
    widget.onExplore?.call();
  }

  Future<void> _delete(FamilyMember m) async {
    final auth = context.read<AuthViewModel>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Supprimer le proche', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        content: Text(
          'Supprimer ${m.name} ?',
          style: GoogleFonts.inter(fontSize: 14),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Supprimer', style: GoogleFonts.inter(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok != true || auth.email == null) return;
    try {
      await accountService.deleteFamilyMember(m.id, auth.email!);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _showForm({FamilyMember? existing}) async {
    final auth = context.read<AuthViewModel>();
    if (auth.email == null) return;

    final firstCtrl = TextEditingController(text: existing?.firstName ?? '');
    final lastCtrl = TextEditingController(text: existing?.lastName ?? '');
    final relCtrl = TextEditingController(text: existing?.relationship ?? '');
    final phoneCtrl = TextEditingController(text: existing?.phone ?? '');
    final emailCtrl = TextEditingController(text: existing?.email ?? '');
    var avatarBytes = <int>[];
    var avatarUrl = existing?.avatar ?? '';
    var uploadingAvatar = false;
    String? gender = existing?.gender;
    var saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModal) {
            Widget avatarPreview() {
              final placeholder = Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.border, width: 2),
                ),
                child: const Icon(Icons.person_outline_rounded, size: 40, color: AppColors.textGray),
              );
              Widget img;
              if (avatarBytes.isNotEmpty) {
                img = Image.memory(Uint8List.fromList(avatarBytes), fit: BoxFit.cover);
              } else if (avatarUrl.trim().startsWith('data:')) {
                try {
                  img = Image.memory(base64Decode(avatarUrl.split(',').last), fit: BoxFit.cover);
                } catch (_) {
                  return placeholder;
                }
              } else if (avatarUrl.trim().isNotEmpty) {
                img = Image.network(avatarUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => placeholder);
              } else {
                return placeholder;
              }
              return ClipOval(child: SizedBox(width: 88, height: 88, child: img));
            }

            Future<void> pickAvatar() async {
              try {
                final picked = await ImagePicker().pickImage(
                  source: ImageSource.gallery,
                  maxWidth: 800,
                  maxHeight: 800,
                  imageQuality: 85,
                );
                if (picked == null) return;
                final bytes = await picked.readAsBytes();
                setModal(() {
                  avatarBytes = bytes;
                  uploadingAvatar = true;
                });
                final ext = picked.name.contains('.') ? picked.name.split('.').last.toLowerCase() : 'jpg';
                final mime = ext == 'png' ? 'image/png' : ext == 'webp' ? 'image/webp' : 'image/jpeg';
                final res = await apiClient.uploadAvatar(bytes, 'avatar.$ext', mime);
                if (ctx.mounted) {
                  setModal(() {
                    avatarUrl = (res['avatar'] as String?) ?? '';
                    uploadingAvatar = false;
                  });
                }
              } catch (_) {
                if (ctx.mounted) setModal(() => uploadingAvatar = false);
              }
            }

            Widget genderChip(String value, String label, IconData icon) {
              final selected = gender == value;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setModal(() => gender = selected ? null : value),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primary.withValues(alpha: 0.1) : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 1.5 : 1),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(icon, size: 18, color: selected ? AppColors.primary : AppColors.textGray),
                        const SizedBox(width: 8),
                        Text(
                          label,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                            color: selected ? AppColors.primary : AppColors.textGray,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      existing == null ? 'Ajouter un proche' : 'Modifier le proche',
                      style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 16),
                    // ── Avatar (optional) ─────────────────────────
                    Center(
                      child: GestureDetector(
                        onTap: uploadingAvatar ? null : pickAvatar,
                        child: Stack(
                          children: [
                            avatarPreview(),
                            Positioned(
                              right: 0,
                              bottom: 0,
                              child: Container(
                                width: 30,
                                height: 30,
                                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                                child: uploadingAvatar
                                    ? const Padding(
                                        padding: EdgeInsets.all(7),
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : const Icon(Icons.photo_camera_rounded, size: 16, color: Colors.white),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    _sheetField('Prénom *', firstCtrl),
                    const SizedBox(height: 10),
                    _sheetField('Nom', lastCtrl),
                    const SizedBox(height: 10),
                    _sheetField('Lien (ami, frère...) *', relCtrl),
                    const SizedBox(height: 10),
                    _sheetField('Téléphone', phoneCtrl, keyboard: TextInputType.phone),
                    const SizedBox(height: 10),
                    _sheetField('Email', emailCtrl, keyboard: TextInputType.emailAddress),
                    const SizedBox(height: 10),
                    Text('Genre', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        genderChip('female', 'Femme', Icons.female_rounded),
                        const SizedBox(width: 12),
                        genderChip('male', 'Homme', Icons.male_rounded),
                      ],
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: saving
                            ? null
                            : () async {
                                final first = firstCtrl.text.trim();
                                final rel = relCtrl.text.trim();
                                if (first.isEmpty || rel.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Prénom et lien requis')),
                                  );
                                  return;
                                }
                                setModal(() => saving = true);
                                try {
                                  if (existing == null) {
                                    await accountService.createFamilyMember(
                                      clientEmail: auth.email!,
                                      firstName: first,
                                      lastName: lastCtrl.text.trim(),
                                      relationship: rel,
                                      phone: phoneCtrl.text.trim(),
                                      email: emailCtrl.text.trim(),
                                      avatar: avatarUrl.isEmpty ? null : avatarUrl,
                                      gender: gender,
                                    );
                                  } else {
                                    await accountService.updateFamilyMember(
                                      id: existing.id,
                                      clientEmail: auth.email!,
                                      firstName: first,
                                      lastName: lastCtrl.text.trim(),
                                      relationship: rel,
                                      phone: phoneCtrl.text.trim(),
                                      email: emailCtrl.text.trim(),
                                      avatar: avatarUrl.isEmpty ? null : avatarUrl,
                                      gender: gender,
                                    );
                                  }
                                  if (ctx.mounted) Navigator.pop(ctx);
                                  await _load();
                                } on ApiException catch (e) {
                                  setModal(() => saving = false);
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(e.message)),
                                    );
                                  }
                                } catch (e) {
                                  setModal(() => saving = false);
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(e.toString())),
                                    );
                                  }
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: Text(
                          existing == null ? 'Ajouter' : 'Enregistrer',
                          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
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

    firstCtrl.dispose();
    lastCtrl.dispose();
    relCtrl.dispose();
    phoneCtrl.dispose();
    emailCtrl.dispose();
  }

  Widget _sheetField(String label, TextEditingController c, {TextInputType? keyboard}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(
          controller: c,
          keyboardType: keyboard,
          style: GoogleFonts.inter(fontSize: 15),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();

    if (!auth.isAuthenticated || auth.email == null) {
      return Scaffold(
        backgroundColor: AppColors.surface,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.people_outline_rounded, size: 64, color: AppColors.textLight),
                const SizedBox(height: 16),
                Text(
                  'Connectez-vous pour gérer vos proches',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textGray),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () async {
                    await Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
                    await _load();
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                  child: Text('Se connecter', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 56, 20, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Mes Proches', style: GoogleFonts.inter(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.textDark)),
                          const SizedBox(height: 4),
                          Text('Gérez les comptes de votre famille', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
                        ],
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () => _showForm(),
                      icon: const Icon(Icons.add, size: 18),
                      label: Text('Ajouter', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                      style: TextButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(child: Center(child: CircularProgressIndicator(color: AppColors.primary)))
            else if (_error != null)
              SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center, style: GoogleFonts.inter(color: AppColors.textGray)),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _load, child: const Text('Réessayer')),
                      ],
                    ),
                  ),
                ),
              )
            else if (_members.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.people_outline, size: 48, color: AppColors.textLight),
                        const SizedBox(height: 12),
                        Text('Aucun proche enregistré', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        Text(
                          'Ajoutez famille et amis pour réserver pour eux.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final m = _members[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 24,
                                    backgroundColor: AppColors.primary,
                                    backgroundImage: avatarProvider(m.avatar ?? ''),
                                    child: avatarProvider(m.avatar ?? '') == null
                                        ? Text(m.initials, style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w700))
                                        : null,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(m.name, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700)),
                                        Text(m.relationship, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, size: 20, color: AppColors.textGray),
                                    onPressed: () => _showForm(existing: m),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.textGray),
                                    onPressed: () => _delete(m),
                                  ),
                                ],
                              ),
                            ),
                            if (m.phone != null && m.phone!.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                                child: Row(
                                  children: [
                                    const Icon(Icons.phone_outlined, size: 16, color: AppColors.textLight),
                                    const SizedBox(width: 8),
                                    Text(m.phone!, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
                                  ],
                                ),
                              ),
                            const Divider(height: 1),
                            InkWell(
                              onTap: () => _bookFor(m),
                              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                child: Center(
                                  child: Text(
                                    'Réserver pour ${m.firstName}',
                                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                    childCount: _members.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
