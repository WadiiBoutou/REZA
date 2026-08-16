import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants.dart';

class BookingConfirmationScreen extends StatefulWidget {
  final VenueItem venue;
  final List<ServiceItem> services;
  final String date;
  final String time;
  final Map<String, dynamic>? bookingResult;
  final VoidCallback? onGoToBookings;

  const BookingConfirmationScreen({
    super.key,
    required this.venue,
    required this.services,
    required this.date,
    required this.time,
    this.bookingResult,
    this.onGoToBookings,
  });

  @override
  State<BookingConfirmationScreen> createState() => _BookingConfirmationScreenState();
}

class _ParticipantService {
  final String name;
  final int durationMin;
  final double price;
  const _ParticipantService({required this.name, required this.durationMin, required this.price});
}

class _ParticipantInfo {
  final String displayName;
  final bool isBooker;
  final double subtotal;
  final String startTime;
  final List<_ParticipantService> services;
  _ParticipantInfo({
    required this.displayName,
    required this.isBooker,
    required this.subtotal,
    this.startTime = '',
    this.services = const [],
  });
}

class _BookingConfirmationScreenState extends State<BookingConfirmationScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;
  late Animation<double> _checkAnim;

  late final List<_ParticipantInfo> _participants;
  late final double _grandTotal;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));

    _scaleAnim = CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.6, curve: Curves.elasticOut));
    _fadeAnim = CurvedAnimation(parent: _controller, curve: const Interval(0.4, 1.0, curve: Curves.easeIn));
    _checkAnim = CurvedAnimation(parent: _controller, curve: const Interval(0.3, 0.8, curve: Curves.easeOut));

    _parseParticipants();

    Future.delayed(const Duration(milliseconds: 100), () => _controller.forward());
  }

  void _parseParticipants() {
    void fillFromWidget() {
      _participants = [
        _ParticipantInfo(
          displayName: 'Vous',
          isBooker: true,
          subtotal: widget.services.fold(0.0, (s, svc) => s + svc.price),
          startTime: widget.time,
          services: widget.services
              .map((s) => _ParticipantService(
                    name: s.name,
                    durationMin: s.durationMin,
                    price: s.price,
                  ))
              .toList(),
        ),
      ];
      _grandTotal = _participants.first.subtotal;
    }

    final result = widget.bookingResult;
    if (result == null) {
      fillFromWidget();
      return;
    }

    final pricing = result['pricing'] as Map<String, dynamic>?;
    final rawParticipants = pricing?['participants'] as List?;
    if (rawParticipants != null && rawParticipants.isNotEmpty) {
      _participants = rawParticipants.map((p) {
        final data = p as Map<String, dynamic>;
        final rawServices = data['services'] as List?;
        final services = (rawServices ?? []).map((s) {
          final m = s as Map<String, dynamic>;
          return _ParticipantService(
            name: (m['name'] ?? '').toString(),
            durationMin: ((m['duration'] as num?) ?? 0).toInt(),
            price: ((m['price'] as num?) ?? 0).toDouble(),
          );
        }).toList();
        return _ParticipantInfo(
          displayName: (data['displayName'] as String?) ?? '',
          isBooker: (data['isBooker'] as bool?) ?? false,
          subtotal: ((data['subtotal'] as num?) ?? 0).toDouble(),
          startTime: (data['startTime'] as String?) ?? '',
          services: services,
        );
      }).toList();
      _grandTotal = ((pricing?['grandTotal'] as num?) ?? 0).toDouble();
    } else {
      // Safety net: never show an empty receipt if pricing data is missing.
      fillFromWidget();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 40),

              // ── Animated Check ────────────────────────────────
              ScaleTransition(
                scale: _scaleAnim,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: AppColors.available,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.available.withValues(alpha: 0.3),
                        blurRadius: 30,
                        spreadRadius: 10,
                      ),
                    ],
                  ),
                  child: AnimatedBuilder(
                    animation: _checkAnim,
                    builder: (_, __) => Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 52 * _checkAnim.value,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // ── Title ────────────────────────────────────────
              FadeTransition(
                opacity: _fadeAnim,
                child: Column(
                  children: [
                    Text(
                      'Réservation enregistrée !',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textDark,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Votre demande a été envoyée. L\'établissement confirmera bientôt votre rendez-vous.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        color: AppColors.textGray,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 36),

              // ── Booking Card ────────────────────────────────
              FadeTransition(
                opacity: _fadeAnim,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      // Venue row
                      Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              widget.venue.image,
                              width: 52,
                              height: 52,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 52, height: 52,
                                color: AppColors.border,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.venue.name,
                                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textDark),
                                ),
                                Text(
                                  widget.venue.location,
                                  style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              'En attente',
                              style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFFF59E0B)),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 16),
                      const Divider(color: AppColors.border),
                      const SizedBox(height: 16),

                      // Participants — each one shows their own services, prices and time
                      Row(
                        children: [
                          Icon(Icons.people_rounded, size: 18, color: AppColors.textGray),
                          const SizedBox(width: 8),
                          Text('Participants', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textGray)),
                          const Spacer(),
                          Text('Sous-total', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textGray)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      for (final p in _participants) ...[_ParticipantCard(info: p)],
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              _participants.length > 1 ? 'Total groupe' : 'Total',
                              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textDark),
                            ),
                          ),
                          Text(
                            '${_grandTotal.toInt()} MAD',
                            style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textDark),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _ConfirmDetail(icon: Icons.calendar_today_rounded, label: 'Date', value: widget.date),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // ── Actions ──────────────────────────────────────
              FadeTransition(
                opacity: _fadeAnim,
                child: Column(
                  children: [
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: () {
                          Navigator.popUntil(context, (route) => route.isFirst);
                          widget.onGoToBookings?.call();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: Text(
                          'Voir mes réservations',
                          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: OutlinedButton(
                        onPressed: () => Navigator.popUntil(context, (route) => route.isFirst),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: AppColors.border),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: Text(
                          "Retour à l'accueil",
                          style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textDark),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One participant on the receipt — their own services, timing and price,
/// mirroring the web receipt's per-client blocks.
class _ParticipantCard extends StatelessWidget {
  final _ParticipantInfo info;
  const _ParticipantCard({required this.info});

  static String _formatTime(String iso) {
    final t = DateTime.tryParse(iso)?.toLocal();
    if (t != null) {
      return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    }
    // Already a plain HH:MM string (single-booking fallback path)
    return iso.trim();
  }

  @override
  Widget build(BuildContext context) {
    final label = (info.isBooker ? 'Vous' : info.displayName).toUpperCase();
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
                child: Text(
                  label,
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.textDark, letterSpacing: 0.4),
                ),
              ),
              if (_formatTime(info.startTime).isNotEmpty) ...[Icon(Icons.access_time_rounded, size: 13, color: AppColors.textGray), const SizedBox(width: 4)],
              if (_formatTime(info.startTime).isNotEmpty)
                Text(_formatTime(info.startTime), style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textDark)),
            ],
          ),
          const SizedBox(height: 8),
          if (info.services.isEmpty)
            Text('—', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray))
          else
            ...info.services.map((s) => Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(s.name, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark)),
                      ),
                      Text('${s.price.toInt()} MAD', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark)),
                    ],
                  ),
                )),
          const SizedBox(height: 6),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text('Sous-total', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray)),
              ),
              Text('${info.subtotal.toInt()} MAD', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textDark)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ConfirmDetail extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _ConfirmDetail({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.textGray),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textGray)),
              const SizedBox(height: 2),
              Text(value, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark)),
            ],
          ),
        ),
      ],
    );
  }
}
