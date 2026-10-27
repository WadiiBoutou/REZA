import '../data/demo_api_data.dart';
import '../config/demo_config.dart';

/// Demo API client that simulates backend responses with mock data for Pro app.
class DemoApiClient {
  // In-memory data stores (mutable for demo interactions)
  static List<Map<String, dynamic>> _services = List.from(DemoApiData.services);
  static List<Map<String, dynamic>> _employees = List.from(DemoApiData.employees);
  static List<Map<String, dynamic>> _appointments = DemoApiData.generateAppointments();
  static List<Map<String, dynamic>> _clients = DemoApiData.generateClients();
  static List<Map<String, dynamic>> _reviews = DemoApiData.generateReviews(_appointments);
  static List<Map<String, dynamic>> _invoices = DemoApiData.generateInvoices(_appointments);
  static List<String> _serviceCategories = List.from(DemoApiData.serviceCategories);

  /// Main request handler
  static Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 300));

    print('[DEMO API PRO] $method $path');

    // Route requests to appropriate handlers
    if (path.contains('/auth/login')) {
      return _handleLogin(body);
    } else if (path.contains('/auth/me')) {
      return _handleMe();
    } else if (path.contains('/auth/logout')) {
      return {'success': true};
    } else if (path.contains('/salons') && method == 'GET') {
      return _handleGetSalons();
    } else if (path.contains('/appointments')) {
      return _handleAppointments(method, path, body, query);
    } else if (path.contains('/services')) {
      return _handleServices(method, path, body, query);
    } else if (path.contains('/employees')) {
      return _handleEmployees(method, path, body, query);
    } else if (path.contains('/clients')) {
      return _handleClients(method, path, body, query);
    } else if (path.contains('/reviews')) {
      return _handleReviews(method, path, body, query);
    } else if (path.contains('/invoices')) {
      return _handleInvoices(method, path, body, query);
    } else if (path.contains('/stats')) {
      return _handleStats(path, query);
    } else if (path.contains('/tenant')) {
      return _handleTenant(method, path, body);
    } else if (path.contains('/subscription')) {
      return _handleSubscription();
    } else if (path.contains('/notifications')) {
      return _handleNotifications(method, path);
    }

    return {'message': 'Demo endpoint not implemented: $path'};
  }

  // Auth handlers
  static Map<String, dynamic> _handleLogin(Map<String, dynamic>? body) {
    return {
      'token': 'reza-demo-session',
      'user': DemoApiData.demoUser,
      'salons': [DemoApiData.salon],
      'activeTenantId': DemoApiData.salon['id'],
      'salonLimit': 3,
      'subscription': {
        'status': 'ACTIVE',
        'currentPeriodEnd': DemoConfig.subscriptionEnd.toIso8601String(),
        'salonsPaid': 1,
      },
    };
  }

  static Map<String, dynamic> _handleMe() {
    return {
      'user': DemoApiData.demoUser,
      'salons': [DemoApiData.salon],
      'activeTenantId': DemoApiData.salon['id'],
      'salonLimit': 3,
      'subscription': {
        'status': 'ACTIVE',
        'currentPeriodEnd': DemoConfig.subscriptionEnd.toIso8601String(),
        'salonsPaid': 1,
      },
    };
  }

  static Map<String, dynamic> _handleGetSalons() {
    return {
      'salons': [DemoApiData.salon],
      'salonLimit': 3,
      'subscription': {'status': 'ACTIVE'},
      'account': {'id': 'demo-account', 'isActive': true},
    };
  }

  // Appointment handlers
  static Map<String, dynamic> _handleAppointments(
    String method,
    String path,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  ) {
    if (method == 'GET') {
      var filtered = List<Map<String, dynamic>>.from(_appointments);

      if (query != null) {
        final startDate = query['startDate'];
        final endDate = query['endDate'];
        final status = query['status'];

        if (startDate != null) {
          filtered = filtered.where((a) {
            final date = (a['date'] as String).substring(0, 10);
            return date.compareTo(startDate.substring(0, 10)) >= 0;
          }).toList();
        }

        if (endDate != null) {
          filtered = filtered.where((a) {
            final date = (a['date'] as String).substring(0, 10);
            return date.compareTo(endDate.substring(0, 10)) <= 0;
          }).toList();
        }

        if (status != null) {
          filtered = filtered.where((a) => a['status'] == status).toList();
        }
      }

      return {
        'appointments': filtered,
        'total': filtered.length,
        'page': int.tryParse(query?['page'] ?? '1') ?? 1,
        'limit': int.tryParse(query?['limit'] ?? '${filtered.length}') ?? filtered.length,
      };
    }

    if (method == 'POST') {
      final now = DateTime.now();
      final dateStr = body?['date']?.toString() ?? 
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      
      final selectedService = _services.firstWhere(
        (s) => s['id'] == body?['serviceId'] || 
               (body?['serviceIds'] as List?)?.contains(s['id']) == true,
        orElse: () => _services[0],
      );

      final selectedEmployee = _employees.firstWhere(
        (e) => e['id'] == body?['employeeId'],
        orElse: () => _employees[0],
      );

      final newAppointment = {
        ...?body,
        'id': 'demo-appointment-${DateTime.now().millisecondsSinceEpoch}',
        'tenantId': DemoApiData.salon['id'],
        'date': dateStr,
        'status': body?['status'] ?? 'CONFIRMED',
        'service': selectedService,
        'services': [
          {
            'id': selectedService['id'],
            'serviceId': selectedService['id'],
            'name': selectedService['name'],
            'duration': selectedService['duration'],
            'price': selectedService['price'],
            'employee': selectedEmployee,
          }
        ],
        'employee': selectedEmployee,
        'client': body?['client'] ?? {
          'firstName': body?['firstName'] ?? 'Nouveau',
          'lastName': body?['lastName'] ?? 'Client',
        },
        'totalPrice': body?['price'] ?? selectedService['price'],
      };

      _appointments.insert(0, newAppointment);

      return {
        'appointment': newAppointment,
        'success': true,
      };
    }

    if (path.contains('/validate-move')) {
      return {'conflicts': []};
    }

    final segments = path.split('/');
    if (segments.length > 2) {
      final id = segments[2];
      final index = _appointments.indexWhere((a) => a['id'] == id);

      if (method == 'DELETE' && index >= 0) {
        _appointments.removeAt(index);
        return {'success': true};
      }

      if (method == 'PUT' && index >= 0 && body != null) {
        _appointments[index] = {..._appointments[index], ...body};
        return {
          'appointment': _appointments[index],
          'success': true,
        };
      }
    }

    return {};
  }

  // Service handlers
  static Map<String, dynamic> _handleServices(
    String method,
    String path,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  ) {
    if (path.contains('/categories') && method == 'PUT') {
      if (body != null && body['categories'] is List) {
        _serviceCategories = List<String>.from(body['categories']);
      }
      return {
        'categories': _serviceCategories,
        'success': true,
      };
    }

    if (method == 'GET') {
      var filtered = List<Map<String, dynamic>>.from(_services);

      if (query != null) {
        final search = query['search']?.toLowerCase();
        final category = query['category'];

        if (search != null && search.isNotEmpty) {
          filtered = filtered.where((s) {
            final text = '${s['name']} ${s['category']}'.toLowerCase();
            return text.contains(search);
          }).toList();
        }

        if (category != null && category.isNotEmpty) {
          filtered = filtered.where((s) => s['category'] == category).toList();
        }
      }

      return {
        'services': filtered,
        'total': filtered.length,
        'categories': _serviceCategories,
      };
    }

    if (method == 'POST' && body != null) {
      final newService = {
        'id': 'service-${DateTime.now().millisecondsSinceEpoch}',
        ...body,
        'isActive': true,
      };
      _services.insert(0, newService);
      return {
        'service': newService,
        'services': _services,
        'total': _services.length,
      };
    }

    return {};
  }

  // Employee handlers
  static Map<String, dynamic> _handleEmployees(
    String method,
    String path,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  ) {
    final segments = path.split('/');

    if (method == 'GET' && segments.length == 2) {
      return {
        'employees': _employees,
        'total': _employees.length,
      };
    }

    if (method == 'POST' && body != null) {
      final newEmployee = {
        'id': 'employee-${DateTime.now().millisecondsSinceEpoch}',
        ...body,
        'isActive': true,
      };
      _employees.insert(0, newEmployee);
      return {
        'employee': newEmployee,
        'employees': _employees,
        'total': _employees.length,
      };
    }

    if (segments.length > 2) {
      final employeeId = segments[2];
      final index = _employees.indexWhere((e) => e['id'] == employeeId);

      if (method == 'GET' && index >= 0) {
        return {'employee': _employees[index]};
      }

      if (method == 'PUT' && index >= 0 && body != null) {
        _employees[index] = {..._employees[index], ...body};
        return {
          'employee': _employees[index],
          'success': true,
        };
      }

      if (method == 'DELETE' && index >= 0) {
        _employees.removeAt(index);
        return {'success': true};
      }
    }

    return {};
  }

  // Client handlers
  static Map<String, dynamic> _handleClients(
    String method,
    String path,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  ) {
    final segments = path.split('/');

    if (method == 'GET' && segments.length == 2) {
      var filtered = List<Map<String, dynamic>>.from(_clients);

      if (query != null) {
        final search = query['search']?.toLowerCase();
        final status = query['status'];

        if (search != null && search.isNotEmpty) {
          filtered = filtered.where((c) {
            final text = '${c['firstName']} ${c['lastName']} ${c['email'] ?? ''} ${c['phone']}'.toLowerCase();
            return text.contains(search);
          }).toList();
        }

        if (status != null) {
          filtered = filtered.where((c) => c['status'] == status).toList();
        }
      }

      final withCounts = filtered.map((client) {
        final appointmentCount = _appointments.where((a) => a['clientId'] == client['id']).length;
        return {
          ...client,
          '_count': {'appointments': appointmentCount},
        };
      }).toList();

      final page = int.tryParse(query?['page'] ?? '1') ?? 1;
      final limit = int.tryParse(query?['limit'] ?? '${withCounts.length}') ?? withCounts.length;

      return {
        'clients': withCounts.skip((page - 1) * limit).take(limit).toList(),
        'total': withCounts.length,
        'page': page,
        'limit': limit,
      };
    }

    if (method == 'POST' && body != null) {
      final newClient = {
        ...body,
        'id': 'demo-client-${DateTime.now().millisecondsSinceEpoch}',
        'email': body['email'],
        'status': body['status'] ?? 'ACTIVE',
        'avatar': body['avatar'],
        'createdAt': DateTime.now().toIso8601String(),
        'updatedAt': DateTime.now().toIso8601String(),
        'addedAs': body['addedAs'],
        'addedByClient': null,
        '_count': {'appointments': 0},
      };
      _clients.insert(0, newClient);
      return {'client': newClient};
    }

    if (segments.length > 2) {
      final clientId = segments[2];
      final index = _clients.indexWhere((c) => c['id'] == clientId);

      if (method == 'PUT' && index >= 0 && body != null) {
        _clients[index] = {
          ..._clients[index],
          ...body,
          'updatedAt': DateTime.now().toIso8601String(),
        };
        return {'client': _clients[index]};
      }

      if (method == 'DELETE' && index >= 0) {
        _clients.removeAt(index);
        return {'success': true};
      }
    }

    return {};
  }

  // Review handlers
  static Map<String, dynamic> _handleReviews(
    String method,
    String path,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  ) {
    final segments = path.split('/');

    if (method == 'GET' && segments.length == 2) {
      var filtered = List<Map<String, dynamic>>.from(_reviews);

      final statusFilter = query?['status']?.toUpperCase();
      if (statusFilter != null) {
        filtered = filtered.where((r) => r['status'] == statusFilter).toList();
      }

      return {
        'reviews': filtered,
        'total': filtered.length,
        'page': int.tryParse(query?['page'] ?? '1') ?? 1,
        'limit': int.tryParse(query?['limit'] ?? '${filtered.length}') ?? filtered.length,
      };
    }

    if (segments.length > 2 && path.contains('/status') && method == 'PUT') {
      final reviewId = segments[2];
      final index = _reviews.indexWhere((r) => r['id'] == reviewId);

      if (index >= 0 && body != null) {
        _reviews[index]['status'] = body['status'];
        _reviews[index]['rejectReason'] = 
            body['status'] == 'REJECTED' ? (body['rejectReason'] ?? null) : null;
        _reviews[index]['moderatedAt'] = 
            body['status'] == 'PENDING' ? null : DateTime.now().toIso8601String();
        
        return {'review': _reviews[index]};
      }
    }

    if (segments.length > 2 && method == 'DELETE') {
      final reviewId = segments[2];
      _reviews.removeWhere((r) => r['id'] == reviewId);
      return {'success': true};
    }

    return {};
  }

  // Invoice handlers
  static Map<String, dynamic> _handleInvoices(
    String method,
    String path,
    Map<String, dynamic>? body,
    Map<String, String>? query,
  ) {
    if (method == 'GET') {
      return {
        'invoices': _invoices,
        'total': _invoices.length,
      };
    }

    return {};
  }

  // Stats handlers
  static Map<String, dynamic> _handleStats(String path, Map<String, String>? query) {
    // Return simplified stats for demo
    return {
      'totalRevenue': 125000,
      'totalAppointments': _appointments.length,
      'completedAppointments': _appointments.where((a) => a['status'] == 'COMPLETED').length,
      'pendingAppointments': _appointments.where((a) => a['status'] == 'PENDING').length,
      'averageRating': 4.8,
      'totalClients': _clients.length,
    };
  }

  // Tenant handlers
  static Map<String, dynamic> _handleTenant(
    String method,
    String path,
    Map<String, dynamic>? body,
  ) {
    if (method == 'GET') {
      return {'tenant': DemoApiData.salon};
    }

    if (method == 'PUT' && body != null) {
      DemoApiData.salon = {...DemoApiData.salon, ...body};
      return {
        'tenant': DemoApiData.salon,
        'message': 'Salon mis à jour.',
      };
    }

    return {};
  }

  // Subscription handler
  static Map<String, dynamic> _handleSubscription() {
    return {
      'subscription': {
        'status': 'ACTIVE',
        'currentPeriodEnd': DemoConfig.subscriptionEnd.toIso8601String(),
        'salonsPaid': 1,
        'plan': 'STARTER',
      },
    };
  }

  // Notifications handler
  static Map<String, dynamic> _handleNotifications(String method, String path) {
    return {
      'notifications': [],
      'unreadCount': 0,
    };
  }
}
