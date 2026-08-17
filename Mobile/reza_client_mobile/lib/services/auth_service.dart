import 'api_client.dart';
import 'session_store.dart';

/// Result of a registration attempt: the backend always requires email
/// verification before the account is usable, so there is no session user
/// at this point — the app must tell the user to check their inbox.
class RegisterResult {
  final bool requiresEmailVerification;
  final String? message;
  const RegisterResult({required this.requiresEmailVerification, this.message});
}

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
    // Persist the session token (secure storage) alongside the profile.
    final token = res['token'] as String?;
    await sessionStore.save(client, token: token);
    return client;
  }

  /// Lightweight pre-registration check: true when a *confirmed* account
  /// already exists for this email (mirrors the backend's check-email logic).
  Future<bool> emailExists(String email) async {
    final res = await apiClient.get('/public/auth/check-email', query: {
      'email': email.trim(),
    });
    return res['exists'] == true;
  }

  Future<RegisterResult> register({
    required String email,
    required String firstName,
    required String lastName,
    required String password,
    String? phone,
    String? avatar,
    String? gender,
    String? dateOfBirth,
  }) async {
    final res = await apiClient.post('/public/auth/client-register', {
      'email': email.trim(),
      'firstName': firstName.trim(),
      'lastName': lastName.trim(),
      'password': password,
      if (phone != null && phone.isNotEmpty) 'phone': phone.trim(),
      if (avatar != null && avatar.isNotEmpty) 'avatar': avatar,
      if (gender != null && gender.isNotEmpty) 'gender': gender,
      if (dateOfBirth != null && dateOfBirth.isNotEmpty) 'dateOfBirth': dateOfBirth,
    });
    return RegisterResult(
      requiresEmailVerification: res['requiresEmailVerification'] == true,
      message: (res['message'] as String?) ??
          'Compte créé. Un email de confirmation vous a été envoyé — vérifiez votre boîte de réception pour activer votre compte.',
    );
  }

  Future<void> logout() => sessionStore.clear();
}

final authService = AuthService();
