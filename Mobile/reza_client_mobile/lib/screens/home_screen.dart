import 'dart:math';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants.dart';
import 'package:provider/provider.dart';
import '../models/venue_mapper.dart';
import '../viewmodels/home_viewmodel.dart';
import '../widgets/geo_prompt_banner.dart';
import '../widgets/reza_bottom_nav.dart';
import 'search_results_screen.dart';
import 'venue_detail_screen.dart';
import 'bookings_screen.dart';
import 'proches_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) {
        final vm = HomeViewModel();
        vm.loadTenants();
        vm.initGeoPrompt();
        return vm;
      },
      child: const _HomeScreenBody(),
    );
  }
}

/// Renders a venue's cover photo — REAL salon image only. When the salon
/// hasn't uploaded anything (or the URL fails), a neutral placeholder is shown
/// instead of stock imagery.
class _VenueCardImage extends StatelessWidget {
  final String image;
  final double height;
  const _VenueCardImage({required this.image, required this.height});

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      height: height,
      width: double.infinity,
      color: AppColors.surface,
      child: const Icon(Icons.image_rounded, color: AppColors.textLight, size: 40),
    );
    if (!image.startsWith('http')) return placeholder;
    return Image.network(
      image,
      height: height,
      width: double.infinity,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => placeholder,
    );
  }
}

class _HomeScreenBody extends StatefulWidget {
  const _HomeScreenBody();

