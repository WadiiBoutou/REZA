import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../constants/app_colors.dart';
import '../models/client.dart';
import '../viewmodels/agenda_viewmodel.dart';
import '../viewmodels/admin_viewmodel.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../viewmodels/caisse_viewmodel.dart';
import '../viewmodels/clients_viewmodel.dart';
import '../services/client_service.dart';
import 'agenda/agenda_screen.dart';
import 'clients/clients_screen.dart';
import 'caisse/caisse_screen.dart';
import 'admin/admin_screen.dart';
import '../widgets/appointment_modal.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with TickerProviderStateMixin {
  int _selectedIndex = 0;
  bool _isMenuOpen = false;

  late AnimationController _animationController;
  late Animation<double> _rotationAnimation;

  /// Stable VMs — do NOT remount on salon filter (would close open drawer).
  late final AgendaViewModel _agendaVm;
  late final ClientsViewModel _clientsVm;
  late final CaisseViewModel _caisseVm;
  late final AdminViewModel _adminVm;
  late final List<Widget> _screens;

  AuthViewModel? _auth;
  String? _lastSalonFilterScopeKey;

  @override
  void initState() {
    super.initState();
    _agendaVm = AgendaViewModel()..bootstrap();
    _clientsVm = ClientsViewModel()..load();
    _caisseVm = CaisseViewModel()..load();
    _adminVm = AdminViewModel()..loadAll();
    _screens = [
      ChangeNotifierProvider<AgendaViewModel>.value(
        value: _agendaVm,
        child: const AgendaScreen(),
      ),
      ChangeNotifierProvider<ClientsViewModel>.value(
        value: _clientsVm,
        child: const ClientsScreen(),
      ),
      ChangeNotifierProvider<CaisseViewModel>.value(
        value: _caisseVm,
        child: const CaisseScreen(),
      ),
      ChangeNotifierProvider<AdminViewModel>.value(
        value: _adminVm,
        child: const AdminScreen(),
      ),
    ];
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
    _rotationAnimation = Tween<double>(begin: 0.0, end: 0.25).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = context.read<AuthViewModel>();
    if (!identical(_auth, auth)) {
      _auth?.removeListener(_onAuthChanged);
      _auth = auth;
      _lastSalonFilterScopeKey = auth.salonFilterScopeKey;
      _auth!.addListener(_onAuthChanged);
    }
  }

  void _onAuthChanged() {
    final auth = _auth;
    if (auth == null || !mounted) return;
    final scope = auth.salonFilterScopeKey;
    if (scope == _lastSalonFilterScopeKey) return;
    _lastSalonFilterScopeKey = scope;
    // Filter already applied on apiClient; refetch without remounting Scaffold/drawer.
    _agendaVm.bootstrap();
    _clientsVm.load();
    _caisseVm.load();
    _adminVm.loadAll();
  }

  @override
  void dispose() {
    _auth?.removeListener(_onAuthChanged);
    _animationController.dispose();
    _agendaVm.dispose();
    _clientsVm.dispose();
    _caisseVm.dispose();
    _adminVm.dispose();
    super.dispose();
  }

  void _toggleMenu() {
    setState(() {
      _isMenuOpen = !_isMenuOpen;
      if (_isMenuOpen) {
        _animationController.forward();
      } else {
        _animationController.reverse();
      }
    });
  }

  // Action methods
  void _nouveauRDV() {
    _toggleMenu();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => NewAppointmentModal(
        selectedDate: DateTime.now(),
        onAdd: (appointment) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Rendez-vous ajouté avec succès pour ${appointment.clientName}',
                style: GoogleFonts.outfit(fontSize: 13),
              ),
              backgroundColor: AppColors.primary,
            ),
          );
        },
      ),
    );
  }

  void _bloquerCreneau() {
    _toggleMenu();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Bloquer un créneau', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text('Voulez-vous bloquer un créneau d\'indisponibilité sur l\'agenda ?', style: GoogleFonts.outfit()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Annuler', style: GoogleFonts.outfit(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Créneau bloqué avec succès !', style: GoogleFonts.outfit()),
                  backgroundColor: AppColors.primary,
                ),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: Text('Confirmer', style: GoogleFonts.outfit(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _fideliteVIP() async {
    _toggleMenu();
    List<Client> top = [];
    try {
      final raw = await clientService.list(limit: 100);
      top = raw.map(Client.fromJson).toList()
        ..sort((a, b) => b.totalVisits.compareTo(a.totalVisits));
      top = top.take(5).toList();
    } catch (_) {}

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Clients VIP & Fidélité',
              style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            if (top.isEmpty)
              Text('Aucun client VIP pour le moment',
                  style: GoogleFonts.outfit(color: AppColors.textGray))
            else
              ...top.map((c) {
                final tier = c.totalVisits >= 20
                    ? 'Or'
                    : c.totalVisits >= 10
                        ? 'Argent'
                        : 'Bronze';
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primary.withOpacity(0.1),
                    child: Icon(Icons.star, color: AppColors.primary),
                  ),
                  title: Text(c.name, style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                  subtitle: Text('Fidélité $tier - ${c.totalVisits} visites',
                      style: GoogleFonts.outfit()),
                );
              }),
          ],
        ),
      ),
    );
  }

  void _prestationsTab() {
    _toggleMenu();
    setState(() {
      _selectedIndex = 3; // Switch to Admin tab where prestations are configured
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Gestion des prestations & tarifs', style: GoogleFonts.outfit()),
        backgroundColor: AppColors.primary,
      ),
    );
  }

  void _nouvelleVente() {
    _toggleMenu();
    setState(() {
      _selectedIndex = 2; // Switch to Caisse tab
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Vente rapide - Caisse ouverte', style: GoogleFonts.outfit()),
        backgroundColor: AppColors.primary,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          IndexedStack(
            index: _selectedIndex,
            children: _screens,
          ),
          
          // Dark overlay when quick action menu is open
          if (_isMenuOpen)
            GestureDetector(
              onTap: _toggleMenu,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                color: Colors.black.withOpacity(0.5),
              ),
            ),

          // Arc layout for quick action items
          if (_isMenuOpen)
            Positioned(
              bottom: 75,
              left: 0,
              right: 0,
              child: Container(
                height: 160,
                alignment: Alignment.bottomCenter,
                child: Stack(
                  alignment: Alignment.bottomCenter,
                  children: [
                    // Item 1: Left-most (Rendez-vous)
                    _buildArcItem(
                      icon: Icons.event_available_rounded,
                      angle: 170,
                      distance: 85,
                      onTap: _nouveauRDV,
                      tooltip: 'Rendez-vous',
                    ),
                    // Item 2: Mid-left (Absence / Bloquer)
                    _buildArcItem(
                      icon: Icons.calendar_today_rounded,
                      angle: 130,
                      distance: 90,
                      onTap: _bloquerCreneau,
                      tooltip: 'Bloquer',
                    ),
                    // Item 3: Top-center (Trophy / VIP)
                    _buildArcItem(
                      icon: Icons.emoji_events_rounded,
                      angle: 90,
                      distance: 100,
                      onTap: _fideliteVIP,
                      tooltip: 'VIP',
                    ),
                    // Item 4: Mid-right (Prestation)
                    _buildArcItem(
                      icon: Icons.spa_rounded,
                      angle: 50,
                      distance: 90,
                      onTap: _prestationsTab,
                      tooltip: 'Prestations',
                    ),
                    // Item 5: Right-most (Vente)
                    _buildArcItem(
                      icon: Icons.fact_check_rounded,
                      angle: 10,
                      distance: 85,
                      onTap: _nouvelleVente,
                      tooltip: 'Vente',
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: Container(
        height: 70,
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(
            top: BorderSide(color: AppColors.border, width: 0.5),
          ),
        ),
        child: SafeArea(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              // Icon 1 (Grid / Agenda)
              _buildBottomNavItem(
                icon: Icons.grid_view_rounded,
                index: 0,
                label: 'Agenda',
              ),
              // Icon 2 (Clients)
              _buildBottomNavItem(
                icon: Icons.chat_bubble_outline_rounded,
                index: 1,
                label: 'Clients',
                hasBadge: true,
              ),
              
              // Center Circular Action Button (+ / X) — green to match Agenda FAB
              GestureDetector(
                onTap: _toggleMenu,
                child: Container(
                  width: 52,
                  height: 52,
                  margin: const EdgeInsets.only(bottom: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.35),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Center(
                    child: AnimatedBuilder(
                      animation: _rotationAnimation,
                      builder: (context, child) {
                        return Transform.rotate(
                          angle: _rotationAnimation.value * 2 * math.pi,
                          child: Icon(
                            _isMenuOpen ? Icons.close : Icons.add,
                            color: Colors.white,
                            size: 28,
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
              
              // Icon 3 (Caisse)
              _buildBottomNavItem(
                icon: Icons.bar_chart_rounded,
                index: 2,
                label: 'Caisse',
              ),
              // Icon 4 (Admin)
              _buildBottomNavItem(
                icon: Icons.notifications_none_rounded,
                index: 3,
                label: 'Admin',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNavItem({
    required IconData icon,
    required int index,
    required String label,
    bool hasBadge = false,
  }) {
    final isSelected = _selectedIndex == index;
    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (_isMenuOpen) _toggleMenu();
            setState(() {
              _selectedIndex = index;
            });
            // Re-fetch when the Caisse tab is opened so a stale/empty first
            // load (e.g. at app startup) doesn't linger until a manual refresh.
            if (index == 2) _caisseVm.load();
          },
          child: Stack(
            alignment: Alignment.center,
            children: [
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    color: isSelected ? AppColors.primary : Colors.grey[400],
                    size: 24,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    style: GoogleFonts.outfit(
                      fontSize: 10,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
                      color: isSelected ? AppColors.primary : Colors.grey[500],
                    ),
                  ),
                ],
              ),
              if (hasBadge)
                Positioned(
                  top: 8,
                  right: 26,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    child: const Text(
                      '1',
                      style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  // Positioning quick action item using polar coordinates
  Widget _buildArcItem({
    required IconData icon,
    required double angle, // in degrees
    required double distance,
    required VoidCallback onTap,
    required String tooltip,
  }) {
    final double angleRad = angle * math.pi / 180.0;
    final double leftOffset = distance * math.cos(angleRad);
    final double bottomOffset = distance * math.sin(angleRad);

    return Positioned(
      bottom: bottomOffset,
      left: MediaQuery.of(context).size.width / 2 + leftOffset - 24,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: onTap,
            child: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.35),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(
                icon,
                color: Colors.white,
                size: 24,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
