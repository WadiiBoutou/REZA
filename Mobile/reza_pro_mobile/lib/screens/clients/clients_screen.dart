import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../models/client.dart';
import '../../services/api_client.dart';
import '../../viewmodels/clients_viewmodel.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/client_card.dart';
import '../../widgets/page_controls.dart';
import '../../widgets/pro_drawer.dart';

class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    _searchController.addListener(() {
      context.read<ClientsViewModel>().setSearch(_searchController.text);
    });
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    setState(() {});
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  ClientsViewModel get vm => context.watch<ClientsViewModel>();

  @override
  Widget build(BuildContext context) {
    final vm = this.vm;
    return Scaffold(
      backgroundColor: Colors.white,
      drawer: const ProDrawer(),
      body: NestedScrollView(
        headerSliverBuilder: (context, innerScrolled) => [
          _buildAppBar(vm),
          SliverToBoxAdapter(child: _buildSearchAndSort(vm)),
          SliverToBoxAdapter(child: _buildSummaryCards(vm)),
          SliverPersistentHeader(
            pinned: true,
            delegate: _TabBarDelegate(
              TabBar(
                controller: _tabController,
                labelStyle: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
                unselectedLabelStyle: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textGray,
                indicatorColor: AppColors.primary,
                indicatorWeight: 3,
                tabs: const [
                  Tab(text: 'Tous les clients'),
                  Tab(text: 'Fichier client'),
                ],
              ),
            ),
          ),
        ],
        body: vm.loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : vm.error != null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(vm.error!, style: GoogleFonts.outfit(color: AppColors.cancelled)),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: vm.load,
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                          child: Text('Réessayer', style: GoogleFonts.outfit(color: Colors.white)),
                        ),
                      ],
                    ),
                  )
                : TabBarView(
                    controller: _tabController,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _buildClientList(vm),
                      _buildClientFiche(vm),
                    ],
                  ),
      ),
      bottomNavigationBar: _tabController.index == 0 && !vm.loading && vm.error == null
          ? PagePager(
              page: vm.currentPage,
              totalPages: vm.totalPages,
              onPrevious: vm.previousPage,
              onNext: vm.nextPage,
            )
          : null,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddClientSheet(vm),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        icon: const Icon(Icons.person_add_rounded, size: 20),
        label: Text(
          'Nouveau client',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 13),
        ),
      ),
    );
  }

  SliverAppBar _buildAppBar(ClientsViewModel vm) {
    final auth = context.watch<AuthViewModel>();
    return SliverAppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      pinned: false,
      floating: true,
      snap: true,
      leading: Builder(
        builder: (ctx) => IconButton(
          icon: const Icon(Icons.menu, color: AppColors.textDark),
          onPressed: () => Scaffold.of(ctx).openDrawer(),
        ),
      ),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Clients',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textDark,
            ),
          ),
          Text(
            _clientsSubtitle(auth, vm),
            style: GoogleFonts.outfit(
              fontSize: 11,
              color: AppColors.textGray,
              fontWeight: FontWeight.w500,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: AppColors.textGray),
          onPressed: vm.load,
        ),
      ],
    );
  }

  Widget _buildSearchAndSort(ClientsViewModel vm) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 46,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: TextField(
                controller: _searchController,
                style: GoogleFonts.outfit(fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Rechercher un client...',
                  hintStyle: GoogleFonts.outfit(
                    fontSize: 13,
                    color: AppColors.textLight,
                  ),
                  prefixIcon: const Icon(Icons.search_rounded,
                      color: AppColors.textGray, size: 20),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 13),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: vm.sortBy,
                icon: const Icon(Icons.swap_vert_rounded,
                    size: 18, color: AppColors.textGray),
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textDark,
                ),
                items: vm.sortOptions
                    .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                    .toList(),
                onChanged: (v) { if (v != null) vm.setSort(v); },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCards(ClientsViewModel vm) {
    final totalRevenue = vm.clients.fold(0.0, (sum, c) => sum + c.totalSpent);
    final totalVisits = vm.clients.fold(0, (sum, c) => sum + c.totalVisits);
    final activeClients = vm.clients.where((c) =>
        c.lastVisit != null &&
        DateTime.now().difference(c.lastVisit!).inDays <= 30).length;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        children: [
          _buildSummaryCard('${vm.clients.length}', 'Total clients',
              Icons.people_alt_rounded, AppColors.primary, AppColors.primary.withOpacity(0.1)),
          const SizedBox(width: 10),
          _buildSummaryCard('$activeClients', 'Actifs (30j)',
              Icons.trending_up_rounded, AppColors.confirmed, AppColors.confirmedBg),
          const SizedBox(width: 10),
          _buildSummaryCard('$totalVisits', 'Visites totales',
              Icons.calendar_month_rounded, AppColors.pending, AppColors.pendingBg),
          const SizedBox(width: 10),
          _buildSummaryCard(
              '${totalRevenue.toStringAsFixed(0)} DH',
              'Chiffre d\'affaires',
              Icons.payments_rounded,
              const Color(0xFF7C3AED),
              const Color(0xFFF3E8FF)),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(
      String value, String label, IconData icon, Color color, Color bg) {
    return Container(
      width: 140,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 10),
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }

  String _clientsSubtitle(AuthViewModel auth, ClientsViewModel vm) {
    final query = vm.searchQuery.trim();
    if (query.isNotEmpty) {
      final count = vm.filteredClients.length;
      final label = count == 1 ? 'résultat' : 'résultats';
      return '$count $label';
    }
    final count = vm.clients.length;
    if (auth.hasMultipleSalons) {
      return '${auth.salonFilterLabel} · $count clients';
    }
    return '$count clients enregistrés';
  }

  Widget _buildClientList(ClientsViewModel vm) {
    final clients = vm.pageClients;
    final empty = Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.person_search_rounded, size: 48, color: AppColors.textLight),
          const SizedBox(height: 12),
          Text(
            'Aucun client trouvé',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textGray,
            ),
          ),
        ],
      ),
    );
    return PagedSwipe(
      expand: true,
      page: vm.currentPage,
      onPrevious: vm.previousPage,
      onNext: vm.nextPage,
      child: clients.isEmpty
          ? empty
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 88),
              itemCount: clients.length,
              itemBuilder: (ctx, i) => ClientCard(client: clients[i]),
            ),
    );
  }

  Widget _buildClientFiche(ClientsViewModel vm) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Fiche client rapide',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Sélectionnez un client dans la liste "Tous les clients" pour accéder à sa fiche complète.',
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  color: AppColors.textGray,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ...vm.filteredClients.take(5).map((c) => ClientCard(client: c)),
      ],
    );
  }

  void _showAddClientSheet(ClientsViewModel vm) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChangeNotifierProvider.value(
        value: vm,
        child: _AddClientSheet(
          onAdd: (_) {},
        ),
      ),
    );
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  const _TabBarDelegate(this.tabBar);

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Colors.white,
      child: tabBar,
    );
  }

  @override
  double get maxExtent => 48;
  @override
  double get minExtent => 48;
  @override
  bool shouldRebuild(covariant SliverPersistentHeaderDelegate oldDelegate) => false;
}

