import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';
import '../services/session_store.dart';

class AuthViewModel extends ChangeNotifier {
  SessionUser? _user;
  bool _loading = true;

  SessionUser? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get loading => _loading;
  String? get email => _user?.email;

  Future<void> bootstrap() async {
    _user = await sessionStore.load();
    _loading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    _user = await authService.login(email, password);
    notifyListeners();
  }

  Future<bool> emailExists(String email) => authService.emailExists(email);

  /// Registers a new client. The backend requires email verification, so this
  /// does NOT log the user in — callers should show `result.message` and
  /// return to the login form.
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
    return authService.register(
      email: email,
      firstName: firstName,
      lastName: lastName,
      password: password,
      phone: phone,
      avatar: avatar,
      gender: gender,
      dateOfBirth: dateOfBirth,
    );
  }

  Future<void> logout() async {
    await authService.logout();
    _user = null;
    notifyListeners();
  }

  Future<void> refreshFromStore() async {
    _user = await sessionStore.load();
    notifyListeners();
  }
}
