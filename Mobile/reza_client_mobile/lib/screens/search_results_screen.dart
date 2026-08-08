import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' hide Path;
import '../constants.dart';
import '../models/venue_mapper.dart';
import '../services/discovery_service.dart';
import '../services/location_service.dart';
import '../widgets/geo_prompt_banner.dart';
import 'venue_detail_screen.dart';

class SearchResultsScreen extends StatefulWidget {
  /// When provided, forwarded to VenueDetailScreen → BookingScreen →
  /// BookingConfirmationScreen so "Voir mes réservations" switches to Mes RDV.
  final VoidCallback? onGoToBookings;

  const SearchResultsScreen({super.key, this.onGoToBookings});

  @override
  State<SearchResultsScreen> createState() => _SearchResultsScreenState();
}

class _SearchResultsScreenState extends State<SearchResultsScreen> {
  final Set<String> _likedVenues = {};
  final List<String> _recentSearches = ['Coupes et coiffures'];
  List<VenueItem> _results = [];
  bool _loading = true;
  String? _loadError;
  String _queryLabel = 'Toutes les prestations';
  /// Empty = no city filter.
  String _city = '';
  double? _userLat;
  double? _userLng;
  bool _geoLoading = false;
  String? _geoError;
  bool? _showGeoPrompt;

  bool get _hasUserLocation => _userLat != null && _userLng != null;
  String get _cityLabel => _city.isEmpty ? 'Toutes les villes' : _city;

  @override
  void initState() {
    super.initState();
    _loadTenants();
    _initGeoPrompt();
  }

  Future<void> _initGeoPrompt() async {
    if (await locationService.wasPromptDismissed()) {
      if (!mounted) return;
      setState(() => _showGeoPrompt = false);
      return;
    }
    if (await locationService.wasGrantedBefore()) {
      await _requestUserLocation();
      return;
    }
    if (!mounted) return;
    setState(() => _showGeoPrompt = true);
  }

