import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../constants.dart';

/// Politique de confidentialité — plateforme REZA.
class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: AppColors.textDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Politique de confidentialité',
          style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textDark),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'REZA',
              style: GoogleFonts.inter(fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 4, color: AppColors.textDark),
            ),
            const SizedBox(height: 4),
            Text(
              'Plateforme de réservation de salons et instituts',
              style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray),
            ),
            const SizedBox(height: 24),
            _section('1. Données collectées', [
              'Les informations que vous fournissez lors de la création de votre compte : prénom, nom, adresse email, numéro de téléphone, et les informations facultatives que vous choisissez d\'ajouter (photo de profil, genre, date de naissance).',
              'Les informations liées à votre activité sur la plateforme : réservations, avis, favoris, et proches ajoutés.',
              'Des données techniques lors de l\'utilisation de l\'application (adresse IP, type d\'appareil) afin d\'assurer le bon fonctionnement et la sécurité du service.',
            ]),
            _section('2. Utilisation des données', [
              'Gérer vos réservations auprès des salons partenaires.',
              'Vous permettre de retrouver vos proches, avis et favoris.',
              'Vous envoyer des notifications liées à vos réservations et, si vous y consentez, des communications sur nos services.',
            ]),
            _section('3. Partage des données', [
              'Vos informations de contact (nom, téléphone) sont partagées avec le salon que vous réservez, uniquement dans le cadre de votre réservation.',
              'Nous ne vendons jamais vos données personnelles à des tiers.',
            ]),
            _section('4. Conservation des données', [
              'Vos données sont conservées le temps nécessaire à la fourniture du service. Vous pouvez demander la suppression de votre compte et de vos données à tout moment.',
            ]),
            _section('5. Vos droits', [
              'Conformément à la réglementation applicable en matière de protection des données, vous disposez d\'un droit d\'accès, de rectification, d\'opposition et de suppression de vos données personnelles.',
              'Pour exercer ces droits, contactez-nous depuis l\'application ou par email.',
            ]),
            _section('6. Sécurité', [
              'Vos données sont protégées par des mesures techniques et organisationnelles appropriées. Les mots de passe sont stockés de manière sécurisée et ne sont jamais conservés en clair.',
            ]),
            const SizedBox(height: 8),
            Text(
              'Dernière mise à jour : août 2026',
              style: GoogleFonts.inter(fontSize: 12, color: AppColors.textLight),
            ),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, List<String> bullets) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textDark)),
          const SizedBox(height: 8),
          ...bullets.map(
            (b) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 7),
                    child: Icon(Icons.circle, size: 5, color: AppColors.textGray),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      b,
                      style: GoogleFonts.inter(fontSize: 13.5, height: 1.45, color: AppColors.textGray),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
