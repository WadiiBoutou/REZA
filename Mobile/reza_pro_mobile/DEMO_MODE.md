# REZA Pro Mobile - Demo Mode

This branch contains a **full frontend mock data implementation** that runs completely offline without needing the backend server.

## What is Demo Mode?

Demo mode is enabled by default in this branch. The app uses mock data that mirrors the Web application's demo setup, allowing you to:

- Test all professional features without a backend
- Demo the app to salon owners/staff
- Develop UI/UX without backend dependencies
- Generate APKs for distribution that work standalone

## Demo Account Credentials

Use these credentials to login:

- **Email**: `demo.pro@reza.ma`
- **Password**: `demo1234`

## Mock Data Features

The demo includes:

- **Salon**: Atelier Noor (Casablanca beauty institute)
- **6 services** with categories (Coiffure, Soin visage, Onglerie, Bien-être)
- **4 employees** (Salma, Youssef, Lina, Meryem) with color-coded agendas
- **150 appointments** spanning July-October 2026 with realistic distribution
- **16 clients** with full contact details and appointment history
- **36 reviews** (approved, pending, rejected) for moderation
- **Invoices** with payment tracking (paid/unpaid)
- **Statistics** (revenue, occupation, client trends)
- **Subscription** management (active until Dec 2026)
- **Full CRUD operations** for all entities

## Configuration

Demo mode is controlled in `lib/config/demo_config.dart`:

```dart
class DemoConfig {
  static const bool isDemoMode = true;  // Toggle demo mode
  static const String demoEmail = 'demo.pro@reza.ma';
  static const String demoPassword = 'demo1234';
  static final DateTime subscriptionEnd = DateTime.utc(2026, 12, 1, 12, 0, 0);
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

All business logic is simulated:
- Appointments are distributed realistically across months
- Stats calculations (revenue, occupation, new clients)
- Review moderation workflow
- Invoice generation from completed appointments
- Service and employee management

## Building APKs

### Debug APK (for testing)
```bash
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_pro_mobile
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

### iOS Build (requires macOS)
```bash
flutter build ipa --release
```

## Switching Back to Production

To connect to the real backend:

1. Set `isDemoMode = false` in `lib/config/demo_config.dart`
2. Ensure backend is running at `http://127.0.0.1:5000/api`
3. Rebuild the app

Or merge changes from the main branch which has production configuration.

## Demo Data Timeline

Appointments span **July 1 - October 31, 2026**:
- **July**: Sparse appointments, 6 different clients
- **August**: More frequent, 10 clients total
- **September**: Dense schedule, 13 clients
- **October**: Peak activity, 16 clients

This creates realistic month-over-month growth for statistics.

## Notes

- All data is stored in memory and resets when the app restarts
- Network delays are simulated (300ms) for realistic UX
- Mock data exactly matches the Web reza-pro demo data
- Images are loaded from external CDNs (randomuser.me, unsplash.com)
- Multi-salon support is simulated (1 salon, limit of 3)
- Subscription is active and valid until December 2026

## Development

This demo mode is perfect for:
- UI/UX iterations
- Salon owner demonstrations
- Offline development
- Feature showcases
- Training sessions
- APK distributions without backend setup
