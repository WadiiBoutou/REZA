import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'viewmodels/auth_viewmodel.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/pro_onboarding_screen.dart';
import 'constants.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final auth = AuthViewModel();
  await auth.bootstrap();
  runApp(RezaApp(auth: auth));
}

class RezaApp extends StatelessWidget {
  const RezaApp({super.key, required this.auth});
  final AuthViewModel auth;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: auth,
      child: MaterialApp(
        title: 'REZA',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          primaryColor: AppColors.primary,
          scaffoldBackgroundColor: AppColors.background,
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.primary,
            primary: AppColors.primary,
            surface: AppColors.surface,
          ),
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
          fontFamily: 'Inter',
          // Material 3 derives a pinkish/mauve secondaryContainer from ANY
          // seed color, which is what tints the default date picker. Restyle
          // it explicitly to the app's black/white/gray palette.
          datePickerTheme: DatePickerThemeData(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            headerBackgroundColor: AppColors.primary,
            headerForegroundColor: Colors.white,
            headerHeadlineStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
            headerHelpStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: Colors.white70,
            ),
            weekdayStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textGray,
            ),
            dayStyle: const TextStyle(
              fontFamily: 'Inter',
              fontSize: 13,
            ),
            dayBackgroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.selected)) {
                return AppColors.primary;
              }
              return Colors.transparent;
            }),
            dayForegroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.selected)) return Colors.white;
              if (states.contains(WidgetState.disabled)) {
                return AppColors.textLight;
              }
              return AppColors.textDark;
            }),
            dayOverlayColor: WidgetStatePropertyAll(
              AppColors.primary.withValues(alpha: 0.08),
            ),
            todayForegroundColor: WidgetStatePropertyAll(AppColors.primary),
            todayBackgroundColor: WidgetStatePropertyAll(
              Colors.transparent,
            ),
            todayBorder: BorderSide(
              color: AppColors.primary.withValues(alpha: 0.6),
              width: 1.5,
            ),
            yearBackgroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.selected)) {
                return AppColors.primary;
              }
              return Colors.transparent;
            }),
            yearForegroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.selected)) return Colors.white;
              return AppColors.textDark;
            }),
            rangeSelectionBackgroundColor: AppColors.primary.withValues(
              alpha: 0.10,
            ),
            rangeSelectionOverlayColor: WidgetStatePropertyAll(
              AppColors.primary.withValues(alpha: 0.08),
            ),
            dividerColor: AppColors.border,
            cancelButtonStyle: TextButton.styleFrom(
              foregroundColor: AppColors.textGray,
            ),
            confirmButtonStyle: TextButton.styleFrom(
              foregroundColor: AppColors.primary,
            ),
            elevation: 4,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
        initialRoute: '/',
        routes: {
          '/': (context) => const HomeScreen(),
          '/login': (context) => const LoginScreen(),
          '/pro-info': (context) => const ProOnboardingScreen(),
        },
      ),
    );
  }
}
