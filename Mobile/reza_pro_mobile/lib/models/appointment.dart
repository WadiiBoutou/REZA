class AppointmentServiceLine {
  final String? id;
  final String? serviceId;
  final String name;
  final int duration;
  final double price;
  /// Employee assigned to this service line (may be null).
  final String? employeeName;

  AppointmentServiceLine({
    this.id,
    this.serviceId,
    required this.name,
    required this.duration,
    required this.price,
    this.employeeName,
  });
}

class Appointment {
  final String id;
  final String clientId;
  final String clientName;
  final String? clientAvatar;
  final String serviceId;
  final String service;
  final double? servicePrice;
  final List<AppointmentServiceLine> services;
  final int totalDuration;
  final double totalPrice;
  final String? employeeId;
  final String employee;
  final String time;
  final int duration;
  /// UI status: confirmed | pending | cancelled | completed | in_progress | no_show
  final String status;
  final String? phone;
  final String? email;
  final DateTime date;
  final String? notes;
  final DateTime? startTime;
  final String? tenantId;
  /// Booking group this appointment belongs to (multi-participant reservation).
  final String? bookingGroupId;

  Appointment({
    required this.id,
    this.clientId = '',
    required this.clientName,
    this.clientAvatar,
    this.serviceId = '',
    required this.service,
    this.servicePrice,
    this.services = const [],
    this.totalDuration = 0,
    this.totalPrice = 0,
    this.employeeId,
    required this.employee,
    required this.time,
    required this.duration,
    required this.status,
    this.phone,
    this.email,
    required this.date,
    this.notes,
    this.startTime,
    this.tenantId,
    this.bookingGroupId,
  });

  Appointment copyWith({
    String? id,
    String? clientId,
    String? clientName,
    String? clientAvatar,
    String? serviceId,
    String? service,
    double? servicePrice,
    List<AppointmentServiceLine>? services,
    int? totalDuration,
    double? totalPrice,
    String? employeeId,
    String? employee,
    String? time,
    int? duration,
    String? status,
    String? phone,
    String? email,
    DateTime? date,
    String? notes,
    DateTime? startTime,
    String? tenantId,
    String? bookingGroupId,
  }) {
    return Appointment(
      id: id ?? this.id,
      clientId: clientId ?? this.clientId,
      clientName: clientName ?? this.clientName,
      clientAvatar: clientAvatar ?? this.clientAvatar,
      serviceId: serviceId ?? this.serviceId,
      service: service ?? this.service,
      servicePrice: servicePrice ?? this.servicePrice,
      services: services ?? this.services,
      totalDuration: totalDuration ?? this.totalDuration,
      totalPrice: totalPrice ?? this.totalPrice,
      employeeId: employeeId ?? this.employeeId,
      employee: employee ?? this.employee,
      time: time ?? this.time,
      duration: duration ?? this.duration,
      status: status ?? this.status,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      date: date ?? this.date,
      notes: notes ?? this.notes,
      startTime: startTime ?? this.startTime,
      tenantId: tenantId ?? this.tenantId,
      bookingGroupId: bookingGroupId ?? this.bookingGroupId,
    );
  }

  static bool canConfirm(String status) => status == 'pending';

  static bool canMarkAbsentOrDone(String status) =>
      status == 'pending' || status == 'confirmed' || status == 'in_progress';

  static String labelFr(String status) {
    switch (status) {
      case 'confirmed':
        return 'Confirmé';
      case 'pending':
        return 'En attente';
      case 'cancelled':
        return 'Annulé';
      case 'completed':
        return 'Terminé';
      case 'in_progress':
        return 'En cours';
      case 'no_show':
        return 'Absent';
      default:
        return status;
    }
  }

  static String uiStatus(String? backend) {
    switch ((backend ?? '').toUpperCase()) {
      case 'CONFIRMED':
        return 'confirmed';
      case 'PENDING':
        return 'pending';
      case 'CANCELLED':
        return 'cancelled';
      case 'COMPLETED':
        return 'completed';
      case 'IN_PROGRESS':
        return 'in_progress';
      case 'NO_SHOW':
        return 'no_show';
      default:
        return (backend ?? 'pending').toLowerCase();
    }
  }

