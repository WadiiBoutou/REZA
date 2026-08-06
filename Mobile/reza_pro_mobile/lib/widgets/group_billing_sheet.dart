import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/app_colors.dart';
import '../services/api_client.dart';
import '../services/invoice_service.dart';

const _groupPaymentMethods = <String, String>{
  'CASH': 'Espèces',
  'CARD': 'Carte',
  'BANK_TRANSFER': 'Virement',
  'CHECK': 'Chèque',
};

/// Shared group-billing bottom sheet, mirroring the web pro caisse
/// "Facturer un groupe" modal:
///  - step 1 lists billable groups (or jumps straight to [initialGroupId]
///    when provided — the agenda "Terminé" flow);
///  - step 2 shows the participant breakdown, payer selector, payment method
///    and the combined / separate confirmation buttons.
///
/// Self-contained: it talks directly to [invoiceService] and calls [onDone]
/// after a successful sale so the caller can refresh its own data.
class GroupBillingSheet extends StatefulWidget {
  final String? initialGroupId;
  final Future<void> Function()? onDone;

  const GroupBillingSheet({super.key, this.initialGroupId, this.onDone});

  @override
  State<GroupBillingSheet> createState() => _GroupBillingSheetState();
}

class _GroupBillingSheetState extends State<GroupBillingSheet> {
  List<Map<String, dynamic>> _pendingGroups = [];
  Map<String, dynamic>? _groupDetails;
  String? _selectedGroupId;
  String _payerClientId = '';
  String _groupPaymentMethod = 'CASH';
  bool _groupLoading = false;
  bool _groupSubmitting = false;
  bool _fromList = false;

  @override
  void initState() {
    super.initState();
    final initialId = widget.initialGroupId;
    if (initialId != null && initialId.isNotEmpty) {
      _fromList = false;
      _loadGroupDetails(initialId);
    } else {
      _fromList = true;
      _loadPendingGroups();
    }
  }

  Future<void> _loadPendingGroups() async {
    try {
      final groups = await invoiceService.getPendingGroups();
      if (!mounted) return;
      setState(() => _pendingGroups = groups);
    } catch (_) {
      if (!mounted) return;
      setState(() => _pendingGroups = []);
    }
  }

  Future<void> _loadGroupDetails(String groupId) async {
    setState(() {
      _selectedGroupId = groupId;
      _groupDetails = null;
      _groupLoading = true;
    });
    try {
      final details = await invoiceService.getGroupDetails(groupId);
      if (!mounted) return;
      final participants = (details['participants'] as List?) ?? [];
      final booker = (details['bookerClientId'] as String?) ?? '';
      setState(() {
        _groupDetails = details;
        _payerClientId = booker.isNotEmpty
            ? booker
            : (participants.isNotEmpty
                ? participants.first['clientId']?.toString() ?? ''
                : '');
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _groupDetails = null);
    } finally {
      if (mounted) setState(() => _groupLoading = false);
    }
  }

  void _backToList() {
    setState(() {
      _selectedGroupId = null;
      _groupDetails = null;
      _payerClientId = '';
      _groupPaymentMethod = 'CASH';
    });
    _loadPendingGroups();
  }

  Future<void> _submitCombined() async {
    final groupId = _selectedGroupId;
    if (groupId == null || _groupDetails == null) {
      _showMessage('Veuillez sélectionner un groupe', isError: true);
      return;
    }
    if (_payerClientId.isEmpty) {
      _showMessage('Veuillez sélectionner qui paie', isError: true);
      return;
    }
    setState(() => _groupSubmitting = true);
    try {
      await invoiceService.createGroupSale(
        bookingGroupId: groupId,
        payerClientId: _payerClientId,
        paymentMethod: _groupPaymentMethod,
      );
      if (!mounted) return;
      // Pop + show the success snackbar first (a refresh failure below must
      // not turn a successful sale into an error), then refresh the caller.
      final messenger = ScaffoldMessenger.of(context);
      Navigator.pop(context);
      messenger.showSnackBar(
        SnackBar(
          content:
              Text('Groupe facturé', style: GoogleFonts.outfit(fontSize: 13)),
          backgroundColor: const Color(0xFF7C3AED),
        ),
      );
      try {
        await widget.onDone?.call();
      } catch (_) {/* refresh errors must not mask the success */}
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _groupSubmitting = false);
      _showMessage(e.message, isError: true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _groupSubmitting = false);
      _showMessage("Erreur lors de la facturation du groupe", isError: true);
    }
  }

