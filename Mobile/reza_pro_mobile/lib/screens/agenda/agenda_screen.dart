import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../constants/app_colors.dart';
import '../../models/appointment.dart';
import '../../services/api_client.dart';
import '../../viewmodels/agenda_viewmodel.dart';
import '../../viewmodels/new_appointment_viewmodel.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../../widgets/appointment_modal.dart';
import '../../widgets/group_billing_sheet.dart';
import '../../widgets/pro_drawer.dart';

/// Timed block after classic calendar column-packing (overlap graph).
class _PackedSlot {
  _PackedSlot({
    required this.appointment,
    required this.startMin,
    required this.endMin,
    required this.top,
    required this.height,
  });

  final Appointment appointment;
  final double startMin;
  final double endMin;
  final double top;
  final double height;
  int column = 0;
  int columnCount = 1;
}

/// Pack overlapping intervals into side-by-side columns (Web day grid idea).
List<_PackedSlot> _packDayAppointments(List<Appointment> apps) {
  const dayStartHour = 8;
  const daySpanMinutes = 11 * 60; // 08:00 → 19:00
  const hourHeight = 70.0;

  final items = <_PackedSlot>[];
  for (final app in apps) {
    try {
      final parts = app.time.split(':');
      final hour = int.parse(parts[0]);
      final minute = int.parse(parts[1]);
      final startMin = ((hour - dayStartHour) * 60.0) + minute;
      if (startMin < 0 || startMin > daySpanMinutes) continue;
      final endMin = startMin + app.duration.toDouble();
      items.add(
        _PackedSlot(
          appointment: app,
          startMin: startMin,
          endMin: endMin,
          top: (startMin / 60.0) * hourHeight,
          height: (app.duration / 60.0) * hourHeight,
        ),
      );
    } catch (_) {
      // skip malformed time
    }
  }

  items.sort((a, b) {
    final byStart = a.startMin.compareTo(b.startMin);
    if (byStart != 0) return byStart;
    return b.endMin.compareTo(a.endMin); // longer first
  });

  // Greedy earliest-free column.
  final columnEnds = <double>[];
  for (final item in items) {
    var placed = false;
    for (var col = 0; col < columnEnds.length; col++) {
      if (columnEnds[col] <= item.startMin) {
        item.column = col;
        columnEnds[col] = item.endMin;
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.column = columnEnds.length;
      columnEnds.add(item.endMin);
    }
  }

  // Cluster connected overlaps → columnCount = max cols in cluster.
  final n = items.length;
  if (n == 0) return items;
  final parent = List<int>.generate(n, (i) => i);
  int find(int i) {
    while (parent[i] != i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  void union(int a, int b) {
    final ra = find(a);
    final rb = find(b);
    if (ra != rb) parent[rb] = ra;
  }

  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      if (items[j].startMin >= items[i].endMin) break;
      union(i, j);
    }
  }

  final clusterMaxCol = <int, int>{};
  for (var i = 0; i < n; i++) {
    final root = find(i);
    clusterMaxCol[root] =
        math.max(clusterMaxCol[root] ?? 0, items[i].column);
  }
  for (var i = 0; i < n; i++) {
    items[i].columnCount = (clusterMaxCol[find(i)] ?? 0) + 1;
  }

  return items;
}

const _paymentMethods = <String, String>{
  'CASH': 'Espèces',
  'CARD': 'Carte',
  'BANK_TRANSFER': 'Virement',
  'CHECK': 'Chèque',
};

class AgendaScreen extends StatelessWidget {
  const AgendaScreen({super.key});

  Future<void> _openDatePicker(BuildContext context, AgendaViewModel vm) async {
    await vm.ensureMonthLoaded(vm.selectedDate);
    if (!context.mounted) return;
    DateTime focused = vm.selectedDate;
    DateTime selected = vm.selectedDate;

    final picked = await showDialog<DateTime>(
      context: context,
      builder: (ctx) {
        return ListenableBuilder(
          listenable: vm,
          builder: (ctx, _) {
            return StatefulBuilder(
              builder: (ctx, setLocal) {
                final markers = vm.daysWithAppointments;
                return AlertDialog(
                  title: Text(
                    'Sélectionner une date',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                  ),
                  contentPadding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                  content: SizedBox(
                    width: 340,
                    child: TableCalendar(
                      locale: 'fr_FR',
                      firstDay:
                          DateTime.now().subtract(const Duration(days: 365)),
                      lastDay: DateTime.now().add(const Duration(days: 365)),
                      focusedDay: focused,
                      selectedDayPredicate: (d) => isSameDay(d, selected),
                      calendarFormat: CalendarFormat.month,
                      startingDayOfWeek: StartingDayOfWeek.monday,
                      availableCalendarFormats: const {
                        CalendarFormat.month: 'Mois',
                      },
                      headerStyle: HeaderStyle(
                        titleCentered: true,
                        formatButtonVisible: false,
                        titleTextStyle: GoogleFonts.outfit(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                      calendarStyle: CalendarStyle(
                        todayDecoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.25),
                          shape: BoxShape.circle,
                        ),
                        selectedDecoration: const BoxDecoration(
                          color: Color(0xFF4ADE80),
                          shape: BoxShape.circle,
                        ),
                        markerDecoration: const BoxDecoration(
                          color: AppColors.navy,
                          shape: BoxShape.circle,
                        ),
                        markersMaxCount: 1,
                        markerSize: 5,
                        markerMargin: const EdgeInsets.only(top: 6),
                      ),
                      eventLoader: (day) {
                        final key = DateTime(day.year, day.month, day.day);
                        return markers.contains(key) ? [key] : const [];
                      },
                      onDaySelected: (day, focusedDay) {
                        selected = day;
                        focused = focusedDay;
                        setLocal(() {});
                      },
                      onPageChanged: (focusedDay) async {
                        focused = focusedDay;
                        await vm.ensureMonthLoaded(focusedDay);
                        setLocal(() {});
                      },
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: Text('Annuler', style: GoogleFonts.outfit()),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, selected),
                      child: Text(
                        'OK',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );

    if (picked != null) await vm.setDate(picked);
  }

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<AgendaViewModel>();
    final auth = context.watch<AuthViewModel>();

    return Scaffold(
      backgroundColor: Colors.white,
      drawer: const ProDrawer(),
      appBar: AppBar(
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        title: InkWell(
          onTap: () => _openDatePicker(context, vm),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                DateFormat('E d MMM', 'fr_FR').format(vm.selectedDate),
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const Icon(Icons.keyboard_arrow_down, size: 18),
            ],
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () async {
              await Future.wait([
                vm.loadAppointments(),
                vm.loadMonthAppointments(forMonth: vm.selectedDate, force: true),
              ]);
            },
          ),
        ],
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0.5,
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: const BoxDecoration(
              color: Color(0xFFFAFAFA),
              border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE))),
            ),
            child: Column(
              children: [
                if (auth.hasMultipleSalons)
                  Text(
                    auth.salonFilterLabel,
                    style: GoogleFonts.outfit(
                      color: AppColors.textLight,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                if (auth.hasMultipleSalons) const SizedBox(height: 2),
                Text(
                  vm.selectedEmployeeId.isEmpty
                      ? 'Tous les collaborateurs'
                      : vm.selectedEmployeeLabel,
                  style: GoogleFonts.outfit(
                    color: Colors.grey[600],
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Expanded(child: _EmployeeDropdown(vm: vm)),
                const SizedBox(width: 8),
                Expanded(
                  child: _SimpleDropdown(
                    value: vm.selectedStatus,
                    items: vm.statuses,
                    onChanged: (v) {
                      if (v != null) vm.setStatus(v);
                    },
                  ),
                ),
              ],
            ),
          ),
          Expanded(child: _AgendaBody(vm: vm)),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: Colors.transparent,
            builder: (_) => ChangeNotifierProvider(
              create: (_) =>
                  NewAppointmentViewModel(vm.selectedDate)..loadOptions(),
              child: NewAppointmentModal(
                selectedDate: vm.selectedDate,
                onAdd: (_) async {
                  await Future.wait([
                    vm.loadAppointments(),
                    vm.loadMonthAppointments(
                        forMonth: vm.selectedDate, force: true),
                  ]);
                },
              ),
            ),
          );
        },
        backgroundColor: const Color(0xFF10B981),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}

class _EmployeeDropdown extends StatelessWidget {
  final AgendaViewModel vm;
  const _EmployeeDropdown({required this.vm});

  @override
  Widget build(BuildContext context) {
    final items = <DropdownMenuItem<String>>[
      const DropdownMenuItem(value: '', child: Text('Tous')),
      ...vm.employees.map((e) {
        final id = e['id']?.toString() ?? '';
        final name = '${e['firstName'] ?? ''} ${e['lastName'] ?? ''}'.trim();
        return DropdownMenuItem(value: id, child: Text(name.isEmpty ? '—' : name));
      }),
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: vm.selectedEmployeeId,
          isExpanded: true,
          icon: const Icon(Icons.expand_more, size: 18),
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
          items: items,
          onChanged: (v) => vm.setEmployeeId(v ?? ''),
        ),
      ),
    );
  }
}

class _SimpleDropdown extends StatelessWidget {
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;
  const _SimpleDropdown({
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          icon: const Icon(Icons.expand_more, size: 18),
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
          items: items
              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _AgendaBody extends StatelessWidget {
  final AgendaViewModel vm;
  const _AgendaBody({required this.vm});

  Future<void> _handleStatus(
    BuildContext context,
    Appointment app,
    String uiStatus,
  ) async {
    if (uiStatus == 'completed') {
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => _FinalizeCaisseDialog(appointment: app, vm: vm),
      );
      return;
    }
    try {
      await vm.updateStatus(app, uiStatus);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Rendez-vous ${Appointment.labelFr(uiStatus)}',
              style: GoogleFonts.outfit(fontSize: 13),
            ),
            backgroundColor: AppColors.primary,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: GoogleFonts.outfit())),
        );
      }
    }
  }

  void _openNewAppointmentAtSlot(
    BuildContext context,
    AgendaViewModel vm, {
    required int hour,
    required int minute,
  }) {
    final timeStr =
        '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => NewAppointmentModal(
        selectedDate: vm.selectedDate,
        initialTime: timeStr,
        onAdd: (_) async {
          await Future.wait([
            vm.loadAppointments(),
            vm.loadMonthAppointments(forMonth: vm.selectedDate, force: true),
          ]);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (vm.loading) {
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (vm.error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(vm.error!, style: GoogleFonts.outfit(color: Colors.red)),
            TextButton(
                onPressed: vm.loadAppointments, child: const Text('Réessayer')),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 16, 16, 80),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: List.generate(11, (index) {
                final hour = 8 + index;
                return Container(
                  height: 70,
                  alignment: Alignment.topCenter,
                  padding: const EdgeInsets.only(right: 8),
                  child: Text(
                    '${hour.toString().padLeft(2, '0')}:00',
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      color: Colors.grey[500],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                );
              }),
            ),
            Container(width: 1, height: 770, color: Colors.grey[200]),
            const SizedBox(width: 8),
            Expanded(
              child: SizedBox(
                height: 770,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final packed =
                        _packDayAppointments(vm.filteredAppointments);
                    final totalW = constraints.maxWidth;
                    const gap = 2.0;
                    return Stack(
                      children: [
                        // Tap targets for each hour row (empty slot → create appointment)
                        ...List.generate(11, (index) {
                          final hour = 8 + index;
                          return Positioned(
                            top: index * 70.0,
                            left: 0,
                            right: 0,
                            height: 70,
                            child: GestureDetector(
                              onTap: () => _openNewAppointmentAtSlot(
                                context,
                                vm,
                                hour: hour,
                                minute: 0,
                              ),
                              child:
                                  Container(height: 1, color: Colors.grey[100]),
                            ),
                          );
                        }),
                        // Appointment blocks
                        ...packed.map((slot) {
                          final app = slot.appointment;
                          var blockColor = const Color(0xFF60A5FA);
                          if (app.service.contains('Coupe')) {
                            blockColor = const Color(0xFF8B5CF6);
                          } else if (app.service.contains('Coloration')) {
                            blockColor = const Color(0xFF14B8A6);
                          } else if (app.service.contains('Soin')) {
                            blockColor = const Color(0xFFEC4899);
                          }
                          final colW = totalW / slot.columnCount;
                          final left = slot.column * colW;
                          final width = math.max(colW - gap, 12.0);
                          final blockHeight = math.max(slot.height - 2, 18).toDouble();
                          final contentHeight = blockHeight - 8; // minus padding
                          // Determine layout intensity based on available height
                          final showServicesRow = contentHeight >= 24;
                          final showNameRow = contentHeight >= 14;
                          return Positioned(
                            top: slot.top,
                            left: left,
                            width: width,
                            height: blockHeight,
                            child: GestureDetector(
                              onTap: () {
                                showModalBottomSheet(
                                  context: context,
                                  backgroundColor: Colors.transparent,
                                  isScrollControlled: true,
                                  builder: (_) => _DetailsSheet(
                                    appointment: app,
                                    onStatusChanged: (s) async {
                                      Navigator.pop(context);
                                      await _handleStatus(context, app, s);
                                    },
                                  ),
                                );
                              },
                              child: Container(
                                decoration: BoxDecoration(
                                  color: blockColor.withOpacity(0.85),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: blockColor),
                                ),
                                padding: const EdgeInsets.all(4),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (showNameRow)
                                      Flexible(
                                        child: Text(
                                          '${app.time} - ${app.clientName}',
                                          style: GoogleFonts.outfit(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                          maxLines: 1,
                                        ),
                                      ),
                                    if (showServicesRow)
                                      Flexible(
                                        child: app.services.length > 1
                                            ? Text(
                                                app.services
                                                    .map((s) => s.name)
                                                    .join(', '),
                                                style: GoogleFonts.outfit(
                                                  color: Colors.white
                                                      .withOpacity(0.9),
                                                  fontSize: 10,
                                                ),
                                                overflow:
                                                    TextOverflow.ellipsis,
                                                maxLines: 1,
                                              )
                                            : Text(
                                                app.service,
                                                style: GoogleFonts.outfit(
                                                  color: Colors.white
                                                      .withOpacity(0.9),
                                                  fontSize: 10,
                                                ),
                                                overflow:
                                                    TextOverflow.ellipsis,
                                              ),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailsSheet extends StatelessWidget {
  final Appointment appointment;
  final Future<void> Function(String)? onStatusChanged;
  const _DetailsSheet({required this.appointment, this.onStatusChanged});

  @override
  Widget build(BuildContext context) {
    final canConfirm = Appointment.canConfirm(appointment.status);
    final canDone = Appointment.canMarkAbsentOrDone(appointment.status);

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Détails du rendez-vous',
              style: GoogleFonts.outfit(
                  fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Text(appointment.clientName,
              style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (appointment.services.isNotEmpty) ...[
            Text('Services (${appointment.services.length})',
                style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textLight)),
            const SizedBox(height: 4),
            ...appointment.services.map((s) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                '• ${s.name} • ${s.duration} min • ${s.price.toStringAsFixed(0)} MAD'
                '${s.employeeName != null && s.employeeName!.isNotEmpty ? ' — ${s.employeeName}' : ''}',
                style: GoogleFonts.outfit(fontSize: 13, color: AppColors.textGray),
              ),
            )),
            const SizedBox(height: 4),
            Text(
              'Total: ${appointment.totalDuration} min • ${appointment.totalPrice.toStringAsFixed(0)} MAD',
              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark),
            ),
          ] else
            Text(appointment.service),
          const SizedBox(height: 8),
          Text('${appointment.time} · ${appointment.duration} min'),
          Text(appointment.employee),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceGray,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  Appointment.labelFr(appointment.status),
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              if (appointment.bookingGroupId != null &&
                  appointment.bookingGroupId!.isNotEmpty)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7C3AED).withOpacity(0.08),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.group_rounded,
                          size: 13, color: Color(0xFF7C3AED)),
                      const SizedBox(width: 4),
                      Text(
                        'Réservation de groupe',
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF7C3AED),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (canConfirm)
                _ActionChip(
                  label: 'Confirmé',
                  color: const Color(0xFF10B981),
                  onTap: () => onStatusChanged?.call('confirmed'),
                ),
              if (canDone)
                _ActionChip(
                  label: 'Terminé',
                  color: const Color(0xFF3B82F6),
                  onTap: () => onStatusChanged?.call('completed'),
                ),
              if (canDone)
                _ActionChip(
                  label: 'Absent',
                  color: const Color(0xFFF59E0B),
                  onTap: () => onStatusChanged?.call('no_show'),
                ),
              OutlinedButton(
                onPressed: () => Navigator.pop(context),
                child: Text('Fermer', style: GoogleFonts.outfit()),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionChip({
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      child: Text(label, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
    );
  }
}

class _FinalizeCaisseDialog extends StatefulWidget {
  final Appointment appointment;
  final AgendaViewModel vm;
  const _FinalizeCaisseDialog({
    required this.appointment,
    required this.vm,
  });

  @override
  State<_FinalizeCaisseDialog> createState() => _FinalizeCaisseDialogState();
}

class _FinalizeCaisseDialogState extends State<_FinalizeCaisseDialog> {
  String _paymentMethod = 'CASH';
  bool _loading = false;
  bool _billed = false;

  Future<void> _withCaisse() async {
    setState(() => _loading = true);
    try {
      final msg = await widget.vm.completeWithCaisse(
        widget.appointment,
        paymentMethod: _paymentMethod,
      );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg, style: GoogleFonts.outfit(fontSize: 13)),
          backgroundColor: AppColors.primary,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message, style: GoogleFonts.outfit())),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erreur lors de l’encaissement',
              style: GoogleFonts.outfit()),
        ),
      );
    }
  }

  Future<void> _withoutCaisse() async {
    setState(() => _loading = true);
    try {
      await widget.vm.completeWithoutCaisse(widget.appointment);
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Rendez-vous terminé',
              style: GoogleFonts.outfit(fontSize: 13)),
          backgroundColor: AppColors.primary,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e', style: GoogleFonts.outfit())),
      );
    }
  }

  bool get _isGroup =>
      widget.appointment.bookingGroupId != null &&
      widget.appointment.bookingGroupId!.isNotEmpty;

  /// Ouvre la facturation de groupe pour le RDV courant (parité web pro).
  Future<void> _groupBilling() async {
    _billed = false;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => GroupBillingSheet(
        initialGroupId: widget.appointment.bookingGroupId,
        onDone: () async {
          _billed = true;
          await Future.wait([
            widget.vm.loadAppointments(),
            widget.vm.loadMonthAppointments(
                forMonth: widget.vm.selectedDate, force: true),
          ]);
        },
      ),
    );
    // La vente a réussi → fermer la fenêtre de finalisation (le RDV est désormais terminé).
    if (_billed && mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final apt = widget.appointment;
    final servicesDisplay = apt.services.length > 1
        ? '${apt.services.length} services • ${apt.totalDuration} min • ${apt.totalPrice.toStringAsFixed(0)} DH'
        : apt.services.isNotEmpty
            ? '${apt.services[0].name} • ${apt.totalPrice.toStringAsFixed(0)} DH'
            : '${apt.service} • ${(apt.servicePrice ?? 0).toStringAsFixed(0)} DH';

    return AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(
        'Finaliser le rendez-vous',
        style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 18),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Voulez-vous ajouter cette prestation à la caisse ?',
            style: GoogleFonts.outfit(fontSize: 14, color: AppColors.textGray),
          ),
          const SizedBox(height: 8),
          Text(
            '${apt.clientName} · $servicesDisplay',
            style: GoogleFonts.outfit(fontSize: 12, color: AppColors.textLight),
          ),
          const SizedBox(height: 16),
          Text('Mode de paiement',
              style: GoogleFonts.outfit(
                  fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: _paymentMethod,
            decoration: InputDecoration(
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            ),
            items: _paymentMethods.entries
                .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                .toList(),
            onChanged: _loading
                ? null
                : (v) {
                    if (v != null) setState(() => _paymentMethod = v);
                  },
          ),
        ],
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ElevatedButton(
              onPressed: _loading ? null : _withCaisse,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF3B82F6),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24)),
              ),
              child: Text(
                _loading ? 'Traitement…' : 'Ajouter à la caisse',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
              ),
            ),
            if (_isGroup) ...[
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: _loading ? null : _groupBilling,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C3AED),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24)),
                ),
                child: Text(
                  'Facturer le groupe',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                ),
              ),
            ],
            const SizedBox(height: 8),
            TextButton(
              onPressed: _loading ? null : _withoutCaisse,
              child: Text('Terminé sans caisse',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
            ),
            TextButton(
              onPressed: _loading ? null : () => Navigator.pop(context),
              child: Text('Annuler',
                  style: GoogleFonts.outfit(color: AppColors.textGray)),
            ),
          ],
        ),
      ],
    );
  }
}
