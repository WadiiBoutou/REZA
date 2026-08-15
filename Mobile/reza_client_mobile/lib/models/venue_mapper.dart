import 'dart:convert';

import 'package:flutter/widgets.dart';

import '../config/api_config.dart';
import '../constants.dart';

/// Resolves an image URL (possibly relative `/uploads/...`) to an absolute URL
/// that Flutter's `Image.network` can fetch. External `http(s)://` URLs are
/// kept as-is. This fixes real uploaded salon covers (e.g. Spa Royal Casablanca)
/// which the backend returns as relative paths in dev/proxy environments.
String resolveImageUrl(String raw) {
  final v = raw.trim();
  if (v.isEmpty) return '';
  final apiBase = ApiConfig.baseUrl;
  final origin = apiBase.endsWith('/api')
      ? apiBase.substring(0, apiBase.length - 4)
      : apiBase;
  // A URL pointing at the machine's own loopback can never be fetched by a
  // real phone (it would try to reach ITSELF). Rewrite localhost/127.0.0.1
  // to the current API origin so stale dev URLs in the DB still render.
  if (v.startsWith('http://localhost') || v.startsWith('http://127.0.0.1')) {
    final slash = v.indexOf('/', 'http://'.length);
    final pathPart = slash >= 0 ? v.substring(slash) : '/';
    return '$origin$pathPart';
  }
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('/')) return '$origin$v';
  return '$origin/$v';
}

/// Resolves an avatar string (http URL or base64 data: URI) into an ImageProvider,
/// or null when empty/unusable so callers can fall back to initials.
ImageProvider? avatarProvider(String src) {
  final s = src.trim();
  if (s.isEmpty) return null;
  if (s.startsWith('data:')) {
    try {
      return MemoryImage(base64Decode(s.split(',').last));
    } catch (_) {
      return null;
    }
  }
  // Uploaded avatars can be stored as relative paths (/uploads/...) in dev or
  // as localhost URLs from an earlier local run — resolve both to an absolute,
  // device-reachable URL before handing the string to NetworkImage.
  final resolved = resolveImageUrl(s);
  if (resolved.startsWith('http')) return NetworkImage(resolved);
  return null;
}

/// Map Backend tenant JSON → UI-friendly venue map used across screens.
Map<String, dynamic> tenantToVenue(Map<String, dynamic> t) {
  final coords = t['coordinates'];
  double? lat;
  double? lng;
  if (coords is Map) {
    lat = (coords['lat'] as num?)?.toDouble();
    lng = (coords['lng'] as num?)?.toDouble();
  }
  lat ??= (t['latitude'] as num?)?.toDouble();
  lng ??= (t['longitude'] as num?)?.toDouble();
  // Only true when the backend actually provided coordinates — not the
  // Casablanca fallback below, so the UI never fakes a distance.
  final hasCoordinates = lat != null && lng != null;

  final rating = (t['rating'] as num?)?.toDouble() ??
      (t['averageRating'] as num?)?.toDouble() ??
      0.0;
  final reviewCount = t['reviewCount'] ?? t['reviewsCount'] ?? 0;

  return {
    'id': t['id']?.toString() ?? '',
    'name': t['name']?.toString() ?? '',
    'image': resolveImageUrl((t['coverImage'] ?? t['logo'] ?? '').toString()),
    'rating': rating,
    'reviews': reviewCount is int ? reviewCount : int.tryParse('$reviewCount') ?? 0,
    'category': t['category']?.toString() ?? '',
    'location': [
      if ((t['address'] ?? '').toString().isNotEmpty) t['address'],
      if ((t['city'] ?? '').toString().isNotEmpty) t['city'],
    ].join(', '),
    'city': t['city']?.toString() ?? '',
    'distance': t['distanceKm'] != null ? '${t['distanceKm']} km' : '',
    'latitude': lat ?? 33.5731,
    'longitude': lng ?? -7.5898,
    'hasCoordinates': hasCoordinates,
    'nextAvailable': t['nextAvailable']?.toString() ?? '',
    'price': t['price']?.toString() ?? '',
    'description': (t['description'] ?? '').toString(),
    'raw': t,
  };
}

