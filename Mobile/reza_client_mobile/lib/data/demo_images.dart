/// Demo image URLs (matching Web mock data).
class DemoImages {
  static String portrait(String gender, int index) =>
      'https://randomuser.me/api/portraits/$gender/$index.jpg';

  static final Map<String, List<String>> clientPhotos = {
    'FEMALE': [2, 9, 12, 17, 21, 31, 40, 47]
        .map((n) => portrait('women', n))
        .toList(),
    'MALE': [3, 7, 11, 14, 22, 29, 36, 45]
        .map((n) => portrait('men', n))
        .toList(),
  };

  static final Map<String, String> employeePhotos = {
    'salma': portrait('women', 57),
    'youssef': portrait('men', 50),
    'lina': portrait('women', 63),
    'meryem': portrait('women', 90),
  };

  static final List<String> salonPhotos = [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
    'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=800&q=80',
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&q=80',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
  ];

  static String clientPhoto(String gender, int ordinal) {
    final pool = clientPhotos[gender == 'MALE' ? 'MALE' : 'FEMALE'] ?? clientPhotos['FEMALE']!;
    return pool[ordinal % pool.length];
  }
}
