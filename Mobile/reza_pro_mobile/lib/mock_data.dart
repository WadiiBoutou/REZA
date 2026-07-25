import 'dart:math';
import 'models/appointment.dart';
import 'services/session_store.dart';
import 'services/auth_service.dart';

// Toggle this to enable/disable mock data
const bool useMockData = false;

// Salon images provided by user
const String salon1ImageUrl =
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBlOR6I8cHCAUnuvgL4Is5rs1fy3NfpHTwVLOzz_Zz_KqfeA2vdjr3s5xD&s=10';
const String salon2ImageUrl =
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRJX5sypKch0fjfsBt8e3wX10cmxWW1XPnb-aJ5v_IIFqGwFDrVYXD-VnHk&s=10';

// Mock User
final StaffUser mockUser = StaffUser(
  id: 'mock-user-1',
  email: 'admin@reza.com',
  firstName: 'Admin',
  lastName: 'Reza',
  role: 'ADMIN',
  tenantId: 'mock-salon-1',
  tenantName: 'Reza Salon Casablanca',
);

// Mock Salons
final List<SalonSummary> mockSalons = [
  const SalonSummary(
    id: 'mock-salon-1',
    name: 'Reza Salon Casablanca',
    city: 'Casablanca',
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBlOR6I8cHCAUnuvgL4Is5rs1fy3NfpHTwVLOzz_Zz_KqfeA2vdjr3s5xD&s=10',
  ),
  const SalonSummary(
    id: 'mock-salon-2',
    name: 'Reza Salon Rabat',
    city: 'Rabat',
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRJX5sypKch0fjfsBt8e3wX10cmxWW1XPnb-aJ5v_IIFqGwFDrVYXD-VnHk&s=10',
  ),
];

// Mock Auth Session
final AuthSession mockAuthSession = AuthSession(
  token: 'mock-token-12345',
  user: mockUser,
  salons: mockSalons,
  activeTenantId: 'mock-salon-1',
);

// Helper functions
String generateId() => 'mock-${Random().nextInt(1000000)}';

DateTime _getDate(int dayOffset) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  return today.add(Duration(days: dayOffset));
}

// -------------------------------
// Mutable Mock Data Storage
// -------------------------------

List<Map<String, dynamic>> _mockAppointmentsSalon1 = [];
List<Map<String, dynamic>> _mockAppointmentsSalon2 = [];
List<Map<String, dynamic>> _mockInvoicesSalon1 = [];
List<Map<String, dynamic>> _mockInvoicesSalon2 = [];
List<Map<String, dynamic>> _mockCashTransactionsSalon1 = [];

