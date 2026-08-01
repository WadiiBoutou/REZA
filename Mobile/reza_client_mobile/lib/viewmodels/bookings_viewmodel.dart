import 'package:flutter/foundation.dart';
import '../services/account_service.dart';
import '../services/api_client.dart';

class BookingsViewModel extends ChangeNotifier {
  List<Map<String, dynamic>> upcoming = [];
  List<Map<String, dynamic>> past = [];
  bool loading = false;
  String? error;
  String sortBy = 'createdAt'; // 'createdAt' or 'startTime'

  Map<String, dynamic> mapAppointment(Map<String, dynamic> a) {
    // The backend pre-formats everything as flat fields.
    // 'service' and 'salon' are plain Strings, price is a number,
    // duration and image are already formatted strings.

    final status = (a['status']?.toString() ?? 'pending').toLowerCase();

    // price comes as a number (e.g. 150) → format it
    final priceRaw = a['price'];
    String priceDisplay = '';
    if (priceRaw != null && priceRaw != 0) {
      final priceNum = priceRaw is num ? priceRaw : num.tryParse(priceRaw.toString());
      if (priceNum != null && priceNum > 0) {
        priceDisplay = '${priceNum.toStringAsFixed(0)} MAD';
      }
    }

    // Extract services array from backend response
    final servicesRaw = a['services'] as List<dynamic>? ?? [];
    final services = servicesRaw.map((s) {
      if (s is Map<String, dynamic>) {
        return {
          'id': s['id']?.toString() ?? '',
          'serviceId': s['serviceId']?.toString() ?? '',
          'name': s['name']?.toString() ?? '',
          'duration': s['duration'] ?? 0,
          'price': s['price'] ?? 0,
        };
      }
      return <String, dynamic>{};
    }).toList();

    // date + time are already formatted by the backend ("DD/MM/YYYY", "HH:MM")
    // but we also parse startTime for sorting (_dt)
    final dt = DateTime.tryParse(a['startTime']?.toString() ?? '')?.toLocal();

    return {
      'id': a['id']?.toString() ?? '',
      'venue': a['salon']?.toString() ?? 'Salon',
      'service': a['service']?.toString() ?? 'Service',
      'salon': a['salon']?.toString() ?? 'Salon',
      'image': a['image']?.toString() ?? '',
      'price': priceDisplay,
      'duration': a['duration']?.toString() ?? '',
      'status': status,
      'date': a['date']?.toString() ?? '',
      'time': a['time']?.toString() ?? '',
      'services': services, // Pass through the services array
      '_dt': dt,
      'raw': a,
    };
  }

  Future<void> load(String? email) async {
    if (email == null || email.isEmpty) {
      upcoming = [];
      past = [];
      loading = false;
      error = 'Connectez-vous pour voir vos réservations.';
      notifyListeners();
      return;
    }
    loading = true;
    error = null;
    notifyListeners();
    try {
      final list = await accountService.getAppointments(email, sortBy: sortBy);
      final now = DateTime.now();
      final up = <Map<String, dynamic>>[];
      final pa = <Map<String, dynamic>>[];
      for (final a in list) {
        final mapped = mapAppointment(a);
        final status = mapped['status'] as String;
        final dt = mapped['_dt'] as DateTime?;
        final isPast = status == 'completed' ||
            status == 'cancelled' ||
            status == 'no_show' ||
            (dt != null && dt.isBefore(now));
        if (isPast) {
          pa.add(mapped);
        } else {
          up.add(mapped);
        }
      }
      upcoming = up;
      past = pa;
      loading = false;
      notifyListeners();
    } on ApiException catch (e) {
      error = e.message;
      loading = false;
      notifyListeners();
    } catch (e) {
      error = e.toString();
      loading = false;
      notifyListeners();
    }
  }

  void setSortBy(String sort) {
    sortBy = sort;
    notifyListeners();
  }

  Future<void> cancel(String appointmentId, String email) async {
    await accountService.cancelAppointment(appointmentId, email);
    await load(email);
  }
}
