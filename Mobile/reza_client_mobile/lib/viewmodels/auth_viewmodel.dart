import 'package:flutter/foundation.dart';
import '../services/account_service.dart';
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
    // Non-blocking backfill: sessions saved before the backend returned the
    // avatar at login have a null avatar — refresh from the profile endpoint
    // so avatars render everywhere (profile, recap, etc.).
    if (_user != null) {
      // Fire and forget — the app must not wait on the network at startup.
      _backfillAvatar();
    }
  }

  Future<void> _backfillAvatar() async {
    final email = _user?.email;
    if (email == null || email.isEmpty) return;
    try {
      final profile = await accountService.getProfile(email);
      final newAvatar = (profile['avatar'] ?? '').toString();
      final current = _user;
      if (current == null) return;
      if ((current.avatar ?? '') == newAvatar) {
        debugPrint(
          '[avatar] session already has avatar: '
          '${newAvatar.isEmpty ? 'EMPTY (no photo on DB)' : 'present'}',
        );
        return;
      }
      final updated = SessionUser(
        id: current.id,
        email: current.email,
        firstName: current.firstName,
        lastName: current.lastName,
        phone: current.phone,
        avatar: newAvatar.isEmpty ? null : newAvatar,
      );
      _user = updated;
      await sessionStore.save(updated);
      notifyListeners();
      debugPrint(
        '[avatar] session backfilled: '
        '${newAvatar.isEmpty ? 'EMPTY (no photo on DB)' : 'loaded (${newAvatar.length} chars)'}',
      );
    } catch (e) {
      debugPrint('[avatar] profile backfill failed: $e');
    }
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
