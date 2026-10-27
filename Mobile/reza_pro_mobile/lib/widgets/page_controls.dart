import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

/// Bottom pager: previous arrow, "Page x / y", next arrow.
class PagePager extends StatelessWidget {
  final int page;
  final int totalPages;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  const PagePager({
    super.key,
    required this.page,
    required this.totalPages,
    required this.onPrevious,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final canPrev = page > 1;
    final canNext = page < totalPages;
    return Material(
      color: Colors.white,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SizedBox(
          height: 52,
          child: Row(
            children: [
              _arrow(
                icon: Icons.chevron_left_rounded,
                tooltip: 'Page précédente',
                enabled: canPrev,
                onPressed: onPrevious,
              ),
              Expanded(
                child: Text(
                  'Page $page / $totalPages',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
              ),
              _arrow(
                icon: Icons.chevron_right_rounded,
                tooltip: 'Page suivante',
                enabled: canNext,
                onPressed: onNext,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _arrow({
    required IconData icon,
    required String tooltip,
    required bool enabled,
    required VoidCallback onPressed,
  }) {
    return IconButton(
      tooltip: tooltip,
      onPressed: enabled ? onPressed : null,
      icon: Icon(icon),
      iconSize: 28,
      color: AppColors.textDark,
      disabledColor: AppColors.textLight,
      constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
    );
  }
}

/// Swipe left for the next page, swipe right for the previous page.
/// Arrows stay the primary control; the swipe is the shortcut.
class PagedSwipe extends StatefulWidget {
  final int page;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final Widget child;
  final bool expand;

  const PagedSwipe({
    super.key,
    required this.page,
    required this.onPrevious,
    required this.onNext,
    required this.child,
    this.expand = false,
  });

  @override
  State<PagedSwipe> createState() => _PagedSwipeState();
}

class _PagedSwipeState extends State<PagedSwipe> {
  int _direction = 1;

  @override
  void didUpdateWidget(PagedSwipe oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.page != oldWidget.page) {
      _direction = widget.page > oldWidget.page ? 1 : -1;
    }
  }

  void _onDragEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (velocity <= -280) {
      widget.onNext();
    } else if (velocity >= 280) {
      widget.onPrevious();
    }
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final switcher = AnimatedSwitcher(
      duration: reduceMotion
          ? Duration.zero
          : const Duration(milliseconds: 220),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      layoutBuilder: (current, previous) {
        return Stack(
          alignment: Alignment.topCenter,
          children: [
            ...previous,
            if (current != null) current,
          ],
        );
      },
      transitionBuilder: (child, animation) {
        final incoming = child.key == ValueKey(widget.page);
        final begin = Offset((incoming ? _direction : -_direction) * 0.08, 0);
        return SlideTransition(
          position: Tween<Offset>(begin: begin, end: Offset.zero).animate(animation),
          child: FadeTransition(opacity: animation, child: child),
        );
      },
      child: KeyedSubtree(
        key: ValueKey(widget.page),
        child: widget.child,
      ),
    );

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragEnd: _onDragEnd,
      child: widget.expand ? SizedBox.expand(child: switcher) : switcher,
    );
  }
}
