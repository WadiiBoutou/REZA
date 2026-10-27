import 'demo_images.dart';

/// Complete demo data matching Web reza-client mock API.
class DemoApiData {
  // Salon data
  static final List<List<String>> salonNames = [
    ['Atelier Noor', 'Casablanca', 'Institut de beauté'],
    ['Maison Safran', 'Rabat', 'Coiffeur'],
    ['Studio Sable', 'Marrakech', 'Barbier'],
    ['Ligne Claire', 'Tanger', 'Manucure'],
    ['Dar Glow', 'Fès', 'Institut de beauté'],
    ['Le Petit Fauteuil', 'Agadir', 'Barbier'],
    ['Miroir Moderne', 'Meknès', 'Coiffeur'],
    ['Nacre Studio', 'Casablanca', 'Manucure'],
  ];

  // Service catalog
  static final List<Map<String, dynamic>> serviceCatalog = [
    {'name': 'Coupe & brushing', 'category': 'Coiffure', 'duration': 60, 'price': 280},
    {'name': 'Coloration signature', 'category': 'Coiffure', 'duration': 120, 'price': 650},
    {'name': 'Soin visage éclat', 'category': 'Soin visage', 'duration': 75, 'price': 420},
    {'name': 'Manucure soin', 'category': 'Onglerie', 'duration': 45, 'price': 180},
    {'name': 'Massage relaxant', 'category': 'Bien-être', 'duration': 60, 'price': 500},
    {'name': 'Balayage lumière', 'category': 'Coiffure', 'duration': 150, 'price': 900},
    {'name': 'Taille de barbe', 'category': 'Barbier', 'duration': 30, 'price': 140},
  ];

  // Staff names
  static final List<List<String>> staffNames = [
    ['Salma', 'Bennani'],
    ['Youssef', 'Amrani'],
    ['Lina', 'Idrissi'],
    ['Meryem', 'Alaoui'],
  ];

  static final List<int> salonPhotoIndex = [0, 4, 1, 3, 2, 1, 5, 3];

  static final List<String> shortDescriptions = [
    'Un studio de beauté contemporain, pensé pour prendre le temps.',
    'Des gestes précis, une atmosphère calme et des équipes passionnées.',
    'Votre adresse de quartier pour une parenthèse qui fait du bien.',
  ];

  // Generate salons
  static List<Map<String, dynamic>> getSalons() {
    return List.generate(salonNames.length, (index) {
      final salonData = salonNames[index];
      return {
        'id': 'demo-salon-${index + 1}',
        'name': salonData[0],
        'city': salonData[1],
        'category': salonData[2],
        'address': '${12 + index} Rue des Orangers, ${salonData[1]}',
        'shortDescription': shortDescriptions[index % 3],
        'coverImage': DemoImages.salonPhotos[salonPhotoIndex[index]],
        'settings': {
          'coverImages': [
            DemoImages.salonPhotos[(index + 2) % DemoImages.salonPhotos.length],
            DemoImages.salonPhotos[(index + 4) % DemoImages.salonPhotos.length],
          ],
        },
        'averageRating': [4.9, 4.8, 4.7, 4.9, 4.6, 4.8, 4.7, 4.9][index],
        'rating': [4.9, 4.8, 4.7, 4.9, 4.6, 4.8, 4.7, 4.9][index],
        'reviewCount': 38 + index * 17,
        'totalReviews': 38 + index * 17,
        'subscriptionActive': true,
        // Names only. Do not call getServicesForSalon here: that lookup used to
        // call getSalons again and recursed until the stack overflowed.
        'services': serviceCatalog
            .skip(index % 3)
            .take(4)
            .map((service) => service['name'])
            .toList(),
      };
    });
  }

  /// Services for [salonId]. The salon index is parsed from the id so this
  /// never calls [getSalons] (salon generation and appointment generation both
  /// need this list, and a lookup through [getSalons] is infinite recursion).
  static List<Map<String, dynamic>> getServicesForSalon(String salonId) {
    final match = RegExp(r'demo-salon-(\d+)$').firstMatch(salonId);
    var index = 0;
    if (match != null) {
      final parsed = int.tryParse(match.group(1) ?? '') ?? 1;
      if (parsed >= 1 && parsed <= salonNames.length) {
        index = parsed - 1;
      }
    }

    final services = serviceCatalog.skip(index % 3).take(4).toList();
    return List.generate(services.length, (serviceIndex) {
      return {
        ...services[serviceIndex],
        'id': 'demo-service-${index + 1}-${serviceIndex + 1}',
        'tenantId': 'demo-salon-${index + 1}',
      };
    });
  }

