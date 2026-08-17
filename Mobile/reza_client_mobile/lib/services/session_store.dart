import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SessionUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? phone;
  final String? avatar;

  SessionUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.phone,
    this.avatar,
  });

  String get name => '$firstName $lastName'.trim();

  factory SessionUser.fromJson(Map<String, dynamic> j) => SessionUser(
        id: j['id']?.toString() ?? '',
        email: j['email']?.toString() ?? j['email'] ?? '',
        firstName: j['firstName']?.toString() ?? '',
        lastName: j['lastName']?.toString() ?? '',
        phone: j['phone']?.toString(),
        avatar: j['avatar']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'phone': phone,
        'avatar': avatar,
        'name': name,
      };
}

class SessionStore {
  static const _key = 'reza_user';

  /// The client session token lives in platform secure storage (Keychain /
  /// Keystore), never in plaintext SharedPreferences.
  static const _tokenKey = 'reza_client_token';
  static const _secureStorage = FlutterSecureStorage();

  Future<SessionUser?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return SessionUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      await prefs.remove(_key);
      return null;
    }
  }

  Future<String?> getToken() async {
    return _secureStorage.read(key: _tokenKey);
  }

  Future<void> save(SessionUser user, {String? token}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(user.toJson()));
    if (token != null && token.isNotEmpty) {
      await _secureStorage.write(key: _tokenKey, value: token);
    }
  }

  Future<void> clear() async {
    await _secureStorage.delete(key: _tokenKey);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

final sessionStore = SessionStore();
