import 'dart:math' show pow;

import 'demo_images.dart';
import '../config/demo_config.dart';

/// Complete demo data matching Web reza-pro mock API.
class DemoApiData {
  // Salon configuration
  static Map<String, dynamic> salon = {
    'id': 'demo-salon',
    'name': 'Atelier Noor',
    'email': DemoConfig.demoEmail,
    'phone': '+212 5 22 00 00 00',
    'address': '12 Rue des Orangers',
    'city': 'Casablanca',
    'category': 'Institut de beauté',
    'shortDescription': 'Un studio de beauté contemporain au coeur de Casablanca.',
    'coverImage': DemoImages.salonPhotos[0],
    'subscriptionActive': true,
  };

  // Services catalog
  static List<Map<String, dynamic>> services = [
    {
      'id': 'service-cut',
      'name': 'Coupe & brushing',
      'duration': 60,
      'price': 280,
      'priceType': 'FIXED',
      'priceFrom': null,
      'priceTo': null,
      'onQuote': false,
      'category': 'Coiffure',
      'visibility': 'BOOKABLE',
      'competences': [],
      'multipleProviders': false,
      'color': '#d77c65',
      'isActive': true,
    },
    {
      'id': 'service-color',
      'name': 'Coloration signature',
      'duration': 120,
      'price': 650,
      'priceType': 'FIXED',
      'priceFrom': null,
      'priceTo': null,
      'onQuote': false,
      'category': 'Coiffure',
      'visibility': 'BOOKABLE',
      'competences': [],
      'multipleProviders': false,
      'color': '#537f78',
      'isActive': true,
    },
    {
      'id': 'service-facial',
      'name': 'Soin visage éclat',
      'duration': 75,
      'price': 420,
      'priceType': 'FIXED',
      'priceFrom': null,
      'priceTo': null,
      'onQuote': false,
      'category': 'Soin visage',
      'visibility': 'BOOKABLE',
      'competences': [],
      'multipleProviders': false,
      'color': '#bd9a52',
      'isActive': true,
    },
    {
      'id': 'service-mani',
      'name': 'Manucure soin',
      'duration': 45,
      'price': 180,
      'priceType': 'FIXED',
      'priceFrom': null,
      'priceTo': null,
      'onQuote': false,
      'category': 'Onglerie',
      'visibility': 'BOOKABLE',
      'competences': [],
      'multipleProviders': false,
      'color': '#7c7892',
      'isActive': true,
    },
    {
      'id': 'service-massage',
      'name': 'Massage relaxant',
      'duration': 60,
      'price': 500,
      'priceType': 'FIXED',
      'priceFrom': null,
      'priceTo': null,
      'onQuote': false,
      'category': 'Bien-être',
      'visibility': 'BOOKABLE',
      'competences': [],
      'multipleProviders': false,
      'color': '#d77c65',
      'isActive': true,
    },
    {
      'id': 'service-balayage',
      'name': 'Balayage lumière',
      'duration': 150,
      'price': 900,
      'priceType': 'FIXED',
      'priceFrom': null,
      'priceTo': null,
      'onQuote': false,
      'category': 'Coiffure',
      'visibility': 'BOOKABLE',
      'competences': [],
      'multipleProviders': false,
      'color': '#537f78',
      'isActive': true,
    },
  ];

  static List<String> serviceCategories = [
    'Coiffure',
    'Soin visage',
    'Onglerie',
    'Bien-être',
  ];

