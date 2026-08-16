import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'constants/app_colors.dart';
import 'mock_data.dart';
import 'viewmodels/auth_viewmodel.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';
import 'widgets/rz_logo.dart';

void main() {
  initializeMockData();
  initializeDateFormatting('fr_FR', null).then((_) {
    runApp(const RezaProApp());
  });
}

class RezaProApp extends StatelessWidget {
  const RezaProApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthViewModel(),
      child: MaterialApp(
        title: 'Reza Pro',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.primary,
            primary: AppColors.primary,
            surface: Colors.white,
          ),
          scaffoldBackgroundColor: Colors.white,
          textTheme: GoogleFonts.outfitTextTheme(),
          appBarTheme: AppBarTheme(
            backgroundColor: Colors.white,
            foregroundColor: AppColors.textDark,
            elevation: 0,
            centerTitle: true,
            titleTextStyle: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
            ),
          ),
        ),
        home: const _AuthGate(),
        routes: {
          '/login': (context) => const LoginScreen(),
          '/dashboard': (context) => const DashboardScreen(),
        },
      ),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthViewModel>(
      builder: (context, auth, _) {
        if (auth.isBooting) {
          return Scaffold(
            backgroundColor: Colors.white,
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const RzLogo(size: 72),
                  const SizedBox(height: 24),
                  Text(
                    'Reza Pro',
                    style: GoogleFonts.outfit(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: 40,
                    height: 40,
                    child: CircularProgressIndicator(
                      strokeWidth: 3,
                      color: AppColors.primary,
                      backgroundColor: AppColors.primary.withOpacity(0.15),
                    ),
                  ),
                ],
              ),
            ),
          );
        }
        if (auth.isAuthenticated) {
          return const DashboardScreen();
        }
        return const LoginScreen();
      },
    );
  }
}
