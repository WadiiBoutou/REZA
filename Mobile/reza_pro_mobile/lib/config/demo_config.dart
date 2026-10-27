/// Demo mode configuration for frontend-only mock data.
/// Set to true to bypass backend and use local mock data.
class DemoConfig {
  /// Enable demo mode (no backend required).
  static const bool isDemoMode = true;

  /// Demo admin credentials
  static const String demoEmail = 'demo.pro@reza.ma';
  static const String demoPassword = 'demo1234';

  /// Demo subscription end date
  static final DateTime subscriptionEnd = DateTime.utc(2026, 12, 1, 12, 0, 0);
}
