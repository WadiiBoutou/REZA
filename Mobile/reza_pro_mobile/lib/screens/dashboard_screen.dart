import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../constants/app_colors.dart';
import '../viewmodels/agenda_viewmodel.dart';
import '../viewmodels/admin_viewmodel.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../viewmodels/caisse_viewmodel.dart';
import '../viewmodels/clients_viewmodel.dart';
import 'agenda/agenda_screen.dart';
import 'clients/clients_screen.dart';
import 'caisse/caisse_screen.dart';
import 'admin/admin_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;

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
    _agendaVm.dispose();
    _clientsVm.dispose();
    _caisseVm.dispose();
    _adminVm.dispose();
    super.dispose();
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
              // Icon 1 (Agenda)
              _buildBottomNavItem(
                icon: Icons.calendar_month_rounded,
                index: 0,
                label: 'Agenda',
              ),
              // Icon 2 (Clients)
              _buildBottomNavItem(
                icon: Icons.people_alt_rounded,
                index: 1,
                label: 'Clients',
              ),
              // Icon 3 (Caisse)
              _buildBottomNavItem(
                icon: Icons.payments_rounded,
                index: 2,
                label: 'Caisse',
              ),
              // Icon 4 (Admin)
              _buildBottomNavItem(
                icon: Icons.settings_rounded,
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
  }) {
    final isSelected = _selectedIndex == index;
    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
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
            ],
          ),
        ),
      ),
    );
  }

}
