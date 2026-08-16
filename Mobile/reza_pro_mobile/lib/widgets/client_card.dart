import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/app_colors.dart';
import '../models/client.dart';
import '../utils/image_url.dart';

class ClientCard extends StatelessWidget {
  final Client client;

  const ClientCard({super.key, required this.client});

  Color get _avatarColor {
    final colors = [
      const Color(0xFF3B82F6),
      const Color(0xFFEC4899),
      const Color(0xFF8B5CF6),
      const Color(0xFF10B981),
      const Color(0xFFF59E0B),
      const Color(0xFFEF4444),
    ];
    return colors[client.id.hashCode.abs() % colors.length];
  }

  @override
  Widget build(BuildContext context) {
    final avatar = avatarProvider(client.avatar ?? '');
    final daysSinceLast = client.lastVisit != null
        ? DateTime.now().difference(client.lastVisit!).inDays
        : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _showClientDetails(context),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Avatar
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: _avatarColor.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: ClipOval(
                    child: avatar != null
                        ? Image(
                            image: avatar,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => Center(
                              child: Text(
                                client.initials,
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: _avatarColor,
                                ),
                              ),
                            ),
                          )
                        : Center(
                            child: Text(
                              client.initials,
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: _avatarColor,
                              ),
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            client.name,
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textDark,
                            ),
                          ),
                          if (client.totalVisits >= 20) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF7ED),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.star_rounded,
                                      size: 10, color: Color(0xFFF59E0B)),
                                  const SizedBox(width: 2),
                                  Text(
                                    'VIP',
                                    style: GoogleFonts.outfit(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFFF59E0B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Icon(Icons.phone_outlined,
                              size: 12, color: AppColors.textLight),
                          const SizedBox(width: 4),
                          Text(
                            client.phone,
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              color: AppColors.textGray,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _badge(
                            '${client.totalVisits} visites',
                            Icons.calendar_month_rounded,
                            AppColors.primary,
                            AppColors.primary.withOpacity(0.08),
                          ),
                          const SizedBox(width: 8),
                          _badge(
                            '${client.totalSpent.toStringAsFixed(0)} DH',
                            Icons.payments_rounded,
                            const Color(0xFF7C3AED),
                            const Color(0xFFF3E8FF),
                          ),
                          if (daysSinceLast != null) ...[
                            const SizedBox(width: 8),
                            _badge(
                              daysSinceLast == 0
                                  ? "Aujourd'hui"
                                  : daysSinceLast == 1
                                      ? 'Hier'
                                      : 'Il y a ${daysSinceLast}j',
                              Icons.access_time_rounded,
                              daysSinceLast <= 7
                                  ? AppColors.confirmed
                                  : AppColors.textGray,
                              daysSinceLast <= 7
                                  ? AppColors.confirmedBg
                                  : AppColors.surfaceGray,
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded,
                    color: AppColors.textGray, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _badge(String text, IconData icon, Color color, Color bg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 3),
          Text(
            text,
            style: GoogleFonts.outfit(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  void _showClientDetails(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ClientDetailsSheet(client: client),
    );
  }
}

class _ClientDetailsSheet extends StatelessWidget {
  final Client client;
  const _ClientDetailsSheet({required this.client});

  @override
  Widget build(BuildContext context) {
    final avatar = avatarProvider(client.avatar ?? '');
    final daysSinceLast = client.lastVisit != null
        ? DateTime.now().difference(client.lastVisit!).inDays
        : null;

    final colors = [
      const Color(0xFF3B82F6),
      const Color(0xFFEC4899),
      const Color(0xFF8B5CF6),
      const Color(0xFF10B981),
      const Color(0xFFF59E0B),
    ];
    final avatarColor = colors[client.id.hashCode.abs() % colors.length];

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      maxChildSize: 0.92,
      minChildSize: 0.4,
      builder: (ctx, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(28),
            topRight: Radius.circular(28),
          ),
        ),
        child: ListView(
          controller: scrollCtrl,
          padding: const EdgeInsets.all(24),
          children: [
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
            const SizedBox(height: 24),
            // Header
            Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: avatarColor.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: ClipOval(
                    child: avatar != null
                        ? Image(
                            image: avatar,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => Center(
                              child: Text(
                                client.initials,
                                style: GoogleFonts.outfit(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: avatarColor,
                                ),
                              ),
                            ),
                          )
                        : Center(
                            child: Text(
                              client.initials,
                              style: GoogleFonts.outfit(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: avatarColor,
                              ),
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(client.name,
                          style: GoogleFonts.outfit(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textDark)),
                      if (client.address != null)
                        Text(client.address!,
                            style: GoogleFonts.outfit(
                                fontSize: 12, color: AppColors.textGray)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Quick stats
            Row(
              children: [
                Expanded(
                  child: _quickStat('${client.totalVisits}', 'Visites',
                      Icons.calendar_month_rounded, AppColors.primary),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _quickStat(
                      '${client.totalSpent.toStringAsFixed(0)} DH',
                      'Total dépensé',
                      Icons.payments_rounded,
                      const Color(0xFF7C3AED)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _quickStat(
                      daysSinceLast != null ? '${daysSinceLast}j' : '-',
                      'Dernière visite',
                      Icons.access_time_rounded,
                      AppColors.confirmed),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Divider(color: AppColors.divider),
            const SizedBox(height: 16),
            _infoRow(Icons.mail_rounded, 'Email', client.email),
            _infoRow(Icons.phone_rounded, 'Téléphone', client.phone),
            if (client.address != null)
              _infoRow(Icons.location_on_rounded, 'Adresse', client.address!),
            if (client.lastVisit != null)
              _infoRow(
                  Icons.calendar_today_rounded,
                  'Dernière visite',
                  DateFormat('d MMMM yyyy', 'fr_FR').format(client.lastVisit!)),
            if (client.notes != null && client.notes!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.pendingBg,
                  borderRadius: BorderRadius.circular(12),
                  border:
                      Border.all(color: AppColors.pending.withOpacity(0.2)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.sticky_note_2_rounded,
                        color: AppColors.pending, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        client.notes!,
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          color: AppColors.textDark,
                          height: 1.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.calendar_today_rounded, size: 18),
                    label: Text('Prendre RDV',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 13)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.phone_rounded, size: 18),
                  label: Text('Appeler',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.border, width: 1.5),
                    foregroundColor: AppColors.textDark,
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ],
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom + 12),
          ],
        ),
      ),
    );
  }

  Widget _quickStat(String value, String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(height: 6),
          Text(value,
              style: GoogleFonts.outfit(
                  fontSize: 14, fontWeight: FontWeight.w800, color: color)),
          Text(label,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                  fontSize: 9, fontWeight: FontWeight.w600, color: color.withOpacity(0.7))),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: GoogleFonts.outfit(
                      fontSize: 11, color: AppColors.textLight)),
              Text(value,
                  style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textDark)),
            ],
          ),
        ],
      ),
    );
  }
}
