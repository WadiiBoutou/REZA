import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants.dart';

class ProOnboardingScreen extends StatefulWidget {
  const ProOnboardingScreen({super.key});

  @override
  State<ProOnboardingScreen> createState() => _ProOnboardingScreenState();
}

class _ProOnboardingScreenState extends State<ProOnboardingScreen> {
  int _step = 1;
  String? _hasCommercialLocal;

  final TextEditingController _establishmentNameController = TextEditingController();
  final TextEditingController _contactNameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _postalCodeController = TextEditingController();
  String? _selectedCity;

  final _formKey = GlobalKey<FormState>();

  final List<Map<String, dynamic>> _citiesList = [
    {'value': 'casablanca', 'label': 'Casablanca', 'available': true},
    {'value': 'marrakech', 'label': 'Marrakech', 'available': true},
    {'value': 'rabat', 'label': 'Rabat (Bientôt disponible)', 'available': false},
    {'value': 'tanger', 'label': 'Tanger (Bientôt disponible)', 'available': false},
    {'value': 'fes', 'label': 'Fès (Bientôt disponible)', 'available': false},
  ];

  @override
  void dispose() {
    _establishmentNameController.dispose();
    _contactNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _postalCodeController.dispose();
    super.dispose();
  }

  void _handleUserType(String type) {
    if (type == 'client') {
      Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
    } else {
      setState(() {
        _step = 2;
      });
    }
  }

  void _handleBusinessType(String _) {
    setState(() {
      _step = 3;
    });
  }

  void _handleCommercialLocal(String val) {
    setState(() {
      _hasCommercialLocal = val;
      _step = 4;
    });
  }