  Future<void> _loadTenants({String? search, String? category, String? city}) async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final cityFilter = city ?? _city;
      final cityArg = cityFilter.isNotEmpty ? cityFilter : null;
      // Nearby radius first; if empty (emulator GPS far from salons), retry
      // without radius. Always use real API data — never reintroduce mock salons.
      final cats = category != null ? [category] : null;
      var tenants = await discoveryService.searchTenants(
        search: search,
        categories: cats,
        city: cityArg,
        lat: _userLat,
        lng: _userLng,
        radiusKm: _hasUserLocation ? 10 : null,
        limit: 50,
      );
      if (tenants.isEmpty && _hasUserLocation) {
        tenants = await discoveryService.searchTenants(
          search: search,
          categories: cats,
          city: cityArg,
          lat: _userLat,
          lng: _userLng,
          limit: 50,
        );
      }
      final mapped = tenants.map(tenantToVenueItem).toList();
      if (!mounted) return;
      setState(() {
        _results = mapped;
        _loading = false;
        if (city != null) _city = city;
        if (search != null && search.isNotEmpty) {
          _queryLabel = search;
          if (!_recentSearches.contains(search)) {
            _recentSearches.insert(0, search);
          }
        } else if (category != null && category.isNotEmpty) {
          _queryLabel = category;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _results = [];
        _loading = false;
        _loadError = e.toString();
      });
    }
  }

  Future<void> _requestUserLocation() async {
    setState(() {
      _geoLoading = true;
      _geoError = null;
      _showGeoPrompt = true;
    });
    final result = await locationService.requestUserLocation();
    if (!mounted) return;
    if (result.ok && result.location != null) {
      setState(() {
        _userLat = result.location!.lat;
        _userLng = result.location!.lng;
        _geoError = null;
        _showGeoPrompt = false;
        _geoLoading = false;
      });
      await _loadTenants();
      return;
    }
    setState(() {
      _userLat = null;
      _userLng = null;
      _geoError = result.error;
      _showGeoPrompt = true;
      _geoLoading = false;
    });
    await _loadTenants();
  }

  Future<void> _dismissGeoPrompt() async {
    await locationService.markPromptDismissed();
    if (!mounted) return;
    setState(() {
      _showGeoPrompt = false;
      _geoError = null;
    });
  }

  void _showSearchModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _SearchModal(
        recentSearches: _recentSearches,
        cityHint: _cityLabel,
        onClearRecent: () => setState(() => _recentSearches.clear()),
        onSearch: (query, category, {String? city}) {
          Navigator.pop(context);
          _loadTenants(search: query, category: category, city: city);
        },
        onUseMyLocation: () {
          Navigator.pop(context);
          _requestUserLocation();
        },
      ),
    );
  }

  void _toggleLike(String id) {
    setState(() {
      if (_likedVenues.contains(id)) {
        _likedVenues.remove(id);
      } else {
        _likedVenues.add(id);
      }
    });
  }

  void _openVenue(VenueItem venue) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => VenueDetailScreen(
          tenantId: venue.id,
          onGoToBookings: widget.onGoToBookings,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final results = _results;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Stack(
        children: [
          Positioned.fill(
            child: FlutterMap(
              options: MapOptions(
                initialCenter: results.isNotEmpty
                    ? LatLng(results.first.latitude, results.first.longitude)
                    : const LatLng(33.589, -7.603),
                initialZoom: 13.0,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.example.mobile_app',
                ),
                MarkerLayer(
                  markers: results.map((venue) {
                    return Marker(
                      point: LatLng(venue.latitude, venue.longitude),
                      width: 60,
                      height: 50,
                      alignment: Alignment.topCenter,
                      child: GestureDetector(
                        onTap: () => _openVenue(venue),
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.textDark,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: [
                                  BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 4, offset: const Offset(0, 2)),
                                ],
                              ),
                              child: Text(
                                venue.rating.toStringAsFixed(1).replaceAll('.', ','),
                                style: GoogleFonts.inter(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                              ),
                            ),
                            CustomPaint(
                              size: const Size(10, 6),
                              painter: _TrianglePainter(color: AppColors.textDark),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 20,
            right: 20,
            child: GestureDetector(
              onTap: _showSearchModal,
              child: Container(
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10, offset: const Offset(0, 4)),
                  ],
                ),
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    const Icon(Icons.search_rounded, color: AppColors.textDark, size: 24),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _queryLabel,
                            style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textDark),
                          ),
                          Text(
                            _cityLabel,
                            style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray),
                          ),
                        ],
                      ),
                    ),
                    if (_loading)
                      const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                      )
                    else
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.border),
                        ),
                        child: const Icon(Icons.format_list_bulleted_rounded, color: AppColors.textDark, size: 18),
                      ),
                  ],
                ),
              ),
            ),
          ),
          DraggableScrollableSheet(
            initialChildSize: 0.45,
            minChildSize: 0.15,
            maxChildSize: 0.9,
            builder: (context, scrollController) {
              return Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  boxShadow: [
                    BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, -2)),
                  ],
                ),
                child: CustomScrollView(
                  controller: scrollController,
                  slivers: [
                    SliverToBoxAdapter(
                      child: Column(
                        children: [
                          const SizedBox(height: 12),
                          Center(
                            child: Container(
                              width: 40,
                              height: 4,
                              decoration: BoxDecoration(
                                color: AppColors.border,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: AppColors.border),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.tune_rounded, size: 18, color: AppColors.textDark),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: AppColors.border),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Row(
                                    children: [
                                      Text('Établissements', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500)),
                                      const SizedBox(width: 4),
                                      const Icon(Icons.keyboard_arrow_down_rounded, size: 16),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: AppColors.border),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Row(
                                    children: [
                                      Text('Meilleure correspondance', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500)),
                                      const SizedBox(width: 4),
                                      const Icon(Icons.keyboard_arrow_down_rounded, size: 16),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          if ((_showGeoPrompt == true || _geoError != null) && !_hasUserLocation)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                              child: GeoPromptBanner(
                                loading: _geoLoading,
                                error: _geoError,
                                onUseLocation: _requestUserLocation,
                                onDismiss: _dismissGeoPrompt,
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: Row(
                              children: [
                                Text(
                                  _hasUserLocation
                                      ? '${results.length} établissements à proximité'
                                      : '${results.length} établissements',
                                  style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray, fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),
                          ),
                          if (!_loading && results.isEmpty)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                              child: Text(
                                _loadError ??
                                    'Aucun salon trouvé. Essayez une autre ville ou élargissez la recherche.',
                                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
                              ),
                            ),
                          const SizedBox(height: 16),
                        ],
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final venue = results[index];
                            return _VenueCard(
                              venue: venue,
                              isLiked: _likedVenues.contains(venue.id),
                              onLike: () => _toggleLike(venue.id),
                              onTap: () => _openVenue(venue),
                            );
                          },
                          childCount: results.length,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _TrianglePainter extends CustomPainter {
  final Color color;
  _TrianglePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final path = Path();
    path.moveTo(0, 0);
    path.lineTo(size.width, 0);
    path.lineTo(size.width / 2, size.height);
    path.close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _VenueCard extends StatelessWidget {
  final VenueItem venue;
  final bool isLiked;
  final VoidCallback onLike;
  final VoidCallback onTap;

  const _VenueCard({
    required this.venue,
    required this.isLiked,
    required this.onLike,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    venue.image,
                    height: 200,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 200,
                      color: AppColors.surface,
                      child: const Icon(Icons.image_rounded, color: AppColors.textLight, size: 48),
                    ),
                  ),
                ),
                Positioned(
                  top: 12,
                  right: 12,
                  child: GestureDetector(
                    onTap: onLike,
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 6)],
                      ),
                      child: Icon(
                        isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        size: 18,
                        color: isLiked ? const Color(0xFFEF4444) : AppColors.textGray,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    venue.name,
                    style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textDark),
                  ),
                ),
                Row(
                  children: [
                    const Icon(Icons.star_rounded, size: 16, color: AppColors.starColor),
                    const SizedBox(width: 4),
                    Text(venue.rating.toStringAsFixed(1).replaceAll('.', ','), style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              venueMetaLine(venue),
              style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
            ),
            const SizedBox(height: 4),
            Text(
              '${venue.category} · ${venue.reviews} avis',
              style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchModal extends StatefulWidget {
  final List<String> recentSearches;
  final String cityHint;
  final VoidCallback onClearRecent;
  final void Function(String? query, String? category, {String? city}) onSearch;
  final VoidCallback onUseMyLocation;

  const _SearchModal({
    required this.recentSearches,
    required this.cityHint,
    required this.onClearRecent,
    required this.onSearch,
    required this.onUseMyLocation,
  });

  @override
  State<_SearchModal> createState() => _SearchModalState();
}

class _SearchModalState extends State<_SearchModal> {
  final _queryController = TextEditingController();
  final _cityController = TextEditingController();

  static const _popularCategories = [
    {'icon': Icons.apps_rounded, 'label': 'Toutes les prestations'},
    {'icon': Icons.content_cut, 'label': 'Coupes et coiffures'},
    {'icon': Icons.spa_outlined, 'label': 'Salons de manucure'},
    {'icon': Icons.remove_red_eye_outlined, 'label': 'Sourcils et cils'},
    {'icon': Icons.dry_cleaning_outlined, 'label': 'Épilations'},
    {'icon': Icons.self_improvement, 'label': 'Massages'},
  ];

  @override
  void initState() {
    super.initState();
    if (widget.cityHint != 'Toutes les villes') {
      _cityController.text = widget.cityHint;
    }
  }

  @override
  void dispose() {
    _queryController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  void _submit({String? category}) {
    final city = _cityController.text.trim();
    widget.onSearch(
      _queryController.text.trim().isEmpty ? null : _queryController.text.trim(),
      category,
      city: city,
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 16, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Rechercher', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700)),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded, size: 24),
                    splashRadius: 20,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  Container(
                    height: 52,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.search_rounded, size: 20, color: AppColors.textGray),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: _queryController,
                            decoration: InputDecoration(
                              border: InputBorder.none,
                              hintText: "N'importe quels soins, établissements ...",
                              hintStyle: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
                            ),
                            style: GoogleFonts.inter(fontSize: 14, color: AppColors.textDark),
                            onSubmitted: (_) => _submit(),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    height: 52,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 20, color: AppColors.textGray),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _cityController,
                            decoration: InputDecoration(
                              border: InputBorder.none,
                              hintText: 'Ville (optionnel)',
                              hintStyle: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
                            ),
                            style: GoogleFonts.inter(fontSize: 14, color: AppColors.textDark),
                            onSubmitted: (_) => _submit(),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Utiliser ma position',
                          onPressed: widget.onUseMyLocation,
                          icon: const Icon(Icons.my_location_rounded, size: 20, color: AppColors.primary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  const _InputRow(icon: Icons.calendar_today_outlined, placeholder: 'À tout moment'),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                children: [
                  if (widget.recentSearches.isNotEmpty) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Récent', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700)),
                        GestureDetector(
                          onTap: () {
                            widget.onClearRecent();
                            Navigator.pop(context);
                          },
                          child: Text('Effacer', style: GoogleFonts.inter(fontSize: 14, color: AppColors.primary, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ...widget.recentSearches.map((s) => GestureDetector(
                          onTap: () => widget.onSearch(s, null, city: _cityController.text.trim()),
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(Icons.search_rounded, size: 18, color: AppColors.textGray),
                                ),
                                const SizedBox(width: 14),
                                Text(s, style: GoogleFonts.inter(fontSize: 15, color: AppColors.textDark)),
                              ],
                            ),
                          ),
                        )),
                    const SizedBox(height: 20),
                  ],
                  Text('Catégories les plus populaires', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 2.6,
                    ),
                    itemCount: _popularCategories.length,
                    itemBuilder: (context, index) {
                      final cat = _popularCategories[index];
                      final label = cat['label'] as String;
                      return GestureDetector(
                        onTap: () {
                          if (label.startsWith('Toutes')) {
                            _submit();
                          } else {
                            _submit(category: label);
                          }
                        },
                        child: Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFFF5F5F7),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Row(
                            children: [
                              Icon(cat['icon'] as IconData, size: 22, color: AppColors.textDark),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  label,
                                  maxLines: 2,
                                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textDark),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).padding.bottom + 16),
              child: SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: () => _submit(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.textDark,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                  ),
                  child: Text('Rechercher', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _InputRow extends StatelessWidget {
  final IconData icon;
  final String placeholder;
  const _InputRow({required this.icon, required this.placeholder});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.textGray),
          const SizedBox(width: 12),
          Text(placeholder, style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray)),
        ],
      ),
    );
  }
}
