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
    required this.nextAvailable,
    required this.services,
  });
}

class FAQItem {
  final String question;
  final String answer;
  const FAQItem({required this.question, required this.answer});
}

class Testimonial {
  final int id;
  final String name;
  final String role;
  final String city;
  final int rating;
  final String text;
  final String avatar;
  final String date;

  const Testimonial({
    required this.id,
    required this.name,
    required this.role,
    required this.city,
    required this.rating,
    required this.text,
    required this.avatar,
    required this.date,
  });
}

class ProfessionalItem {
  final String name;
  final String distance;
  final String role;
  final String avatarUrl;

  const ProfessionalItem({
    required this.name,
    required this.distance,
    required this.role,
    required this.avatarUrl,
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

final List<VenueItem> allVenues = [
  VenueItem(
    id: '1',
    name: 'Salon Élégance',
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop',
    rating: 4.8,
    reviews: 156,
    category: 'Coiffeur',
    location: 'Maarif, Casablanca',
    distance: '1.2 km',
    latitude: 33.585,
    longitude: -7.635,
    nextAvailable: "Aujourd'hui à 15h",
    services: [
      const ServiceItem(name: 'Coupe femme', durationMin: 45, price: 150, description: 'Coupe, shampoing et brushing inclus'),
      const ServiceItem(name: 'Brushing', durationMin: 30, price: 80, description: 'Brushing lissant ou volumisant'),
      const ServiceItem(name: 'Coloration', durationMin: 90, price: 250, description: 'Coloration complète avec soin'),
      const ServiceItem(name: 'Mèches', durationMin: 120, price: 320, description: 'Balayage ou mèches classiques'),
    ],
  ),
  VenueItem(
    id: '2',
    name: 'Barber Studio',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop',
    rating: 4.9,
    reviews: 203,
    category: 'Barbier',
    location: 'Racine, Casablanca',
    distance: '2.1 km',
    latitude: 33.595,
    longitude: -7.637,
    nextAvailable: 'Demain à 10h',
    services: [
      const ServiceItem(name: 'Coupe homme', durationMin: 30, price: 80, description: 'Coupe classique ou moderne'),
      const ServiceItem(name: 'Rasage à l\'ancienne', durationMin: 30, price: 70, description: 'Rasage au blaireau et rasoir'),
      const ServiceItem(name: 'Taille de barbe', durationMin: 20, price: 50, description: 'Taille et entretien de barbe'),
    ],
  ),
  VenueItem(
    id: '3',
    name: 'Spa Royal Casablanca',
    image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=800&auto=format&fit=crop',
    rating: 4.7,
    reviews: 98,
    category: 'Spa',
    location: 'Oasis, Casablanca',
    distance: '3.5 km',
    latitude: 33.555,
    longitude: -7.636,
    nextAvailable: "Aujourd'hui à 18h",
    services: [
      const ServiceItem(name: 'Hammam traditionnel', durationMin: 60, price: 200, description: 'Hammam avec gommage au savon beldi'),
      const ServiceItem(name: 'Massage relaxant', durationMin: 60, price: 250, description: 'Massage corps complet aux huiles'),
      const ServiceItem(name: 'Gommage argan', durationMin: 45, price: 180, description: 'Gommage corps à l\'huile d\'argan'),
    ],
  ),
  VenueItem(
    id: '4',
    name: 'Beauty Center Chic',
    image: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?q=80&w=800&auto=format&fit=crop',
    rating: 4.6,
    reviews: 124,
    category: 'Centre de beauté',
    location: 'Centre-ville, Casablanca',
    distance: '0.8 km',
    latitude: 33.590,
    longitude: -7.610,
    nextAvailable: "Aujourd'hui à 14h",
    services: [
      const ServiceItem(name: 'Manucure gel', durationMin: 60, price: 120, description: 'Pose de gel et nail art inclus'),
      const ServiceItem(name: 'Pédicure complète', durationMin: 60, price: 130, description: 'Soin pieds + vernis semi-permanent'),
      const ServiceItem(name: 'Épilation jambes', durationMin: 30, price: 90, description: 'Épilation à la cire tiède'),
    ],
  ),
  VenueItem(
    id: '5',
    name: 'Nail Bar Chic',
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800&auto=format&fit=crop',
    rating: 4.5,
    reviews: 75,
    category: 'Manucure',
    location: 'Racine, Casablanca',
    distance: '1.8 km',
    latitude: 33.594,
    longitude: -7.638,
    nextAvailable: 'Demain à 11h',
    services: [
      const ServiceItem(name: 'Pose résine', durationMin: 75, price: 160, description: 'Pose résine avec nail art personnalisé'),
      const ServiceItem(name: 'Vernis semi-permanent', durationMin: 45, price: 100, description: 'Vernis longue durée 3 semaines'),
    ],
  ),
  VenueItem(
    id: '6',
    name: 'Zen Spa',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop',
    rating: 4.8,
    reviews: 120,
    category: 'Massage',
    location: 'Anfa, Casablanca',
    distance: '4.2 km',
    latitude: 33.592,
    longitude: -7.648,
    nextAvailable: "Aujourd'hui à 17h",
    services: [
      const ServiceItem(name: 'Massage suédois', durationMin: 60, price: 220, description: 'Massage relaxant complet du corps'),
      const ServiceItem(name: 'Massage aux pierres chaudes', durationMin: 75, price: 280, description: 'Détente profonde avec pierres volcaniques'),
      const ServiceItem(name: 'Réflexologie plantaire', durationMin: 45, price: 160, description: 'Massage des pieds et points réflexes'),
    ],
  ),
];

final List<FAQItem> faqs = [
  const FAQItem(
    question: "Qu'est-ce que REZA ?",
    answer: "REZA est une plateforme marocaine de réservation de soins beauté et bien-être. Trouvez et réservez instantanément dans les meilleurs salons, spas et instituts du Maroc.",
  ),
  const FAQItem(
    question: "Comment annuler un rendez-vous ?",
    answer: "Vous pouvez annuler gratuitement jusqu'à 24h avant votre rendez-vous depuis l'onglet 'Mes RDV'. Au-delà, des frais peuvent s'appliquer selon l'établissement.",
  ),
  const FAQItem(
    question: "Comment payer ma réservation ?",
    answer: "Le paiement s'effectue directement en salon après votre prestation. Certains établissements proposent également le paiement en ligne sécurisé.",
  ),
];

final List<Testimonial> testimonials = [
  const Testimonial(
    id: 1,
    name: "Sara M.",
    role: "Cliente régulière",
    city: "Casablanca",
    rating: 5,
    text: "L'application est intuitive et me permet de voir les disponibilités en temps réel. Je ne retournerai jamais aux réservations par téléphone !",
    avatar: "S",
    date: "Il y a 2 jours",
  ),
  const Testimonial(
    id: 2,
    name: "Aya B.",
    role: "Cliente",
    city: "Rabat",
    rating: 5,
    text: "Super pratique ! J'ai trouvé un salon top noté près de chez moi et j'ai réservé en 2 minutes.",
    avatar: "A",
    date: "Il y a 5 jours",
  ),
  const Testimonial(
    id: 3,
    name: "Karim L.",
    role: "Client",
    city: "Casablanca",
    rating: 5,
    text: "Les créneaux en temps réel c'est top. Plus besoin d'appeler pour vérifier les dispos !",
    avatar: "K",
    date: "Il y a 1 semaine",
  ),
];

final List<ProfessionalItem> allProfessionals = [
  const ProfessionalItem(
    name: 'Beauty lab',
    distance: '6,1 km',
    role: 'Beauty salon & Spa',
    avatarUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=150',
  ),
  const ProfessionalItem(
    name: 'fahd elhilali',
    distance: '6,4 km',
    role: 'Thai Massage Therapist',
    avatarUrl: 'F',
  ),
  const ProfessionalItem(
    name: 'Wife Wappetha',
    distance: '6,4 km',
    role: 'Thai Massage Therapist',
    avatarUrl: 'W',
  ),
  const ProfessionalItem(
    name: 'Private Barber Marrakech',
    distance: '6,5 km',
    role: 'Barbier - Barbershop - Marrak...',
    avatarUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=150',
  ),
];