// Initialize mock data
void initializeMockData() {
  // Initialize salon 1 appointments
  _mockAppointmentsSalon1 = [
    {
      'id': 'mock-apt-1',
      'clientId': 'mock-client-1',
      'client': mockClientsSalon1[0],
      'serviceId': 'mock-svc-1',
      'service': mockServicesSalon1[0],
      'employeeId': 'mock-emp-1',
      'employee': mockEmployeesSalon1[0],
      'startTime': _getDate(0).add(const Duration(hours: 10)).toIso8601String(),
      'endTime': _getDate(0).add(const Duration(hours: 10, minutes: 30)).toIso8601String(),
      'duration': 30,
      'status': 'CONFIRMED',
      'notes': 'Mock appointment',
      'tenantId': 'mock-salon-1',
      'services': [
        {
          'id': 'mock-svc-line-1',
          'serviceId': 'mock-svc-1',
          'serviceName': 'Coupe homme',
          'duration': 30,
          'price': 80.0,
          'sortOrder': 0,
        }
      ],
    },
    {
      'id': 'mock-apt-2',
      'clientId': 'mock-client-2',
      'client': mockClientsSalon1[1],
      'serviceId': 'mock-svc-3',
      'service': mockServicesSalon1[2],
      'employeeId': 'mock-emp-2',
      'employee': mockEmployeesSalon1[1],
      'startTime': _getDate(1).add(const Duration(hours: 14)).toIso8601String(),
      'endTime': _getDate(1).add(const Duration(hours: 14, minutes: 45)).toIso8601String(),
      'duration': 45,
      'status': 'PENDING',
      'notes': 'Mock appointment',
      'tenantId': 'mock-salon-1',
      'services': [
        {
          'id': 'mock-svc-line-2',
          'serviceId': 'mock-svc-3',
          'serviceName': 'Brushing',
          'duration': 45,
          'price': 100.0,
          'sortOrder': 0,
        }
      ],
    },
    {
      'id': 'mock-apt-3',
      'clientId': 'mock-client-3',
      'client': mockClientsSalon1[2],
      'serviceId': 'mock-svc-1',
      'service': mockServicesSalon1[0],
      'employeeId': 'mock-emp-1',
      'employee': mockEmployeesSalon1[0],
      'startTime': _getDate(-2).add(const Duration(hours: 11)).toIso8601String(),
      'endTime': _getDate(-2).add(const Duration(hours: 11, minutes: 30)).toIso8601String(),
      'duration': 30,
      'status': 'COMPLETED',
      'notes': 'Mock appointment',
      'tenantId': 'mock-salon-1',
      'services': [
        {
          'id': 'mock-svc-line-3',
          'serviceId': 'mock-svc-1',
          'serviceName': 'Coupe homme',
          'duration': 30,
          'price': 80.0,
          'sortOrder': 0,
        }
      ],
    },
    {
      'id': 'mock-apt-4',
      'clientId': 'mock-client-2',
      'client': mockClientsSalon1[1],
      'serviceId': 'mock-svc-4',
      'service': mockServicesSalon1[3],
      'employeeId': 'mock-emp-2',
      'employee': mockEmployeesSalon1[1],
      'startTime': _getDate(3).add(const Duration(hours: 16)).toIso8601String(),
      'endTime': _getDate(3).add(const Duration(hours: 17, minutes: 30)).toIso8601String(),
      'duration': 90,
      'status': 'CONFIRMED',
      'notes': 'Mock appointment',
      'tenantId': 'mock-salon-1',
      'services': [
        {
          'id': 'mock-svc-line-4',
          'serviceId': 'mock-svc-4',
          'serviceName': 'Coloration',
          'duration': 90,
          'price': 250.0,
          'sortOrder': 0,
        }
      ],
    },
    {
      'id': 'mock-apt-5',
      'clientId': 'mock-client-1',
      'client': mockClientsSalon1[0],
      'serviceId': 'mock-svc-1',
      'service': mockServicesSalon1[0],
      'employeeId': 'mock-emp-1',
      'employee': mockEmployeesSalon1[0],
      'startTime': _getDate(-5).add(const Duration(hours: 15)).toIso8601String(),
      'endTime': _getDate(-5).add(const Duration(hours: 15, minutes: 30)).toIso8601String(),
      'duration': 30,
      'status': 'NO_SHOW',
      'notes': 'Mock appointment',
      'tenantId': 'mock-salon-1',
      'services': [
        {
          'id': 'mock-svc-line-5',
          'serviceId': 'mock-svc-1',
          'serviceName': 'Coupe homme',
          'duration': 30,
          'price': 80.0,
          'sortOrder': 0,
        }
      ],
    },
  ];

  // Initialize salon 2 appointments
  _mockAppointmentsSalon2 = [
    {
      'id': 'mock-apt-6',
      'clientId': 'mock-client-4',
      'client': mockClientsSalon2[0],
      'serviceId': 'mock-svc-5',
      'service': mockServicesSalon2[0],
      'employeeId': 'mock-emp-3',
      'employee': mockEmployeesSalon2[0],
      'startTime': _getDate(2).add(const Duration(hours: 11)).toIso8601String(),
      'endTime': _getDate(2).add(const Duration(hours: 11, minutes: 45)).toIso8601String(),
      'duration': 45,
      'status': 'CONFIRMED',
      'notes': 'Mock appointment',
      'tenantId': 'mock-salon-2',
      'services': [
        {
          'id': 'mock-svc-line-6',
          'serviceId': 'mock-svc-5',
          'serviceName': 'Coupe + rasage',
          'duration': 45,
          'price': 120.0,
          'sortOrder': 0,
        }
      ],
    },
    {
      'id': 'mock-apt-7',
      'clientId': 'mock-client-5',
      'client': mockClientsSalon2[1],
      'serviceId': 'mock-svc-6',
      'service': mockServicesSalon2[1],
      'employeeId': 'mock-emp-3',
      'employee': mockEmployeesSalon2[0],
      'startTime': _getDate(4).add(const Duration(hours: 15)).toIso8601String(),
      'endTime': _getDate(4).add(const Duration(hours: 15, minutes: 30)).toIso8601String(),
      'duration': 30,
      'status': 'PENDING',
      'notes': 'Mock appointment',
      'tenantId': 'mock-salon-2',
      'services': [
        {
          'id': 'mock-svc-line-7',
          'serviceId': 'mock-svc-6',
          'serviceName': 'Soin barbe',
          'duration': 30,
          'price': 70.0,
          'sortOrder': 0,
        }
      ],
    },
    {
      'id': 'mock-apt-8',
      'clientId': 'mock-client-4',
      'client': mockClientsSalon2[0],
      'serviceId': 'mock-svc-7',
      'service': mockServicesSalon2[2],
      'employeeId': 'mock-emp-3',
      'employee': mockEmployeesSalon2[0],
      'startTime': _getDate(-4).add(const Duration(hours: 16)).toIso8601String(),
      'endTime': _getDate(-4).add(const Duration(hours: 16, minutes: 25)).toIso8601String(),
      'duration': 25,
      'status': 'COMPLETED',
      'notes': 'Mock appointment',
      'tenantId': 'mock-salon-2',
      'services': [
        {
          'id': 'mock-svc-line-8',
          'serviceId': 'mock-svc-7',
          'serviceName': 'Coupe classique',
          'duration': 25,
          'price': 60.0,
          'sortOrder': 0,
        }
      ],
    },
  ];

  // Initialize invoices
  _mockInvoicesSalon1 = [
    {
      'id': 'mock-inv-1',
      'invoiceNumber': 'INV-MOCK-SALON1-0001',
      'clientId': 'mock-client-3',
      'client': mockClientsSalon1[2],
      'appointmentId': 'mock-apt-3',
      'appointment': _mockAppointmentsSalon1[2],
      'amount': 80.0,
      'tax': 0.0,
      'total': 80.0,
      'status': 'PAID',
      'paymentMethod': 'CASH',
      'paidAt': _getDate(-2).add(const Duration(hours: 11, minutes: 30)).toIso8601String(),
      'createdAt': _getDate(-2).add(const Duration(hours: 11, minutes: 30)).toIso8601String(),
      'items': [
        {
          'id': 'mock-inv-item-1',
          'serviceId': 'mock-svc-1',
          'service': mockServicesSalon1[0],
          'serviceName': 'Coupe homme',
          'price': 80.0,
          'quantity': 1,
        }
      ],
      'tenantId': 'mock-salon-1',
    },
    {
      'id': 'mock-inv-2',
      'invoiceNumber': 'INV-MOCK-SALON1-0002',
      'clientId': 'mock-client-2',
      'client': mockClientsSalon1[1],
      'appointmentId': null,
      'amount': 100.0,
      'tax': 0.0,
      'total': 100.0,
      'status': 'PAID',
      'paymentMethod': 'CARD',
      'paidAt': _getDate(-7).add(const Duration(hours: 10)).toIso8601String(),
      'createdAt': _getDate(-7).add(const Duration(hours: 10)).toIso8601String(),
      'items': [
        {
          'id': 'mock-inv-item-2',
          'serviceId': 'mock-svc-3',
          'service': mockServicesSalon1[2],
          'serviceName': 'Brushing',
          'price': 100.0,
          'quantity': 1,
        }
      ],
      'tenantId': 'mock-salon-1',
    },
  ];

  _mockInvoicesSalon2 = [
    {
      'id': 'mock-inv-3',
      'invoiceNumber': 'INV-MOCK-SALON2-0001',
      'clientId': 'mock-client-4',
      'client': mockClientsSalon2[0],
      'appointmentId': 'mock-apt-8',
      'appointment': _mockAppointmentsSalon2[2],
      'amount': 60.0,
      'tax': 0.0,
      'total': 60.0,
      'status': 'PAID',
      'paymentMethod': 'CASH',
      'paidAt': _getDate(-4).add(const Duration(hours: 16, minutes: 25)).toIso8601String(),
      'createdAt': _getDate(-4).add(const Duration(hours: 16, minutes: 25)).toIso8601String(),
      'items': [
        {
          'id': 'mock-inv-item-3',
          'serviceId': 'mock-svc-7',
          'service': mockServicesSalon2[2],
          'serviceName': 'Coupe classique',
          'price': 60.0,
          'quantity': 1,
        }
      ],
      'tenantId': 'mock-salon-2',
    },
  ];

  // Initialize cash transactions
  _mockCashTransactionsSalon1 = [
    {
      'id': 'mock-cash-1',
      'type': 'DEPOSIT',
      'amount': 500.0,
      'paymentMethod': 'CASH',
      'notes': 'Dépôt initial',
      'createdAt': _getDate(-10).toIso8601String(),
      'tenantId': 'mock-salon-1',
    },
    {
      'id': 'mock-cash-2',
      'type': 'WITHDRAWAL',
      'amount': 200.0,
      'paymentMethod': 'CASH',
      'notes': 'Retrait pour fournitures',
      'createdAt': _getDate(-5).toIso8601String(),
      'tenantId': 'mock-salon-1',
    },
  ];
}

