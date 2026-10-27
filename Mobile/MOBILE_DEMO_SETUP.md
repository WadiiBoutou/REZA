# REZA Mobile Apps - Demo Mode Implementation

This document describes the complete mock data setup for both REZA mobile applications.

## Overview

Both mobile apps now have **full frontend mock data** implementations that work identically to the Web applications' demo mode. No backend server is required.

## 📱 Applications

### 1. REZA Pro Mobile (`reza_pro_mobile`)
Professional salon management app for staff/owners.

**Demo Account:**
- Email: `demo.pro@reza.ma`
- Password: `demo1234`

**Mock Data Includes:**
- 1 salon (Atelier Noor - Casablanca)
- 6 services across 4 categories
- 4 employees with color-coded agendas
- 150 appointments (July-October 2026)
- 16 clients with full history
- 36 reviews (approved/pending/rejected)
- Invoices with payment tracking
- Statistics and reporting data
- Active subscription (until Dec 2026)

### 2. REZA Client Mobile (`reza_client_mobile`)
Client-facing booking app for end users.

**Demo Account:**
- Email: `demo.client@reza.ma`
- Password: `demo1234`

**Mock Data Includes:**
- 8 salons across Morocco
- 7 services (haircuts, treatments, etc.)
- 4 staff members
- 34 appointments (various statuses)
- 28 reviews
- Favorites and family members
- Full booking flow

## 🏗️ Implementation Structure

Each app has these new files:

```
lib/
├── config/
│   └── demo_config.dart          # Enable/disable demo mode
├── data/
│   ├── demo_api_data.dart        # Mock data generation
│   └── demo_images.dart          # Image URLs (avatars, photos)
└── services/
    ├── api_client.dart           # Modified to route to demo API
    └── demo_api_client.dart      # Mock API request handler
```

## 🔧 How It Works

1. **Demo mode is enabled** by default in `demo_config.dart`
2. **ApiClient checks demo mode** before each request
3. **Requests are intercepted** and routed to `DemoApiClient`
4. **Mock data is returned** from in-memory stores
5. **CRUD operations** update in-memory data (persists during session)

## 📦 Building APKs

### For Pro Mobile App

```powershell
# Navigate to pro mobile directory
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_pro_mobile

# Debug APK (for testing)
flutter build apk --debug

# Release APK (for distribution)
flutter build apk --release

# Android App Bundle (Play Store)
flutter build appbundle --release
```

**Output locations:**
- Debug: `build/app/outputs/flutter-apk/app-debug.apk`
- Release: `build/app/outputs/flutter-apk/app-release.apk`
- Bundle: `build/app/outputs/bundle/release/app-release.aab`

### For Client Mobile App

```powershell
# Navigate to client mobile directory
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_client_mobile

# Debug APK (for testing)
flutter build apk --debug

# Release APK (for distribution)
flutter build apk --release

# Android App Bundle (Play Store)
flutter build appbundle --release
```

**Output locations:**
- Debug: `build/app/outputs/flutter-apk/app-debug.apk`
- Release: `build/app/outputs/flutter-apk/app-release.apk`
- Bundle: `build/app/outputs/bundle/release/app-release.aab`

### For iOS (requires macOS with Xcode)

```bash
# Pro app
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_pro_mobile
flutter build ipa --release

# Client app
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_client_mobile
flutter build ipa --release
```

## 🎯 Demo Accounts Summary

| App | Email | Password | Purpose |
|-----|-------|----------|---------|
| **Pro Mobile** | demo.pro@reza.ma | demo1234 | Salon staff/admin |
| **Client Mobile** | demo.client@reza.ma | demo1234 | End user/client |

## ✨ Features

### Pro Mobile Features
✅ Complete appointment management (create, edit, delete, drag-drop)  
✅ Client directory with search and filtering  
✅ Service catalog management  
✅ Employee/staff management  
✅ Review moderation (approve/reject)  
✅ Invoice generation and tracking  
✅ Statistics dashboard  
✅ Subscription management  
✅ Agenda with multi-employee views  
✅ Cash transactions  

### Client Mobile Features
✅ Salon discovery and search  
✅ Service browsing with prices/duration  
✅ Available slots booking  
✅ Appointment management (view, cancel)  
✅ Review submission and editing  
✅ Favorites management  
✅ Family members (booking for others)  
✅ Profile management  
✅ Notifications  

