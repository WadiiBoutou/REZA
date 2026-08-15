import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../constants.dart';
import '../models/venue_mapper.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../services/account_service.dart';
import '../services/api_client.dart';
import '../services/session_store.dart';
import 'login_screen.dart';

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
                      onTap: () => _showEditProfile(context, user),
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
                  title: 'Support',
                  items: [
                    _SettingsItem(icon: Icons.help_outline_rounded, label: "Centre d'aide", onTap: () {}),
                    _SettingsItem(icon: Icons.privacy_tip_outlined, label: 'Politique de confidentialité', onTap: () {}),
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
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          title: Text('Déconnexion', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 18)),
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

  static Future<void> _showEditProfile(BuildContext context, SessionUser user) async {
    final firstCtrl = TextEditingController(text: user.firstName);
    final lastCtrl = TextEditingController(text: user.lastName);
    final phoneCtrl = TextEditingController(text: user.phone ?? '');

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Mes informations', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: firstCtrl, decoration: const InputDecoration(labelText: 'Prénom')),
            TextField(controller: lastCtrl, decoration: const InputDecoration(labelText: 'Nom')),
            TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Téléphone'), keyboardType: TextInputType.phone),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          TextButton(
            onPressed: () async {
              try {
                final res = await accountService.updateProfile(user.email, {
                  'firstName': firstCtrl.text.trim(),
                  'lastName': lastCtrl.text.trim(),
                  'phone': phoneCtrl.text.trim(),
                });
                final client = res['client'] as Map<String, dynamic>? ?? res;
                final updated = SessionUser(
                  id: client['id']?.toString() ?? user.id,
                  email: client['email']?.toString() ?? user.email,
                  firstName: client['firstName']?.toString() ?? firstCtrl.text.trim(),
                  lastName: client['lastName']?.toString() ?? lastCtrl.text.trim(),
                  phone: client['phone']?.toString() ?? phoneCtrl.text.trim(),
                  avatar: client['avatar']?.toString() ?? user.avatar,
                );
                await sessionStore.save(updated);
                if (!context.mounted) return;
                await context.read<AuthViewModel>().refreshFromStore();
                if (!ctx.mounted) return;
                Navigator.pop(ctx);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profil mis à jour')));
              } on ApiException catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
                }
              }
            },
            child: const Text('Enregistrer'),
          ),
        ],
      ),
    );
  }

  static Future<void> _showChangePassword(BuildContext context, String email) async {
    final currentCtrl = TextEditingController();
    final newCtrl = TextEditingController();

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Mot de passe', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: currentCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Mot de passe actuel')),
            TextField(controller: newCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Nouveau mot de passe')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          TextButton(
            onPressed: () async {
              if (newCtrl.text.length < 6) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Min 6 caractères')));
                return;
              }
              try {
                await accountService.changePassword(
                  email: email,
                  currentPassword: currentCtrl.text,
                  newPassword: newCtrl.text,
                );
                if (context.mounted) {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Mot de passe changé')));
                }
              } on ApiException catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
                }
              }
            },
            child: const Text('Changer'),
          ),
        ],
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