  static String backendStatus(String ui) {
    switch (ui.toLowerCase()) {
      case 'confirmed':
        return 'CONFIRMED';
      case 'pending':
        return 'PENDING';
      case 'cancelled':
        return 'CANCELLED';
      case 'completed':
        return 'COMPLETED';
      case 'in_progress':
        return 'IN_PROGRESS';
      case 'no_show':
        return 'NO_SHOW';
      default:
        return ui.toUpperCase();
    }
  }

  factory Appointment.fromJson(Map<String, dynamic> json) {
    final client = json['client'] as Map<String, dynamic>?;
    final employee = json['employee'] as Map<String, dynamic>?;
    final start = DateTime.tryParse(json['startTime']?.toString() ?? '')?.toLocal();
    final date = start != null
        ? DateTime(start.year, start.month, start.day)
        : DateTime.now();
    final time = start != null
        ? '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}'
        : '00:00';
    final clientName = client != null
        ? '${client['firstName'] ?? ''} ${client['lastName'] ?? ''}'.trim()
        : 'Client';
    final clientAvatar = client?['avatar']?.toString();
    final employeeName = employee != null
        ? '${employee['firstName'] ?? ''} ${employee['lastName'] ?? ''}'.trim()
        : '—';
    final serviceLines = (json['services'] as List?)?.map((item) {
      final map = item as Map<String, dynamic>;
      final svcEmployee = map['employee'] as Map<String, dynamic>?;
      return AppointmentServiceLine(
        id: map['id']?.toString(),
        serviceId: map['serviceId']?.toString(),
        name: map['name']?.toString() ?? map['serviceName']?.toString() ?? 'Service',
        duration: (map['duration'] as num?)?.toInt() ?? 0,
        price: (map['price'] as num?)?.toDouble() ?? 0,
        employeeName: svcEmployee != null
            ? '${svcEmployee['firstName'] ?? ''} ${svcEmployee['lastName'] ?? ''}'.trim()
            : null,
      );
    }).toList() ?? const <AppointmentServiceLine>[];

    // Derive primary serviceId and price from services[] array
    final primaryServiceId = serviceLines.isNotEmpty ? (serviceLines.first.serviceId ?? '') : '';
    final primaryPrice = serviceLines.isNotEmpty ? serviceLines.first.price : null;

    final bookingGroup = json['bookingGroup'] as Map<String, dynamic>?;

    // Employee name: multi-service appointments store the real assignment on
    // each service line (AppointmentServiceItem.employeeId) and leave the
    // top-level `employee` null. Derive the display name from the service
    // lines first, falling back to the legacy top-level employee relation.
    final serviceEmployeeNames = serviceLines
        .map((s) => s.employeeName)
        .where((n) => n != null && n.isNotEmpty)
        .map((n) => n!)
        .toSet();
    final employeeLabel = serviceEmployeeNames.isNotEmpty
        ? (serviceEmployeeNames.length == 1
            ? serviceEmployeeNames.first
            : 'Plusieurs employés')
        : employeeName;

    return Appointment(
      id: json['id']?.toString() ?? '',
      clientId: client?['id']?.toString() ?? json['clientId']?.toString() ?? '',
      clientName: clientName.isEmpty ? 'Client' : clientName,
      clientAvatar: clientAvatar,
      serviceId: primaryServiceId,
      service: serviceLines.isNotEmpty
          ? serviceLines.first.name
          : 'Service',
      servicePrice: primaryPrice,
      services: serviceLines,
      totalDuration: (json['totalDuration'] as num?)?.toInt() ??
          (json['duration'] as num?)?.toInt() ??
          60,
      totalPrice: (json['totalPrice'] as num?)?.toDouble() ??
          (primaryPrice ?? 0),
      employeeId: employee?['id']?.toString(),
      employee: employeeLabel.trim().isEmpty ? '—' : employeeLabel,
      time: time,
      duration: (json['duration'] as num?)?.toInt() ?? 60,
      status: uiStatus(json['status']?.toString()),
      phone: client?['phone']?.toString(),
      email: client?['email']?.toString(),
      date: date,
      notes: json['notes']?.toString(),
      startTime: start,
      tenantId: json['tenantId']?.toString(),
      bookingGroupId: json['bookingGroupId']?.toString() ??
          bookingGroup?['id']?.toString(),
    );
  }
}
