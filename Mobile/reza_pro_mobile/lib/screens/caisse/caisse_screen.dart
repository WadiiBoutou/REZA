import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../services/api_client.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../viewmodels/caisse_viewmodel.dart';
import '../../widgets/group_billing_sheet.dart';
import '../../widgets/page_controls.dart';
import '../../widgets/pro_drawer.dart';

class CaisseScreen extends StatefulWidget {
  const CaisseScreen({super.key});

  @override
  State<CaisseScreen> createState() => _CaisseScreenState();
}

class _CaisseScreenState extends State<CaisseScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _showActions = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<CaisseViewModel>();

    return Scaffold(
      backgroundColor: Colors.white,
      drawer: const ProDrawer(),
      body: vm.loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : vm.error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(vm.error!,
                          style: GoogleFonts.outfit(color: AppColors.cancelled)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => vm.load(),
                        style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary),
                        child: Text('Réessayer',
                            style: GoogleFonts.outfit(color: Colors.white)),
                      ),
                    ],
                  ),
                )
              : CustomScrollView(
                  slivers: [
                    _buildAppBar(context, vm),
                    SliverToBoxAdapter(child: _PeriodSelector(vm: vm)),
                    SliverToBoxAdapter(child: _buildSearch(vm)),
                    SliverToBoxAdapter(child: _RevenueCard(vm: vm)),
                    SliverToBoxAdapter(child: _PaymentBreakdown(vm: vm)),
                    SliverToBoxAdapter(child: _TransactionsHeader(vm: vm)),
                    SliverToBoxAdapter(
                      child: PagedSwipe(
                        page: vm.currentPage,
                        onPrevious: vm.previousPage,
                        onNext: vm.nextPage,
                        child: vm.pageTransactions.isEmpty
                            ? Padding(
                                padding: const EdgeInsets.all(32),
                                child: Center(
                                  child: Text(
                                    vm.searchQuery.trim().isEmpty
                                        ? 'Aucune transaction sur cette période'
                                        : 'Aucune transaction trouvée',
                                    style: GoogleFonts.outfit(
                                      color: AppColors.textGray,
                                    ),
                                  ),
                                ),
                              )
                            : Column(
                                children: [
                                  for (final txn in vm.pageTransactions)
                                    _TransactionItem(txn: txn),
                                ],
                              ),
                      ),
                    ),
                    const SliverPadding(padding: EdgeInsets.only(bottom: 88)),
                  ],
                ),
      bottomNavigationBar: vm.loading || vm.error != null
          ? null
          : PagePager(
              page: vm.currentPage,
              totalPages: vm.totalPages,
              onPrevious: vm.previousPage,
              onNext: vm.nextPage,
            ),
      floatingActionButton: _buildActionsToggle(),
    );
  }

  Widget _buildSearch(CaisseViewModel vm) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: TextField(
          controller: _searchController,
          onChanged: vm.setSearch,
          style: GoogleFonts.outfit(fontSize: 13),
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: 'Client, service, n° facture...',
            hintStyle: GoogleFonts.outfit(
              fontSize: 13,
              color: AppColors.textLight,
            ),
            prefixIcon: const Icon(
              Icons.search_rounded,
              color: AppColors.textGray,
              size: 20,
            ),
            suffixIcon: _searchController.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Effacer',
                    onPressed: () {
                      _searchController.clear();
                      vm.setSearch('');
                    },
                    icon: const Icon(
                      Icons.close_rounded,
                      color: AppColors.textGray,
                      size: 18,
                    ),
                  ),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 13),
          ),
        ),
      ),
    );
  }

  Widget _buildActionsToggle() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        IgnorePointer(
          ignoring: !_showActions,
          child: AnimatedAlign(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            alignment: Alignment.bottomRight,
            heightFactor: _showActions ? 1 : 0,
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 180),
              opacity: _showActions ? 1 : 0,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  FloatingActionButton.extended(
                    onPressed: () {
                      setState(() => _showActions = false);
                      _showGroupBillingSheet(context);
                    },
                    backgroundColor: const Color(0xFF7C3AED),
                    foregroundColor: Colors.white,
                    heroTag: 'groupBillingFab',
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                    icon: const Icon(Icons.group_rounded, size: 20),
                    label: Text(
                      'Facturer un groupe',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FloatingActionButton.extended(
                    onPressed: () {
                      setState(() => _showActions = false);
                      _showNewSaleSheet(context);
                    },
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    heroTag: 'newSaleFab',
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                    icon: const Icon(Icons.add_rounded, size: 22),
                    label: Text(
                      'Nouvelle vente',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ),
        FloatingActionButton(
          heroTag: 'caisseActionsToggle',
          onPressed: () => setState(() => _showActions = !_showActions),
          backgroundColor: _showActions ? AppColors.textDark : AppColors.primary,
          foregroundColor: Colors.white,
          shape: const CircleBorder(),
          child: Icon(_showActions ? Icons.close_rounded : Icons.add_rounded, size: 26),
        ),
      ],
    );
  }

  SliverAppBar _buildAppBar(BuildContext context, CaisseViewModel vm) {
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
            'Caisse',
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.textDark,
            ),
          ),
          if (auth.hasMultipleSalons)
            Text(
              auth.salonFilterLabel,
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
          onPressed: () => vm.load(),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.confirmedBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.circle, color: AppColors.confirmed, size: 8),
                const SizedBox(width: 6),
                Text(
                  'Ouvert',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.confirmed,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _showNewSaleSheet(BuildContext context) async {
    final vm = context.read<CaisseViewModel>();
    await vm.loadSaleOptions();
    if (!context.mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChangeNotifierProvider.value(
        value: vm,
        child: const _NewSaleSheet(),
      ),
    );
  }

  Future<void> _showGroupBillingSheet(BuildContext context) async {
    final vm = context.read<CaisseViewModel>();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => GroupBillingSheet(
        onDone: () async {
          await vm.load();
        },
      ),
    );
  }
}

