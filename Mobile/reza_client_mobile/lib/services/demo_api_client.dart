import '../data/demo_api_data.dart';
import '../data/demo_images.dart';
import '../config/demo_config.dart';

/// Demo API client that simulates backend responses with mock data.
class DemoApiClient {
  // In-memory data stores (mutable for demo interactions)
  static List<Map<String, dynamic>> _salons = DemoApiData.getSalons();
  static List<Map<String, dynamic>> _appointments = DemoApiData.getAppointments();
  static List<Map<String, dynamic>> _reviews = DemoApiData.getReviews();
  static List<Map<String, dynamic>> _favorites = DemoApiData.getFavorites();
  static List<Map<String, dynamic>> _familyMembers = [];
  static Map<String, dynamic> _client = DemoApiData.getClient();

  /// Main request handler
  static Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 300));

    final uri = Uri.parse(path);
    final segments = uri.pathSegments;
    
    print('[DEMO API] $method $path');

    // Route requests to appropriate handlers
    if (path.contains('/public/tenants')) {
      return _handlePublicTenants(query);
    } else if (path.contains('/public/categories')) {
      return _handlePublicCategories();
    } else if (path.contains('/public/employees/featured')) {
      return _handleFeaturedEmployees();
    } else if (path.contains('/public/tenant/')) {
      return _handleTenantRoutes(segments, method, body, query);
    } else if (path.contains('/public/auth/client-login')) {
      return _handleClientLogin(body);
    } else if (path.contains('/public/auth/client-register')) {
      return _handleClientRegister(body);
    } else if (path.contains('/public/auth/check-email')) {
      final email = (query?['email'] ?? body?['email'] ?? '').toString().trim().toLowerCase();
      return {'exists': email == DemoConfig.demoEmail.toLowerCase()};
    } else if (path.contains('/public/auth/upload-avatar')) {
      return {
        'avatar': (_client['avatar'] ?? DemoImages.clientPhoto('FEMALE', 0)).toString(),
      };
    } else if (path.contains('/public/bookings') && method == 'POST') {
      return _handleCreateBooking(body);
    } else if (path.contains('/public/client/')) {
      return _handleClientRoutes(segments, method, body, query);
    } else if (path.contains('/public/appointments/') && path.contains('/cancel')) {
      return _handleCancelAppointment(segments);
    } else if (path.contains('/public/favorites')) {
      return _handleFavorites(method, body, segments);
    } else if (path.contains('/public/family-members')) {
      return _handleFamilyMembers(method, body, segments);
    } else if (path.contains('/public/reviews')) {
      return _handleReviews(method, body, segments);
    } else if (path.contains('password') || path.contains('forgot') || path.contains('/read')) {
      return {'message': 'Action simulée avec succès.'};
    }

    return {'message': 'Demo endpoint not implemented: $path'};
  }

  // Handler methods
  static bool _salonMatchesCategory(Map<String, dynamic> salon, String needle) {
    if (needle.isEmpty) return true;
    final salonCategory = (salon['category'] ?? '').toString().toLowerCase();
    if (salonCategory.contains(needle)) return true;
    final names = salon['services'];
    if (names is List && names.any((name) => name.toString().toLowerCase().contains(needle))) {
      return true;
    }
    final detailed = DemoApiData.getServicesForSalon((salon['id'] ?? '').toString());
    return detailed.any((service) {
      final category = (service['category'] ?? '').toString().toLowerCase();
      final name = (service['name'] ?? '').toString().toLowerCase();
      return category.contains(needle) || name.contains(needle);
    });
  }

  static Map<String, dynamic> _handlePublicTenants(Map<String, String>? query) {
    var filtered = List<Map<String, dynamic>>.from(_salons);

    if (query != null) {
      final search = (query['search'] ?? '').toLowerCase();
      final category = (query['category'] ?? '').trim().toLowerCase();
      final categories = (query['categories'] ?? '')
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .where((value) => value.isNotEmpty)
          .toList();
      final city = (query['city'] ?? '').toLowerCase();

      if (search.isNotEmpty) {
        filtered = filtered.where((salon) {
          final text = '${salon['name']} ${salon['city']} ${salon['category']}'.toLowerCase();
          return text.contains(search);
        }).toList();
      }

      final needles = <String>[
        if (category.isNotEmpty) category,
        ...categories,
      ];
      if (needles.isNotEmpty) {
        filtered = filtered.where((salon) {
          return needles.any((needle) => _salonMatchesCategory(salon, needle));
        }).toList();
      }

      if (city.isNotEmpty) {
        filtered = filtered.where((salon) {
          return (salon['city'] ?? '').toString().toLowerCase().contains(city);
        }).toList();
      }
    }

    final limit = int.tryParse(query?['limit'] ?? '50') ?? 50;
    return {'tenants': filtered.take(limit).toList()};
  }

  static Map<String, dynamic> _handlePublicCategories() {
    final categories = <String>{};
    for (final salon in _salons) {
      categories.add(salon['category'] as String);
    }

    return {
      'categories': categories.map((name) {
        final count = _salons.where((s) => s['category'] == name).length;
        return {'name': name, 'count': count};
      }).toList()
    };
  }

  static Map<String, dynamic> _handleFeaturedEmployees() {
    final staff = DemoApiData.getStaff();
    return {
      'employees': staff.asMap().entries.map((entry) {
        final index = entry.key;
        final employee = entry.value;
        final salon = _salons[index % _salons.length];
        return {
          ...employee,
          'tenant': salon,
          'tenantId': salon['id'],
          'salonName': salon['name'],
          'specialty': employee['role'],
          'rating': salon['rating'],
          'reviews': salon['reviewCount'],
          'services': DemoApiData.getServicesForSalon(salon['id']),
        };
      }).toList()
    };
  }

  static Map<String, dynamic> _handleTenantRoutes(
    List<String> segments,
    String method,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  ) {
    final salonId = segments[2];
    final salon = _salons.firstWhere(
      (s) => s['id'] == salonId,
      orElse: () => _salons[0],
    );

    if (segments.length == 3) {
      return {'tenant': salon};
    }

    final action = segments.length > 3 ? segments[3] : '';

    switch (action) {
      case 'services':
        var services = DemoApiData.getServicesForSalon(salonId);
        final categoryFilter = query?['category'];
        if (categoryFilter != null && categoryFilter.isNotEmpty) {
          services = services.where((s) => s['category'] == categoryFilter).toList();
        }
        return {'services': services};

      case 'employees':
        return {'employees': DemoApiData.getStaff().take(3).toList()};

      case 'reviews':
        final salonReviews = _reviews.where((r) => r['tenantId'] == salonId).toList();
        final limit = int.tryParse(query?['limit'] ?? '10') ?? 10;
        final page = int.tryParse(query?['page'] ?? '1') ?? 1;
        
        return {
          'reviews': salonReviews.take(limit).toList(),
          'pagination': {
            'page': page,
            'total': salon['reviewCount'],
          },
          'stats': {
            'averageRating': salon['averageRating'],
            'totalReviews': salon['totalReviews'],
          }
        };

      case 'available-slots':
        return {
          'slots': ['09:30', '10:30', '11:00', '13:30', '14:30', '16:00', '17:00']
        };

      case 'available-days':
        return _handleAvailableDays(query);

      default:
        return {'tenant': salon};
    }
  }

  static Map<String, dynamic> _handleAvailableDays(Map<String, String>? query) {
    final from = DateTime.tryParse(query?['from'] ?? '') ?? DateTime.now();
    final to = DateTime.tryParse(query?['to'] ?? '') ?? 
        DateTime.now().add(const Duration(days: 60));

    final days = <String>[];
    var current = from;
    
    while (current.isBefore(to) || current.isAtSameMomentAs(to)) {
      if (current.weekday != DateTime.sunday) {
        days.add(
          '${current.year}-${current.month.toString().padLeft(2, '0')}-${current.day.toString().padLeft(2, '0')}'
        );
      }
      current = current.add(const Duration(days: 1));
    }

    return {'days': days};
  }

  static Map<String, dynamic> _handleClientLogin(Map<String, dynamic>? body) {
    return {
      'client': _client,
      'token': 'reza-client-demo-session',
      'message': 'Connexion démo réussie.',
    };
  }

  static Map<String, dynamic> _handleClientRegister(Map<String, dynamic>? body) {
    return {
      'client': {..._client, if (body != null) ...body},
      'message': 'Compte démo créé.',
    };
  }

  static Map<String, dynamic> _handleCreateBooking(Map<String, dynamic>? body) {
    if (body == null) return {'message': 'Invalid booking data'};

    final salonId = body['tenantId'] as String?;
    final salon = _salons.firstWhere(
      (s) => s['id'] == salonId,
      orElse: () => _salons[0],
    );

    final services = DemoApiData.getServicesForSalon(salon['id']);
    final serviceIds = body['serviceIds'] as List?;
    final selectedService = services.firstWhere(
      (s) => serviceIds?.contains(s['id']) ?? false,
      orElse: () => services[0],
    );

    final staff = DemoApiData.getStaff();
    final startTime = body['startTime'] ?? DateTime.now().toIso8601String();
    final dateStr = startTime.toString().substring(0, 10);

    final newAppointment = {
      'id': 'demo-client-appointment-${DateTime.now().millisecondsSinceEpoch}',
      'tenantId': salon['id'],
      'tenant': salon,
      'date': dateStr,
      'image': salon['coverImage'],
      'salon': salon['name'],
      'tenantData': salon,
      'service': selectedService['name'],
      'serviceId': selectedService['id'],
      'services': [
        {'service': selectedService}
      ],
      'employee': staff[0],
      'employeeId': staff[0]['id'],
      'client': _client,
      'startTime': startTime,
      'time': startTime.toString().substring(11, 16),
      'status': 'pending',
      'totalPrice': selectedService['price'],
      'price': selectedService['price'],
    };

    _appointments.insert(0, newAppointment);

    return {
      'bookingGroup': {'id': 'demo-booking-${DateTime.now().millisecondsSinceEpoch}'},
      'appointments': [newAppointment],
      'client': _client,
      'pricing': {
        'participants': [],
        'grandTotal': selectedService['price'],
      },
      'message': 'Demande de réservation envoyée.',
    };
  }

  static Map<String, dynamic> _handleClientRoutes(
    List<String> segments,
    String method,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  ) {
    if (segments.length < 3) return {};

    final action = segments.length > 3 ? segments[3] : '';
    if (action.contains('password')) {
      return {'message': 'Action simulée avec succès.'};
    }

    switch (action) {
      case 'appointments':
        return {'appointments': _appointments, 'client': _client};
      
      case 'reviews':
        return {'reviews': _reviews};
      
      case 'notifications':
        return {
          'notifications': [],
          'grouped': {},
          'unreadCount': 0,
        };
      
      case 'family-members':
        return {'familyMembers': _familyMembers};
      
      case 'favorites':
        return {
          'favorites': _favorites,
          'count': _favorites.length,
        };
      
      default:
        if (method == 'PUT') {
          _client = {..._client, if (body != null) ...body};
          return {
            'client': _client,
            'message': 'Profil mis à jour.',
          };
        }
        return {'client': _client};
    }
  }

  static Map<String, dynamic> _handleCancelAppointment(List<String> segments) {
    final appointmentId = segments[2];
    final index = _appointments.indexWhere((a) => a['id'] == appointmentId);
    
    if (index >= 0) {
      _appointments[index]['status'] = 'cancelled';
      return {
        'appointment': _appointments[index],
        'message': 'Rendez-vous annulé.',
      };
    }

    return {'message': 'Appointment not found'};
  }

  static Map<String, dynamic> _handleFamilyMembers(
    String method,
    Map<String, dynamic>? body,
    List<String> segments,
  ) {
    if (method == 'POST' && body != null) {
      final member = <String, dynamic>{
        'id': 'demo-family-${DateTime.now().millisecondsSinceEpoch}',
        'firstName': body['firstName'] ?? '',
        'lastName': body['lastName'] ?? '',
        'relationship': body['relationship'] ?? '',
        'phone': body['phone'],
        'email': body['email'],
        'avatar': body['avatar'],
        'gender': body['gender'],
      };
      _familyMembers.insert(0, member);
      return {'familyMember': member};
    }

    if (method == 'PUT' && segments.length > 2 && body != null) {
      final id = segments[2];
      final index = _familyMembers.indexWhere((member) => member['id'] == id);
      if (index >= 0) {
        _familyMembers[index] = {..._familyMembers[index], ...body, 'id': id};
        return {'familyMember': _familyMembers[index]};
      }
      return {'message': 'Proche introuvable.'};
    }

    if (method == 'DELETE' && segments.length > 2) {
      final id = segments[2];
      _familyMembers.removeWhere((member) => member['id'] == id);
      return {'message': 'Proche supprimé.'};
    }

    return {'familyMembers': _familyMembers};
  }

  static Map<String, dynamic> _handleFavorites(
    String method,
    Map<String, dynamic>? body,
    List<String> segments,
  ) {
    if (method == 'POST' && body != null) {
      final tenantId = body['tenantId'];
      final salon = _salons.firstWhere(
        (s) => s['id'] == tenantId,
        orElse: () => _salons[0],
      );

      final newFavorite = {
        'id': 'demo-favorite-${DateTime.now().millisecondsSinceEpoch}',
        'tenant': salon,
        'tenantId': salon['id'],
      };

      _favorites.add(newFavorite);

      return {
        'favorite': newFavorite,
        'message': 'Ajouté aux favoris.',
      };
    }

    if (method == 'DELETE' && segments.length > 2) {
      final favoriteId = segments[2];
      _favorites.removeWhere((f) => f['id'] == favoriteId);
      return {'message': 'Retiré des favoris.'};
    }

    return {
      'favorites': _favorites,
      'count': _favorites.length,
    };
  }

  static Map<String, dynamic> _handleReviews(
    String method,
    Map<String, dynamic>? body,
    List<String> segments,
  ) {
    if (method == 'POST' && body != null) {
      final newReview = {
        'id': 'demo-client-review-${DateTime.now().millisecondsSinceEpoch}',
        ...body,
        'createdAt': DateTime.now().toIso8601String(),
      };
      _reviews.insert(0, newReview);
      return {
        'review': newReview,
        'message': 'Avis publié.',
      };
    }

    if (method == 'PUT' && segments.length > 2) {
      final reviewId = segments[2];
      final index = _reviews.indexWhere((r) => r['id'] == reviewId);
      if (index >= 0 && body != null) {
        _reviews[index] = {..._reviews[index], ...body};
        return {
          'review': _reviews[index],
          'message': 'Avis mis à jour.',
        };
      }
    }

    if (method == 'DELETE' && segments.length > 2) {
      final reviewId = segments[2];
      _reviews.removeWhere((r) => r['id'] == reviewId);
      return {'message': 'Avis supprimé.'};
    }

    return {'reviews': _reviews};
  }
}