  @override
  State<_HomeScreenBody> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<_HomeScreenBody> {
  int _navIndex = 0;

  HomeViewModel get _vm => context.watch<HomeViewModel>();

  Future<void> _loadTenants({List<String>? categories}) =>
      context.read<HomeViewModel>().loadTenants(categories: categories);

  List<VenueItem> get _filteredVenues => _vm.filteredVenues;

  String get _searchCityLabel => _vm.searchCityLabel;

  bool _isCategorySelected(String label) => _vm.selectedCategories.contains(label);

  String get _searchCategory => _vm.searchCategory;

  bool get _loading => _vm.loading;
  String? get _error => _vm.error;

  void _openVenue(VenueItem venue) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => VenueDetailScreen(
          tenantId: venue.id,
          onGoToBookings: () => setState(() => _navIndex = 2),
        ),
      ),
    );
  }

  void _showCategoryPicker() async {
    final categories = ['Tous', ...serviceCategories.map((c) => c['label'] as String)];
    final vm = context.read<HomeViewModel>();
    final Set<String> before = Set<String>.from(vm.selectedCategories);
    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return SafeArea(
              child: SizedBox(
                height: MediaQuery.of(ctx).size.height * 0.75,
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                      child: Row(
                        children: [
                          Text(
                            'Catégories',
                            style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700),
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () => Navigator.pop(ctx),
                            child: Text(
                              'OK',
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(0, 4, 0, 12),
                        itemCount: categories.length,
                        itemBuilder: (context, index) {
                          final label = categories[index];
                          final isAll = label == 'Tous';
                          bool isSelected = isAll
                              ? vm.selectedCategories.isEmpty
                              : vm.selectedCategories.contains(label);
                          return ListTile(
                            title: Text(label, style: GoogleFonts.inter(fontSize: 16)),
                            trailing: isSelected
                                ? const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 20)
                                : const Icon(Icons.circle_outlined, color: AppColors.border, size: 20),
                            onTap: () {
                              if (isAll) {
                                vm.clearCategories();
                              } else {
                                vm.toggleCategory(label);
                              }
                              setSheetState(() {});
                            },
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
    final changed = before.length != vm.selectedCategories.length ||
        before.any((c) => !vm.selectedCategories.contains(c));
    if (changed) {
      vm.loadTenants();
    }
  }

  void _showCityPicker() {
    final cities = ['Toutes les villes', 'Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Agadir'];
    // Capture the VM from the State's context (under the provider) BEFORE opening
    // the bottom sheet — the builder's context lives in a new route that cannot
    // see the provider and would throw ProviderNotFoundException.
    final vm = context.read<HomeViewModel>();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetContext) {
        return ListView.builder(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 20),
          itemCount: cities.length,
          itemBuilder: (context, index) {
            return ListTile(
              leading: const Icon(Icons.location_on_outlined, color: AppColors.textGray),
              title: Text(cities[index], style: GoogleFonts.inter(fontSize: 16)),
              onTap: () {
                final label = cities[index];
                vm.setSearchCity(label == 'Toutes les villes' ? '' : label);
                Navigator.pop(sheetContext);
                vm.loadTenants();
              },
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: IndexedStack(
        index: _navIndex,
        children: [
          _buildHomeBody(),
          SearchResultsScreen(onGoToBookings: () => setState(() => _navIndex = 2)),
          BookingsScreen(navIndex: _navIndex),
          ProchesScreen(onExplore: () => setState(() => _navIndex = 1)),
          const ProfileScreen(),
        ],
      ),
      bottomNavigationBar: RezaBottomNav(
        currentIndex: _navIndex,
        onTap: (i) => setState(() => _navIndex = i),
      ),
    );
  }

  Widget _buildHomeBody() {
    final list = _filteredVenues;
    // Nearest first — GPS actif : l'API trie déjà par distance, ce tri local est un filet de sécurité.
    final nearest = [...list]..sort((a, b) => _distanceKm(a).compareTo(_distanceKm(b)));
    // Recommandés = les mieux notés (le plus d'avis), dans un rayon de 10 km (appliqué côté API quand GPS actif).
    final recommended = [...nearest]..sort((a, b) => b.reviews.compareTo(a.reviews));
    final recTop = recommended.take(3).toList();
    // Récemment consulté — sans reprendre les salons déjà affichés dans Recommandés.
    var recent = list.where((v) => !recTop.contains(v)).take(2).toList();
    if (recent.isEmpty && list.isNotEmpty) recent = list.take(2).toList();
    // Salons à proximité — les plus proches en premier (sans reprendre ceux déjà affichés).
    final shownIds = {...recTop.map((v) => v.id), ...recent.map((v) => v.id)};
    var nearby = nearest.where((v) => !shownIds.contains(v.id)).take(2).toList();
    if (nearby.isEmpty && nearest.isNotEmpty) nearby = nearest.take(2).toList();

    return RefreshIndicator(
      onRefresh: () async {
        final vm = context.read<HomeViewModel>();
        if (vm.hasUserLocation) {
          await vm.requestUserLocation();
        } else {
          await vm.loadTenants();
        }
      },
      color: AppColors.primary,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
        SliverToBoxAdapter(
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Center(
                child: Text(
                  'REZA',
                  style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 4),
                ),
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              SizedBox(
                height: 280,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.network(
                      'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop',
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => Container(
                        color: Colors.grey[800],
                        child: const Icon(Icons.image_not_supported, color: Colors.white30, size: 50),
                      ),
                    ),
                    Container(color: Colors.black.withValues(alpha: 0.3)),
                  ],
                ),
              ),
              Positioned(
                bottom: -40,
                left: 20,
                right: 20,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 20, offset: const Offset(0, 10)),
                    ],
                  ),
                  child: Column(
                    children: [
                      GestureDetector(
                        onTap: _showCategoryPicker,
                        child: Container(
                          height: 50,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.search_rounded, color: AppColors.textGray, size: 20),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  _searchCategory,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.inter(
                                    color: _searchCategory.startsWith('Prestations') ? AppColors.textGray : AppColors.textDark,
                                    fontSize: 14,
                                    fontWeight: _searchCategory.startsWith('Prestations') ? FontWeight.w400 : FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      GestureDetector(
                        onTap: _showCityPicker,
                        child: Container(
                          height: 50,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.location_on_outlined, color: AppColors.textGray, size: 20),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  _searchCityLabel,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.inter(color: AppColors.textDark, fontSize: 14, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton.icon(
                          onPressed: () => setState(() => _navIndex = 1),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          icon: const Icon(Icons.search_rounded, size: 20),
                          label: Text('Rechercher', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 60),
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                ),
              if (_error != null && !_loading)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text(
                    'Impossible de charger les salons. Vérifiez la connexion API.',
                    style: GoogleFonts.inter(fontSize: 12, color: AppColors.textLight),
                  ),
                ),
              if (!_loading && _error == null && list.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Text(
                    'Aucun salon trouvé. Essayez une autre ville ou élargissez la recherche.',
                    style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
                  ),
                ),
              if ((_vm.showGeoPrompt == true || _vm.geoError != null) && !_vm.hasUserLocation)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  child: GeoPromptBanner(
                    loading: _vm.geoLoading,
                    error: _vm.geoError,
                    onUseLocation: () => context.read<HomeViewModel>().requestUserLocation(),
                    onDismiss: () => context.read<HomeViewModel>().dismissGeoPrompt(),
                  ),
                ),
              SizedBox(
                height: 115,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: serviceCategories.length,
                  itemBuilder: (context, index) {
                    final cat = serviceCategories[index];
                    final label = cat['label'] as String;
                    final selected = _isCategorySelected(label);
                    return GestureDetector(
                      onTap: () {
                        context.read<HomeViewModel>().toggleCategory(label);
                        _loadTenants();
                      },
                      child: Container(
                        margin: const EdgeInsets.only(right: 16),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: selected ? AppColors.textDark : const Color(0xFFF5F5F7),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Icon(
                                cat['icon'] as IconData,
                                size: 26,
                                color: selected ? Colors.white : const Color(0xFF1D1D1F),
                              ),
                            ),
                            const SizedBox(height: 6),
                            SizedBox(
                              width: 64,
                              child: Text(
                                label,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: const Color(0xFF1D1D1F),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 28),
              _buildSectionHeader('Recommandés', 'Voir tout'),
              const SizedBox(height: 14),
              SizedBox(
                height: 250,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: recTop.length,
                  itemBuilder: (context, index) => _buildRecommandeCard(recTop[index]),
                ),
              ),
              const SizedBox(height: 28),
              _buildSectionHeader('Récemment consulté', 'Voir tout'),
              const SizedBox(height: 14),
              SizedBox(
                height: 270,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: recent.length,
                  itemBuilder: (context, index) => _buildRecemmentConsulteCard(recent[index]),
                ),
              ),
              const SizedBox(height: 28),
              _buildSectionHeader('Salons à proximité', 'Voir tout'),
              const SizedBox(height: 14),
              SizedBox(
                height: 230,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: nearby.length.clamp(0, 2),
                  itemBuilder: (context, index) => _buildNearbyCard(nearby[index]),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ],
    ),
  );
}

  Widget _buildSectionHeader(String title, String action) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textDark)),
          GestureDetector(
            onTap: () => setState(() => _navIndex = 1),
            child: Text(action, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textGray)),
          ),
        ],
      ),
    );
  }

  Widget _buildRecommandeCard(VenueItem venue) {
    return GestureDetector(
      onTap: () => _openVenue(venue),
      child: Container(
        width: 260,
        margin: const EdgeInsets.only(right: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: _VenueCardImage(image: venue.image, height: 150),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(venue.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                ),
                Row(
                  children: [
                    const Icon(Icons.star_rounded, size: 14, color: AppColors.starColor),
                    const SizedBox(width: 2),
                    Text(venue.rating.toStringAsFixed(1).replaceAll('.', ','),
                        style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              _metaLine(venue),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecemmentConsulteCard(VenueItem venue) {
    return GestureDetector(
      onTap: () => _openVenue(venue),
      child: Container(
        width: 260,
        margin: const EdgeInsets.only(right: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: _VenueCardImage(image: venue.image, height: 150),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(venue.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                ),
                Row(
                  children: [
                    const Icon(Icons.star_rounded, size: 14, color: AppColors.starColor),
                    const SizedBox(width: 2),
                    Text(venue.rating.toStringAsFixed(1).replaceAll('.', ','),
                        style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text('${venue.category} · ${venue.reviews} avis', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray)),
            const SizedBox(height: 2),
            Text(
              _metaLine(venue),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNearbyCard(VenueItem venue) {
    return GestureDetector(
      onTap: () => _openVenue(venue),
      child: Container(
        width: 240,
        margin: const EdgeInsets.only(right: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: _VenueCardImage(image: venue.image, height: 140),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(venue.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                ),
                Row(
                  children: [
                    const Icon(Icons.star_rounded, size: 14, color: AppColors.starColor),
                    const SizedBox(width: 2),
                    Text(venue.rating.toStringAsFixed(1).replaceAll('.', ','),
                        style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              _metaLine(venue),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray),
            ),
          ],
        ),
      ),
    );
  }

  /// Real km from the user's GPS position (haversine — same calc as the search
  /// screen) when the user shared location and the salon has real coordinates.
  /// Falls back to the API's '1.2 km' string; empty/unparseable → infinity
  /// (sorts last, so no-coords salons never pretend to be "à proximité").
  double _distanceKm(VenueItem v) {
    final vm = _vm;
    if (vm.hasUserLocation && v.hasCoordinates) {
      final lat = vm.userLat!;
      final lng = vm.userLng!;
      const r = 6371.0;
      final dLat = (v.latitude - lat) * pi / 180;
      final dLng = (v.longitude - lng) * pi / 180;
      final a = sin(dLat / 2) * sin(dLat / 2) +
          cos(lat * pi / 180) * cos(v.latitude * pi / 180) * sin(dLng / 2) * sin(dLng / 2);
      return r * 2 * atan2(sqrt(a), sqrt(1 - a));
    }
    final m = RegExp(r'([\d.,]+)\s*km').firstMatch(v.distance);
    if (m == null) return double.infinity;
    return double.tryParse(m.group(1)!.replaceAll(',', '.')) ?? double.infinity;
  }

  /// Meta line with a REAL distance when GPS is on: computed locally from the
  /// user's position (covers fallback queries where the API string is missing).
  /// Otherwise the API's '1.2 km · Casablanca', then just the location.
  String _metaLine(VenueItem venue) {
    if (_vm.hasUserLocation && venue.hasCoordinates) {
      final km = _distanceKm(venue);
      if (km.isFinite) {
        final s = km.toStringAsFixed(1).replaceAll('.', ',');
        return '$s km · ${venue.location}';
      }
    }
    return venueMetaLine(venue);
  }
}
