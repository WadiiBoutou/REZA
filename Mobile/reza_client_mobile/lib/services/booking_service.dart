import 'api_client.dart';

class BookingService {
  Future<Map<String, dynamic>> createBooking({
    required String tenantId,
    required String firstName,
    required String lastName,
    required String phone,
    String? email,
    required List<String> serviceIds,
    required String startTimeIso,
    String? notes,
    String? employeeId,
    List<Map<String, dynamic>>? serviceEmployees,
    List<Map<String, dynamic>>? participants,
  }) async {
    final body = <String, dynamic>{
      'tenantId': tenantId,
      'firstName': firstName,
      'lastName': lastName,
      'phone': phone,
      if (email != null && email.isNotEmpty) 'email': email,
      'serviceIds': serviceIds,
      'startTime': startTimeIso,
      if (employeeId != null && employeeId.isNotEmpty) 'employeeId': employeeId,
      if (serviceEmployees != null && serviceEmployees.isNotEmpty)
        'serviceEmployees': serviceEmployees,
      if (notes != null) 'notes': notes,
    };
    if (participants != null && participants.isNotEmpty) {
      body['participants'] = participants;
    }
    return apiClient.post('/public/bookings', body);
  }
}

final bookingService = BookingService();
