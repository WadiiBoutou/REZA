import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../constants.dart';

/// Temporary brand logo — an "RZ" monogram rendered in a rounded badge,
/// used until a real logo asset is available.
class RzLogo extends StatelessWidget {
  const RzLogo({super.key, this.size = 44});

  /// Square size of the badge.
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      child: Text(
        'RZ',
        style: GoogleFonts.inter(
          fontSize: size * 0.42,
          fontWeight: FontWeight.w900,
          color: Colors.white,
          letterSpacing: -1,
          height: 1,
        ),
      ),
    );
  }
}
