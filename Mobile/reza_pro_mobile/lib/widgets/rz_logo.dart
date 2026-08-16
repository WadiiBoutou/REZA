import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../constants/app_colors.dart';

/// Temporary brand logo — an "RZ" monogram in a rounded badge with a small
/// "pro" pill pinned to its top-right corner, used until a real logo asset
/// is available.
class RzLogo extends StatelessWidget {
  const RzLogo({super.key, this.size = 44});

  /// Square size of the badge (the "pro" pill scales with it).
  final double size;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(size * 0.28),
          ),
          child: Text(
            'RZ',
            style: GoogleFonts.outfit(
              fontSize: size * 0.42,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -1,
              height: 1,
            ),
          ),
        ),
        Positioned(
          top: -size * 0.16,
          right: -size * 0.22,
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: size * 0.12,
              vertical: size * 0.035,
            ),
            decoration: BoxDecoration(
              color: AppColors.navy,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.white, width: 1.5),
            ),
            child: Text(
              'pro',
              style: GoogleFonts.outfit(
                fontSize: size * 0.2,
                fontWeight: FontWeight.w800,
                color: Colors.white,
                height: 1,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