  Future<void> _submitSeparate() async {
    final groupId = _selectedGroupId;
    if (groupId == null || _groupDetails == null) {
      _showMessage('Veuillez sélectionner un groupe', isError: true);
      return;
    }
    setState(() => _groupSubmitting = true);
    try {
      await invoiceService.separateGroupSale(
        bookingGroupId: groupId,
        paymentMethod: _groupPaymentMethod,
      );
      if (!mounted) return;
      // Pop + show the success snackbar first, then refresh the caller.
      final messenger = ScaffoldMessenger.of(context);
      Navigator.pop(context);
      messenger.showSnackBar(
        SnackBar(
          content: Text('Chaque participant a été facturé séparément',
              style: GoogleFonts.outfit(fontSize: 13)),
          backgroundColor: const Color(0xFF7C3AED),
        ),
      );
      try {
        await widget.onDone?.call();
      } catch (_) {/* refresh errors must not mask the success */}
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _groupSubmitting = false);
      _showMessage(e.message, isError: true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _groupSubmitting = false);
      _showMessage("Erreur lors de la facturation séparée", isError: true);
    }
  }

  void _showMessage(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.outfit()),
        backgroundColor: isError ? AppColors.cancelled : AppColors.primary,
      ),
    );
  }

  String _money(num? v) => '${(v ?? 0).toStringAsFixed(0)} DH';

  @override
  Widget build(BuildContext context) {
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
          Text('Facturer un groupe',
              style: GoogleFonts.outfit(
                  fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            _selectedGroupId == null
                ? 'Sélectionnez un groupe à facturer'
                : 'Détails du groupe et paiement',
            style: GoogleFonts.outfit(fontSize: 12, color: AppColors.textGray),
          ),
          const SizedBox(height: 16),
          Flexible(
            child: SingleChildScrollView(
              child: _selectedGroupId == null
                  ? _buildGroupList()
                  : _buildGroupDetails(),
            ),
          ),
          const SizedBox(height: 16),
          if (_selectedGroupId != null && _groupDetails != null)
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _groupSubmitting
                        ? null
                        : _submitSeparate,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textGray,
                      side: const BorderSide(color: AppColors.border),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24)),
                    ),
                    child: Text(
                      'Facturer séparément',
                      style: GoogleFonts.outfit(
                          fontSize: 12, fontWeight: FontWeight.w700),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _groupSubmitting ||
                            _payerClientId.isEmpty ||
                            _groupDetails?['alreadyInvoiced'] == true ||
                            _groupDetails?['hasInvoicedAppointment'] == true
                        ? null
                        : _submitCombined,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7C3AED),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24)),
                    ),
                    child: Text(
                      _groupSubmitting
                          ? 'Traitement…'
                          : 'Confirmer la facturation',
                      style: GoogleFonts.outfit(
                          fontSize: 12, fontWeight: FontWeight.w700),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ],
            )
          else
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24)),
              ),
              child: Text('Fermer',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
            ),
          TextButton(
            onPressed: _groupSubmitting ? null : () => Navigator.pop(context),
            child: Text('Annuler',
                style: GoogleFonts.outfit(color: AppColors.textGray)),
          ),
        ],
      ),
    );
  }

  Widget _buildGroupList() {
    final billable = _pendingGroups
        .where((g) =>
            g['alreadyInvoiced'] != true &&
            g['hasInvoicedAppointment'] != true)
        .toList();

    if (billable.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text(
            'Aucun groupe en attente de facturation',
            style: GoogleFonts.outfit(fontSize: 13, color: AppColors.textGray),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return Column(
      children: billable.map((g) {
        final names = (g['participantNames'] as List?) ?? [];
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => _loadGroupDetails(g['id']?.toString() ?? ''),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: const Color(0xFF7C3AED).withOpacity(0.08),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.group_rounded,
                          color: Color(0xFF7C3AED), size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            names.join(' & '),
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textDark,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${g['participantCount']} participants',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              color: AppColors.textGray,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded,
                        color: AppColors.textLight),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildGroupDetails() {
    if (_groupLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(
            child: CircularProgressIndicator(color: Color(0xFF7C3AED))),
      );
    }

    final details = _groupDetails;
    if (details == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: Text('Impossible de charger le groupe',
              style: GoogleFonts.outfit(color: AppColors.textGray)),
        ),
      );
    }

    final participants = (details['participants'] as List?) ?? [];
    final total = (details['total'] as num?)?.toDouble() ?? 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_fromList) ...[
          GestureDetector(
            onTap: _backToList,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.arrow_back_ios_new_rounded,
                    size: 13, color: Color(0xFF2563EB)),
                const SizedBox(width: 4),
                Text('Retour à la liste',
                    style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: const Color(0xFF2563EB),
                        fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (details['alreadyInvoiced'] == true) ...[
          _warningBanner('Ce groupe a déjà été facturé.'),
          const SizedBox(height: 8),
        ],
        if (details['hasInvoicedAppointment'] == true &&
            details['alreadyInvoiced'] != true) ...[
          _warningBanner(
              'Un ou plusieurs RDV de ce groupe ont déjà été facturés individuellement.'),
          const SizedBox(height: 8),
        ],
        ...participants.map((p) {
          final pMap = p as Map<String, dynamic>;
          final services = (pMap['services'] as List?) ?? [];
          final subtotal = (pMap['subtotal'] as num?)?.toDouble() ?? 0.0;
          final isBooker = pMap['isBooker'] == true;
          final startTime = DateTime.tryParse(pMap['startTime']?.toString() ?? '');
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surfaceGray,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            pMap['displayName']?.toString() ?? 'Client',
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textDark,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (isBooker) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2563EB).withOpacity(0.08),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text('Réservant',
                                style: GoogleFonts.outfit(
                                    fontSize: 10,
                                    color: const Color(0xFF2563EB),
                                    fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ],
                    ),
                    Text(_money(subtotal),
                        style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textDark)),
                  ],
                ),
                const SizedBox(height: 8),
                ...services.map<Widget>((s) {
                  final sMap = s as Map;
                  final emp = sMap['employee'] as Map?;
                  final empLabel = emp != null
                      ? ' · ${emp['firstName']} ${emp['lastName']}'
                      : '';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: Text(
                            '${sMap['serviceName']}$empLabel',
                            style: GoogleFonts.outfit(
                                fontSize: 12, color: AppColors.textGray),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(_money((sMap['price'] as num?)?.toDouble()),
                            style: GoogleFonts.outfit(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textGray)),
                      ],
                    ),
                  );
                }),
                if (startTime != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.access_time_rounded,
                          size: 12, color: AppColors.textLight),
                      const SizedBox(width: 4),
                      Text(
                        DateFormat('HH:mm', 'fr_FR')
                            .format(startTime.toLocal()),
                        style: GoogleFonts.outfit(
                            fontSize: 11, color: AppColors.textLight),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          );
        }),
        const SizedBox(height: 4),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.divider)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total',
                  style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textDark)),
              Text(_money(total),
                  style: GoogleFonts.outfit(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textDark)),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text('Payé par',
            style:
                GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: _payerClientId.isEmpty ? null : _payerClientId,
          isExpanded: true,
          decoration: InputDecoration(
            hintText: 'Sélectionner qui paie',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          items: participants
              .where((p) =>
                  (p as Map)['clientId']?.toString().isNotEmpty == true)
              .map((p) {
                final pMap = p as Map;
                final label =
                    '${pMap['displayName']}${pMap['isBooker'] == true ? ' (Réservant)' : ''}';
                return DropdownMenuItem(
                  value: pMap['clientId'].toString(),
                  child: Text(label, overflow: TextOverflow.ellipsis),
                );
              }).toList(),
          onChanged: _groupSubmitting
              ? null
              : (v) {
                  if (v != null) setState(() => _payerClientId = v);
                },
        ),
        const SizedBox(height: 12),
        Text('Mode de paiement',
            style:
                GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: _groupPaymentMethod,
          decoration: InputDecoration(
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          items: _groupPaymentMethods.entries
              .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
              .toList(),
          onChanged: _groupSubmitting
              ? null
              : (v) {
                  if (v != null) {
                    setState(() => _groupPaymentMethod = v);
                  }
                },
        ),
      ],
    );
  }

  Widget _warningBanner(String message) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Text(
        message,
        style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF9A3412)),
      ),
    );
  }
}
