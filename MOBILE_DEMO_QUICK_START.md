# 📱 REZA Mobile - Demo Mode Quick Start

## Demo Accounts

### Pro Mobile App (Salon Staff)
- **Email**: `demo.pro@reza.ma`
- **Password**: `demo1234`

### Client Mobile App (End User)
- **Email**: `demo.client@reza.ma`
- **Password**: `demo1234`

---

## 🚀 Generate APKs (No Backend Required!)

### Pro Mobile APK
```powershell
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_pro_mobile
flutter build apk --release
```
**Output**: `build/app/outputs/flutter-apk/app-release.apk`

### Client Mobile APK
```powershell
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_client_mobile
flutter build apk --release
```
**Output**: `build/app/outputs/flutter-apk/app-release.apk`

---

## 📦 What's Included

### ✅ Pro Mobile (demo.pro@reza.ma)
- 1 salon with full configuration
- 150 appointments (July-October 2026)
- 16 clients with history
- 6 services across 4 categories
- 4 employees with agendas
- 36 reviews for moderation
- Invoice management
- Statistics dashboard

### ✅ Client Mobile (demo.client@reza.ma)
- 8 salons to discover
- 34 appointments (past & upcoming)
- 28 reviews
- Booking system with available slots
- Favorites management
- Profile management

---

## 🔧 Implementation Files

Each mobile app now has:
```
lib/
├── config/demo_config.dart       # Demo mode ON/OFF
├── data/
│   ├── demo_api_data.dart        # Mock data
│   └── demo_images.dart          # Image URLs
└── services/
    ├── api_client.dart           # Routes to demo API
    └── demo_api_client.dart      # Handles mock requests
```

---

## 📖 Full Documentation

- **Pro Mobile**: `Mobile/reza_pro_mobile/DEMO_MODE.md`
- **Client Mobile**: `Mobile/reza_client_mobile/DEMO_MODE.md`
- **Complete Guide**: `Mobile/MOBILE_DEMO_SETUP.md`

---

## 💡 Key Features

✨ **Fully Offline** - No backend server needed  
✨ **Identical to Web Demo** - Same mock data as web apps  
✨ **Production Ready** - Generate APKs for distribution  
✨ **Easy Toggle** - Switch to real backend with one flag  
✨ **In-Memory CRUD** - Create, edit, delete data during session  
✨ **Realistic Data** - 150+ appointments with proper distribution  

---

**Note**: Demo mode is enabled by default in the demo branch. All data resets when app restarts.