  // Employees
  static List<Map<String, dynamic>> employees = [
    {
      'id': 'employee-salma',
      'firstName': 'Salma',
      'lastName': 'Bennani',
      'name': 'Salma Bennani',
      'role': 'Coiffeuse',
      'isActive': true,
      'color': '#d77c65',
      'avatar': DemoImages.employeePhotos['salma'],
      'tenantId': 'demo-salon',
      'agendaSettings': {'color': '#d77c65'},
    },
    {
      'id': 'employee-youssef',
      'firstName': 'Youssef',
      'lastName': 'Amrani',
      'name': 'Youssef Amrani',
      'role': 'Barbier',
      'isActive': true,
      'color': '#537f78',
      'avatar': DemoImages.employeePhotos['youssef'],
      'tenantId': 'demo-salon',
      'agendaSettings': {'color': '#537f78'},
    },
    {
      'id': 'employee-lina',
      'firstName': 'Lina',
      'lastName': 'Idrissi',
      'name': 'Lina Idrissi',
      'role': 'Esthéticienne',
      'isActive': true,
      'color': '#bd9a52',
      'avatar': DemoImages.employeePhotos['lina'],
      'tenantId': 'demo-salon',
      'agendaSettings': {'color': '#bd9a52'},
    },
    {
      'id': 'employee-meryem',
      'firstName': 'Meryem',
      'lastName': 'Alaoui',
      'name': 'Meryem Alaoui',
      'role': 'Prothésiste ongulaire',
      'isActive': true,
      'color': '#7c7892',
      'avatar': DemoImages.employeePhotos['meryem'],
      'tenantId': 'demo-salon',
      'agendaSettings': {'color': '#7c7892'},
    },
  ];

  // Client names and data
  static final List<List<String>> clientNames = [
    ['Amine', 'Khaldi'],
    ['Nadia', 'Tazi'],
    ['Mehdi', 'Berrada'],
    ['Sofia', 'El Fassi'],
    ['Imane', 'Chraibi'],
    ['Omar', 'Lahlou'],
    ['Aya', 'Benjelloun'],
    ['Rayan', 'Fikri'],
    ['Adam', 'Mansouri'],
    ['Leila', 'Naciri'],
    ['Yasmine', 'Bennis'],
    ['Anas', 'Tahiri'],
    ['Salma', 'Zerouali'],
    ['Mehdi', 'Ait Lahcen'],
    ['Maya', 'Sefrioui'],
    ['Ilyas', 'Kettani'],
  ];

  static final List<String> clientGenders = [
    'MALE', 'FEMALE', 'MALE', 'FEMALE', 'FEMALE', 'MALE', 'FEMALE', 'MALE',
    'MALE', 'FEMALE', 'FEMALE', 'MALE', 'FEMALE', 'MALE', 'FEMALE', 'MALE',
  ];

  // Demo user (admin)
  static Map<String, dynamic> demoUser = {
    'id': 'demo-admin',
    'email': DemoConfig.demoEmail,
    'firstName': 'Amal',
    'lastName': 'El Mansouri',
    'avatar': DemoImages.adminPhoto,
    'role': 'TENANT_ADMIN',
    'tenantId': 'demo-salon',
    'emailVerified': true,
    'tenant': {
      'id': 'demo-salon',
      'name': 'Atelier Noor',
    },
  };