class _PeriodSelector extends StatelessWidget {
  final CaisseViewModel vm;
  const _PeriodSelector({required this.vm});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: List.generate(vm.periods.length, (i) {
            final selected = i == vm.selectedPeriod;
            return Expanded(
              child: GestureDetector(
                onTap: () => vm.setPeriod(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.all(4),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    vm.periods[i],
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: selected ? Colors.white : AppColors.textGray,
                    ),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _RevenueCard extends StatelessWidget {
  final CaisseViewModel vm;
  const _RevenueCard({required this.vm});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF059669), Color(0xFF10B981)],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Chiffre d\'affaires',
            style: GoogleFonts.outfit(
              fontSize: 13,
              color: Colors.white70,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${vm.totalRevenue.toStringAsFixed(0)} DH',
            style: GoogleFonts.outfit(
              fontSize: 38,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _sub(
                  '${vm.paidCount} transactions',
                  'Encaissées',
                  Icons.check_circle_outline_rounded,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _sub(
                  '${vm.pendingRevenue.toStringAsFixed(0)} DH',
                  'En attente',
                  Icons.pending_outlined,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _sub(String value, String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.white, size: 20),
          const SizedBox(width: 10),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Colors.white),
                    overflow: TextOverflow.ellipsis),
                Text(label,
                    style: GoogleFonts.outfit(
                        fontSize: 10,
                        color: Colors.white70,
                        fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentBreakdown extends StatelessWidget {
  final CaisseViewModel vm;
  const _PaymentBreakdown({required this.vm});

  @override
  Widget build(BuildContext context) {
    final methods = <String, double>{};
    for (final t in vm.transactions.where((t) => t['status'] == 'paid')) {
      final m = t['method'] as String;
      methods[m] = (methods[m] ?? 0) + (t['amount'] as double);
    }
    final total = methods.values.fold(0.0, (a, b) => a + b);
    final colors = [
      AppColors.primary,
      const Color(0xFF3B82F6),
      const Color(0xFF8B5CF6)
    ];
    final icons = [
      Icons.credit_card_rounded,
      Icons.payments_rounded,
      Icons.account_balance_rounded
    ];

    if (methods.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Moyens de paiement',
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          const SizedBox(height: 14),
          ...methods.entries.toList().asMap().entries.map((entry) {
            final i = entry.key;
            final method = entry.value.key;
            final amount = entry.value.value;
            final pct = total > 0 ? (amount / total * 100) : 0;
            final color = colors[i % colors.length];
            final icon = icons[i % icons.length];
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: color, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(method,
                                style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textDark)),
                            Text('${amount.toStringAsFixed(0)} DH',
                                style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: color)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: pct / 100,
                            backgroundColor: color.withOpacity(0.12),
                            valueColor: AlwaysStoppedAnimation(color),
                            minHeight: 6,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _TransactionsHeader extends StatelessWidget {
  final CaisseViewModel vm;
  const _TransactionsHeader({required this.vm});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Transactions',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
          Text(
            '${vm.transactions.length} opérations',
            style: GoogleFonts.outfit(
              fontSize: 12,
              color: AppColors.textGray,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _TransactionItem extends StatelessWidget {
  final Map<String, dynamic> txn;
  const _TransactionItem({required this.txn});

  @override
  Widget build(BuildContext context) {
    final isPaid = txn['status'] == 'paid';
    final isPending = txn['status'] == 'pending';
    final Color statusColor = isPaid
        ? AppColors.confirmed
        : isPending
            ? AppColors.pending
            : AppColors.cancelled;
    final Color statusBg = isPaid
        ? AppColors.confirmedBg
        : isPending
            ? AppColors.pendingBg
            : AppColors.cancelledBg;
    final String statusLabel =
        isPaid ? 'Payé' : isPending ? 'En attente' : 'Annulé';

    final methodIcon = txn['method'] == 'Carte'
        ? Icons.credit_card_rounded
        : txn['method'] == 'Virement'
            ? Icons.account_balance_rounded
            : Icons.payments_rounded;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(methodIcon, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        txn['client'],
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textDark,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      '${(txn['amount'] as double).toStringAsFixed(0)} DH',
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color:
                            isPaid ? AppColors.confirmed : AppColors.textDark,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        txn['service'],
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: AppColors.textGray,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        statusLabel,
                        style: GoogleFonts.outfit(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.access_time_rounded,
                        size: 12, color: AppColors.textLight),
                    const SizedBox(width: 4),
                    Text(
                      '${txn['time']}',
                      style: GoogleFonts.outfit(
                          fontSize: 11, color: AppColors.textLight),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NewSaleSheet extends StatefulWidget {
  const _NewSaleSheet();

  @override
  State<_NewSaleSheet> createState() => _NewSaleSheetState();
}

class _NewSaleSheetState extends State<_NewSaleSheet> {
  String? _clientId;
  final Set<String> _serviceIds = {};
  Map<String, String?> _serviceEmployeeIds = {};
  List<Map<String, dynamic>> _employees = [];
  String _paymentMethod = 'CASH';
  final _amountCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _amountOverridden = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    // Use addPostFrameCallback so we can safely access the provider
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final vm = context.read<CaisseViewModel>();
        setState(() {
          _employees = List.from(vm.employees);
        });
      }
    });
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _recalcAmount(CaisseViewModel vm) {
    if (_amountOverridden) return;
    final sum = _serviceIds.fold<double>(0, (acc, id) {
      final s = vm.catalogServices.firstWhere(
        (x) => x['id']?.toString() == id,
        orElse: () => <String, dynamic>{},
      );
      return acc + vm.servicePrice(s);
    });
    _amountCtrl.text = sum > 0 ? sum.toStringAsFixed(0) : '';
  }

  Future<void> _submit() async {
    final vm = context.read<CaisseViewModel>();
    final auth = context.read<AuthViewModel>();
    setState(() => _submitting = true);
    try {
      final amount = double.tryParse(_amountCtrl.text.replaceAll(',', '.'));
      await vm.createSale(
        clientId: _clientId ?? '',
        serviceIds: _serviceIds.toList(),
        paymentMethod: _paymentMethod,
        amountOverride: _amountOverridden ? amount : null,
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
        tenantId: auth.activeTenantId,
        serviceEmployeeIds: _serviceEmployeeIds,
      );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text('Vente encaissée', style: GoogleFonts.outfit(fontSize: 13)),
          backgroundColor: AppColors.primary,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message, style: GoogleFonts.outfit())),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('Erreur lors de l\'encaissement',
                style: GoogleFonts.outfit())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<CaisseViewModel>();
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      margin: EdgeInsets.only(bottom: bottom),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Nouvelle vente',
              style: GoogleFonts.outfit(
                  fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            DateFormat('d MMMM yyyy', 'fr_FR').format(DateTime.now()),
            style: GoogleFonts.outfit(fontSize: 12, color: AppColors.textGray),
          ),
          const SizedBox(height: 16),
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Client *',
                      style: GoogleFonts.outfit(
                          fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: _clientId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      hintText: 'Sélectionner un client',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                    ),
                    items: vm.clients.map((c) {
                      final id = c['id']?.toString() ?? '';
                      final name =
                          '${c['firstName'] ?? ''} ${c['lastName'] ?? ''}'
                              .trim();
                      return DropdownMenuItem(
                        value: id,
                        child: Text(name.isEmpty ? 'Client' : name,
                            overflow: TextOverflow.ellipsis),
                      );
                    }).toList(),
                    onChanged: _submitting
                        ? null
                        : (v) => setState(() => _clientId = v),
                  ),
                  const SizedBox(height: 16),
                  Text('Services *',
                      style: GoogleFonts.outfit(
                          fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  if (vm.catalogServices.isEmpty)
                    Text('Aucune prestation',
                        style: GoogleFonts.outfit(color: AppColors.textGray))
                  else
                    ...vm.catalogServices.map((s) {
                      final id = s['id']?.toString() ?? '';
                      final name = s['name']?.toString() ?? 'Service';
                      final price = vm.servicePrice(s);
                      final selected = _serviceIds.contains(id);
                      return Column(
                        key: ValueKey(id),
                        children: [
                          CheckboxListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            value: selected,
                            title: Text(name, style: GoogleFonts.outfit(fontSize: 14)),
                            subtitle: Text('${price.toStringAsFixed(0)} DH',
                                style: GoogleFonts.outfit(
                                    fontSize: 12, color: AppColors.textGray)),
                            onChanged: _submitting
                                ? null
                                : (v) {
                                    setState(() {
                                      if (v == true) {
                                        _serviceIds.add(id);
                                        if (!_serviceEmployeeIds.containsKey(id)) {
                                          _serviceEmployeeIds[id] = _employees.isNotEmpty
                                              ? _employees.first['id']?.toString()
                                              : null;
                                        }
                                      } else {
                                        _serviceIds.remove(id);
                                        _serviceEmployeeIds.remove(id);
                                      }
                                      _recalcAmount(vm);
                                    });
                                  },
                          ),
                          if (selected) ...[
                            Padding(
                              padding: const EdgeInsets.only(left: 8, bottom: 8, right: 8),
                              child: Row(
                                children: [
                                  const SizedBox(width: 28),
                                  Expanded(
                                    child: DropdownButtonFormField<String>(
                                      value: _serviceEmployeeIds[id],
                                      isExpanded: true,
                                      decoration: InputDecoration(
                                        labelText: 'Employé (optionnel)',
                                        labelStyle: GoogleFonts.outfit(fontSize: 12),
                                        border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(10)),
                                        contentPadding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 6),
                                        isDense: true,
                                      ),
                                      items: [
                                        const DropdownMenuItem(
                                          value: '',
                                          child: Text('Aucun',
                                              style: TextStyle(fontSize: 13)),
                                        ),
                                        ..._employees.map((e) {
                                          final eid = e['id']?.toString() ?? '';
                                          final ename =
                                              '${e['firstName'] ?? ''} ${e['lastName'] ?? ''}'
                                                  .trim();
                                          return DropdownMenuItem(
                                            value: eid,
                                            child: Text(ename.isEmpty ? 'Employé' : ename,
                                                style: const TextStyle(fontSize: 13)),
                                          );
                                        }),
                                      ],
                                      onChanged: _submitting
                                          ? null
                                          : (v) {
                                              setState(() {
                                                _serviceEmployeeIds[id] = v;
                                              });
                                            },
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      );
                    }),
                  const SizedBox(height: 12),
                  Text('Montant (DH)',
                      style: GoogleFonts.outfit(
                          fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _amountCtrl,
                    keyboardType: TextInputType.number,
                    enabled: !_submitting,
                    onChanged: (_) =>
                        setState(() => _amountOverridden = true),
                    decoration: InputDecoration(
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text('Mode de paiement',
                      style: GoogleFonts.outfit(
                          fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: _paymentMethod,
                    decoration: InputDecoration(
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                    ),
                    items: CaisseViewModel.paymentMethodLabels.entries
                        .map((e) => DropdownMenuItem(
                            value: e.key, child: Text(e.value)))
                        .toList(),
                    onChanged: _submitting
                        ? null
                        : (v) {
                            if (v != null) {
                              setState(() => _paymentMethod = v);
                            }
                          },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _notesCtrl,
                    enabled: !_submitting,
                    decoration: InputDecoration(
                      labelText: 'Note (optionnel)',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _submitting ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24)),
            ),
            child: Text(
              _submitting ? 'Encaissement…' : 'Encaisser',
              style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
            ),
          ),
          TextButton(
            onPressed: _submitting ? null : () => Navigator.pop(context),
            child: Text('Annuler',
                style: GoogleFonts.outfit(color: AppColors.textGray)),
          ),
        ],
      ),
    );
  }
}