class _AddClientSheet extends StatefulWidget {
  final Function(Client) onAdd;
  const _AddClientSheet({required this.onAdd});

  @override
  State<_AddClientSheet> createState() => _AddClientSheetState();
}

class _AddClientSheetState extends State<_AddClientSheet> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final first = _firstNameController.text.trim();
    final last = _lastNameController.text.trim();
    final phone = _phoneController.text.trim();
    if (first.isEmpty || last.isEmpty || phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Prénom, nom et téléphone requis',
              style: GoogleFonts.outfit(fontSize: 13)),
          backgroundColor: AppColors.cancelled,
        ),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final vm = context.read<ClientsViewModel>();
      final created = await vm.create(
        firstName: first,
        lastName: last,
        phone: phone,
        email: _emailController.text.trim().isNotEmpty
            ? _emailController.text.trim()
            : null,
        address: _addressController.text.trim().isNotEmpty
            ? _addressController.text.trim()
            : null,
      );
      if (!mounted) return;
      widget.onAdd(created);
      Navigator.pop(context);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message, style: GoogleFonts.outfit(fontSize: 13))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(28),
          topRight: Radius.circular(28),
        ),
      ),
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
          const SizedBox(height: 20),
          Text(
            'Nouveau client',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(child: _field(_firstNameController, 'Prénom *', 'Yasmine')),
              const SizedBox(width: 12),
              Expanded(child: _field(_lastNameController, 'Nom *', 'Benali')),
            ],
          ),
          const SizedBox(height: 12),
          _field(_phoneController, 'Téléphone *', '+212 6 61 23 45 67',
              type: TextInputType.phone),
          const SizedBox(height: 12),
          _field(_emailController, 'Email', 'client@exemple.com',
              type: TextInputType.emailAddress),
          const SizedBox(height: 12),
          _field(_addressController, 'Adresse', 'Casablanca'),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _saving ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(25),
                ),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      'Ajouter le client',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 15),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController ctrl, String label, String hint,
      {TextInputType type = TextInputType.text}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: GoogleFonts.outfit(
                fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textDark)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: type,
          style: GoogleFonts.outfit(fontSize: 14, color: AppColors.textDark),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.outfit(fontSize: 13, color: AppColors.textLight),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            filled: true,
            fillColor: AppColors.surfaceGray,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ],
    );
  }
}
