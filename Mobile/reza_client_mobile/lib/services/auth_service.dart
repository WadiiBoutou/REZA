import 'api_client.dart';
import 'session_store.dart';

class AuthService {
  Future<SessionUser> login(String email, String password) async {
    final res = await apiClient.post('/public/auth/client-login', {
      'email': email.trim(),
      'password': password,
    });
    final clientData = res['client'] as Map<String, dynamic>;
    // Preserve the login email if backend returns null/empty (matches web behavior)
    if ((clientData['email']?.toString() ?? '').isEmpty) {
      clientData['email'] = email.trim();
    }
    final client = SessionUser.fromJson(clientData);
    await sessionStore.save(client);
    return client;
  }

  Future<SessionUser> register({
    required String email,
    required String firstName,
    required String lastName,
    required String password,
    String? phone,
  }) async {
    final res = await apiClient.post('/public/auth/client-register', {
      'email': email.trim(),
      'firstName': firstName.trim(),
      'lastName': lastName.trim(),
      'password': password,
      if (phone != null && phone.isNotEmpty) 'phone': phone.trim(),
    });
    final clientData = res['client'] as Map<String, dynamic>;
    if ((clientData['email']?.toString() ?? '').isEmpty) {
      clientData['email'] = email.trim();
    }
    final client = SessionUser.fromJson(clientData);
    await sessionStore.save(client);
    return client;
  }

  Future<void> logout() => sessionStore.clear();
}

final authService = AuthService();