// -------------------------------
// Mock Salon 1 Data (Casablanca)
// -------------------------------

// Mock Employees for Salon 1
final List<Map<String, dynamic>> mockEmployeesSalon1 = [
  {
    'id': 'mock-emp-1',
    'firstName': 'Rachid',
    'lastName': 'Tazi',
    'email': 'rachid.tazi@reza-salon1.ma',
    'phone': '+212600000001',
    'workingHours': null,
    'agendaSettings': {
      'color': '#7C3AED',
      'role': 'Coiffeur',
    },
  },
  {
    'id': 'mock-emp-2',
    'firstName': 'Sofia',
    'lastName': 'Alaoui',
    'email': 'sofia.alaoui@reza-salon1.ma',
    'phone': '+212600000002',
    'workingHours': null,
    'agendaSettings': {
      'color': '#EC4899',
      'role': 'Coloriste',
    },
  },
];

// Mock Services for Salon 1
final List<Map<String, dynamic>> mockServicesSalon1 = [
  {
    'id': 'mock-svc-1',
    'name': 'Coupe homme',
    'description': 'Coupe classique ou moderne',
    'category': 'Coiffure',
    'color': '#3B82F6',
    'price': 80.0,
    'priceType': 'FIXED',
    'duration': 30,
    'visibility': 'BOOKABLE',
    'competences': [],
  },
  {
    'id': 'mock-svc-2',
    'name': 'Coupe femme',
    'description': 'Coupe personnalisée',
    'category': 'Coiffure',
    'color': '#8B5CF6',
    'price': 150.0,
    'priceType': 'FIXED',
    'duration': 60,
    'visibility': 'BOOKABLE',
    'competences': [],
  },
  {
    'id': 'mock-svc-3',
    'name': 'Brushing',
    'description': 'Brushing professionnel',
    'category': 'Coiffure',
    'color': '#10B981',
    'price': 100.0,
    'priceType': 'FIXED',
    'duration': 45,
    'visibility': 'BOOKABLE',
    'competences': [],
  },
  {
    'id': 'mock-svc-4',
    'name': 'Coloration',
    'description': 'Coloration permanente',
    'category': 'Couleur',
    'color': '#F59E0B',
    'price': 250.0,
    'priceType': 'FIXED',
    'duration': 90,
    'visibility': 'BOOKABLE',
    'competences': [],
  },
];

