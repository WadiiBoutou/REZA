import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../constants.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../services/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.returnResultOnSuccess = false});

  /// When true, a successful login/sign-up pops this screen with `true`
  /// instead of navigating to the home screen — used by the group-booking
  /// gate so a guest can log in and immediately resume their booking.
  final bool returnResultOnSuccess;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  int _step = 0;
  bool _isSignUp = false;
  bool _showPassword = false;
  bool _showConfirmPassword = false;
  bool _acceptTerms = false;
  bool _submitting = false;

  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();
  final TextEditingController _firstNameController = TextEditingController();
  final TextEditingController _lastNameController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _forgotMode = false;
  bool _resetSent = false;
  final TextEditingController _resetEmailController = TextEditingController();

  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(vsync: this, duration: const Duration(milliseconds: 400));
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeIn);
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _resetEmailController.dispose();
    super.dispose();
  }

  void _nextStep() async {
    if (_submitting) return;
    if (_step == 0) {
      final email = _emailController.text.trim();
      if (email.isEmpty || !email.contains('@')) {
        _showError('Veuillez entrer une adresse email valide');
        return;
      }
      _animController.reset();
      setState(() => _step = _isSignUp ? 2 : 1);
      _animController.forward();
    } else if (_step == 1) {
      final pw = _passwordController.text;
      if (pw.length < 6) {
        _showError('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
      await _submitLogin();
    } else {
      await _submitSignUp();
    }
  }

  Future<void> _submitLogin() async {
    setState(() => _submitting = true);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
    );
    try {
      await context.read<AuthViewModel>().login(
            _emailController.text.trim(),
            _passwordController.text,
          );
      if (!mounted) return;
      if (widget.returnResultOnSuccess) {
        // Dismiss the loading dialog first, then return to the caller.
        Navigator.pop(context);
        Navigator.pop(context, true);
        return;
      }
      Navigator.pop(context);
      Navigator.pushNamedAndRemoveUntil(context, '/', (r) => false);

    } on ApiException catch (e) {
      if (mounted) {
        Navigator.pop(context);
        _showError(e.message);
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        _showError(e.toString());
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitSignUp() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_acceptTerms) {
      _showError("Veuillez accepter les conditions d'utilisation");
      return;
    }
    setState(() => _submitting = true);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
    );
    try {
      await context.read<AuthViewModel>().register(
            email: _emailController.text.trim(),
            firstName: _firstNameController.text.trim(),
            lastName: _lastNameController.text.trim(),
            password: _passwordController.text,
          );
      if (!mounted) return;
      if (widget.returnResultOnSuccess) {
        // Dismiss the loading dialog first, then return to the caller.
        Navigator.pop(context);
        Navigator.pop(context, true);
        return;
      }
      Navigator.pop(context);
      Navigator.pushNamedAndRemoveUntil(context, '/', (r) => false);

    } on ApiException catch (e) {
      if (mounted) {
        Navigator.pop(context);
        _showError(e.message);
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        _showError(e.toString());
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: GoogleFonts.inter(fontSize: 13)),
        backgroundColor: AppColors.textDark,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  if (_step > 0 || _forgotMode)
                    IconButton(
                      icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textDark),
                      onPressed: () {
                        _animController.reset();
                        setState(() {
                          if (_forgotMode) {
                            _forgotMode = false;
                            _resetSent = false;
                          } else {
                            _step = _isSignUp && _step == 2 ? 0 : _step - 1;
                          }
                        });
                        _animController.forward();
                      },
                    )
                  else
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.textDark),
                      onPressed: () => Navigator.pop(context),
                    ),
                  const Spacer(),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(28, 0, 28, 28),
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: Form(
                    key: _formKey,
                    child: _forgotMode ? _buildForgotPassword() : _buildStepContent(),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        Center(
          child: Text(
            'REZA',
            style: GoogleFonts.inter(
              fontSize: 40,
              fontWeight: FontWeight.w900,
              color: AppColors.textDark,
              letterSpacing: -1,
            ),
          ),
        ),
        const SizedBox(height: 36),
        Text(
          _step == 0
              ? (_isSignUp ? 'Créer un compte' : 'Bon retour !')
              : _step == 1
                  ? 'Votre mot de passe'
                  : 'Vos informations',
          style: GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.textDark),
        ),
        const SizedBox(height: 6),
        Text(
          _step == 0
              ? (_isSignUp ? 'Entrez votre email pour commencer' : 'Connectez-vous à votre compte REZA')
              : _step == 1
                  ? 'Entrez votre mot de passe pour ${_emailController.text}'
                  : 'Complétez votre profil pour continuer',
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray, height: 1.4),
        ),
        const SizedBox(height: 32),
        if (_step == 0) ...[
          _buildLabel('Email'),
          const SizedBox(height: 8),
          _buildTextField(
            controller: _emailController,
            hint: 'vous@exemple.com',
            icon: Icons.mail_outline_rounded,
            keyboardType: TextInputType.emailAddress,
          ),
        ] else if (_step == 1) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.mail_outline_rounded, size: 18, color: AppColors.textGray),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(_emailController.text, style: GoogleFonts.inter(fontSize: 14, color: AppColors.textDark)),
                ),
                GestureDetector(
                  onTap: () {
                    _animController.reset();
                    setState(() => _step = 0);
                    _animController.forward();
                  },
                  child: Text('Modifier', style: GoogleFonts.inter(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600, decoration: TextDecoration.underline)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _buildLabel('Mot de passe'),
          const SizedBox(height: 8),
          _buildPasswordField(
            controller: _passwordController,
            hint: '••••••••',
            showPassword: _showPassword,
            onToggle: () => setState(() => _showPassword = !_showPassword),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: GestureDetector(
              onTap: () {
                _animController.reset();
                setState(() => _forgotMode = true);
                _animController.forward();
              },
              child: Text(
                'Mot de passe oublié ?',
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
              ),
            ),
          ),
        ] else ...[
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildLabel('Prénom'),
                    const SizedBox(height: 8),
                    _buildTextField(
                      controller: _firstNameController,
                      hint: 'Sara',
                      icon: Icons.person_outline_rounded,
                      validator: (v) => v!.trim().isEmpty ? 'Requis' : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildLabel('Nom'),
                    const SizedBox(height: 8),
                    _buildTextField(
                      controller: _lastNameController,
                      hint: 'Moukite',
                      icon: Icons.person_outline_rounded,
                      validator: (v) => v!.trim().isEmpty ? 'Requis' : null,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildLabel('Mot de passe'),
          const SizedBox(height: 8),
          _buildPasswordField(
            controller: _passwordController,
            hint: '••••••••',
            showPassword: _showPassword,
            onToggle: () => setState(() => _showPassword = !_showPassword),
            validator: (v) => v!.length < 6 ? 'Min 6 caractères' : null,
          ),
          const SizedBox(height: 16),
          _buildLabel('Confirmer le mot de passe'),
          const SizedBox(height: 8),
          _buildPasswordField(
            controller: _confirmPasswordController,
            hint: '••••••••',
            showPassword: _showConfirmPassword,
            onToggle: () => setState(() => _showConfirmPassword = !_showConfirmPassword),
            validator: (v) => v != _passwordController.text ? 'Les mots de passe ne correspondent pas' : null,
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () => setState(() => _acceptTerms = !_acceptTerms),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: _acceptTerms ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: _acceptTerms ? AppColors.primary : AppColors.border, width: 2),
                  ),
                  child: _acceptTerms ? const Icon(Icons.check_rounded, size: 14, color: Colors.white) : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    "J'accepte les conditions d'utilisation et la politique de confidentialité de REZA.",
                    style: GoogleFonts.inter(fontSize: 13, color: AppColors.textGray, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 28),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _submitting ? null : _nextStep,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text(
              _step == 1
                  ? 'Se connecter'
                  : _step == 2
                      ? 'Créer mon compte'
                      : 'Continuer',
              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ),
        ),
        if (_step == 0) ...[
          const SizedBox(height: 20),
          Row(
            children: [
              const Expanded(child: Divider(color: AppColors.border)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text('OU', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textGray, fontWeight: FontWeight.w600)),
              ),
              const Expanded(child: Divider(color: AppColors.border)),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: OutlinedButton(
              onPressed: () => _showError('Connexion Google bientôt disponible'),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 22,
                    height: 22,
                    decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFEA4335)),
                    child: const Center(
                      child: Text('G', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text('Continuer avec Google', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textDark)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 32),
          Center(
            child: GestureDetector(
              onTap: () {
                _animController.reset();
                setState(() {
                  _isSignUp = !_isSignUp;
                  _step = 0;
                });
                _animController.forward();
              },
              child: RichText(
                text: TextSpan(
                  style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray),
                  children: [
                    TextSpan(text: _isSignUp ? 'Déjà un compte ? ' : "Pas encore de compte ? "),
                    TextSpan(
                      text: _isSignUp ? 'Se connecter' : "S'inscrire",
                      style: GoogleFonts.inter(color: AppColors.textDark, fontWeight: FontWeight.w700, decoration: TextDecoration.underline),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Center(
          child: Text(
            '🔒 Connexion sécurisée SSL',
            style: GoogleFonts.inter(fontSize: 12, color: AppColors.textLight),
          ),
        ),
      ],
    );
  }

  Widget _buildForgotPassword() {
    if (_resetSent) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 40),
          Container(
            width: 80, height: 80,
            decoration: BoxDecoration(color: AppColors.availableLight, shape: BoxShape.circle),
            child: const Icon(Icons.mail_outline_rounded, color: AppColors.available, size: 38),
          ),
          const SizedBox(height: 24),
          Text('Email envoyé !', style: GoogleFonts.inter(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.textDark)),
          const SizedBox(height: 12),
          Text(
            'Vérifiez votre boîte de réception à\n${_resetEmailController.text}',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray, height: 1.5),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: () => setState(() {
                _forgotMode = false;
                _resetSent = false;
              }),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text('Retour à la connexion', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        Center(child: Text('REZA', style: GoogleFonts.inter(fontSize: 40, fontWeight: FontWeight.w900, color: AppColors.textDark))),
        const SizedBox(height: 36),
        Text('Mot de passe oublié ?', style: GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.textDark)),
        const SizedBox(height: 8),
        Text('Entrez votre email et nous vous enverrons un lien de réinitialisation.', style: GoogleFonts.inter(fontSize: 14, color: AppColors.textGray, height: 1.4)),
        const SizedBox(height: 28),
        _buildLabel('Adresse email'),
        const SizedBox(height: 8),
        _buildTextField(controller: _resetEmailController, hint: 'vous@exemple.com', icon: Icons.mail_outline_rounded),
        const SizedBox(height: 28),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: () {
              final email = _resetEmailController.text.trim();
              if (email.isEmpty || !email.contains('@')) {
                _showError('Email invalide');
                return;
              }
              setState(() => _resetSent = true);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text('Envoyer le lien', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }

  Widget _buildLabel(String text) {
    return Text(text, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textDark));
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      style: GoogleFonts.inter(fontSize: 15, color: AppColors.textDark),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: GoogleFonts.inter(color: AppColors.textLight, fontSize: 14),
        prefixIcon: Icon(icon, color: AppColors.textGray, size: 20),
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFEF4444))),
        contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      ),
      validator: validator,
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String hint,
    required bool showPassword,
    required VoidCallback onToggle,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: !showPassword,
      style: GoogleFonts.inter(fontSize: 15, color: AppColors.textDark),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: GoogleFonts.inter(color: AppColors.textLight, fontSize: 14),
        prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.textGray, size: 20),
        suffixIcon: IconButton(
          icon: Icon(showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.textGray, size: 20),
          onPressed: onToggle,
        ),
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFEF4444))),
        contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      ),
      validator: validator,
    );
  }
}