  // Generate appointments (base date: July 1, 2026)
  static List<Map<String, dynamic>> generateAppointments() {
    final baseDate = DateTime(2026, 7, 1);
    final endDate = DateTime(2026, 10, 31);
    
    return List.generate(150, (index) {
      final rosterSize = index < 23 ? 6 : index < 59 ? 10 : index < 102 ? 13 : 16;
      final clientIndex = index % rosterSize;
      final clientName = clientNames[clientIndex % clientNames.length];
      final clientGender = clientGenders[clientIndex % clientGenders.length];

      final serviceCount = (index * 4 % 10) < 4 ? 2 : 1;
      final selectedServices = List.generate(
        serviceCount,
        (i) => services[(index * 5 + i * 7) % services.length],
      );

      final appointmentServices = selectedServices.asMap().entries.map((entry) {
        final serviceIndex = entry.key;
        final service = entry.value;
        final employee = employees[(index + serviceIndex * 3) % employees.length];
        
        return {
          'id': '${service['id']}-$index-$serviceIndex',
          'serviceId': service['id'],
          'name': service['name'],
          'duration': service['duration'],
          'price': service['price'],
          'sortOrder': serviceIndex,
          'employee': employee,
        };
      }).toList();

      final totalDuration = appointmentServices.fold<int>(
        0, (sum, item) => sum + (item['duration'] as int)
      );
      final totalPrice = appointmentServices.fold<int>(
        0, (sum, item) => sum + (item['price'] as int)
      );

      final date = _appointmentDay(index, baseDate, endDate);
      final hourRanges = [9, 10, 11, 14, 15, 16];
      final hour = hourRanges[index % hourRanges.length];
      final startDate = DateTime.utc(
        date.year, date.month, date.day, hour, index % 2 == 1 ? 30 : 0
      );

      final isPast = date.isBefore(DateTime(2026, 9, 30));
      final leadDays = [0, 1, 3, 5, 2, 7, 4, 10, 3, 6][index % 10];
      final bookedAt = startDate.subtract(Duration(days: leadDays));

      final isGroup = index % 15 == 0;
      final status = isPast
          ? (index % 23 == 0 ? 'CANCELLED' : index % 18 == 0 ? 'NO_SHOW' : 'COMPLETED')
          : isGroup ? 'CONFIRMED' : index % 20 == 0 ? 'CANCELLED' : index % 7 == 0 ? 'PENDING' : 'CONFIRMED';
      
      final sourceWeights = ['SALON', 'SALON', 'SALON', 'ONLINE', 'SALON'];
      final source = isGroup ? 'SALON' : sourceWeights[index % sourceWeights.length];

      final clientPhotoCursor = {'MALE': 0, 'FEMALE': 0};
      final clientPhoto = DemoImages.clientPhoto(clientGender, clientPhotoCursor[clientGender]!);

      return {
        'id': 'demo-appointment-${index + 1}',
        'tenantId': salon['id'],
        'date': _formatDate(date),
        'startTime': startDate.toIso8601String(),
        'endTime': startDate.add(Duration(minutes: totalDuration)).toIso8601String(),
        'createdAt': bookedAt.toIso8601String(),
        'status': status,
        'source': source,
        'clientId': 'demo-client-${clientIndex + 1}',
        'client': {
          'id': 'demo-client-${clientIndex + 1}',
          'firstName': clientName[0],
          'lastName': clientName[1],
          'avatar': clientPhoto,
          'email': '${clientName[0].toLowerCase()}.${clientName[1].toLowerCase().replaceAll(' ', '')}@example.com',
          'phone': '+212 6${(10000000 + index * 7919).toString().substring(0, 8)}',
        },
        'employeeId': employees[index % employees.length]['id'],
        'employee': employees[index % employees.length],
        'serviceId': selectedServices[0]['id'],
        'service': selectedServices[0],
        'services': appointmentServices,
        'duration': totalDuration,
        'totalDuration': totalDuration,
        'price': totalPrice,
        'totalPrice': totalPrice,
        'notes': isPast ? 'Rendez-vous terminé.' : index % 8 == 0 ? 'Préférence : accueil côté cour.' : '',
        'bookingGroupId': isGroup ? 'booking-group-${(index / 15).floor() + 1}' : null,
        'bookingGroupParticipantCount': isGroup ? 3 + (index % 4) : null,
      };
    });
  }

  // Generate clients
  static List<Map<String, dynamic>> generateClients() {
    return List.generate(clientNames.length, (index) {
      final clientName = clientNames[index];
      final gender = clientGenders[index];
      final clientPhotoCursor = {'MALE': 0, 'FEMALE': 0};
      
      return {
        'id': 'demo-client-${index + 1}',
        'firstName': clientName[0],
        'lastName': clientName[1],
        'email': index % 4 == 3
            ? null
            : '${clientName[0].toLowerCase()}.${clientName[1].toLowerCase().replaceAll(' ', '')}@example.com',
        'phone': '+212 6${(10000000 + index * 7919).toString().substring(0, 8)}',
        'address': '${10 + index} Rue des Fleurs, Casablanca',
        'avatar': DemoImages.clientPhoto(gender, clientPhotoCursor[gender]!),
        'gender': gender,
        'age': 18 + ((index * 7) % 40),
        'status': index % 5 == 0 ? 'INACTIVE' : 'ACTIVE',
        'notes': null,
        'createdAt': DateTime.now().subtract(Duration(days: index * 2)).toIso8601String(),
        'updatedAt': DateTime.now().subtract(Duration(days: index)).toIso8601String(),
        'addedAs': index % 4 == 3 ? 'INVITE' : null,
        'addedByClient': index % 4 == 3
            ? {'id': 'demo-booker', 'firstName': 'Nour', 'lastName': 'Benali'}
            : null,
      };
    });
  }

