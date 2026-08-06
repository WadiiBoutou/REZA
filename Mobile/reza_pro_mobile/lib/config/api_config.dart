/// Staff API base (includes `/api`).
/// Uses localhost for all platforms — backend runs `adb reverse` for USB devices.
/// Override: `--dart-define=API_BASE=http://example.com:5000/api`
class ApiConfig {
  static const String _envBase = String.fromEnvironment('API_BASE', defaultValue: '');

  static String get baseUrl {
    if (_envBase.isNotEmpty) return _envBase.replaceAll(RegExp(r'/$'), '');
    return 'http://127.0.0.1:5000/api';
  }
}