  // Generate staff
  static List<Map<String, dynamic>> getStaff() {
    return List.generate(staffNames.length, (index) {
      final staff = staffNames[index];
      return {
        'id': 'demo-employee-${index + 1}',
        'firstName': staff[0],
        'lastName': staff[1],
        'name': '${staff[0]} ${staff[1]}',
        'avatar': DemoImages.employeePhotos[staff[0].toLowerCase()],
        'role': ['Coiffeuse', 'Barbier', 'Esthéticienne', 'Prothésiste ongulaire'][index],
      };
    });
  }

  // Demo client
  static Map<String, dynamic> getClient() {
    return {
      'id': 'demo-client',
      'email': 'demo.client@reza.ma',
      'firstName': 'Nour',
      'lastName': 'Benali',
      'name': 'Nour Benali',
      'phone': '+212 6 12 34 56 78',
      'gender': 'FEMALE',
      'avatar': DemoImages.clientPhoto('FEMALE', 0),
    };
  }

  // Generate appointments
  static List<Map<String, dynamic>> getAppointments() {
    final salons = getSalons();
    final staff = getStaff();
    final client = getClient();

    return List.generate(34, (index) {
      final salon = salons[index % salons.length];
      final salonServices = getServicesForSalon(salon['id']);
      final service = salonServices[index % salonServices.length];
      final employee = staff[index % staff.length];
      
      final date = _appointmentDay(index, 34);
      final dateString = _formatDate(date);
      final status = index % 7 == 0 
          ? 'completed' 
          : index % 8 == 0 
              ? 'cancelled' 
              : 'confirmed';

      return {
        'id': 'demo-client-appointment-${index + 1}',
        'tenantId': salon['id'],
        'tenant': salon,
        'date': dateString,
        'image': salon['coverImage'],
        'salon': salon['name'],
        'service': service['name'],
        'tenantData': salon,
        'services': [
          {'service': service}
        ],
        'employee': employee,
        'employeeId': employee['id'],
        'serviceId': service['id'],
        'client': client,
        'startTime': '${dateString}T${_padZero(10 + index % 8)}:00:00.000Z',
        'endTime': '${dateString}T${_padZero(11 + index % 8)}:00:00.000Z',
        'status': status,
        'time': '${_padZero(10 + index % 8)}:00',
        'totalPrice': service['price'],
        'price': service['price'],
      };
    });
  }

  // Generate reviews
  static List<Map<String, dynamic>> getReviews() {
    final salons = getSalons();
    
    return List.generate(28, (index) {
      final salon = salons[index % salons.length];
      final date = DateTime.now().subtract(Duration(days: index + 1));
      
      return {
        'id': 'demo-client-review-${index + 1}',
        'tenantId': salon['id'],
        'tenant': salon,
        'rating': index % 6 == 0 ? 4 : 5,
        'salonImage': salon['coverImage'],
        'comment': [
          'Une belle découverte, équipe très attentionnée.',
          'Tout était parfait, du début à la fin.',
          'Résultat impeccable, je recommande sans hésiter.',
        ][index % 3],
        'createdAt': date.toIso8601String(),
      };
    });
  }

  // Favorites
  static List<Map<String, dynamic>> getFavorites() {
    final salons = getSalons();
    return [
      {'id': 'demo-favorite-1', 'tenant': salons[0], 'tenantId': salons[0]['id']},
      {'id': 'demo-favorite-2', 'tenant': salons[2], 'tenantId': salons[2]['id']},
      {'id': 'demo-favorite-3', 'tenant': salons[5], 'tenantId': salons[5]['id']},
    ];
  }

  // Family members
  static List<Map<String, dynamic>> familyMembers = [];

  // Helper methods
  static DateTime _appointmentDay(int index, int count) {
    final now = DateTime.now();
    final endOfNextMonth = DateTime(now.year, now.month + 2, 0);
    final availableDays = endOfNextMonth.difference(DateTime(now.year, now.month, now.day)).inDays + 1;
    return DateTime(now.year, now.month, now.day + (index * availableDays ~/ count));
  }

  static String _formatDate(DateTime date) {
    return '${date.year}-${_padZero(date.month)}-${_padZero(date.day)}';
  }

  static String _padZero(int value) {
    return value.toString().padLeft(2, '0');
  }
}
