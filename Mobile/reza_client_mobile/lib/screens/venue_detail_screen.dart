import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' hide Path;
import 'package:provider/provider.dart';
import '../constants.dart';
import '../models/venue_mapper.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../services/account_service.dart';
import '../services/api_client.dart';
import '../services/discovery_service.dart';
import 'booking_summary_screen.dart';
import 'login_screen.dart';

class VenueDetailScreen extends StatefulWidget {
  final String tenantId;
  /// When provided, forwarded through BookingSummaryScreen → BookingConfirmationScreen
  /// so "Voir mes réservations" navigates to the Mes RDV tab.
  final VoidCallback? onGoToBookings;
  /// When true, automatically opens the group booking flow on mount
  /// (used when adding another person to an existing group booking).
  final bool autoStartGroupBooking;
  /// Accumulated participants for group bookings (deferred single-call flow).
  final List<Map<String, dynamic>> accumulatedParticipants;
  /// Pre-fill participant data from person picker.
  final Map<String, dynamic>? prefillParticipant;

  const VenueDetailScreen({
    super.key,
    required this.tenantId,
    this.onGoToBookings,
    this.autoStartGroupBooking = false,
    this.accumulatedParticipants = const [],
    this.prefillParticipant,
  });

  @override
  State<VenueDetailScreen> createState() => _VenueDetailScreenState();
}

class _VenueDetailScreenState extends State<VenueDetailScreen> {
  final _scrollController = ScrollController();
  bool _isLiked = false;
  String? _favoriteId;
  bool _expandDesc = false;
  int _activeTab = 0;
  bool _loading = true;
  String? _error;

  VenueItem? _venue;
  List<ServiceItem> _services = [];
  final Set<String> _stagedServiceIds = {};
  List<Map<String, dynamic>> _employees = [];
  List<Map<String, dynamic>> _reviews = [];
  String _description = '';
  Map<String, dynamic>? _businessHours;

