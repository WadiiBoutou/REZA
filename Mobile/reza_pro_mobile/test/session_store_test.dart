import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wellbepro_mobile/services/session_store.dart';

// In-memory mock of the flutter_secure_storage platform channel
// (plugins.it_nomads.com/flutter_secure_storage) so tests run headless.
const MethodChannel _secureChannel =
    MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

const _tokenKey = 'reza_pro_token'; // legacy plaintext key
const _userKey = 'reza_pro_user';

Map<String, String> secureMap = {};

void mockSecureStorage() {
  secureMap = {};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(_secureChannel, (call) async {
    final args = (call.arguments as Map?) ?? const {};
    switch (call.method) {
      case 'read':
        return secureMap[args['key']];
      case 'write':
        secureMap[args['key'] as String] = args['value'] as String;
        return null;
      case 'delete':
        secureMap.remove(args['key']);
        return null;
      case 'deleteAll':
        secureMap.clear();
        return null;
      case 'containsKey':
        return secureMap.containsKey(args['key']);
      case 'readAll':
        return Map<String, String>.from(secureMap);
      default:
        return null;
    }
  });
}

StaffUser sampleUser() => const StaffUser(
      id: 'user-1',
      email: 'staff@test.reza',
      firstName: 'Staff',
      lastName: 'One',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      tenantName: 'Salon Test',
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    mockSecureStorage();
    SharedPreferences.setMockInitialValues({});
  });

  test('fresh login: token stored in secure storage, never in plaintext prefs',
      () async {
    final store = SessionStore();
    await store.save(token: 'tok-123', user: sampleUser());

    // Readable through getToken (what _boot() uses).
    expect(await store.getToken(), 'tok-123');
    // Plaintext prefs must NOT contain the token.
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.containsKey(_tokenKey), isFalse,
        reason: 'token must never be in plaintext SharedPreferences');
    // It IS in the secure store.
    expect(secureMap['reza_pro_token_secure'], 'tok-123');
    // Non-sensitive session data still lives in prefs (user profile).
    expect(await store.getUser(), isNotNull);
  });

  test('app restart: existing secure session survives without re-login',
      () async {
    final store = SessionStore();
    await store.save(token: 'tok-abc', user: sampleUser());

    // Simulate a restart: secure storage keeps the value, prefs keep profile.
    // (getToken is the only entry point; the map is the persistent backing.)
    expect(await store.getToken(), 'tok-abc');
    expect(secureMap['reza_pro_token_secure'], 'tok-abc');
    expect((await store.getUser())?.id, 'user-1');
  });

  test('legacy migration: plaintext token moved to secure storage once',
      () async {
    // Simulate an install from before the D14 change: token in plaintext prefs.
    SharedPreferences.setMockInitialValues({
      _tokenKey: 'legacy-tok',
      _userKey:
          '{"id":"user-1","email":"staff@test.reza","firstName":"Staff","lastName":"One","role":"ADMIN","tenantId":"tenant-1"}',
    });

    final store = SessionStore();
    // First read triggers migration.
    expect(await store.getToken(), 'legacy-tok');
    expect(secureMap['reza_pro_token_secure'], 'legacy-tok',
        reason: 'legacy token must be copied into secure storage');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.containsKey(_tokenKey), isFalse,
        reason: 'legacy plaintext copy must be cleared after migration');

    // Second read: no re-migration, still returns the token from secure store.
    expect(await store.getToken(), 'legacy-tok');
    expect(secureMap['reza_pro_token_secure'], 'legacy-tok');
  });

  test('explicit logout: token + session cleared from both stores', () async {
    final store = SessionStore();
    await store.save(token: 'tok-xyz', user: sampleUser());
    expect(await store.getToken(), 'tok-xyz');

    await store.clear();

    expect(await store.getToken(), isNull);
    expect(await store.getUser(), isNull);
    expect(secureMap.containsKey('reza_pro_token_secure'), isFalse);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.containsKey(_tokenKey), isFalse);
    expect(prefs.containsKey(_userKey), isFalse);
  });

  test('no legacy token and empty secure store: getToken returns null',
      () async {
    final store = SessionStore();
    expect(await store.getToken(), isNull);
  });
}
