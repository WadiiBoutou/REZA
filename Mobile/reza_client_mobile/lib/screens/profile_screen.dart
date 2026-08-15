import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../constants.dart';
import '../models/venue_mapper.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../services/account_service.dart';
import '../services/api_client.dart';
import 'edit_profile_screen.dart';
import 'login_screen.dart';
import 'privacy_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();
    final user = auth.user;

    if (!auth.isAuthenticated || user == null) {
      return Scaffold(
        backgroundColor: AppColors.surface,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.person_outline_rounded, size: 64, color: AppColors.textLight),
                const SizedBox(height: 16),
                Text('Connectez-vous à votre compte', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textGray)),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen())),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                  child: Text('Se connecter', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final initial = user.firstName.isNotEmpty ? user.firstName[0].toUpperCase() : '?';
    final avatarImg = avatarProvider(user.avatar ?? '');

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(20, 56, 20, 24),
              child: Column(
                children: [
                  Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primary,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10)],
                    ),
                    child: ClipOval(
                      child: avatarImg != null
                          ? Image(
                              image: avatarImg,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Center(
                                child: Text(initial,
                                    style: GoogleFonts.inter(fontSize: 36, fontWeight: FontWeight.w700, color: Colors.white)),
                              ),
                            )
                          : Center(
                              child: Text(initial,
                                  style: GoogleFonts.inter(fontSize: 36, fontWeight: FontWeight.w700, color: Colors.white)),
                            ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(user.name, style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                  const SizedBox(height: 4),
                  Text(user.email, style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray)),
                  if (user.phone != null && user.phone!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(user.phone!, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textLight)),
                  ],
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),
                _SettingsSection(
                  title: 'Mon compte',
                  items: [
                    _SettingsItem(
                      icon: Icons.person_outline_rounded,
                      label: 'Mes informations',
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => EditProfileScreen(user: user)),
                      ),
                    ),
                    _SettingsItem(
                      icon: Icons.lock_outline_rounded,
                      label: 'Changer le mot de passe',
                      onTap: () => _showChangePassword(context, user.email),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _SettingsSection(
                  title: 'Légal',
                  items: [
                    _SettingsItem(
                      icon: Icons.privacy_tip_outlined,
                      label: 'Politique de confidentialité',
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const PrivacyScreen()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: GestureDetector(
                    onTap: () {
                      showDialog(
                        context: context,
                        builder: (_) => AlertDialog(
                          backgroundColor: Colors.white,
                          surfaceTintColor: Colors.transparent,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          title: Text('Déconnexion', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 18, color: AppColors.textDark)),
                          content: Text('Voulez-vous vraiment vous déconnecter ?', style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray)),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context),
                              child: Text('Annuler', style: GoogleFonts.inter(color: AppColors.textGray, fontWeight: FontWeight.w600)),
                            ),
                            TextButton(
                              onPressed: () async {
                                Navigator.pop(context);
                                await context.read<AuthViewModel>().logout();
                              },
                              child: Text('Déconnecter', style: GoogleFonts.inter(color: const Color(0xFFEF4444), fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 22),
                          const SizedBox(width: 14),
                          Text('Se déconnecter', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: const Color(0xFFEF4444))),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Center(child: Text('REZA v1.0.0', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textLight))),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static Future<void> _showChangePassword(BuildContext context, String email) async {
    await showDialog(
      context: context,
      builder: (_) => _ChangePasswordDialog(email: email),
    );
  }
}

/// Two-step password change matching the web: current password → emailed
/// 6-digit code → new password. Styled to the app palette (no pink tint).
class _ChangePasswordDialog extends StatefulWidget {
  final String email;

  const _ChangePasswordDialog({required this.email});

  @override
  State<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<_ChangePasswordDialog> {
  final _currentCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _sending = false;
  bool _saving = false;
  bool _codeSent = false;
  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;
  String? _error;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _codeCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    if (_currentCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Le mot de passe actuel est requis.');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await accountService.sendPasswordCode(
        email: widget.email,
        currentPassword: _currentCtrl.text,
      );
      if (!mounted) return;
      setState(() => _codeSent = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = "Erreur lors de l'envoi du code. Veuillez réessayer.");
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _save() async {
    final code = _codeCtrl.text.trim();
    final newPwd = _newCtrl.text;
    if (code.length < 6) {
      setState(() => _error = 'Veuillez entrer le code reçu par email.');
      return;
    }
    if (newPwd.length < 8) {
      setState(() => _error = 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPwd != _confirmCtrl.text) {
      setState(() => _error = 'Les mots de passe ne correspondent pas.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await accountService.changePassword(
        email: widget.email,
        code: code,
        newPassword: newPwd,
      );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mot de passe changé avec succès')),
      );
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Erreur lors du changement de mot de passe. Veuillez réessayer.');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(
        'Changer le mot de passe',
        style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textDark),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_error != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Text(
                  _error!,
                  style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFFB91C1C)),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (!_codeSent) ...[
              Text(
                'Un code de vérification sera envoyé à ${widget.email}. Saisissez d\'abord votre mot de passe actuel pour recevoir le code.',
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray, height: 1.4),
              ),
              const SizedBox(height: 14),
              _pwdField(_currentCtrl, 'Mot de passe actuel', _showCurrent, () {
                setState(() => _showCurrent = !_showCurrent);
              }),
            ] else ...[
              Text(
                'Un code à 6 chiffres a été envoyé à ${widget.email}. Saisissez-le avec votre nouveau mot de passe.',
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray, height: 1.4),
              ),
              const SizedBox(height: 14),
              _field(_codeCtrl, 'Code de vérification', keyboard: TextInputType.number, maxLen: 6),
              const SizedBox(height: 12),
              _pwdField(_newCtrl, 'Nouveau mot de passe', _showNew, () {
                setState(() => _showNew = !_showNew);
              }),
              const SizedBox(height: 12),
              _pwdField(_confirmCtrl, 'Confirmer le mot de passe', _showConfirm, () {
                setState(() => _showConfirm = !_showConfirm);
              }),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Annuler', style: GoogleFonts.inter(color: AppColors.textGray, fontWeight: FontWeight.w600)),
        ),
        if (!_codeSent)
          TextButton(
            onPressed: _sending ? null : _sendCode,
            child: Text(
              _sending ? 'Envoi...' : 'Envoyer le code',
              style: GoogleFonts.inter(color: AppColors.textDark, fontWeight: FontWeight.w700),
            ),
          )
        else
          TextButton(
            onPressed: _saving ? null : _save,
            child: Text(
              _saving ? 'Enregistrement...' : 'Changer le mot de passe',
              style: GoogleFonts.inter(color: AppColors.textDark, fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }

  Widget _field(TextEditingController c, String label, {TextInputType? keyboard, int? maxLen}) {
    return TextField(
      controller: c,
      keyboardType: keyboard,
      maxLength: maxLen,
      style: GoogleFonts.inter(fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
        counterText: '',
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.textDark, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
    );
  }

  Widget _pwdField(TextEditingController c, String label, bool visible, VoidCallback toggle) {
    return TextField(
      controller: c,
      obscureText: !visible,
      style: GoogleFonts.inter(fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.textDark, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        suffixIcon: IconButton(
          icon: Icon(visible ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20, color: AppColors.textGray),
          onPressed: toggle,
        ),
      ),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<_SettingsItem> items;

  const _SettingsSection({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Text(title, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textGray, letterSpacing: 0.8)),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: items.asMap().entries.map((entry) {
              final i = entry.key;
              final item = entry.value;
              return Column(
                children: [
                  item,
                  if (i < items.length - 1) const Divider(height: 1, color: AppColors.border, indent: 54),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

class _SettingsItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _SettingsItem({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, size: 20, color: AppColors.textDark),
      ),
      title: Text(label, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textDark)),
      trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textLight, size: 20),
    );
  }
}