// Mock Clients for Salon 1
final List<Map<String, dynamic>> mockClientsSalon1 = [
  {
    'id': 'mock-client-1',
    'firstName': 'Amine',
    'lastName': 'El Ouazzani',
    'email': 'amine.elouazzani@email.ma',
    'phone': '+212600123401',
    'status': 'ACTIVE',
  },
  {
    'id': 'mock-client-2',
    'firstName': 'Leila',
    'lastName': 'Haddad',
    'email': 'leila.haddad@email.ma',
    'phone': '+212600123402',
    'status': 'ACTIVE',
  },
  {
    'id': 'mock-client-3',
    'firstName': 'Hassan',
    'lastName': 'Benali',
    'email': 'hassan.benali@email.ma',
    'phone': '+212600123403',
    'status': 'ACTIVE',
  },
];

// -------------------------------
// Mock Salon 2 Data (Rabat)
// -------------------------------

// Mock Employees for Salon 2
final List<Map<String, dynamic>> mockEmployeesSalon2 = [
  {
    'id': 'mock-emp-3',
    'firstName': 'Karim',
    'lastName': 'Idrissi',
    'email': 'karim.idrissi@reza-salon2.ma',
    'phone': '+212600000003',
    'workingHours': null,
    'agendaSettings': {
      'color': '#059669',
      'role': 'Barbier',
    },
  },
];