## 🔄 Switching to Production Mode

To connect to the real backend:

1. **Edit demo config**:
   ```dart
   // lib/config/demo_config.dart
   class DemoConfig {
     static const bool isDemoMode = false;  // Set to false
   }
   ```

2. **Rebuild the app**:
   ```bash
   flutter clean
   flutter pub get
   flutter build apk --release
   ```

3. **Ensure backend is running** at `http://127.0.0.1:5000/api`

## 📊 Mock Data Details

### Pro Mobile Mock Data

**Timeline**: July 1 - October 31, 2026
- **July**: 23 appointments, 6 clients (new business starting)
- **August**: 36 appointments, 10 clients (growth phase)
- **September**: 43 appointments, 13 clients (established)
- **October**: 48 appointments, 16 clients (peak season)

This creates realistic month-over-month growth for statistics.

**Services**:
1. Coupe & brushing (60 min, 280 MAD)
2. Coloration signature (120 min, 650 MAD)
3. Soin visage éclat (75 min, 420 MAD)
4. Manucure soin (45 min, 180 MAD)
5. Massage relaxant (60 min, 500 MAD)
6. Balayage lumière (150 min, 900 MAD)

**Employees**:
1. Salma Bennani (Coiffeuse) - #d77c65
2. Youssef Amrani (Barbier) - #537f78
3. Lina Idrissi (Esthéticienne) - #bd9a52
4. Meryem Alaoui (Prothésiste ongulaire) - #7c7892

### Client Mobile Mock Data

**8 Salons**:
1. Atelier Noor (Casablanca - Institut de beauté)
2. Maison Safran (Rabat - Coiffeur)
3. Studio Sable (Marrakech - Barbier)
4. Ligne Claire (Tanger - Manucure)
5. Dar Glow (Fès - Institut de beauté)
6. Le Petit Fauteuil (Agadir - Barbier)
7. Miroir Moderne (Meknès - Coiffeur)
8. Nacre Studio (Casablanca - Manucure)

**34 Appointments** distributed across:
- Past completed appointments
- Upcoming confirmed bookings
- Pending requests
- Some cancelled appointments

## 🎨 Images & Assets

All images are loaded from CDNs:
- **Employee/Client Photos**: randomuser.me portraits
- **Salon Photos**: Unsplash (beauty/salon themed)

No local image assets required - works with internet connection for images.

## 🚀 Quick Start Commands

### Pro Mobile Demo APK
```powershell
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_pro_mobile ; flutter build apk --release
```

### Client Mobile Demo APK
```powershell
cd c:\Users\wadii\Desktop\t\REZA\Mobile\reza_client_mobile ; flutter build apk --release
```

## 📝 Notes

- **Data Persistence**: In-memory only, resets on app restart
- **Network Simulation**: 300ms delay for realistic UX
- **Exact Parity**: Mock data matches Web demo 1:1
- **No Backend Required**: Completely standalone
- **Branch Strategy**: Demo code on "demo" branch (recommended)
- **Internet Required**: Only for loading CDN images

## 🐛 Troubleshooting

**Issue**: App won't build
- Run: `flutter clean && flutter pub get`
- Check Flutter version: `flutter doctor`

**Issue**: Demo mode not working
- Verify `demo_config.dart` has `isDemoMode = true`
- Check imports in `api_client.dart`

**Issue**: Images not loading
- Ensure device has internet connection
- CDN images (randomuser.me, unsplash.com) must be accessible

## ✅ Testing Checklist

### Pro Mobile
- [ ] Login with demo.pro@reza.ma
- [ ] View appointment calendar
- [ ] Create new appointment
- [ ] Edit client information
- [ ] Moderate reviews
- [ ] Check statistics dashboard

### Client Mobile
- [ ] Login with demo.client@reza.ma
- [ ] Browse salons
- [ ] View salon details
- [ ] Book appointment
- [ ] View my appointments
- [ ] Leave a review
- [ ] Add to favorites

---

**Implementation Date**: 2025  
**Matching Web Version**: Web reza-pro & reza-client demo branches  
**Mock Data Source**: Identical to Web implementation
