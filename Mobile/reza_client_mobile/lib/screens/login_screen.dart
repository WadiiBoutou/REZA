import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../constants.dart';
import '../viewmodels/auth_viewmodel.dart';
import '../services/api_client.dart';
import '../widgets/avatar_picker.dart';

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
  final TextEditingController _phoneController = TextEditingController();
  String? _gender; // 'male' | 'female' (optional)
  DateTime? _birthdate;
  Uint8List? _avatarBytes;
  String? _avatarUrl;
  bool _uploadingAvatar = false;
  String? _successMessage;
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
    _phoneController.dispose();
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
      if (_isSignUp) {
        // Stop early if a confirmed account already exists for this email
        // (server-side check — mirrors the backend's 409 on register).
        setState(() => _submitting = true);
        try {
          final exists = await context.read<AuthViewModel>().emailExists(email);
          if (!mounted) return;
          if (exists) {
            _showError('Un compte existe déjà avec cette adresse email. Connectez-vous.');
            return;
          }
        } catch (_) {
          // Check unreachable — fall through and let the server decide at submit.
        } finally {
          if (mounted) setState(() => _submitting = false);
        }
      }
      _animController.reset();
      setState(() {
        _successMessage = null;
        _step = _isSignUp ? 2 : 1;
      });
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
      final result = await context.read<AuthViewModel>().register(
            email: _emailController.text.trim(),
            firstName: _firstNameController.text.trim(),
            lastName: _lastNameController.text.trim(),
            password: _passwordController.text,
            phone: _phoneController.text.trim(),
            avatar: (_avatarUrl == null || _avatarUrl!.isEmpty) ? null : _avatarUrl,
            gender: _gender,
            dateOfBirth: _birthdate == null ? null : DateFormat('yyyy-MM-dd').format(_birthdate!),
          );
      if (!mounted) return;
      Navigator.pop(context); // close loading dialog
      // The backend always requires email verification — no session yet.
      setState(() {
        _successMessage = result.message;
        _isSignUp = false;
        _step = 0;
        _resetSignupForm();
      });
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

  void _resetSignupForm() {
    _phoneController.clear();
    _gender = null;
    _birthdate = null;
    _avatarBytes = null;
    _avatarUrl = null;
    _uploadingAvatar = false;
  }

  Future<void> _pickAvatar() async {
    try {
      final picked = await pickAvatarImage(context);
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      setState(() {
        _avatarBytes = bytes;
        _uploadingAvatar = true;
      });
      final ext = picked.name.contains('.') ? picked.name.split('.').last.toLowerCase() : 'jpg';
      final mime = ext == 'png' ? 'image/png' : ext == 'webp' ? 'image/webp' : 'image/jpeg';
      final res = await apiClient.uploadAvatar(bytes, 'avatar.$ext', mime);
      if (!mounted) return;
      setState(() {
        _avatarUrl = (res['avatar'] as String?) ?? '';
        _uploadingAvatar = false;
      });
      if (_avatarUrl!.isEmpty) {
        _showError("Impossible de télécharger l'image. Réessayez.");
      }
    } catch (_) {
      if (mounted) setState(() => _uploadingAvatar = false);
      if (mounted) _showError("Impossible de sélectionner l'image.");
    }
  }

  Future<void> _pickBirthdate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthdate ?? DateTime(now.year - 20, now.month, now.day),
      firstDate: DateTime(now.year - 100),
      lastDate: now,
      helpText: 'Date de naissance',
    );
    if (picked != null && mounted) setState(() => _birthdate = picked);
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
        const SizedBox(height: 24),
        if (_successMessage != null) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.availableLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.mark_email_read_outlined, color: AppColors.available, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _successMessage!,
                    style: GoogleFonts.inter(fontSize: 13, color: AppColors.textDark, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],
        const SizedBox(height: 8),
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
          Center(
            child: GestureDetector(
              onTap: _uploadingAvatar ? null : _pickAvatar,
              child: Stack(
                children: [
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.surface,
                      border: Border.all(color: AppColors.border, width: 2),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: _avatarBytes != null
                        ? Image.memory(_avatarBytes!, fit: BoxFit.cover)
                        : Icon(Icons.person_outline_rounded, size: 44, color: AppColors.textGray),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 30,
                      height: 30,
                      decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                      child: _uploadingAvatar
                          ? const Padding(
                              padding: EdgeInsets.all(7),
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.photo_camera_rounded, size: 16, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
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
          _buildLabel('Téléphone'),
          const SizedBox(height: 8),
          _buildTextField(
            controller: _phoneController,
            hint: '06 12 34 56 78',
            icon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
            validator: (v) {
              final digits = (v ?? '').replaceAll(RegExp(r'[^0-9+]'), '');
              if (digits.isEmpty) return 'Requis';
              if (digits.length < 9) return 'Numéro invalide';
              return null;
            },
          ),
          const SizedBox(height: 16),
          _buildLabel('Genre'),
          const SizedBox(height: 8),
          Row(
            children: [
              _genderChip('female', 'Femme', Icons.female_rounded),
              const SizedBox(width: 12),
              _genderChip('male', 'Homme', Icons.male_rounded),
            ],
          ),
          const SizedBox(height: 16),
          _buildLabel('Date de naissance'),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _pickBirthdate,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.cake_outlined, color: AppColors.textGray, size: 20),
                  const SizedBox(width: 12),
                  Text(
                    _birthdate == null
                        ? 'Sélectionner une date'
                        : DateFormat('dd/MM/yyyy').format(_birthdate!),
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      color: _birthdate == null ? AppColors.textLight : AppColors.textDark,
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.textGray, size: 20),
                ],
              ),
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
          Center(
            child: GestureDetector(
              onTap: () {
                _animController.reset();
                setState(() {
                  _isSignUp = !_isSignUp;
                  _step = 0;
                  _successMessage = null;
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

  Widget _genderChip(String value, String label, IconData icon) {
    final selected = _gender == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _gender = selected ? null : value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary.withValues(alpha: 0.1) : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 1.5 : 1),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: selected ? AppColors.primary : AppColors.textGray),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? AppColors.primary : AppColors.textGray,
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
