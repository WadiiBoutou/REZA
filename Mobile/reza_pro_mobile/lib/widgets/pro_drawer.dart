import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../constants/app_colors.dart';
import '../viewmodels/auth_viewmodel.dart';
import 'rz_logo.dart';
import 'salon_filter_control.dart';

/// Shared left drawer: salon filter + logout.
class ProDrawer extends StatelessWidget {
  const ProDrawer({super.key});

  Future<void> _logout(BuildContext context) async {
    Navigator.of(context).pop(); // close drawer first
    await context.read<AuthViewModel>().logout();
    if (!context.mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const RzLogo(size: 44),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          'REZA Pro',
                          style: GoogleFonts.outfit(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textDark,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (auth.user != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      auth.user!.name,
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: AppColors.textGray,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            const Divider(height: 1),
            if (auth.hasMultipleSalons) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
                child: SalonFilterPanel(
                  auth: auth,
                  title: 'Salons',
                  showHint: true,
                ),
              ),
            ] else ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Row(
                  children: [
                    const Icon(
                      Icons.storefront_outlined,
                      size: 18,
                      color: AppColors.navy,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        auth.activeSalonName,
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textDark,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const Spacer(),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
              child: ListTile(
                leading: const Icon(
                  Icons.logout_rounded,
                  color: AppColors.cancelled,
                ),
                title: Text(
                  'Déconnexion',
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w600,
                    color: AppColors.cancelled,
                  ),
                ),
                onTap: () => _logout(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