  // Generate reviews
  static List<Map<String, dynamic>> generateReviews(List<Map<String, dynamic>> appointments) {
    final clients = generateClients();
    
    return List.generate(36, (index) {
      final clientName = clientNames[index % clientNames.length];
      final status = index % 5 == 0 ? 'PENDING' : index % 3 == 0 ? 'REJECTED' : 'APPROVED';
      final reviewAppointment = appointments[(index * 4) % appointments.length];
      
      return {
        'id': 'demo-review-${index + 1}',
        'rating': index % 13 == 0 ? 3 : index % 7 == 0 ? 4 : 5,
        'comment': [
          'Accueil chaleureux et résultat impeccable.',
          'Un vrai moment pour soi, je recommande.',
          'Très professionnel, je reviendrai bientôt.',
        ][index % 3],
        'status': status,
        'createdAt': reviewAppointment['startTime'],
        'moderatedAt': status == 'PENDING' ? null : reviewAppointment['startTime'],
        'rejectReason': status == 'REJECTED'
            ? 'Le commentaire ne respecte pas les règles de publication.'
            : null,
        'client': {
          'id': 'demo-client-${(index % clientNames.length) + 1}',
          'firstName': clientName[0],
          'lastName': clientName[1],
          'avatar': clients[index % clients.length]['avatar'],
          'email': clients[index % clients.length]['email'],
        },
        'service': services[index % services.length],
        'employee': employees[index % employees.length],
        'appointment': {
          'service': services[index % services.length],
          'employee': employees[index % employees.length],
        },
      };
    });
  }

  // Generate invoices
  static List<Map<String, dynamic>> generateInvoices(List<Map<String, dynamic>> appointments) {
    return appointments.where((appointment) {
      final dateStr = appointment['date'] as String;
      final parts = dateStr.split('-');
      final appDate = DateTime(int.parse(parts[0]), int.parse(parts[1]), int.parse(parts[2]));
      return appDate.isBefore(DateTime(2026, 9, 30));
    }).map((appointment) {
      final index = appointments.indexOf(appointment);
      final items = (appointment['services'] as List).asMap().entries.map((entry) {
        final itemIndex = entry.key;
        final service = entry.value as Map<String, dynamic>;
        return {
          'id': 'demo-invoice-item-${index + 1}-${itemIndex + 1}',
          'serviceId': service['serviceId'],
          'serviceName': service['name'],
          'price': service['price'],
          'quantity': 1,
          'employee': service['employee'],
        };
      }).toList();

      final total = appointment['totalPrice'];
      final status = index % 3 == 0 ? 'UNPAID' : 'PAID';

      return {
        'id': 'demo-invoice-${index + 1}',
        'invoiceNumber': 'FAC-2026-${(index + 1).toString().padLeft(4, '0')}',
        'number': 'FAC-2026-${(index + 1).toString().padLeft(4, '0')}',
        'amount': total,
        'tax': 0,
        'total': total,
        'status': status,
        'paymentMethod': ['CASH', 'CARD', 'BANK_TRANSFER'][index % 3],
        'paidAt': status == 'PAID' ? appointment['startTime'] : null,
        'notes': null,
        'createdAt': appointment['startTime'],
        'client': appointment['client'],
        'employee': appointment['employee'],
        'items': items,
        'appointment': {
          'id': appointment['id'],
          'startTime': appointment['startTime'],
          'service': {'name': (appointment['service'] as Map<String, dynamic>)['name']},
          'employee': appointment['employee'],
          'services': (appointment['services'] as List).map((service) {
            final s = service as Map<String, dynamic>;
            return {
              'id': s['id'],
              'serviceId': s['serviceId'],
              'serviceName': s['name'],
              'employeeId': (s['employee'] as Map<String, dynamic>)['id'],
              'employee': s['employee'],
            };
          }).toList(),
        },
      };
    }).toList();
  }

  // Helper methods
  static DateTime _appointmentDay(int index, DateTime startDate, DateTime endDate) {
    final totalDays = endDate.difference(startDate).inDays + 1;
    final progress = index / 149;
    final weightedDays = (totalDays * pow(progress, 0.75)).floor().clamp(0, totalDays - 1);
    return startDate.add(Duration(days: weightedDays));
  }

  static String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}
