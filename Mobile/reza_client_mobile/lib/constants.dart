import 'package:flutter/material.dart';

class AppColors {
  // Core
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFF9FAFB);
  static const Color primary = Color(0xFF000000);
  static const Color primaryLight = Color(0xFF1A1A1A);

  // Text
  static const Color textDark = Color(0xFF111827);
  static const Color offBlack = Color(0xFF111827);
  static const Color textGray = Color(0xFF6B7280);
  static const Color textLight = Color(0xFF9CA3AF);

  // Status
  static const Color available = Color(0xFF10B981);
  static const Color availableLight = Color(0xFFD1FAE5);
  static const Color starColor = Color(0xFFF59E0B);

  // UI
  static const Color border = Color(0xFFE5E7EB);
  static const Color cardShadow = Color(0x0A000000);
  static const Color divider = Color(0xFFF3F4F6);

  // Category chip accent
  static const Color chipBg = Color(0xFFF3F4F6);

  // Booking flow accents (Fresha-style)
  static const Color purpleAccent = Color(0xFF7C3AED);
  static const Color purpleLight = Color(0xFFEDE9FE);
  static const Color facebookBlue = Color(0xFF1877F2);
}

// ─── Data models ─────────────────────────────────────────────────────────────

class ServiceItem {
  final String id;
  final String name;
  final int durationMin;
  final double price;
  final String description;
  final String category;

  const ServiceItem({
    this.id = '',
    required this.name,
    required this.durationMin,
    required this.price,
    required this.description,
    this.category = '',
  });
}

class VenueItem {
  final String id;
  final String name;
  final String image;
  final List<String> images;
  final double rating;
  final int reviews;
  final String category;
  final String location;
  final String distance;
  final double latitude;
  final double longitude;
  /// Whether the venue carries real coordinates (vs the mapper's fallback).
  final bool hasCoordinates;
  final String nextAvailable;
  final List<ServiceItem> services;

  const VenueItem({
    required this.id,
    required this.name,
    required this.image,
    this.images = const [],
    required this.rating,
    required this.reviews,
    required this.category,
    required this.location,
    required this.distance,
    required this.latitude,
    required this.longitude,
    required this.hasCoordinates,
    required this.nextAvailable,
    required this.services,
  });
}

// ─── Static Data ─────────────────────────────────────────────────────────────

/// Canonical salon service categories — shared with the admin's
/// gestion-de-prestations (same labels). Each category maps to an icon here so
/// the home carousel can filter salons offering services in that category.
final List<Map<String, dynamic>> serviceCategories = [
  {'icon': Icons.content_cut, 'label': 'Coiffeur'},
  {'icon': Icons.palette_outlined, 'label': 'Couleur'},
  {'icon': Icons.chair_alt_outlined, 'label': 'Barbier'},
  {'icon': Icons.face_retouching_natural, 'label': 'Manucure'},
  {'icon': Icons.accessibility_new, 'label': 'Pédicure'},
  {'icon': Icons.auto_fix_high, 'label': 'Épilation'},
  {'icon': Icons.spa, 'label': 'Esthétique'},
  {'icon': Icons.brush, 'label': 'Maquillage'},
  {'icon': Icons.self_improvement, 'label': 'Massage'},
  {'icon': Icons.hot_tub, 'label': 'Spa'},
  {'icon': Icons.volunteer_activism, 'label': 'Hammam'},
  {'icon': Icons.healing, 'label': 'Soin'},
];
