'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Mail, ArrowLeft, Camera, Loader2, Phone, Venus, Mars } from 'lucide-react';
import { isValidMoroccanPhone, getMoroccanPhoneError } from '../../lib/utils';
import CurvySlideButton from '@/components/UI/CurvySlideButton';
import { Checkbox } from "@/components/UI/checkbox";
import LoadingOverlay from '@/components/UI/LoadingOverlay';
import { DatePicker } from '@/components/UI/DatePicker';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

// Animated Text Component
const AnimatedText = ({ className = "" }: { className?: string }) => {
  const messages = [
    { title: "Réservez votre moment bien-être en un instant", subtitle: "Trouvez et réservez facilement le soin ou la séance qui vous correspond, près de chez vous." },
    { title: "Gérez tous vos rendez-vous au même endroit", subtitle: "Consultez, modifiez ou annulez vos réservations en toute liberté, 24h/24." },
    { title: "Recevez des rappels pour ne rien manquer", subtitle: "Soyez prévenu avant chaque rendez-vous, pour une expérience sans stress." },
    { title: "Découvrez de nouveaux soins et praticiens", subtitle: "Explorez des offres exclusives et laissez-vous guider vers le bien-être qui vous ressemble." }
  ];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsAnimating(false);
      }, 500);
    }, 4000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className={`min-h-[140px] flex flex-col justify-center text-left pl-2 lg:pl-0 ${className}`}> {/* reduced padding to move left */}
      <div className={`transition-all duration-500 pr-0 ${isAnimating ? 'opacity-0 transform translate-y-4' : 'opacity-100 transform translate-y-0'}`}> 
        <h2 className="text-2xl lg:text-2xl font-extrabold text-white mb-4 leading-tight text-left">
          {messages[currentIndex].title}
        </h2>
        <p className="text-sm lg:text-base text-blue-100 font-medium leading-relaxed text-left">
          {messages[currentIndex].subtitle}
        </p>
      </div>
      {/* Progress Dots */}
      <div className="flex gap-2 justify-start mt-6">
        {messages.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              index === currentIndex 
                ? 'w-8 bg-white' 
                : 'w-1.5 bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// Feature Pill Component
const FeaturePill = ({ icon, text }: { icon: string; text: string }) => (
  <div className="px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-2 hover:bg-white/15 transition-all duration-300 hover:scale-105 cursor-default shadow-lg">
    <span className="text-lg">{icon}</span>
    <span className="text-white font-semibold text-sm">{text}</span>
  </div>
);

// Stat Item Component
const StatItem = ({ number, label }: { number: string; label: string }) => (
  <div className="text-center group cursor-default">
    <div className="text-3xl lg:text-4xl font-bold text-white mb-1 group-hover:scale-110 transition-transform duration-300">
      {number}
    </div>
    <div className="text-sm text-blue-100 font-medium">{label}</div>
  </div>
);

function LoginPageContent() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const { login, isAuthenticated, logout } = useAuth();
  const router = useRouter();


  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      setUploadingAvatar(true);
      setError('');
      const res = await fetch(`${API_URL}/public/auth/upload-avatar`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de l'upload de l'image");
      }
      setAvatarUrl(data.avatar);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'upload de l'image");
    } finally {
      setUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (loading) {
      return;
    }
    
    // Clear previous errors IMMEDIATELY and forcefully
    setError('');
    setFieldErrors({});
    
    const errors: {[key: string]: string} = {};
    
    if (mode === 'signup') {
      // Use React state values directly - they should be up to date when form is submitted
      // React state is the source of truth for controlled inputs
      let currentPassword = password || '';
      let currentConfirmPassword = confirmPassword || '';
      let currentEmail = email || '';
      let currentFirstName = firstName || '';
      let currentLastName = lastName || '';
      let currentPhone = phone || '';
      
      // Also try to read from DOM as a fallback, but prioritize state
      if (e && e.currentTarget) {
        const form = e.currentTarget as HTMLFormElement;
        const passwordInput = form.querySelector('#password') as HTMLInputElement;
        const confirmPasswordInput = form.querySelector('#confirmPassword') as HTMLInputElement;
        
        // Only use DOM values if state values are empty (shouldn't happen with controlled inputs)
        if (!currentPassword && passwordInput?.value) {
          currentPassword = passwordInput.value;
        }
        if (!currentConfirmPassword && confirmPasswordInput?.value) {
          currentConfirmPassword = confirmPasswordInput.value;
        }
      }
      
      // Trim all values
      const trimmedFirstName = String(currentFirstName || '').trim();
      const trimmedLastName = String(currentLastName || '').trim();
      const trimmedPhone = String(currentPhone || '').trim();
      const trimmedEmail = String(currentEmail || '').trim();
      const trimmedPassword = String(currentPassword || '').trim();
      const trimmedConfirmPassword = String(currentConfirmPassword || '').trim();
      
      // Validate each field independently - only set error if field is actually empty
      if (!trimmedFirstName) {
        errors.firstName = 'Le prénom est requis';
      }
      if (!trimmedLastName) {
        errors.lastName = 'Le nom est requis';
      }
      if (!trimmedPhone) {
        errors.phone = 'Le téléphone est requis';
      } else if (!isValidMoroccanPhone(trimmedPhone)) {
        errors.phone = getMoroccanPhoneError(trimmedPhone);
      }
      if (!trimmedEmail) {
        errors.email = 'L\'email est requis';
      }
      // Only validate password if it's actually empty - use explicit check
      // Double check: make sure we're not validating a non-empty password
      const isPasswordEmpty = !trimmedPassword || trimmedPassword === '' || trimmedPassword.length === 0;
      const isConfirmPasswordEmpty = !trimmedConfirmPassword || trimmedConfirmPassword === '' || trimmedConfirmPassword.length === 0;
      
      if (isPasswordEmpty) {
        errors.password = 'Le mot de passe est requis';
      }
      
      if (isConfirmPasswordEmpty) {
        errors.confirmPassword = 'Veuillez confirmer votre mot de passe';
      }
      
      // Only set errors if there are actual errors
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError(''); // Clear general error when showing field errors
        setLoading(false); // Make sure loading is false
        return;
      }

      if (trimmedPassword !== trimmedConfirmPassword) {
        setError('Les mots de passe ne correspondent pas');
        setFieldErrors({});
        return;
      }
      if (trimmedPassword.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères');
        setFieldErrors({});
        return;
      }
      if (!acceptTerms) {
        setError('Veuillez accepter les conditions d\'utilisation');
        setFieldErrors({});
        return;
      }

      setLoading(true);
      
      // For signup, create account via API and store user data
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${API_URL}/public/auth/client-register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: currentEmail.trim(),
            firstName: currentFirstName.trim(),
            lastName: currentLastName.trim(),
            phone: trimmedPhone,
            password: trimmedPassword, // Use trimmed password
            avatar: avatarUrl || undefined, // Optional
            dateOfBirth: dateOfBirth || undefined, // Optional (YYYY-MM-DD)
            gender: gender || undefined // Optional (male | female)
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          const errorMessage = responseData.message || responseData.error || 'Erreur lors de la création du compte';
          setError(errorMessage);
          setFieldErrors({}); // Clear all field errors
          setLoading(false);
          return;
        }

        // Success! Clear all errors immediately before doing anything else
        setFieldErrors({}); // Clear all field errors FIRST
        setError(''); // Clear general error

        // Check if email verification is required
        if (responseData.requiresEmailVerification) {
          // Show success message and redirect to login with message
          // Drop the loading overlay FIRST — without this the form stays
          // hidden behind the floating REZA and the user never sees that
          // the confirmation email was sent.
          setLoading(false);
          // Show success message
          const successMessage = responseData.message || 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.';
          setError(successMessage);
          // Change error display to success style
          setTimeout(() => {
            // Switch to login mode and show message
            setMode('login');
            setEmail(currentEmail.trim());
            setError('Vérifiez votre boîte de réception pour activer votre compte. Vous pouvez vous connecter une fois votre email vérifié.');
          }, 2000);
          return;
        }

        // If email verification is skipped (development mode), login automatically
        // After successful registration, login the user to update the context
        // This ensures the AuthContext is properly updated with the new user data
        // Use the trimmed password that was validated and sent to the API
        const loginResult = await login(currentEmail.trim(), trimmedPassword, keepLoggedIn);
        
        if (loginResult.success) {
          // Clear all errors before redirecting
          setError('');
          setFieldErrors({});
          // Get redirect URL from query params if present
          const searchParams = new URLSearchParams(window.location.search);
          const redirectUrl = searchParams.get('redirect') || '/account';
          router.push(redirectUrl);
        } else {
          // Don't show error for automatic login failure - just redirect to login page
          // The user can manually login with their credentials
          setError('');
          setFieldErrors({});
          setMode('login');
          setEmail(currentEmail.trim());
          setError('Compte créé avec succès. Veuillez vous connecter avec votre email.');
          setLoading(false);
          return;
        }
      } catch (error: any) {
        console.error('Signup error:', error);
        // Only catch unexpected errors (network errors, etc.)
        // Don't throw errors for expected API responses
        const errorMessage = error.message || 'Erreur lors de la création du compte. Veuillez réessayer.';
        setError(errorMessage);
        setFieldErrors({});
        setLoading(false);
      }
    } else {
      // Login validation
      if (!email.trim()) errors.email = 'L\'email est requis';
      if (!password.trim()) errors.password = 'Le mot de passe est requis';

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      
      setLoading(true);
      
      try {
        const result = await login(email.trim(), password.trim(), keepLoggedIn);
        
        if (result.success) {
          const searchParams = new URLSearchParams(window.location.search);
          const redirectUrl = searchParams.get('redirect') || '/account';
          router.push(redirectUrl);
        } else {
          // Use the real backend message — e.g. the "check your inbox" notice
          // for unverified accounts — instead of a generic credentials error.
          setError(result.error || 'Email ou mot de passe incorrect.');
        }
      } catch (error: any) {
        console.error('[Login] Login error:', error);
        setError('Email ou mot de passe incorrect.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleModeSwitch = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setError('');
    setFieldErrors({});
    setLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!resetEmail.trim()) {
      setResetError('Veuillez entrer votre adresse email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      setResetError('Veuillez entrer une adresse email valide');
      return;
    }

    setResetSending(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/public/auth/client-forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResetError(data.message || data.error || 'Une erreur est survenue. Veuillez réessayer.');
        return;
      }
      setResetEmailSent(true);
    } catch (err: any) {
      setResetError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setResetSending(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setResetEmail('');
    setResetEmailSent(false);
    setResetError('');
  };

  // Redirect when already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/account');
    }
    
    // Check for error in URL params
    const searchParams = new URLSearchParams(window.location.search);
    // ?mode=signup opens the register form directly (e.g. from pro-info)
    if (searchParams.get('mode') === 'signup') {
      setMode('signup');
    }
  }, [isAuthenticated]);

  return (
    <>
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }
        
        @keyframes float-delayed {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(20px) translateX(-10px);
          }
        }
        
        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0) translateX(0) scale(1);
          }
          50% {
            transform: translateY(-15px) translateX(-15px) scale(1.1);
          }
        }
        
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 10s ease-in-out infinite;
        }
        
        .animate-float-slow {
          animation: float-slow 12s ease-in-out infinite;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
      `}</style>
      
      <div className="h-screen flex flex-col lg:flex-row overflow-hidden">
        {/* Right Side - Login Form (now first/left) */}
        <div className="flex-1 bg-[#f6f6ef] flex items-start justify-center p-6 lg:p-12 overflow-y-auto relative hide-scrollbar">
          {(loading || homeLoading) ? (
            <div className="w-full h-full flex items-center justify-center">
              <LoadingOverlay />
            </div>
          ) : (
            <div className="w-full max-w-md pt-4">
            

            {/* Header */}
            <div className="mt-4 mb-10">
              {/* Back to Home Button */}
              <button
                type="button"
                onClick={() => {
                  setHomeLoading(true);
                  setTimeout(() => {
                    router.push('/');
                  }, 1200);
                }}
                className="mb-6 flex items-center gap-2 text-gray-900 font-bold hover:text-gray-700 transition-colors text-sm"
                aria-label="Retour à l'accueil"
              >
                <ArrowLeft size={20} className="inline-block" />
                Retour à l&apos;accueil
              </button>
              <h1 className="text-4xl lg:text-4xl font-extrabold text-[#000000] mb-3">
                {showForgotPassword
                  ? 'Mot de passe oublié ?'
                  : mode === 'signup'
                    ? 'Nouveau sur Reza ?'
                    : 'Bienvenue sur Reza !'}
              </h1>
              {/* Mode Toggle Links - now left aligned and below the subtitle */}
              <div className="mt-2 text-left">
                {showForgotPassword ? (
                  <p className="text-gray-600 font-medium text-sm">
                    Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                  </p>
                ) : (
                  <p className="text-gray-600 font-medium text-sm">
                    {mode === 'login' ? (
                      <>
                        Pas encore de compte ?{' '}
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('signup')}
                          className="text-[#000000] font-bold hover:underline"
                        >
                          S&apos;inscrire
                        </button>
                      </>
                    ) : (
                      <>
                        Vous avez déjà un compte ?{' '}
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('login')}
                          className="text-[#000000] font-bold hover:underline"
                        >
                          Se connecter
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

              <AnimatePresence mode="wait" initial={false}>
                {showForgotPassword ? (
                <motion.div
                  key="forgot-password"
                  className="space-y-4"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  {!resetEmailSent ? (
                    <form onSubmit={handlePasswordReset} className="space-y-4" noValidate>
                      <div>
                        <label htmlFor="resetEmail" className="block text-sm font-bold text-gray-900 mb-2">
                          Adresse email
                        </label>
                        <input
                          id="resetEmail"
                          type="text"
                          placeholder="vous@exemple.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 text-base font-medium"
                          autoFocus
                        />
                        {resetError && (
                          <p className="mt-2 text-sm text-red-500">{resetError}</p>
                        )}
                      </div>

                      <div className="bg-transparent border border-gray-200 rounded-2xl p-4 text-left">
                        <p className="text-sm text-gray-900 font-semibold mb-2">Prochaines étapes :</p>
                        <ol className="text-sm text-gray-900 space-y-1.5 ml-4 list-decimal">
                          <li>Vérifiez votre boîte de réception</li>
                          <li>Cliquez sur le lien de réinitialisation</li>
                          <li>Créez un nouveau mot de passe</li>
                          <li>Connectez-vous avec votre nouveau mot de passe</li>
                        </ol>
                      </div>

                      <CurvySlideButton
                        type="submit"
                        disabled={resetSending}
                        text={resetSending ? "Envoi en cours..." : "Envoyer le lien de réinitialisation"}
                        color="#000000"
                        textColor="#ffffff"
                        borderColor="#000000"
                        hoverTextColor="#000000"
                        hoverColor="#FCFBF4"
                        styles={{
                          width: '100%',
                          padding: '12px 24px',
                          fontSize: '16px',
                          borderRadius: '30px',
                          marginTop: '16px',
                          cursor: resetSending ? 'not-allowed' : 'pointer',
                          opacity: resetSending ? 0.7 : 1,
                        }}
                      />

                      <button
                        type="button"
                        onClick={closeForgotPasswordModal}
                        className="w-full text-gray-600 py-3 rounded-full font-semibold text-base hover:text-gray-900 transition-colors"
                      >
                        Retour à la connexion
                      </button>
                    </form>
                  ) : (
                    <div className="text-center space-y-6 pt-4">
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                        </svg>
                      </div>
                      <h2 className="text-3xl font-bold text-[#000000]">
                        Email envoyé !
                      </h2>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Nous avons envoyé un lien de réinitialisation à <strong className="text-[#000000]">{resetEmail}</strong>.
                        Veuillez vérifier votre boîte de réception et suivre les instructions.
                      </p>

                      <p className="text-xs text-gray-500">
                        Vous n&apos;avez pas reçu l&apos;email ? Vérifiez votre dossier spam ou{' '}
                        <button
                          onClick={() => setResetEmailSent(false)}
                          className="text-[#082259] font-bold hover:underline"
                        >
                          réessayez
                        </button>
                      </p>

                      <button
                        onClick={closeForgotPasswordModal}
                        className="w-full bg-[#000000] text-white py-3.5 rounded-full font-bold text-base hover:bg-[#000000] transition-colors duration-200 shadow-lg hover:shadow-xl"
                      >
                        Retour à la connexion
                      </button>
                    </div>
                  )}
                </motion.div>
                ) : (
                <motion.form
                  key={mode}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                  noValidate
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  {/* First Name and Last Name - Only for Signup */}
                  {mode === 'signup' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-bold text-gray-900 mb-2">
                        Prénom <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        placeholder="Jean"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 text-base font-medium"
                      />
                      {fieldErrors.firstName && (
                        <p className="mt-2 text-sm text-red-500">{fieldErrors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-bold text-gray-900 mb-2">
                        Nom <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        placeholder="Dupont"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 text-base font-medium"
                      />
                      {fieldErrors.lastName && (
                        <p className="mt-2 text-sm text-red-500">{fieldErrors.lastName}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Phone - Only for Signup (required) */}
                {mode === 'signup' && (
                  <div>
                    <label htmlFor="phone" className="block text-sm font-bold text-gray-900 mb-2">
                      Téléphone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="06 12 34 56 78"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 pr-12 text-base font-medium"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <Phone size={18} />
                      </span>
                    </div>
                    {fieldErrors.phone && (
                      <p className="mt-2 text-sm text-red-500">{fieldErrors.phone}</p>
                    )}
                  </div>
                )}

                {/* Gender - Only for Signup (optional, radio with icons) */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Genre
                    </label>
                    <div className="flex gap-3">
                      {[
                        { value: 'female', label: 'Femme', Icon: Venus },
                        { value: 'male', label: 'Homme', Icon: Mars },
                      ].map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setGender(gender === value ? '' : value)}
                          className={`flex items-center gap-2 px-5 py-3 rounded-full border transition-all text-sm font-medium ${
                            gender === value
                              ? 'border-[#082259] bg-[#082259] text-white'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <Icon size={16} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Avatar + Date de naissance - Only for Signup (both optional) */}
                {mode === 'signup' && (
                  <>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-dashed border-gray-300 hover:border-[#082259] transition-colors flex items-center justify-center bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        aria-label="Ajouter une photo de profil"
                      >
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarUrl} alt="Photo de profil" className="w-full h-full object-cover" />
                        ) : uploadingAvatar ? (
                          <Loader2 className="animate-spin text-gray-400" size={20} />
                        ) : (
                          <Camera size={20} className="text-gray-400" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 mb-1">
                          Photo de profil
                        </p>
                        <p className="text-xs text-gray-400">Cliquez sur le cercle pour ajouter une photo</p>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="dateOfBirth" className="block text-sm font-bold text-gray-900 mb-2">
                        Date de naissance
                      </label>
                      <DatePicker
                        value={dateOfBirth ? new Date(dateOfBirth + 'T12:00:00') : undefined}
                        onChange={(d) => setDateOfBirth(d ? format(d, 'yyyy-MM-dd') : '')}
                        placeholder="Sélectionner une date"
                        maxDate={new Date()}
                        fromYear={1900}
                        toYear={new Date().getFullYear()}
                      />
                    </div>
                  </>
                )}

                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-bold text-gray-900 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="text"
                      placeholder="vous@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 pr-12 text-base font-medium"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Mail size={18} />
                    </span>
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-2 text-sm text-red-500">{fieldErrors.email}</p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <label htmlFor="password" className="block text-sm font-bold text-[#000000] mb-2">
                    Mot de passe <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        // Clear error when user starts typing
                        if (fieldErrors.password) {
                          setFieldErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.password;
                            return newErrors;
                          });
                        }
                      }}
                      className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 pr-12 text-base font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-2 text-sm text-red-500">{fieldErrors.password}</p>
                  )}
                </div>

                {/* Confirm Password - Only for Signup */}
                {mode === 'signup' && (
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-bold text-[#000000] mb-2">
                      Confirmer le mot de passe <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          // Clear error when user starts typing
                          if (fieldErrors.confirmPassword) {
                            setFieldErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.confirmPassword;
                              return newErrors;
                            });
                          }
                        }}
                        className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 pr-12 text-base font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      >
                        {showConfirmPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p className="mt-2 text-sm text-red-500">{fieldErrors.confirmPassword}</p>
                    )}
                  </div>
                )}

                {/* Error/Success Message */}
                {error && (
                  <div className={`rounded-2xl px-4 py-3 text-sm ${
                    error.includes('vérifier votre email') || error.includes('Vérifiez votre boîte') || error.includes('Compte créé avec succès')
                      ? 'bg-green-50 border border-green-200 text-green-600'
                      : 'bg-red-50 border border-red-200 text-red-600'
                  }`}>
                    <p>{error}</p>
                    {error.includes('Aucun compte trouvé') && mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup');
                          setError('');
                          setEmail(email); // Keep the email they entered
                        }}
                        className="mt-2 text-sm text-red-700 underline hover:text-red-900 font-medium"
                      >
                        Créer un compte avec cet email
                      </button>
                    )}
                    {(error.includes('vérifier votre email') || error.includes('Vérifiez votre boîte')) && (
                      <div className="mt-3 text-sm">
                        <p className="mb-2">Vous n'avez pas reçu l'email ?</p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                              const response = await fetch(`${API_URL}/public/auth/client-resend-verification`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ email: email.trim() }),
                              });
                              const data = await response.json();
                              if (response.ok) {
                                setError('Email de vérification renvoyé avec succès. Vérifiez votre boîte de réception.');
                              } else {
                                setError(data.message || 'Erreur lors de l\'envoi de l\'email.');
                              }
                            } catch (err: any) {
                              setError('Erreur lors de l\'envoi de l\'email. Veuillez réessayer.');
                            }
                          }}
                          className="text-green-700 underline hover:text-green-900 font-medium"
                        >
                          Renvoyer l'email de vérification
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Options Row */}
                {mode === 'login' ? (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer group">
                      <Checkbox
                        id="keepLoggedIn"
                        checked={keepLoggedIn}
                        onCheckedChange={checked => setKeepLoggedIn(checked === true)}
                        className="w-5 h-5 bg-[#f6f6ef] rounded-full border-1 border-gray-300 text-[#000000] cursor-pointer ml-1"
                      />
                      <span className="ml-2 text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                        Rester connecté
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm font-bold text-[#000000] hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="flex items-start cursor-pointer group">
                      <Checkbox
                        id="acceptTerms"
                        checked={acceptTerms}
                        onCheckedChange={checked => setAcceptTerms(checked === true)}
                        className="w-5 h-5 bg-[#f6f6ef] rounded-full border-1 border-gray-300 text-[#000000] cursor-pointer mt-0.5"
                      />
                      <span className="ml-3 text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                        J&apos;accepte les{' '}
                        <a href="#" className="text-[#000000] hover:underline">
                          conditions d&apos;utilisation
                        </a>{' '}
                        et la{' '}
                        <a href="#" className="text-[#000000] hover:underline">
                          politique de confidentialité
                        </a>
                      </span>
                    </label>
                  </div>
                )}

                {/* Sign In Button */}
                <div className="w-full mt-4">
                  <CurvySlideButton
                    onClick={(e) => {
                      // Let the form's onSubmit handle the submission
                      // This prevents double submission
                      if (loading) {
                        e?.preventDefault();
                        e?.stopPropagation();
                      }
                    }}
                    type="submit"
                    disabled={loading}
                    text={loading 
                      ? (mode === 'login' ? 'Connexion...' : 'Création...')
                      : (mode === 'login' ? 'Se connecter' : 'Créer un compte')
                    }
                    color="#000000"
                    textColor="#ffffff"
                    borderColor="#000000"
                    hoverTextColor="#000000"
                    hoverColor="#FCFBF4"
                    styles={{
                      width: '100%',
                      padding: '12px 24px',
                      fontSize: '16px',
                      borderRadius: '30px',
                      marginTop: '16px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.7 : 1,
                    }}
                  />
                </div>
                </motion.form>
                )}
              </AnimatePresence>

            <div className="w-full text-center mt-3">
              <span className="text-xs text-gray-400 font-medium">SSL Connexion sécurisée et privée</span>
            </div>

          </div>
          )}
        </div>

        {/* Left Side - Image Section (now second/right) — hidden on mobile, the form gets the full screen */}
        <div className="hidden lg:block lg:w-[700px] bg-[#f6f6ef] relative overflow-hidden">
          {/* left - Full Height */}
          <div className="relative w-full h-full p-4">
            <div className="w-full h-full rounded-3xl overflow-hidden bg-black flex flex-col items-center justify-center relative">
              {/* Background Image */}
              <img 
                src="/login_bg.png" 
                alt="Fond de connexion" 
                className="absolute inset-0 w-full h-full object-cover rounded-3xl z-0" 
              />
              
              {/* Soft dark overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/40 to-black/60 z-[1]"></div>

              


            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}