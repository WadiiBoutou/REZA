/// Backend public API base (includes `/api`).
///
/// Uses `127.0.0.1` (localhost) for ALL platforms.
/// Physical Android/iOS devices work because the backend automatically
/// runs `adb reverse tcp:5000 tcp:5000` on startup, which forwards
/// the phone's localhost:5000 → PC's port 5000 over USB.
///
/// Override: `--dart-define=API_BASE=http://<custom>:5000/api`
class ApiConfig {
  /// Override at build time: `--dart-define=API_BASE=http://example.com:5000/api`
  static const String _envBase = String.fromEnvironment('API_BASE', defaultValue: '');

  static String get baseUrl {
    if (_envBase.isNotEmpty) return _envBase.replaceAll(RegExp(r'/$'), '');
    // Works everywhere: web, emulator (adb reverse), physical phone (adb reverse), desktop
    return 'http://127.0.0.1:5000/api';
  }
}
