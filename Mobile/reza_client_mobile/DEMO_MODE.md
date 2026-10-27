# REZA Client Mobile - Demo Mode

This branch contains a **full frontend mock data implementation** that runs completely offline without needing the backend server.

## What is Demo Mode?

Demo mode is enabled by default in this branch. The app uses mock data that mirrors the Web application's demo setup, allowing you to:

- Test all client features without a backend
- Demo the app to clients/stakeholders
- Develop UI/UX without backend dependencies
- Generate APKs for distribution that work standalone

## Demo Account Credentials

Use these credentials to login:

- **Email**: `demo.client@reza.ma`
- **Password**: `demo1234`

## Mock Data Features

The demo includes:

- **8 salons** across Morocco (Casablanca, Rabat, Marrakech, etc.)
- **7 services** (haircuts, coloring, facials, manicures, massages, etc.)
- **4 staff members** with photos
- **34 appointments** (past, upcoming, completed, cancelled)
- **28 reviews** with ratings
- **Favorites** and **family members** management
- **Full booking flow** with available slots
- **Real-time UI updates** (create, cancel, update operations)

## Configuration

Demo mode is controlled in `lib/config/demo_config.dart`:

```dart
class DemoConfig {
  static const bool isDemoMode = true;  // Toggle demo mode
  static const String demoEmail = 'demo.client@reza.ma';
  static const String demoPassword = 'demo1234';
}
```

## File Structure

```
lib/
├── config/
│   └── demo_config.dart          # Demo mode toggle
├── data/
│   ├── demo_api_data.dart        # Mock data generation
│   └── demo_images.dart          # Image URLs
└── services/
    ├── api_client.dart           # Modified to route to demo API
    └── demo_api_client.dart      # Mock API implementation
```

## How It Works

When `isDemoMode = true`, the `ApiClient` intercepts all HTTP requests and routes them to `DemoApiClient` instead of the real backend. The demo API maintains in-memory data stores that persist during the app session.

## Building APKs

### Debug APK (for testing)
```bash
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_client_mobile
flutter build apk --debug
```

### Release APK (for distribution)
```bash
flutter build apk --release
```

APKs will be generated in:
- `build/app/outputs/flutter-apk/app-debug.apk`
- `build/app/outputs/flutter-apk/app-release.apk`

### Android App Bundle (for Play Store)
```bash
flutter build appbundle --release
```

## Switching Back to Production

To connect to the real backend:

1. Set `isDemoMode = false` in `lib/config/demo_config.dart`
2. Ensure backend is running at `http://127.0.0.1:5000/api`
3. Rebuild the app

Or merge changes from the main branch which has production configuration.

## Notes

- All data is stored in memory and resets when the app restarts
- Network delays are simulated (300ms) for realistic UX
- Mock data exactly matches the Web application's demo data
- Images are loaded from external CDNs (randomuser.me, unsplash.com)

## Development

This demo mode is perfect for:
- UI/UX iterations
- Client demonstrations
- Offline development
- Feature showcases
- APK distributions without backend setup