ServiceItem serviceFromApi(Map<String, dynamic> s) {
  return ServiceItem(
    id: s['id']?.toString() ?? '',
    name: s['name']?.toString() ?? '',
    durationMin: (s['duration'] as num?)?.toInt() ??
        (s['durationMin'] as num?)?.toInt() ??
        30,
    price: (s['price'] as num?)?.toDouble() ?? 0,
    description: (s['description'] ?? '').toString(),
    category: (s['category'] ?? '').toString().trim(),
  );
}

VenueItem venueMapToItem(
  Map<String, dynamic> m, {
  List<ServiceItem> services = const [],
  List<String> images = const [],
}) {
  // Prefer caller-provided images list (populated by tenant-level photo fields).
  // Otherwise fall back to the single cover image if the list is empty.
  final cover = (m['image'] ?? '').toString().trim();
  final resolvedImages = images.isNotEmpty
      ? images
      : (cover.isNotEmpty ? <String>[cover] : <String>[]);
  return VenueItem(
    id: m['id']?.toString() ?? '',
    name: m['name']?.toString() ?? '',
    // REAL salon image only (cover uploaded by the salon owner). Empty when the
    // salon hasn't uploaded anything — the UI shows a neutral placeholder instead
    // of stock imagery.
    image: cover,
    images: resolvedImages,
    rating: (m['rating'] as num?)?.toDouble() ?? 0,
    reviews: m['reviews'] is int
        ? m['reviews'] as int
        : int.tryParse('${m['reviews']}') ?? 0,
    category: m['category']?.toString() ?? '',
    location: m['location']?.toString() ?? '',
    distance: (m['distance']?.toString().isNotEmpty == true)
        ? m['distance'].toString()
        : '',
    latitude: (m['latitude'] as num?)?.toDouble() ?? 33.5731,
    longitude: (m['longitude'] as num?)?.toDouble() ?? -7.5898,
    hasCoordinates: (m['hasCoordinates'] as bool?) ?? false,
    nextAvailable: m['nextAvailable']?.toString() ?? '',
    services: services,
  );
}

VenueItem tenantToVenueItem(
  Map<String, dynamic> t, {
  List<ServiceItem> services = const [],
}) {
  final Map<String, dynamic> venue = tenantToVenue(t);
  // Collate the gallery images from the tenant's settings fields that the
  // backend already exposes: coverImages (hero gallery), photos (portfolio),
  // and finally coverImage as fallback. Deduplicate while preserving order
  // so a salon uploading the same asset twice doesn't show duplicate slides.
  final settings = t['settings'];
  final gallery = <String>[];
  final seen = <String>{};
  void addPhoto(String? raw) {
    if (raw == null) return;
    final v = resolveImageUrl(raw).trim();
    if (v.isEmpty) return;
    if (!seen.add(v)) return;
    gallery.add(v);
  }

  if (settings is Map) {
    final cImgs = settings['coverImages'];
    if (cImgs is List) {
      for (final x in cImgs) {
        addPhoto(x?.toString());
      }
    }
    final photos = settings['photos'];
    if (photos is List) {
      for (final x in photos) {
        addPhoto(x?.toString());
      }
    }
  }
  addPhoto((t['coverImage'] ?? '').toString().trim().isEmpty
      ? null
      : t['coverImage'].toString());
  addPhoto((t['logo'] ?? '').toString().trim().isEmpty
      ? null
      : t['logo'].toString());

  return venueMapToItem(venue, services: services, images: gallery);
}

/// Distance + location when GPS/API returned km; otherwise location only (no fake km).
String venueMetaLine(VenueItem venue) {
  if (venue.distance.isNotEmpty) {
    return '${venue.distance} · ${venue.location}';
  }
  return venue.location;
}