// Mock Services for Salon 2
final List<Map<String, dynamic>> mockServicesSalon2 = [
  {
    'id': 'mock-svc-5',
    'name': 'Coupe + rasage',
    'description': 'Coupe et rasage traditionnel',
    'category': 'Barbier',
    'color': '#14B8A6',
    'price': 120.0,
    'priceType': 'FIXED',
    'duration': 45,
    'visibility': 'BOOKABLE',
    'competences': [],
  },
  {
    'id': 'mock-svc-6',
    'name': 'Soin barbe',
    'description': 'Soin complet de barbe',
    'category': 'Barbier',
    'color': '#3B82F6',
    'price': 70.0,
    'priceType': 'FIXED',
    'duration': 30,
    'visibility': 'BOOKABLE',
    'competences': [],
  },
  {
    'id': 'mock-svc-7',
    'name': 'Coupe classique',
    'description': 'Coupe homme classique',
    'category': 'Barbier',
    'color': '#8B5CF6',
    'price': 60.0,
    'priceType': 'FIXED',
    'duration': 25,
    'visibility': 'BOOKABLE',
    'competences': [],
  },
];

// Mock Clients for Salon 2
final List<Map<String, dynamic>> mockClientsSalon2 = [
  {
    'id': 'mock-client-4',
    'firstName': 'Younes',
    'lastName': 'El Mansouri',
    'email': 'younes.elmansouri@email.ma',
    'phone': '+212600123501',
    'status': 'ACTIVE',
  },
  {
    'id': 'mock-client-5',
    'firstName': 'Anas',
    'lastName': 'Chraibi',
    'email': 'anas.chraibi@email.ma',
    'phone': '+212600123502',
    'status': 'ACTIVE',
  },
];

// -------------------------------
// Mock Data Modification Functions
// -------------------------------

void updateMockAppointmentStatus(String id, String status, String? tenantId) {
  final list = tenantId == 'mock-salon-2'
      ? _mockAppointmentsSalon2
      : _mockAppointmentsSalon1;
  final index = list.indexWhere((apt) => apt['id'] == id);
  if (index != -1) {
    list[index]['status'] = status;
  }
}

void addMockInvoice(Map<String, dynamic> invoice, String? tenantId) {
  if (tenantId == 'mock-salon-2') {
    _mockInvoicesSalon2.add(invoice);
  } else {
    _mockInvoicesSalon1.add(invoice);
  }
}

void addMockCashTransaction(Map<String, dynamic> tx, String? tenantId) {
  if (tenantId != 'mock-salon-2') {
    _mockCashTransactionsSalon1.add(tx);
  }
}

// -------------------------------
// Aggregate Functions
// -------------------------------

List<Map<String, dynamic>> getMockEmployees(String? activeTenantId) {
  return activeTenantId == 'mock-salon-2'
      ? mockEmployeesSalon2
      : mockEmployeesSalon1;
}

List<Map<String, dynamic>> getMockServices(String? activeTenantId) {
  return activeTenantId == 'mock-salon-2'
      ? mockServicesSalon2
      : mockServicesSalon1;
}

List<Map<String, dynamic>> getMockClients(String? activeTenantId) {
  return activeTenantId == 'mock-salon-2'
      ? mockClientsSalon2
      : mockClientsSalon1;
}

List<Map<String, dynamic>> getMockAppointments(String? activeTenantId,
    {String? startDate, String? endDate}) {
  final data = activeTenantId == 'mock-salon-2'
      ? List.of(_mockAppointmentsSalon2)
      : List.of(_mockAppointmentsSalon1);

  if (startDate == null && endDate == null) return data;

  return data.where((apt) {
    final aptDate = DateTime.parse(apt['startTime'] as String);
    if (startDate != null) {
      final start = DateTime.parse(startDate);
      if (aptDate.isBefore(start)) return false;
    }
    if (endDate != null) {
      final end = DateTime.parse(endDate);
      if (aptDate.isAfter(end)) return false;
    }
    return true;
  }).toList();
}

List<Map<String, dynamic>> getMockInvoices(String? activeTenantId) {
  return activeTenantId == 'mock-salon-2'
      ? List.of(_mockInvoicesSalon2)
      : List.of(_mockInvoicesSalon1);
}

List<Map<String, dynamic>> getMockCashTransactionsSalon1() {
  return List.of(_mockCashTransactionsSalon1);
}