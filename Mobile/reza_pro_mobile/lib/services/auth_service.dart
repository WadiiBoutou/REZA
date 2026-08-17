import 'api_client.dart';
import 'session_store.dart';

class AuthSession {
  final String token;
  final StaffUser user;
  final List<SalonSummary> salons;
  final String? activeTenantId;

  const AuthSession({
    required this.token,
    required this.user,
    this.salons = const [],
    this.activeTenantId,
  });

  factory AuthSession.fromJson(Map<String, dynamic> res) {
    final token = res['token']?.toString() ?? '';
    final userMap = Map<String, dynamic>.from(res['user'] as Map? ?? {});
    final salonsRaw = (res['salons'] as List?) ?? [];
    final salons = salonsRaw
        .map((e) => SalonSummary.fromJson(Map<String, dynamic>.from(e as Map)))
        .where((s) => s.id.isNotEmpty)
        .toList();
    return AuthSession(
      token: token,
      user: StaffUser.fromJson(userMap),
      salons: salons,
      activeTenantId: res['activeTenantId']?.toString() ?? userMap['tenantId']?.toString(),
    );
  }
}

class AuthService {
  Future<AuthSession> login(String email, String password) async {

    final res = await apiClient.post('/auth/login', {
      'email': email.trim(),
      'password': password,
    });
    final session = AuthSession.fromJson(res);
    if (session.token.isEmpty) throw ApiException('Token manquant');
    if (session.user.isSuperAdmin) {
      await sessionStore.clear();
      throw ApiException(kSuperAdminMobileBlockedMessage);
    }
    return session;
  }

  Future<AuthSession> me() async {

    final res = await apiClient.get('/auth/me');
    // /me has no token — caller keeps existing
    return AuthSession.fromJson({
      ...res,
      'token': '',
      'user': res['user'],
    });
  }

  Future<AuthSession> switchSalon(String tenantId) async {

    final res = await apiClient.post('/auth/switch-salon', {
      'tenantId': tenantId,
    });
    final session = AuthSession.fromJson(res);
    if (session.token.isEmpty) throw ApiException('Token manquant après changement de salon');
    return session;
  }

  Future<void> logout() async {
  try {
    await apiClient.post('/auth/logout');
  } catch (_) {
    // ignore network errors on logout
  }
  }
}

final authService = AuthService();
