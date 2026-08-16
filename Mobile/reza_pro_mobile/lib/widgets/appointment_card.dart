import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';
import '../models/appointment.dart';
import '../utils/image_url.dart';

class AppointmentCard extends StatelessWidget {
  final Appointment appointment;
  final Function(String)? onStatusChanged;

  const AppointmentCard({
    super.key,
    required this.appointment,
    this.onStatusChanged,
  });

  Color get _statusColor {
    switch (appointment.status) {
      case 'confirmed':
        return AppColors.confirmed;
      case 'pending':
        return AppColors.pending;
      case 'cancelled':
        return AppColors.cancelled;
      default:
        return AppColors.textGray;
    }
  }

  Color get _statusBg {
    switch (appointment.status) {
      case 'confirmed':
        return AppColors.confirmedBg;
      case 'pending':
        return AppColors.pendingBg;
      case 'cancelled':
        return AppColors.cancelledBg;
      default:
        return AppColors.surfaceGray;
    }
  }

  String get _statusLabel {
    switch (appointment.status) {
      case 'confirmed':
        return 'Confirmé';
      case 'pending':
        return 'En attente';
      case 'cancelled':
        return 'Annulé';
      default:
        return appointment.status;
    }
  }

  String get _initials {
    final parts = appointment.clientName.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  String get _endTime {
    final parts = appointment.time.split(':');
    final h = int.parse(parts[0]);
    final m = int.parse(parts[1]);
    final totalMin = h * 60 + m + appointment.duration;
    final endH = totalMin ~/ 60;
    final endM = totalMin % 60;
    return '${endH.toString().padLeft(2, '0')}:${endM.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final clientAvatar = avatarProvider(appointment.clientAvatar ?? '');
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _showDetails(context),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Time column
                SizedBox(
                  width: 52,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text(
                        appointment.time,
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textDark,
                        ),
                      ),
                      Container(
                        width: 1,
                        height: 20,
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        color: AppColors.border,
                      ),
                      Text(
                        _endTime,
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          color: AppColors.textGray,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // Left accent bar
                Container(
                  width: 3,
                  height: 70,
                  decoration: BoxDecoration(
                    color: _statusColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 12),

                // Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Avatar
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: ClipOval(
                              child: clientAvatar != null
                                  ? Image(
                                      image: clientAvatar,
                                      fit: BoxFit.cover,
                                      errorBuilder: (context, error, stackTrace) => Center(
                                        child: Text(
                                          _initials,
                                          style: GoogleFonts.outfit(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ),
                                    )
                                  : Center(
                                      child: Text(
                                        _initials,
                                        style: GoogleFonts.outfit(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  appointment.clientName,
                                  style: GoogleFonts.outfit(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textDark,
                                  ),
                                ),
                                // Show all services or single service
                                if (appointment.services.length > 1)
                                  ...appointment.services.map((service) => Padding(
                                    padding: const EdgeInsets.only(top: 2),
                                    child: Text(
                                      service.name,
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        color: AppColors.textGray,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ))
                                else
                                  Text(
                                    appointment.service,
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      color: AppColors.textGray,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          // Status chip
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: _statusBg,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              _statusLabel,
                              style: GoogleFonts.outfit(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: _statusColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 12,
                        runSpacing: 6,
                        children: [
                          _iconText(
                            Icons.timer_outlined,
                            '${appointment.duration} min',
                          ),
                          _iconText(
                            Icons.person_outline_rounded,
                            appointment.employee,
                            maxTextWidth: 130,
                          ),
                          if (appointment.phone != null)
                            _iconText(Icons.phone_outlined, appointment.phone!),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _iconText(IconData icon, String text, {double? maxTextWidth}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppColors.textLight),
        const SizedBox(width: 4),
        if (maxTextWidth != null)
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxTextWidth),
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 11,
                color: AppColors.textGray,
                fontWeight: FontWeight.w500,
              ),
            ),
          )
        else
          Text(
            text,
            style: GoogleFonts.outfit(
              fontSize: 11,
              color: AppColors.textGray,
              fontWeight: FontWeight.w500,
            ),
          ),
      ],
    );
  }

  void _showDetails(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AppointmentDetailsSheet(
        appointment: appointment,
        onStatusChanged: onStatusChanged,
      ),
    );
  }
}

class _AppointmentDetailsSheet extends StatelessWidget {
  final Appointment appointment;
  final Function(String)? onStatusChanged;

  const _AppointmentDetailsSheet({
    required this.appointment,
    this.onStatusChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(28),
          topRight: Radius.circular(28),
        ),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
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
          const SizedBox(height: 20),
          Text(
            'Détails du rendez-vous',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 20),
          _detailRow(Icons.person_rounded, 'Client', appointment.clientName),
          if (appointment.services.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.spa_rounded, size: 18, color: AppColors.primary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Services', style: GoogleFonts.outfit(fontSize: 11, color: AppColors.textLight, fontWeight: FontWeight.w500)),
                            ...appointment.services.map((service) => Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Text(
                                      '• ${service.name} • ${service.duration} min • ${service.price.toStringAsFixed(0)} MAD'
                                      '${service.employeeName != null && service.employeeName!.isNotEmpty ? ' — ${service.employeeName}' : ''}',
                                      style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textDark),
                                    ),
                                  ),
                                ],
                              ),
                            )),
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text('Total: ${appointment.totalDuration} min • ${appointment.totalPrice.toStringAsFixed(0)} MAD', style: GoogleFonts.outfit(fontSize: 13, color: AppColors.textGray, fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            )
          else
            _detailRow(Icons.spa_rounded, 'Prestation', appointment.service),
          _detailRow(Icons.access_time_rounded, 'Heure', '${appointment.time} (${appointment.duration} min)'),
          _detailRow(Icons.badge_rounded, 'Employé', appointment.employee),
          if (appointment.phone != null)
            _detailRow(Icons.phone_rounded, 'Téléphone', appointment.phone!),
          if (appointment.email != null)
            _detailRow(Icons.mail_rounded, 'Email', appointment.email!),
          if (appointment.notes != null && appointment.notes!.isNotEmpty)
            _detailRow(Icons.notes_rounded, 'Notes', appointment.notes!),
          const SizedBox(height: 20),
          const Divider(color: AppColors.divider),
          const SizedBox(height: 16),
          Text(
            'Changer le statut',
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _statusButton(
                  context,
                  'Confirmé',
                  AppColors.confirmed,
                  AppColors.confirmedBg,
                  'confirmed',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _statusButton(
                  context,
                  'En attente',
                  AppColors.pending,
                  AppColors.pendingBg,
                  'pending',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _statusButton(
                  context,
                  'Annulé',
                  AppColors.cancelled,
                  AppColors.cancelledBg,
                  'cancelled',
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton(
              onPressed: () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
              ),
              child: Text(
                'Fermer',
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textGray,
                ),
              ),
            ),
          ),
          SizedBox(height: MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }

  Widget _detailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: GoogleFonts.outfit(
                        fontSize: 11, color: AppColors.textLight, fontWeight: FontWeight.w500)),
                Text(value,
                    style: GoogleFonts.outfit(
                        fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textDark)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusButton(BuildContext context, String label, Color color,
      Color bg, String status) {
    final isActive = appointment.status == status;
    return GestureDetector(
      onTap: () {
        onStatusChanged?.call(status);
        Navigator.pop(context);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isActive ? bg : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isActive ? color : AppColors.border,
              width: isActive ? 1.5 : 1),
        ),
        child: Center(
          child: Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: isActive ? color : AppColors.textGray,
            ),
          ),
        ),
      ),
    );
  }
}