  static const _tabs = ['À propos', 'Prestations', 'Équipe', 'Avis', 'Autres'];
  final _keys = List.generate(5, (_) => GlobalKey());

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        discoveryService.getTenant(widget.tenantId),
        discoveryService.getServices(widget.tenantId),
        discoveryService.getEmployees(widget.tenantId),
        discoveryService.getReviews(widget.tenantId),
      ]);

      final tenant = results[0] as Map<String, dynamic>;
      final servicesRaw = results[1] as List<Map<String, dynamic>>;
      final employees = results[2] as List<Map<String, dynamic>>;
      final reviews = results[3] as List<Map<String, dynamic>>;

      final services = servicesRaw.map(serviceFromApi).toList();
      final venue = tenantToVenueItem(tenant, services: services);

      // Real data from DB — settings.businessHours is day-keyed:
      // { lundi: { open: '09:00', close: '19:00' }, ... } (absent day = closed).
      // Description lives in settings.description (fallback shortDescription).
      final tenantSettings = tenant['settings'];
      Map<String, dynamic>? businessHours;
      if (tenantSettings is Map && tenantSettings['businessHours'] is Map) {
        businessHours = Map<String, dynamic>.from(tenantSettings['businessHours'] as Map);
      }
      var desc = (tenantSettings is Map ? (tenantSettings['description'] ?? '') : '').toString().trim();
      if (desc.isEmpty) desc = (tenant['shortDescription'] ?? '').toString().trim();

      String? favId;
      bool liked = false;
      if (!mounted) return;
      final auth = context.read<AuthViewModel>();
      if (auth.isAuthenticated && auth.email != null) {
        try {
          final favs = await accountService.getFavorites(auth.email!);
          for (final f in favs) {
            if (f['tenantId']?.toString() == widget.tenantId) {
              liked = true;
              favId = f['id']?.toString();
              break;
            }
          }
        } catch (_) {}
      }

      if (!mounted) return;
      setState(() {
        _venue = venue;
        _services = services;
        _employees = employees;
        _reviews = reviews;
        _description = desc;
        if (_description.isEmpty) {
          _description =
              'This is a beautifully designed beauty and wellness establishment. '
              'Stunning private treatment rooms with vaulted ceilings, restful treatments and world-class service.';
        }
        _businessHours = businessHours;
        _isLiked = liked;
        _favoriteId = favId;
        _loading = false;
      });

      // Auto-start group booking flow when returning from "Ajouter quelqu'un"
      if (widget.autoStartGroupBooking) {
        WidgetsBinding.instance.addPostFrameCallback((_) async {
          if (!mounted) return;
          // Safety: verify login (should already be verified by caller)
          final auth = context.read<AuthViewModel>();
          if (!auth.isAuthenticated) {
            final ok = await Navigator.push<bool>(
              context,
              MaterialPageRoute(
                builder: (_) => const LoginScreen(returnResultOnSuccess: true),
              ),
            );
            if (ok != true || !mounted) return;
          }
          _navigateToSummary(true);
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _toggleFavorite() async {
    final auth = context.read<AuthViewModel>();
    if (!auth.isAuthenticated || auth.email == null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
      return;
    }
    try {
      if (_isLiked && _favoriteId != null) {
        await accountService.removeFavorite(_favoriteId!, auth.email!);
        setState(() {
          _isLiked = false;
          _favoriteId = null;
        });
      } else {
        final res = await accountService.addFavorite(auth.email!, widget.tenantId);
        final fav = res['favorite'] as Map<String, dynamic>?;
        setState(() {
          _isLiked = true;
          _favoriteId = fav?['id']?.toString();
        });
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  void _scrollToSection(int index) {
    setState(() => _activeTab = index);
    final ctx = _keys[index].currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
    }
  }

  void _openBooking() {
    final venue = _venue;
    if (venue == null) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Pour qui réservez-vous ?',
                style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textDark),
              ),
              const SizedBox(height: 8),
              Text(
                'Choisissez le type de réservation',
                style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
              ),
              const SizedBox(height: 24),
              _BookingChoiceCard(
                icon: Icons.person_rounded,
                title: 'Pour vous seul',
                subtitle: 'Réservez pour vous-même',
                onTap: () {
                  Navigator.pop(ctx);
                  _navigateToSummary(false);
                },
              ),
              const SizedBox(height: 12),
              _BookingChoiceCard(
                icon: Icons.groups_rounded,
                title: 'Pour un groupe',
                subtitle: 'Réservez pour plusieurs personnes',
                onTap: () async {
                  Navigator.pop(ctx);
                  // Group mode requires login — prompt instantly, before the
                  // booking form, and resume the group flow once connected.
                  final auth = context.read<AuthViewModel>();
                  if (!auth.isAuthenticated) {
                    final ok = await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const LoginScreen(returnResultOnSuccess: true),
                      ),
                    );
                    if (ok != true || !mounted) return;
                  }
                  _navigateToSummary(true);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _navigateToSummary(bool isGroupMode) {
    final venue = _venue;
    if (venue == null) return;
    // Only forward accumulated participants when explicitly continuing a group
    // booking (autoStartGroupBooking). For any fresh booking (user taps
    // "Réserver" → picks "Pour vous" or "Groupe"), start with empty state.
    final forwardParticipants = (isGroupMode && widget.autoStartGroupBooking)
        ? widget.accumulatedParticipants
        : <Map<String, dynamic>>[];
    final forwardPrefill = (isGroupMode && widget.autoStartGroupBooking)
        ? widget.prefillParticipant
        : null;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BookingSummaryScreen(
          tenantId: widget.tenantId,
          venue: venue.copyWithServices(_services),
          selectedServiceIds: _stagedServiceIds,
          onGoToBookings: widget.onGoToBookings,
          isGroupMode: isGroupMode,
          accumulatedParticipants: forwardParticipants,
          prefillParticipant: forwardPrefill,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }
    if (_error != null || _venue == null) {
      return Scaffold(
        appBar: AppBar(backgroundColor: Colors.white, foregroundColor: AppColors.textDark),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error ?? 'Établissement introuvable', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton(onPressed: _load, child: const Text('Réessayer')),
              ],
            ),
          ),
        ),
      );
    }

    final venue = _venue!.copyWithServices(_services);

    return Scaffold(
      backgroundColor: Colors.white,
      body: CustomScrollView(
        controller: _scrollController,
        slivers: [
          SliverAppBar(
            expandedHeight: 260,
            pinned: true,
            backgroundColor: Colors.white,
            automaticallyImplyLeading: false,
            flexibleSpace: FlexibleSpaceBar(
              collapseMode: CollapseMode.pin,
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    venue.image,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(color: AppColors.surface),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.center,
                        colors: [Colors.black.withValues(alpha: 0.35), Colors.transparent],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            leading: Padding(
              padding: const EdgeInsets.all(8),
              child: _CircleBtn(icon: Icons.arrow_back_rounded, onTap: () => Navigator.pop(context)),
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: _CircleBtn(icon: Icons.share_outlined, onTap: () {}),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: _CircleBtn(
                  icon: _isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  iconColor: _isLiked ? const Color(0xFFEF4444) : AppColors.textDark,
                  onTap: _toggleFavorite,
                ),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(venue.name, style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textDark)),
                  const SizedBox(height: 2),
                  Text(venue.category, style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.star_rounded, size: 16, color: AppColors.starColor),
                      const SizedBox(width: 4),
                      Text(venue.rating.toStringAsFixed(1).replaceAll('.', ','),
                          style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700)),
                      Text(' (${venue.reviews})', style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textGray),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(venue.location, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPersistentHeader(
            pinned: true,
            delegate: _TabBarDelegate(tabs: _tabs, activeIndex: _activeTab, onTap: _scrollToSection),
          ),
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  key: _keys[0],
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                  child: _AProposSection(
                    description: _description,
                    expanded: _expandDesc,
                    onToggle: () => setState(() => _expandDesc = !_expandDesc),
                  ),
                ),
                const Divider(height: 32, indent: 20, endIndent: 20, color: AppColors.border),
                Container(
                  key: _keys[1],
                  child: _PrestationsSection(
                    services: _services,
                    stagedIds: _stagedServiceIds,
                    onToggle: (s) {
                      setState(() {
                        final id = s.id.isNotEmpty ? s.id : s.name;
                        if (_stagedServiceIds.contains(id)) {
                          _stagedServiceIds.remove(id);
                        } else {
                          _stagedServiceIds.add(id);
                        }
                      });
                    },
                  ),
                ),
                const Divider(height: 32, indent: 20, endIndent: 20, color: AppColors.border),
                Container(
                  key: _keys[2],
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: _EquipeSection(employees: _employees, reviews: _reviews, rating: venue.rating, reviewCount: venue.reviews),
                ),
                const Divider(height: 32, indent: 20, endIndent: 20, color: AppColors.border),
                Container(
                  key: _keys[3],
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: _HorairesSection(businessHours: _businessHours),
                ),
                const Divider(height: 32, indent: 20, endIndent: 20, color: AppColors.border),
                Container(
                  key: _keys[4],
                  child: _AutresSection(venue: venue),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).padding.bottom + 12),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          children: [
            Text('${_services.length} prestations disponibles', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
            const Spacer(),
            ElevatedButton(
              onPressed: _openBooking,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.textDark,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
              ),
              child: Text('Réserver', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}

extension on VenueItem {
  VenueItem copyWithServices(List<ServiceItem> services) => VenueItem(
        id: id,
        name: name,
        image: image,
        rating: rating,
        reviews: reviews,
        category: category,
        location: location,
        distance: distance,
        latitude: latitude,
        longitude: longitude,
        nextAvailable: nextAvailable,
        services: services,
      );
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final List<String> tabs;
  final int activeIndex;
  final void Function(int) onTap;

  const _TabBarDelegate({required this.tabs, required this.activeIndex, required this.onTap});

  static const double _h = 48;
  @override
  double get minExtent => _h + 1;
  @override
  double get maxExtent => _h + 1;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          SizedBox(
            height: _h,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: tabs.length,
              itemBuilder: (context, i) {
                final active = activeIndex == i;
                return GestureDetector(
                  onTap: () => onTap(i),
                  child: Container(
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: active ? AppColors.textDark : Colors.transparent, width: 2),
                      ),
                    ),
                    child: Text(
                      tabs[i],
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                        color: active ? AppColors.textDark : AppColors.textGray,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const Divider(height: 1, thickness: 1, color: AppColors.border),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(_TabBarDelegate old) => old.activeIndex != activeIndex || old.tabs != tabs;
}

class _CircleBtn extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final VoidCallback onTap;
  const _CircleBtn({required this.icon, required this.onTap, this.iconColor = AppColors.textDark});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
        child: Icon(icon, size: 20, color: iconColor),
      ),
    );
  }
}

class _AProposSection extends StatelessWidget {
  final String description;
  final bool expanded;
  final VoidCallback onToggle;
  const _AProposSection({required this.description, required this.expanded, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final short = description.length > 120 ? '${description.substring(0, 120)}...' : description;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(expanded ? description : short, style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray, height: 1.6)),
        if (description.length > 120)
          GestureDetector(
            onTap: onToggle,
            child: Text(
              expanded ? 'Voir moins' : 'Lire la suite',
              style: GoogleFonts.inter(fontSize: 14, color: AppColors.primary, fontWeight: FontWeight.w600),
            ),
          ),
        const SizedBox(height: 20),
      ],
    );
  }
}

class _PrestationsSection extends StatelessWidget {
  final List<ServiceItem> services;
  final Set<String> stagedIds;
  final void Function(ServiceItem) onToggle;
  const _PrestationsSection({required this.services, required this.stagedIds, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Text('Prestations', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textDark)),
        ),
        if (services.isEmpty)
          Padding(
            padding: const EdgeInsets.all(20),
            child: Text('Aucune prestation', style: GoogleFonts.inter(color: AppColors.textGray)),
          )
        else
          ...services.map((s) {
            final id = s.id.isNotEmpty ? s.id : s.name;
            final added = stagedIds.contains(id);
            return Container(
              margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: added ? AppColors.primary : AppColors.border),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.name.toUpperCase(),
                            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textDark)),
                        const SizedBox(height: 4),
                        Text(
                          s.durationMin >= 60
                              ? '${s.durationMin ~/ 60} h${s.durationMin % 60 == 0 ? '' : ' ${s.durationMin % 60} min'}'
                              : '${s.durationMin} min',
                          style: GoogleFonts.inter(fontSize: 12, color: AppColors.textLight),
                        ),
                        const SizedBox(height: 12),
                        Text('${s.price.toInt()} MAD',
                            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => onToggle(s),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: added ? AppColors.primary : Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: added ? AppColors.primary : AppColors.border),
                      ),
                      child: Icon(added ? Icons.remove : Icons.add, size: 20,
                          color: added ? Colors.white : AppColors.textDark),
                    ),
                  ),
                ],
              ),
            );
          }),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _EquipeSection extends StatelessWidget {
  final List<Map<String, dynamic>> employees;
  final List<Map<String, dynamic>> reviews;
  final double rating;
  final int reviewCount;

  const _EquipeSection({
    required this.employees,
    required this.reviews,
    required this.rating,
    required this.reviewCount,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Équipe', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 16),
        if (employees.isEmpty)
          Text('Équipe non renseignée', style: GoogleFonts.inter(color: AppColors.textGray))
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: employees.map((m) {
                final first = (m['firstName'] ?? '').toString();
                final last = (m['lastName'] ?? '').toString();
                final name = '$first $last'.trim().isEmpty ? (m['name']?.toString() ?? 'Pro') : '$first $last'.trim();
                final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
                final avatar = (m['avatar'] ?? m['photo'] ?? '').toString();
                return Padding(
                  padding: const EdgeInsets.only(right: 24),
                  child: Column(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: const BoxDecoration(
                          color: Color(0xFFEDE9FE),
                          shape: BoxShape.circle,
                        ),
                        child: ClipOval(
                          child: avatar.startsWith('http')
                              ? Image.network(
                                  avatar,
                                  fit: BoxFit.cover,
                                  errorBuilder: (context, error, stackTrace) => Center(
                                    child: Text(initial,
                                        style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.primary)),
                                  ),
                                )
                              : Center(
                                  child: Text(initial,
                                      style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.primary)),
                                ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(name.split(' ').first, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        const SizedBox(height: 28),
        Text('Avis', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Row(children: List.generate(5, (_) => const Icon(Icons.star_rounded, size: 28, color: AppColors.starColor))),
        const SizedBox(height: 4),
        Text('${rating.toStringAsFixed(1).replaceAll('.', ',')} ($reviewCount)',
            style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700)),
        const SizedBox(height: 16),
        if (reviews.isEmpty)
          Text('Pas encore d\'avis', style: GoogleFonts.inter(color: AppColors.textGray))
        else
          ...reviews.take(5).map((r) {
            final name = (r['clientName'] ?? r['author'] ?? r['firstName'] ?? 'Client').toString();
            final text = (r['comment'] ?? r['text'] ?? r['content'] ?? '').toString();
            final initials = name.isNotEmpty ? name.substring(0, name.length >= 2 ? 2 : 1).toUpperCase() : 'CL';
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.surface,
                      child: Text(initials, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                    ),
                    const SizedBox(width: 12),
                    Text(name, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(children: List.generate(5, (_) => const Icon(Icons.star_rounded, size: 16, color: AppColors.starColor))),
                const SizedBox(height: 4),
                Text(text, style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray, height: 1.5)),
                const SizedBox(height: 16),
              ],
            );
          }),
      ],
    );
  }
}

class _HorairesSection extends StatelessWidget {
  final Map<String, dynamic>? businessHours;
  const _HorairesSection({this.businessHours});

  static const _days = [
    'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
  ];

  /// Formats '09:00' as '9h' / '09:30' as '9h30' — clean FR display.
  String _fmt(String t) {
    final parts = t.split(':');
    final h = int.tryParse(parts[0]) ?? 0;
    final m = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
    return m == 0 ? '$h h' : '$h h$m';
  }

  @override
  Widget build(BuildContext context) {
    final hours = businessHours;
    final hasHours = hours != null && _days.any((d) => hours[d] is Map);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Horaires d'ouverture", style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 16),
        if (!hasHours)
          Text('Horaires non renseignés', style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray))
        else
          ..._days.map((day) {
            final h = hours[day];
            final open = (h is Map ? (h['open'] ?? '').toString() : '').trim();
            final close = (h is Map ? (h['close'] ?? '').toString() : '').trim();
            final isOpen = open.isNotEmpty && close.isNotEmpty;
            final label = isOpen ? '${_fmt(open)} - ${_fmt(close)}' : 'Fermé';
            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(
                children: [
                  Icon(Icons.circle, size: 10, color: isOpen ? const Color(0xFF22C55E) : AppColors.textLight),
                  const SizedBox(width: 12),
                  Expanded(child: Text(_capitalize(day), style: GoogleFonts.inter(fontSize: 14, color: AppColors.textDark))),
                  Text(label, style: GoogleFonts.inter(fontSize: 14, color: isOpen ? AppColors.textDark : AppColors.textGray)),
                ],
              ),
            );
          }),
      ],
    );
  }

  String _capitalize(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

class _AutresSection extends StatelessWidget {
  final VenueItem venue;
  const _AutresSection({
    required this.venue,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              height: 180,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: LatLng(venue.latitude, venue.longitude),
                  initialZoom: 14,
                  interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.example.mobile_app',
                  ),
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: LatLng(venue.latitude, venue.longitude),
                        width: 50,
                        height: 40,
                        alignment: Alignment.topCenter,
                        child: const _RatingMarker(),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Text(venue.location, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textDark, height: 1.5)),
        ),
      ],
    );
  }
}

class _RatingMarker extends StatelessWidget {
  const _RatingMarker();
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(color: AppColors.textDark, borderRadius: BorderRadius.circular(20)),
          child: Text('★', style: GoogleFonts.inter(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
        ),
        CustomPaint(size: const Size(10, 6), painter: _TriPainter()),
      ],
    );
  }
}

class _TriPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = AppColors.textDark;
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

class _BookingChoiceCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _BookingChoiceCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 26),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textDark),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded, size: 16, color: AppColors.textGray),
          ],
        ),
      ),
    );
  }
}
