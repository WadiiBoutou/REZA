import 'package:flutter/foundation.dart';
import '../constants.dart';
import '../models/venue_mapper.dart';
import '../services/discovery_service.dart';
import '../services/location_service.dart';

class HomeViewModel extends ChangeNotifier {
  /// Search-bar label — derived from the selected categories (multi-select).
  /// Empty = no city filter (show all complete salons).
  String searchCity = '';
  /// Categories currently selected on the carousel (multi-select).
  /// Empty = show all salons (no category filter).
  final Set<String> selectedCategories = {};
  List<VenueItem> venues = [];
  bool loading = true;
  String? error;

  double? userLat;
  double? userLng;
  bool geoLoading = false;
  String? geoError;
  /// null = undecided, true = show banner, false = dismissed this session
  bool? showGeoPrompt;

  bool get hasUserLocation => userLat != null && userLng != null;

  String get searchCityLabel =>
      searchCity.isEmpty ? 'Toutes les villes' : searchCity;

  Future<void> initGeoPrompt() async {
    if (await locationService.wasGrantedBefore()) {
      await requestUserLocation();
      return;
    }
    if (await locationService.wasPromptDismissed()) {
      // Previously dismissed — don't nag on open; the user can enable GPS via
      // the marker button or by tapping "Plus proche" in search.
      showGeoPrompt = false;
      notifyListeners();
      return;
    }
    // First open: ask the OS directly — the system dialog offers
    // "while using the app / only this time / don't allow". On denial the
    // banner stays visible so the user can retry.
    await requestUserLocation();
  }

  Future<void> loadTenants({List<String>? categories}) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final cats = categories ?? selectedCategories.toList();
      final city = searchCity.isNotEmpty ? searchCity : null;
      // Radius filter first when GPS on (nearby). Emulator GPS (e.g. Mountain
      // View) often yields 0 Casablanca salons — fall back to all, still sorted
      // by distance. Always use real API data — never reintroduce mock salons.
      var tenants = await discoveryService.searchTenants(
        city: city,
        categories: cats,
        lat: userLat,
        lng: userLng,
        radiusKm: hasUserLocation ? 10 : null,
        limit: 50,
      );
      if (tenants.isEmpty && hasUserLocation) {
        tenants = await discoveryService.searchTenants(
          city: city,
          categories: cats,
          lat: userLat,
          lng: userLng,
          limit: 50,
        );
      }
      venues = tenants.map(tenantToVenueItem).toList();
      loading = false;
      notifyListeners();
    } catch (e) {
      venues = [];
      loading = false;
      error = e.toString();
      notifyListeners();
    }
  }

  /// Soft GPS ask. On fail → null location, all salons, no km.
  Future<bool> requestUserLocation() async {
    geoLoading = true;
    geoError = null;
    showGeoPrompt = true;
    notifyListeners();

    final result = await locationService.requestUserLocation();
    if (result.ok && result.location != null) {
      userLat = result.location!.lat;
      userLng = result.location!.lng;
      geoError = null;
      showGeoPrompt = false;
      geoLoading = false;
      notifyListeners();
      await loadTenants();
      return true;
    }

    userLat = null;
    userLng = null;
    geoError = result.error;
    showGeoPrompt = true;
    geoLoading = false;
    notifyListeners();
    await loadTenants();
    return false;
  }

  Future<void> dismissGeoPrompt() async {
    showGeoPrompt = false;
    geoError = null;
    await locationService.markPromptDismissed();
    notifyListeners();
  }

  void setSearchCity(String v) {
    searchCity = v;
    notifyListeners();
  }


  /// Toggle a category chip on/off. Deselecting the last one → show all.
  void toggleCategory(String label) {
    if (!selectedCategories.remove(label)) {
      selectedCategories.add(label);
    }
    notifyListeners();
  }

  /// Clear all category selections (show all salons).
  void clearCategories() {
    if (selectedCategories.isEmpty) return;
    selectedCategories.clear();
    notifyListeners();
  }

  String get searchCategory {
    if (selectedCategories.isEmpty) return 'Prestations (coupe, barbier...)'; // default
    if (selectedCategories.length == 1) return selectedCategories.first;
    return '${selectedCategories.length} catégories'; // e.g. "3 catégories"
  }

  /// The backend already applies the category filter (matching both the salon's
  /// own category and its service categories), so the fetched list is final.
  List<VenueItem> get filteredVenues => venues;
}
