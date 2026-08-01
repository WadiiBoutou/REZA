'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';
import CurvySlideButton from '@/components/ui/CurvySlideButton';
import { Checkbox } from '@/components/ui/checkbox';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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
  const [organizationName, setOrganizationName] = useState('');
  const [city, setCity] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [loading, setLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const { login, register, isAuthenticated, user } = useAuth();
  const router = useRouter();
  
  // Use window.location.search as fallback to avoid Suspense issues
  const [searchParamsState, setSearchParamsState] = useState<URLSearchParams | null>(null);
  
  useEffect(() => {
    // Initialize from window.location to avoid Suspense
    if (typeof window !== 'undefined') {
      setSearchParamsState(new URLSearchParams(window.location.search));
    }
  }, []);

  // Get redirect URL from query parameter or default to dashboard
  const getRedirectUrl = () => {
    // Global superadmins land on their own page
    if (user?.role === 'SUPER_ADMIN') {
      return '/superadmin';
    }
    const redirect = searchParamsState?.get('redirect');
    if (redirect && redirect.startsWith('/')) {
      return redirect;
    }
    return '/dashboard/rendez-vous';
  };

  // Pre-fill email from URL parameter
  useEffect(() => {
    if (searchParamsState) {
      const emailParam = searchParamsState.get('email');
      if (emailParam && !email) {
        setEmail(emailParam);
      }
    }
  }, [searchParamsState, email]);

  // Redirect if already authenticated AND verified (don't redirect unverified users)
  useEffect(() => {
    // Only redirect if user is authenticated AND email is verified
    // Unverified users should stay on login page to see verification message
    if (isAuthenticated && user && user.emailVerified !== false) {
      const redirectUrl = getRedirectUrl();
      router.push(redirectUrl);
    }
  }, [isAuthenticated, user, router, searchParamsState]);

  const handlePasswordReset = (e: React.FormEvent) => {
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
    
    // Simulate sending reset email
    setResetEmailSent(true);
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setResetEmail('');
    setResetEmailSent(false);
    setResetError('');
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      if ('stopPropagation' in e) {
        (e as any).stopPropagation();
      }
    }
    setError('');
    setFieldErrors({});
    
    const errors: {[key: string]: string} = {};
    
    if (mode === 'signup') {
      // Validation for signup
      if (!firstName.trim()) errors.firstName = 'Le prénom est requis';
      if (!lastName.trim()) errors.lastName = 'Le nom est requis';
      if (!organizationName.trim()) errors.organizationName = 'Le nom de l\'établissement est requis';
      if (!city) errors.city = 'La ville est requise';
      if (!email.trim()) errors.email = 'L\'email est requis';
      if (!password) errors.password = 'Le mot de passe est requis';
      if (!confirmPassword) errors.confirmPassword = 'Veuillez confirmer votre mot de passe';
      
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas');
        return;
      }
      if (password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères');
        return;
      }
      if (!acceptTerms) {
        setError("Veuillez accepter les conditions d'utilisation");
        return;
      }

      setLoading(true);
      try {
        const result = await register({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: undefined,
          // Create new organization during registration
          createTenant: true,
          tenantName: organizationName.trim(),
          tenantEmail: email.trim(), // Use user's email as organization email
          tenantCity: city, // Add city to registration
        });

        if (result.success) {
          // Show success message about email verification instead of redirecting
          setSuccessMessage(
            'Compte créé avec succès ! Un email de vérification a été envoyé à ' +
              email.trim() +
              '. Veuillez vérifier votre boîte de réception et cliquer sur le lien pour activer votre compte.',
          );
          setError(''); // Clear any previous errors
          setLoading(false);
          // Clear form fields
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setFirstName('');
          setLastName('');
          setOrganizationName('');
          setCity('');
          setAcceptTerms(false);
        } else {
          console.error('[Signup] Registration failed:', result.error);
          setError(result.error || 'Erreur lors de la création du compte');
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[Signup] Registration error:', err);
        setError(err.message || 'Erreur lors de la création du compte');
        setLoading(false);
      }
    } else {
      // Login validation
      if (!email.trim()) errors.email = 'L\'email est requis';
      if (!password) errors.password = 'Le mot de passe est requis';
      
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      setLoading(true);
      try {
        const result = await login(email.trim(), password.trim());

        if (result.success) {
          // Redirect to specified URL or default dashboard
          const redirectUrl = getRedirectUrl();
          router.push(redirectUrl);
        } else {
          console.warn('[Login] Login failed:', result.error);
          setError(result.error || 'Email ou mot de passe invalide');
          setLoading(false);
        }
      } catch (err: any) {
        console.warn('[Login] Login error:', err.message);
        setError(err.message || 'Erreur de connexion');
        setLoading(false);
      }
    }
  };

  const handleModeSwitch = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setError('');
    setFieldErrors({});
  };

  // Check for error in URL params and handle redirects
  useEffect(() => {
    // Only redirect if user is authenticated AND email is verified
    // Unverified users should stay on login page to see verification message
    if (isAuthenticated && user && user.emailVerified !== false) {
      const redirectUrl = getRedirectUrl();
      router.push(redirectUrl);
      return;
    }

    // Check for error and success messages in URL params
    if (searchParamsState) {
      const errorParam = searchParamsState.get('error');
      const messageParam = searchParamsState.get('message');
      const registeredParam = searchParamsState.get('registered');
      const verifiedParam = searchParamsState.get('verified');
      const unverifiedParam = searchParamsState.get('unverified');

      if (unverifiedParam === 'true') {
        setError(
          "Veuillez vérifier votre email avant d'accéder au tableau de bord. Un email de vérification vous a été envoyé lors de votre inscription.",
        );
        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else if (verifiedParam === 'true') {
        setSuccessMessage('Votre email a été vérifié avec succès ! Vous pouvez maintenant vous connecter.');
        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else if (registeredParam === 'true') {
        setSuccessMessage(
          "Merci pour votre inscription ! Vous recevrez bientôt un accès prioritaire. Vous pouvez maintenant vous connecter avec vos identifiants.",
        );
        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } else if (errorParam === 'account_inactive') {
        setError('Votre compte a été désactivé. Veuillez contacter le support.');
      } else if (errorParam === 'tenant_inactive') {
        setError('Votre organisation a été désactivée. Veuillez contacter le support.');
      } else if (messageParam) {
        setError(messageParam);
      }
    }
  }, [isAuthenticated, user, router, searchParamsState]);

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

            {/* Forgot Password Form */}
            {showForgotPassword ? (
              <div className="space-y-6">
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

                    <div
                      onClick={() => {
                        const form = document.querySelector('form');
                        if (form) {
                          const event = new Event('submit', { bubbles: true, cancelable: true });
                          form.dispatchEvent(event);
                        }
                      }}
                    >
                      <CurvySlideButton
                        text={"Envoyer le lien de réinitialisation"}
                        color="#002366"
                        textColor="#ffffff"
                        borderColor="#002366"
                        hoverTextColor="#000000"
                        hoverColor="#FCFBF4"
                        styles={{
                          width: '100%',
                          padding: '12px 24px',
                          fontSize: '16px',
                          borderRadius: '30px',
                          marginTop: '0',
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={closeForgotPasswordModal}
                      className="w-full text-gray-600 py-3 rounded-full font-semibold text-base hover:text-gray-900 transition-colors"
                    >
                      Retour à la connexion
                    </button>
                  </form>
                ) : (
                  <div className="text-center space-y-6">
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
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  handleSubmit(e);
                }}
                className="space-y-4"
                noValidate
              >
                {/* Success Message */}
                {successMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-green-800 font-medium">{successMessage}</p>
                  </div>
                )}
                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm whitespace-pre-line">
                    <p className="font-semibold mb-2">{error.split('\n\n')[0]}</p>
                    {error.includes('\n\n') && (
                      <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                        {error.split('\n\n').slice(1).join('\n\n')}
                      </div>
                    )}
                  </div>
                )}
                {/* Organization Name - Only for Signup */}
                {mode === 'signup' && (
                  <div>
                    <label htmlFor="organizationName" className="block text-sm font-bold text-gray-900 mb-2">
                      Nom de l'établissement <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="organizationName"
                      type="text"
                      placeholder="Mon Salon / Mon Institut"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 text-base font-medium"
                    />
                    {fieldErrors.organizationName && (
                      <p className="mt-2 text-sm text-red-500">{fieldErrors.organizationName}</p>
                    )}
                  </div>
                )}

                {/* City Select - Only for Signup */}
                {mode === 'signup' && (
                  <div>
                    <label htmlFor="city" className="block text-sm font-bold text-gray-900 mb-2">
                      Ville <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-6 py-3 bg-white border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 text-base font-medium"
                    >
                      <option value="">Sélectionner une ville</option>
                      <option value="Agadir">Agadir</option>
                      <option value="Al Hoceïma">Al Hoceïma</option>
                      <option value="Azrou">Azrou</option>
                      <option value="Beni Mellal">Beni Mellal</option>
                      <option value="Berkane">Berkane</option>
                      <option value="Boujdour">Boujdour</option>
                      <option value="Casablanca">Casablanca</option>
                      <option value="Chefchaouen">Chefchaouen</option>
                      <option value="Dakhla">Dakhla</option>
                      <option value="El Jadida">El Jadida</option>
                      <option value="Errachidia">Errachidia</option>
                      <option value="Essaouira">Essaouira</option>
                      <option value="Fès">Fès</option>
                      <option value="Figuig">Figuig</option>
                      <option value="Guelmim">Guelmim</option>
                      <option value="Ifrane">Ifrane</option>
                      <option value="Kénitra">Kénitra</option>
                      <option value="Khemisset">Khemisset</option>
                      <option value="Khénifra">Khénifra</option>
                      <option value="Larache">Larache</option>
                      <option value="Laâyoune">Laâyoune</option>
                      <option value="Marrakech">Marrakech</option>
                      <option value="Meknès">Meknès</option>
                      <option value="Mohammedia">Mohammedia</option>
                      <option value="Nador">Nador</option>
                      <option value="Ouarzazate">Ouarzazate</option>
                      <option value="Oujda">Oujda</option>
                      <option value="Rabat">Rabat</option>
                      <option value="Safi">Safi</option>
                      <option value="Salé">Salé</option>
                      <option value="Settat">Settat</option>
                      <option value="Sidi Ifni">Sidi Ifni</option>
                      <option value="Tanger">Tanger</option>
                      <option value="Tan-Tan">Tan-Tan</option>
                      <option value="Taza">Taza</option>
                      <option value="Tétouan">Tétouan</option>
                      <option value="Tiznit">Tiznit</option>
                    </select>
                    {fieldErrors.city && (
                      <p className="mt-2 text-sm text-red-500">{fieldErrors.city}</p>
                    )}
                  </div>
                )}

                {/* First Name and Last Name - Only for Signup */}
                {mode === "signup" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-bold text-gray-900 mb-2">
                        Prénom
                      </label>
                      <input
                        id="firstName"
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
                        Nom
                      </label>
                      <input
                        id="lastName"
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

                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-bold text-gray-900 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      id="email"
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
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                      Confirmer le mot de passe
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
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

                {/* Options Row */}
                {mode === 'login' ? (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer group">
                      <Checkbox
                        id="keepLoggedIn"
                        checked={keepLoggedIn}
                        onCheckedChange={checked => setKeepLoggedIn(checked === true)}
                        className="w-5 h-5 ml-1 rounded-full border-2 bg-[#FCFBF4] border-gray-300 text-[#000000] cursor-pointer"
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

                {/* Sign In/Sign Up Button */}
                <div className="w-full mt-4">
                  <CurvySlideButton
                    onClick={(e) => {
                      if (e) {
                        e.preventDefault();
                        (e as any).stopPropagation?.();
                      }
                      // Call handleSubmit directly
                      handleSubmit(e as any);
                    }}
                    type="button"
                    disabled={loading}
                    text={
                      loading
                        ? mode === 'login'
                          ? 'Connexion...'
                          : 'Création...'
                        : mode === 'login'
                          ? 'Se connecter'
                          : 'Créer un compte'
                    }
                    color="#002366"
                    textColor="#ffffff"
                    borderColor="#000000"
                    hoverTextColor="#000000"
                    hoverColor="#FCFBF4"
                    styles={{
                      width: '100%',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      borderRadius: '30px',
                      marginTop: '16px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.7 : 1,
                    }}
                  />
                </div>
              </form>
            )}

            {/* Divider and Social Login - Only show when not in forgot password mode */}
            {!showForgotPassword && (
              <>
                <div className="w-full text-center mt-3">
                  <span className="text-xs text-gray-400 font-medium">SSL Connexion sécurisée et privée</span>
                </div>
              </>
            )}

          </div>
          )}
        </div>

        {/* Left Side - Image Section (now second/right) */}
        <div className="w-full lg:w-[700px] bg-[#f6f6ef] relative overflow-hidden">
          {/* left - Full Height */}
          <div className="relative w-full h-full p-4">
            <div className="w-full h-full rounded-3xl overflow-hidden bg-black flex flex-col items-center justify-center relative">
              {/* Background Image */}
              <img 
                src="/log.png" 
                alt="Fond de connexion" 
                className="absolute inset-0 w-full h-full object-cover rounded-3xl z-0" 
              />
              
              {/* Animated Gradient Overlay 
              <div className="absolute inset-0 bg-gradient-to-br from-[#002366]/90 via-[#003d99]/80 to-[#0052cc]/70 z-[1]"></div>
              */}
              {/* Floating Shapes */}
              <div className="absolute inset-0 overflow-hidden z-[2]">
                <div className="absolute top-20 left-10 w-32 h-32 bg-white/5 rounded-full blur-3xl animate-float"></div>
                <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-300/10 rounded-full blur-3xl animate-float-delayed"></div>
                <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-white/5 rounded-full blur-2xl animate-float-slow"></div>
                <span className="absolute top-10 left-18 -translate-x-1/2 ext-2xl lg:text-5xl text-white select-none pointer-events-none" style={{zIndex:3}}>*</span>
              </div>
              
              <div className="relative h-full flex flex-col items-start justify-center p-0 lg:p-0 z-10">
                <div className="space-y-8 max-w-lg text-left">
                  <div className="mb-0 flex flex-col gap-4 -mt-74">
                    <div>
                      {/* Removed star from here */}
                      <h3 className="text-2xl lg:text-5xl text-white font-medium leading-tight text-left">
                        <span className="inline-block align-middle ml-2">
                          <img src="/logos/logo-2.svg?v=rz1" alt="Reza Logo" className="h-6 lg:h-7 w-auto" />
                        </span>
                      </h3>
                    </div>
                    {/* Dynamic Animated Text - now separated from REZA text */}
                    <div className="-mt-0 pl-0">
                      <AnimatedText className="text-white w-[380px] lg:w-[620px] min-w-[520px] max-w-full pl-0 lg:pl-2" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6ef]">
        <div className="text-center">
          <LoadingOverlay />
          <p className="text-gray-600 mt-4">Chargement...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}