import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../viewmodels/admin_viewmodel.dart';
import '../../services/api_client.dart';
import '../../services/employee_service.dart';
import '../../services/service_catalog_service.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<String> _tabs = [
    'Agenda',
    'Prestations',
    'Personnel',
    'Établissement',
    'Statistiques',
  ];

  final _staffColors = const [
    Color(0xFF3B82F6),
    Color(0xFFEC4899),
    Color(0xFF8B5CF6),
    Color(0xFF10B981),
    Color(0xFFF59E0B),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  AdminViewModel get _vm => context.watch<AdminViewModel>();

  Future<void> _showAddServiceSheet() async {
    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final durationCtrl = TextEditingController(text: '30');
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text('Nouvelle prestation', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Nom de la prestation')),
            TextField(controller: priceCtrl, decoration: const InputDecoration(labelText: 'Prix (DH)'), keyboardType: TextInputType.number),
            TextField(controller: durationCtrl, decoration: const InputDecoration(labelText: 'Durée (min)'), keyboardType: TextInputType.number),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Annuler', style: GoogleFonts.outfit(color: AppColors.textGray))),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isEmpty || priceCtrl.text.isEmpty) return;
              try {
                final created = await serviceCatalogService.create({
                  'name': nameCtrl.text.trim(),
                  'price': double.tryParse(priceCtrl.text) ?? 0,
                  'duration': int.tryParse(durationCtrl.text) ?? 30,
                  'priceType': 'FIXED',
                });
                if (!mounted) return;
                setState(() => _vm.services.insert(0, created));
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Prestation ajoutée', style: GoogleFonts.outfit()), backgroundColor: AppColors.primary),
                );
              } on ApiException catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(e.message, style: GoogleFonts.outfit())),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: Text('Ajouter', style: GoogleFonts.outfit(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _showAddStaffSheet() async {
    final firstCtrl = TextEditingController();
    final lastCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: Text('Nouveau collaborateur', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: firstCtrl, decoration: const InputDecoration(labelText: 'Prénom')),
            TextField(controller: lastCtrl, decoration: const InputDecoration(labelText: 'Nom')),
            TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email (optionnel)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Annuler', style: GoogleFonts.outfit(color: AppColors.textGray))),
          ElevatedButton(
            onPressed: () async {
              if (firstCtrl.text.isEmpty || lastCtrl.text.isEmpty) return;
              try {
                final created = await employeeService.create({
                  'firstName': firstCtrl.text.trim(),
                  'lastName': lastCtrl.text.trim(),
                  if (emailCtrl.text.trim().isNotEmpty) 'email': emailCtrl.text.trim(),
                  'isActive': true,
                });
                if (!mounted) return;
                setState(() => _vm.staff.insert(0, created));
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Collaborateur ajouté', style: GoogleFonts.outfit()), backgroundColor: AppColors.primary),
                );
              } on ApiException catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(e.message, style: GoogleFonts.outfit())),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: Text('Ajouter', style: GoogleFonts.outfit(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _logout() async {
    await context.read<AuthViewModel>().logout();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: _vm.loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _vm.error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_vm.error!, style: GoogleFonts.outfit(color: AppColors.cancelled)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => context.read<AdminViewModel>().loadAll(),
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: Text('Réessayer', style: GoogleFonts.outfit(color: Colors.white)),
                      ),
                    ],
                  ),
                )
              : NestedScrollView(
                  headerSliverBuilder: (ctx, _) => [
                    _buildAppBar(),
                    SliverPersistentHeader(
                      pinned: true,
                      delegate: _StickyTabBarDelegate(
                        TabBar(
                          controller: _tabController,
                          isScrollable: true,
                          tabAlignment: TabAlignment.start,
                          labelStyle: GoogleFonts.outfit(
                              fontSize: 13, fontWeight: FontWeight.w700),
                          unselectedLabelStyle: GoogleFonts.outfit(
                              fontSize: 13, fontWeight: FontWeight.w500),
                          labelColor: AppColors.primary,
                          unselectedLabelColor: AppColors.textGray,
                          indicatorColor: AppColors.primary,
                          indicatorWeight: 3,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          tabs: _tabs.map((t) => Tab(text: t)).toList(),
                        ),
                      ),
                    ),
                  ],
                  body: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildAgendaParams(),
                      _buildPrestations(),
                      _buildPersonnel(),
                      _buildEtablissement(),
                      _buildStatistiques(),
                    ],
                  ),
                ),
    );
  }

  SliverAppBar _buildAppBar() {
    return SliverAppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      pinned: false,
      floating: true,
      snap: true,
      expandedHeight: 70,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
        title: Row(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Admin',
                    style: GoogleFonts.outfit(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textDark)),
                Text('Paramètres de l\'établissement',
                    style: GoogleFonts.outfit(
                        fontSize: 11,
                        color: AppColors.textGray,
                        fontWeight: FontWeight.w500)),
              ],
            ),
            const Spacer(),
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: AppColors.cancelled, size: 22),
              tooltip: 'Déconnexion',
              onPressed: _logout,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAgendaParams() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildSectionCard(
          title: 'Paramètres de l\'agenda',
          icon: Icons.calendar_today_rounded,
          children: [
            _buildToggleSetting('Rappels SMS automatiques', true),
            _buildToggleSetting('Confirmations par email', true),
            _buildToggleSetting('Annulation en ligne', false),
            _buildToggleSetting('Double réservation', false),
          ],
        ),
      ],
    );
  }

  Widget _buildPrestations() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildActionButton('Ajouter une prestation', Icons.add_circle_outline_rounded, onTap: _showAddServiceSheet),
        const SizedBox(height: 16),
        if (_vm.services.isEmpty)
          Text('Aucune prestation', style: GoogleFonts.outfit(color: AppColors.textGray)),
        ..._vm.services.map((s) {
          final duration = (s['duration'] as num?)?.toInt() ?? 0;
          final price = (s['price'] as num?)?.toDouble();
          final priceLabel = price != null ? '${price.toStringAsFixed(0)} DH' : 'Sur devis';
          final category = s['category']?.toString() ?? 'Autre';
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.spa_rounded, color: AppColors.primary, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s['name']?.toString() ?? 'Service',
                        style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textDark),
                      ),
                      Row(
                        children: [
                          _tag(category, AppColors.primary),
                          const SizedBox(width: 6),
                          const Icon(Icons.timer_outlined, size: 12, color: AppColors.textLight),
                          const SizedBox(width: 3),
                          Text('$duration min',
                              style: GoogleFonts.outfit(fontSize: 11, color: AppColors.textGray)),
                        ],
                      ),
                    ],
                  ),
                ),
                Text(
                  priceLabel,
                  style: GoogleFonts.outfit(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildPersonnel() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildActionButton('Ajouter un collaborateur', Icons.person_add_rounded, onTap: _showAddStaffSheet),
        const SizedBox(height: 16),
        if (_vm.staff.isEmpty)
          Text('Aucun collaborateur', style: GoogleFonts.outfit(color: AppColors.textGray)),
        ..._vm.staff.asMap().entries.map((entry) {
          final i = entry.key;
          final s = entry.value;
          final name = '${s['firstName'] ?? ''} ${s['lastName'] ?? ''}'.trim();
          final initials = name
              .split(' ')
              .where((w) => w.isNotEmpty)
              .take(2)
              .map((w) => w[0])
              .join()
              .toUpperCase();
          final color = _staffColors[i % _staffColors.length];
          final active = s['isActive'] != false;
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: ClipOval(
                    child: (s['avatar']?.toString() ?? '').trim().isNotEmpty
                        ? Image.network(
                            s['avatar'].toString(),
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => Center(
                              child: Text(
                                initials.isEmpty ? '?' : initials,
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: color,
                                ),
                              ),
                            ),
                          )
                        : Center(
                            child: Text(
                              initials.isEmpty ? '?' : initials,
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: color,
                              ),
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name.isEmpty ? 'Collaborateur' : name,
                          style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textDark)),
                      Text(s['email']?.toString() ?? '',
                          style: GoogleFonts.outfit(fontSize: 12, color: AppColors.textGray)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: active ? AppColors.confirmedBg : AppColors.cancelledBg,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(active ? 'Actif' : 'Inactif',
                      style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: active ? AppColors.confirmed : AppColors.cancelled)),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Future<void> _switchSalon(String tenantId) async {
    final auth = context.read<AuthViewModel>();
    final messenger = ScaffoldMessenger.of(context);
    try {
      await auth.switchSalon(tenantId);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            'Salon actif : ${auth.activeSalonName}',
            style: GoogleFonts.outfit(fontSize: 13),
          ),
          backgroundColor: AppColors.primary,
        ),
      );
    } on ApiException catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text(e.message, style: GoogleFonts.outfit())),
      );
    } catch (_) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('Impossible de changer de salon',
              style: GoogleFonts.outfit()),
        ),
      );
    }
  }

  Widget _buildEtablissement() {
    final auth = context.watch<AuthViewModel>();
    final name = _vm.tenant['name']?.toString() ??
        auth.user?.tenantName ??
        auth.activeSalonName;
    final city = _vm.tenant['city']?.toString() ?? '';
    final country = _vm.tenant['country']?.toString() ?? 'Maroc';
    final phone = _vm.tenant['phone']?.toString() ?? '—';
    final email = _vm.tenant['email']?.toString() ?? '—';
    final address = _vm.tenant['address']?.toString() ?? '—';
    final website = _vm.tenant['website']?.toString() ?? '—';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF059669), Color(0xFF10B981)],
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withOpacity(0.3), width: 1.5),
                ),
                child: const Icon(Icons.spa_rounded, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Colors.white)),
                    Text([city, country].where((e) => e.isNotEmpty).join(', '),
                        style: GoogleFonts.outfit(fontSize: 13, color: Colors.white70)),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (auth.salons.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildSectionCard(
            title: 'Salon actif',
            icon: Icons.storefront_rounded,
            children: [
              if (auth.isSwitchingSalon)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                )
              else
                ...auth.salons.map((s) {
                  final active = s.id == auth.activeTenantId;
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      active
                          ? Icons.check_circle_rounded
                          : Icons.radio_button_unchecked,
                      color: active ? AppColors.primary : AppColors.textLight,
                    ),
                    title: Text(
                      s.name,
                      style: GoogleFonts.outfit(
                        fontWeight:
                            active ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                    subtitle: s.city != null && s.city!.isNotEmpty
                        ? Text(s.city!,
                            style: GoogleFonts.outfit(
                                fontSize: 12, color: AppColors.textGray))
                        : null,
                    onTap: active || auth.isSwitchingSalon
                        ? null
                        : () => _switchSalon(s.id),
                  );
                }),
              if (auth.hasMultipleSalons)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Changer de salon recharge agenda, clients et caisse.',
                    style: GoogleFonts.outfit(
                        fontSize: 11, color: AppColors.textLight),
                  ),
                ),
            ],
          ),
        ],
        const SizedBox(height: 16),
        _buildSectionCard(
          title: 'Informations générales',
          icon: Icons.info_outline_rounded,
          children: [
            _buildEditableRow('Nom du salon', name),
            _buildEditableRow('Téléphone', phone),
            _buildEditableRow('Email', email),
            _buildEditableRow('Adresse', address),
            _buildEditableRow('Site web', website),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: OutlinedButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout_rounded, color: AppColors.cancelled),
            label: Text('Se déconnecter',
                style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w700, color: AppColors.cancelled)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.cancelled),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatistiques() {
    final totalRdv = _vm.stats['totalAppointments']?.toString() ?? '—';
    final clients = _vm.stats['loyalClientsCount']?.toString() ??
        _vm.stats['totalClients']?.toString() ??
        '—';
    final revenue = _vm.stats['totalRevenue'] ?? _vm.stats['revenue'] ?? _vm.stats['monthlyRevenue'];
    final revenueLabel = revenue is num ? '${revenue.toStringAsFixed(0)} DH' : '—';
    final occupancy = _vm.stats['onlineRate'] ?? _vm.stats['occupancyRate'];
    final occupancyLabel = occupancy is num ? '${occupancy.toStringAsFixed(0)}%' : '—';
    final clientsLabel = clients == '—' ? '—' : clients;

    final popular = (_vm.stats['serviceData'] as List?) ??
        (_vm.stats['popularServices'] as List?) ??
        (_vm.stats['topServices'] as List?) ??
        [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: _buildStatBox(totalRdv, 'RDV période',
                  Icons.calendar_month_rounded, AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatBox(occupancyLabel, 'Taux occupation',
                  Icons.donut_large_rounded, AppColors.confirmed),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildStatBox(clientsLabel, 'Clients fidèles',
                  Icons.people_alt_rounded, const Color(0xFF7C3AED)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatBox(revenueLabel, 'CA',
                  Icons.payments_rounded, AppColors.pending),
            ),
          ],
        ),
        if (popular.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildSectionCard(
            title: 'Services les plus populaires',
            icon: Icons.trending_up_rounded,
            children: [
              ...popular.take(5).toList().asMap().entries.map((e) {
                final item = e.value;
                final name = item is Map
                    ? (item['name'] ?? item['serviceName'] ?? 'Service').toString()
                    : item.toString();
                final count = item is Map
                    ? ((item['count'] ?? item['value'] ?? item['total'] ?? 0) as num).toInt()
                    : 0;
                return _buildPopularService(name, count, e.key + 1);
              }),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 18),
              const SizedBox(width: 8),
              Text(
                title,
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(color: AppColors.divider, height: 1),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }

  Widget _buildToggleSetting(String label, bool value) {
    return StatefulBuilder(
      builder: (ctx, setS) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDark)),
            Switch(
              value: value,
              onChanged: (v) => setS(() => value = v),
              activeColor: AppColors.primary,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEditableRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(label,
                style: GoogleFonts.outfit(fontSize: 12, color: AppColors.textGray)),
          ),
          Expanded(
            flex: 3,
            child: Text(value,
                style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDark)),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(String label, IconData icon, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.primary.withOpacity(0.4), width: 1.5),
          borderRadius: BorderRadius.circular(14),
          color: AppColors.primary.withOpacity(0.04),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppColors.primary, size: 20),
            const SizedBox(width: 8),
            Text(label,
                style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary)),
          ],
        ),
      ),
    );
  }

  Widget _tag(String text, Color color) {
    return Container(
      margin: const EdgeInsets.only(right: 6, top: 3),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text,
          style: GoogleFonts.outfit(
              fontSize: 10, fontWeight: FontWeight.w700, color: color)),
    );
  }

  Widget _buildStatBox(String value, String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withOpacity(0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 10),
          Text(value,
              style: GoogleFonts.outfit(
                  fontSize: 22, fontWeight: FontWeight.w800, color: color)),
          Text(label,
              style: GoogleFonts.outfit(
                  fontSize: 12, fontWeight: FontWeight.w600, color: color.withOpacity(0.7))),
        ],
      ),
    );
  }

  Widget _buildPopularService(String name, int count, int rank) {
    final pct = count > 0 ? (count / (count + 20)).clamp(0.1, 1.0) : 0.1;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: rank <= 3
                  ? AppColors.primary.withOpacity(0.1)
                  : AppColors.surfaceGray,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text('$rank',
                  style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: rank <= 3 ? AppColors.primary : AppColors.textGray)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(name,
                          style: GoogleFonts.outfit(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textDark),
                          overflow: TextOverflow.ellipsis),
                    ),
                    Text('$count RDV',
                        style: GoogleFonts.outfit(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary)),
                  ],
                ),
                const SizedBox(height: 5),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: pct.toDouble(),
                    backgroundColor: AppColors.primary.withOpacity(0.08),
                    valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                    minHeight: 5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StickyTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  const _StickyTabBarDelegate(this.tabBar);

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
  bool shouldRebuild(covariant SliverPersistentHeaderDelegate old) => false;
}