  void _showCitySelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SÉLECTIONNEZ UNE VILLE',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textGray,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 16),
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _citiesList.length,
                itemBuilder: (context, index) {
                  final city = _citiesList[index];
                  final isAvail = city['available'] as bool;
                  return ListTile(
                    enabled: isAvail,
                    title: Text(
                      city['label'] as String,
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w500,
                        color: isAvail ? AppColors.textDark : AppColors.textGray,
                      ),
                    ),
                    trailing: _selectedCity == city['value']
                        ? const Icon(Icons.check, color: AppColors.primary)
                        : null,
                    onTap: () {
                      setState(() {
                        _selectedCity = city['value'] as String;
                      });
                      Navigator.pop(context);
                    },
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _handleSubmit() {
    if (_formKey.currentState!.validate()) {
      if (_selectedCity == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Veuillez sélectionner une ville")),
        );
        return;
      }

      // Show loader animations
      String loadingText = "Création du compte...";
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) {
          return StatefulBuilder(
            builder: (context, setStateDialog) {
              Future.delayed(const Duration(milliseconds: 900), () {
                if (context.mounted) {
                  setStateDialog(() {
                    loadingText = "Nous créons votre compte...";
                  });
                }
              });
              Future.delayed(const Duration(milliseconds: 1800), () {
                if (context.mounted) {
                  setStateDialog(() {
                    loadingText = "Finalisation...";
                  });
                }
              });
              return Dialog(
                backgroundColor: AppColors.background,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                child: Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: AppColors.primary),
                      const SizedBox(height: 24),
                      Text(
                        loadingText,
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textDark,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      );

      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) {
          Navigator.pop(context); // Close dialog
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Inscription de l'établissement réussie !")),
          );
          Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: _step > 1
            ? IconButton(
                icon: const Icon(Icons.arrow_back, color: AppColors.offBlack),
                onPressed: () => setState(() => _step--),
              )
            : null,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'WELLBE',
                  style: GoogleFonts.inter(
                    color: AppColors.textDark,
                    fontSize: 16,
                    fontWeight: FontWeight.w200,
                    letterSpacing: 4,
                  ),
                ),
                Row(
                  children: [
                    Container(width: 15, height: 1, color: AppColors.primary),
                    const SizedBox(width: 2),
                    Text(
                      'PRO',
                      style: GoogleFonts.inter(
                        color: AppColors.primary,
                        fontSize: 6,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2,
                      ),
                    ),
                  ],
                )
              ],
            )
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Progress Bar
            if (_step > 1) _buildProgressBar(),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: _buildStepContent(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressBar() {
    double progress = (_step - 1) / 3.0; // steps: 2, 3, 4
    return LinearProgressIndicator(
      value: progress,
      backgroundColor: Colors.black12,
      color: AppColors.offBlack,
      minHeight: 3,
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case 1:
        return _buildStep1();
      case 2:
        return _buildStep2();
      case 3:
        return _buildStep3();
      case 4:
        return _buildStep4();
      default:
        return const SizedBox();
    }
  }

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 16),
        Text(
          'Devenir partenaire WellBe Pro',
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.bold, color: AppColors.textDark),
        ),
        const SizedBox(height: 12),
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: GoogleFonts.inter(color: AppColors.textGray, fontSize: 15),
            children: const [
              TextSpan(text: "Soyez visibles auprès de "),
              TextSpan(text: "milliers d'utilisateurs", style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textDark)),
              TextSpan(text: "."),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline, color: Colors.green, size: 16),
            const SizedBox(width: 6),
            Text("Sans engagement", style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
            const SizedBox(width: 16),
            const Icon(Icons.check_circle_outline, color: Colors.green, size: 16),
            const SizedBox(width: 6),
            Text("Sans commission", style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray)),
          ],
        ),
        const SizedBox(height: 48),

        // Action card 1: Pro
        GestureDetector(
          onTap: () => _handleUserType('professional'),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.offBlack,
              borderRadius: BorderRadius.circular(20),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 4))],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                  child: const Icon(Icons.storefront, color: AppColors.offBlack, size: 24),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Je suis gérant d'un établissement",
                        style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "Coiffure, esthétique, barber, bien-être...",
                        style: GoogleFonts.inter(color: Colors.white70, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 16),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Action card 2: Client
        GestureDetector(
          onTap: () => _handleUserType('client'),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.black12),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(color: AppColors.background, shape: BoxShape.circle),
                  child: const Icon(Icons.calendar_month_outlined, color: AppColors.textDark, size: 24),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Je ne suis pas un professionnel",
                        style: GoogleFonts.inter(color: AppColors.textDark, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "Je souhaite prendre un rendez-vous beauté",
                        style: GoogleFonts.inter(color: AppColors.textGray, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios, color: AppColors.textGray, size: 16),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Text(
          'Quel établissement souhaitez-vous équiper ?',
          style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.textDark),
        ),
        const SizedBox(height: 32),
        _buildSelectionTile("Salon de coiffure ou barbershop", () => _handleBusinessType('salon')),
        _buildSelectionTile("Institut de beauté ou bar à ongles", () => _handleBusinessType('beauty')),
        _buildSelectionTile("Spa ou centre de bien-être", () => _handleBusinessType('spa')),
        const SizedBox(height: 32),
        Center(
          child: TextButton(
            onPressed: () => Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false),
            child: Text(
              "Retour à l'accueil",
              style: GoogleFonts.inter(color: AppColors.textGray, decoration: TextDecoration.underline),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSelectionTile(String text, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.black12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                text,
                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textDark),
              ),
              const Icon(Icons.arrow_forward_ios, color: AppColors.textGray, size: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStep3() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 16),
        Text(
          'Exercez-vous dans un local commercial ?',
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.textDark),
        ),
        const SizedBox(height: 48),
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 55,
                child: ElevatedButton(
                  onPressed: () => _handleCommercialLocal('oui'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _hasCommercialLocal == 'oui' ? AppColors.offBlack : Colors.white,
                    foregroundColor: _hasCommercialLocal == 'oui' ? Colors.white : AppColors.textDark,
                    side: const BorderSide(color: Colors.black12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: Text('Oui', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: SizedBox(
                height: 55,
                child: ElevatedButton(
                  onPressed: () => _handleCommercialLocal('non'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _hasCommercialLocal == 'non' ? AppColors.offBlack : Colors.white,
                    foregroundColor: _hasCommercialLocal == 'non' ? Colors.white : AppColors.textDark,
                    side: const BorderSide(color: Colors.black12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: Text('Non', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep4() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Informations sur votre établissement',
            style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.textDark),
          ),
          const SizedBox(height: 4),
          Text(
            'Remplissez les informations ci-dessous pour créer votre compte professionnel',
            style: GoogleFonts.inter(color: AppColors.textGray, fontSize: 12),
          ),
          const SizedBox(height: 24),

          TextFormField(
            controller: _establishmentNameController,
            style: GoogleFonts.inter(fontSize: 13),
            decoration: _inputDecoration("Nom de l'établissement *"),
            validator: (val) => val == null || val.trim().isEmpty ? "Champs requis" : null,
          ),
          const SizedBox(height: 16),

          TextFormField(
            controller: _contactNameController,
            style: GoogleFonts.inter(fontSize: 13),
            decoration: _inputDecoration("Nom du contact *"),
            validator: (val) => val == null || val.trim().isEmpty ? "Champs requis" : null,
          ),
          const SizedBox(height: 16),

          TextFormField(
            controller: _emailController,
            style: GoogleFonts.inter(fontSize: 13),
            keyboardType: TextInputType.emailAddress,
            decoration: _inputDecoration("Email professionnel *"),
            validator: (val) => val == null || val.isEmpty || !val.contains('@') ? "Email valide requis" : null,
          ),
          const SizedBox(height: 16),

          TextFormField(
            controller: _phoneController,
            style: GoogleFonts.inter(fontSize: 13),
            keyboardType: TextInputType.phone,
            decoration: _inputDecoration("Téléphone *"),
            validator: (val) => val == null || val.trim().isEmpty ? "Champs requis" : null,
          ),
          const SizedBox(height: 16),

          TextFormField(
            controller: _addressController,
            style: GoogleFonts.inter(fontSize: 13),
            decoration: _inputDecoration("Adresse complète *"),
            validator: (val) => val == null || val.trim().isEmpty ? "Champs requis" : null,
          ),
          const SizedBox(height: 16),

          // Custom dropdown trigger for city
          InkWell(
            onTap: _showCitySelector,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: Colors.black12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _selectedCity != null
                        ? _citiesList.firstWhere((c) => c['value'] == _selectedCity)['label'] as String
                        : 'Sélectionnez une ville *',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: _selectedCity != null ? AppColors.textDark : AppColors.textGray,
                    ),
                  ),
                  const Icon(Icons.arrow_drop_down, color: AppColors.textGray),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          TextFormField(
            controller: _postalCodeController,
            style: GoogleFonts.inter(fontSize: 13),
            keyboardType: TextInputType.number,
            decoration: _inputDecoration("Code postal"),
          ),
          const SizedBox(height: 20),

          Text(
            "* Note : Actuellement, nous sommes disponibles uniquement à Casablanca et Marrakech. D'autres villes seront bientôt ajoutées.",
            style: GoogleFonts.inter(color: AppColors.textGray, fontSize: 11, fontStyle: FontStyle.italic),
          ),
          const SizedBox(height: 32),

          // Action row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: () => setState(() => _step = 3),
                child: Text('Retour', style: GoogleFonts.inter(color: AppColors.textGray, fontWeight: FontWeight.bold)),
              ),
              ElevatedButton(
                onPressed: _handleSubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.offBlack,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                ),
                child: Row(
                  children: [
                    Text('Créer mon compte', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_forward, size: 16),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.inter(color: AppColors.textGray, fontSize: 13),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: const BorderSide(color: Colors.black12)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: const BorderSide(color: Colors.black12)),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
    );
  }
}
