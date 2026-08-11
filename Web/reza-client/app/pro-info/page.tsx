'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Check, ArrowLeft, Eye, EyeOff, X } from 'lucide-react';
import Loading from '../salon/Loading';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';

export default function ProOnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    establishmentName: '',
    firstName: '',
    lastName: '',
    email: '',
    city: '',
    password: '',
    confirmPassword: ''
  });
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Création du compte...");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Public billing config: one-time per-salon fee + monthly employee tiers.
  const [billingConfig, setBillingConfig] = useState<{
    pricePerSalon: number;
    pricePerEmployee: number;
    currency: string;
    freeEmployeeThreshold: number;
    employeeTiers: { min: number; max: number | null; price: number }[] | null;
  } | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcSalons, setCalcSalons] = useState(1);
  const [calcEmployees, setCalcEmployees] = useState(1);

  useEffect(() => {
    let cancelled = false;
    api
      .getPublicBillingConfig()
      .then((cfg) => {
        if (!cancelled) setBillingConfig(cfg);
      })
      .catch((err) => console.error('Error fetching billing config:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Monthly employee fee — mirrors the backend marginal-tier calculation so the
  // calculator always matches the real invoice (each employee is charged at the
  // rate of the band their position falls into).
  const calcEmployeeFee = (count: number): number => {
    const tiers = billingConfig?.employeeTiers || [];
    if (tiers.length === 0) {
      return count * (billingConfig?.pricePerEmployee ?? 0);
    }
    let remaining = Math.max(0, count);
    let fee = 0;
    for (const t of tiers) {
      if (remaining <= 0) break;
      const bandSize = t.max === null ? remaining : Math.max(0, t.max - t.min + 1);
      const take = Math.min(remaining, bandSize);
      fee += take * t.price;
      remaining -= take;
    }
    if (remaining > 0 && tiers.length > 0) {
      fee += remaining * tiers[tiers.length - 1].price;
    }
    return fee;
  };

  const cities = [
    { value: 'Agadir', label: 'Agadir', available: true },
    { value: 'Aïn Harrouda', label: 'Aïn Harrouda', available: true },
    { value: 'Al Hoceima', label: 'Al Hoceima', available: true },
    { value: 'Azrou', label: 'Azrou', available: true },
    { value: 'Beni Mellal', label: 'Beni Mellal', available: true },
    { value: 'Benslimane', label: 'Benslimane', available: true },
    { value: 'Berrechid', label: 'Berrechid', available: true },
    { value: 'Boujdour', label: 'Boujdour', available: true },
    { value: 'Bouskoura', label: 'Bouskoura', available: true },
    { value: 'Casablanca', label: 'Casablanca', available: true },
    { value: 'Chefchaouen', label: 'Chefchaouen', available: true },
    { value: 'Dakhla', label: 'Dakhla', available: true },
    { value: 'El Jadida', label: 'El Jadida', available: true },
    { value: 'Errachidia', label: 'Errachidia', available: true },
    { value: 'Essaouira', label: 'Essaouira', available: true },
    { value: 'Fès', label: 'Fès', available: true },
    { value: 'Guelmim', label: 'Guelmim', available: true },
    { value: 'Ifrane', label: 'Ifrane', available: true },
    { value: 'Inezgane', label: 'Inezgane', available: true },
    { value: 'Kénitra', label: 'Kénitra', available: true },
    { value: 'Khémisset', label: 'Khémisset', available: true },
    { value: 'Khouribga', label: 'Khouribga', available: true },
    { value: 'Laâyoune', label: 'Laâyoune', available: true },
    { value: 'Larache', label: 'Larache', available: true },
    { value: 'Marrakech', label: 'Marrakech', available: true },
    { value: 'Meknès', label: 'Meknès', available: true },
    { value: 'Mohammedia', label: 'Mohammedia', available: true },
    { value: 'Nador', label: 'Nador', available: true },
    { value: 'Ouarzazate', label: 'Ouarzazate', available: true },
    { value: 'Oued Zem', label: 'Oued Zem', available: true },
    { value: 'Oujda', label: 'Oujda', available: true },
    { value: 'Rabat', label: 'Rabat', available: true },
    { value: 'Safi', label: 'Safi', available: true },
    { value: 'Salé', label: 'Salé', available: true },
    { value: 'Sefrou', label: 'Sefrou', available: true },
    { value: 'Settat', label: 'Settat', available: true },
    { value: 'Sidi Kacem', label: 'Sidi Kacem', available: true },
    { value: 'Sidi Slimane', label: 'Sidi Slimane', available: true },
    { value: 'Skhirat', label: 'Skhirat', available: true },
    { value: 'Tanger', label: 'Tanger', available: true },
    { value: 'Taza', label: 'Taza', available: true },
    { value: 'Témara', label: 'Témara', available: true },
    { value: 'Tétouan', label: 'Tétouan', available: true },
    { value: 'Tifelt', label: 'Tifelt', available: true },
    { value: 'Tiznit', label: 'Tiznit', available: true },
    { value: 'Youssoufia', label: 'Youssoufia', available: true },
    { value: 'Zagora', label: 'Zagora', available: true },
    { value: 'Autre', label: 'Autre', available: true },
  ];

  const handleUserTypeSelection = (type: string) => {
    if (type === 'client') {
      // Not a professional → go to the client register page (signup mode).
      window.location.href = '/login?mode=signup';
    } else {
      // Professional → straight to the establishment registration form.
      setStep(4);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async () => {
    setError(null);
    
    // Validate passwords
    if (!formData.password || formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    setLoadingText("Création du compte...");

    try {
      // Prepare registration data matching the backend schema
      const registrationData = {
        email: formData.email.trim(),
        password: formData.password.trim(), // User-provided password
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: undefined,
        // Create new tenant during registration
        createTenant: true,
        tenantName: formData.establishmentName.trim(),
        tenantEmail: formData.email.trim(),
        // Additional tenant information
        tenantPhone: undefined,
        tenantAddress: undefined,
        tenantCity: formData.city || null,
        tenantPostalCode: undefined,
        tenantCategory: 'Établissement'
      };

      setLoadingText("Envoi des données...");

      // Call the registration API (backend is in saas/Backend/)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || responseData.error || 'Erreur lors de la création du compte');
      }

      // Show success step (no need to show password since user already knows it)
      setLoading(false);
      setStep(5); // Move to success step

    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Une erreur est survenue lors de la création du compte. Veuillez réessayer.');
      setLoading(false);
      setLoadingText("Erreur...");
    }
  };

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        cityDropdownRef.current &&
        !cityDropdownRef.current.contains(event.target as Node)
      ) {
        setCityDropdownOpen(false);
      }
    }
    if (cityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [cityDropdownOpen]);

  return (
    <div className="min-h-screen [background-color:#f5f7f3] flex flex-col">
      {loading && (
        <Loading text={loadingText} />
      )}
      {/* Header */}
      <header className="[background-color:#f5f7f3] border-gray-200 py-6 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a 
            href="/" 
            onClick={(e) => {
              e.preventDefault();
              router.push('/');
            }}
            className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[28px] tracking-wide text-gray-900">REZA</span>
              <span className="text-xs font-bold tracking-[0.2em] text-[#C57B57] mt-1">PRO</span>
            </div>
          </a>
          {step > 0 && step < 5 && (
            <button
              onClick={() => setStep(step === 4 ? 1 : step - 1)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      {step > 1 && (
        <div className="bg-[#f5f7f3] border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex gap-2">
              <div className={`flex-1 h-1 rounded-full ${step >= 4 ? 'bg-black' : 'bg-gray-200'}`} />
              <div className={`flex-1 h-1 rounded-full ${step >= 5 ? 'bg-black' : 'bg-gray-200'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">

            {/* Step 0: Pricing Page */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="space-y-16"
              >
                {/* Hero */}
                <div className="text-center space-y-5 max-w-3xl mx-auto">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/5 rounded-full text-sm font-medium text-gray-700 mb-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Reza Pro · Offre de lancement
                  </div>
                  <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
                    Développez votre<br />activité avec Reza
                  </h1>
                  <p className="text-xl text-gray-500 font-light leading-relaxed">
                    La plateforme de réservation beauté et bien-être n°1 au Maroc. Gérez vos rendez-vous, vos équipes et vos clients — tout en un.
                  </p>
                </div>

                {/* Pricing — one plan with the real fee structure (from the
                    platform billing config, same source as the admin dashboard) */}
                <div className="max-w-3xl mx-auto">
                  <div className="bg-black border-2 border-black rounded-3xl p-8 space-y-6 relative overflow-hidden shadow-2xl">
                    <div>
                      <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Reza Pro</p>
                      <p className="text-gray-300 text-sm">
                        Un frais unique par salon, puis une redevance mensuelle par employé.
                      </p>
                    </div>

                    {/* One-time per-salon fee */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Frais par salon — paiement unique</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-white">
                          {billingConfig ? billingConfig.pricePerSalon.toLocaleString('fr-FR') : '—'}
                        </span>
                        <span className="text-xl font-bold text-gray-400">{billingConfig?.currency || 'MAD'}</span>
                        <span className="text-gray-400 text-sm">/ salon · une seule fois</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">
                        Le frais par salon est payé une seule fois, pour toujours.
                      </p>
                    </div>

                    {/* Monthly per-employee tiers */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Employés — mensuel</p>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
                        {billingConfig?.employeeTiers && billingConfig.employeeTiers.length > 0 ? (
                          billingConfig.employeeTiers.map((t, i) => {
                            const range =
                              t.max === null || t.max === undefined
                                ? `${t.min}+ employés`
                                : t.min === t.max
                                  ? `${t.min} employé${t.min > 1 ? 's' : ''}`
                                  : `${t.min}–${t.max} employés`;
                            return (
                              <div key={i} className="flex items-center justify-between gap-4 text-sm">
                                <span className="text-gray-300">{range}</span>
                                <span className="font-bold text-white whitespace-nowrap">
                                  {t.price} {billingConfig.currency}/employé/mois
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-gray-300">Chargement de la tarification...</p>
                        )}
                        <p className="text-[11px] text-gray-500 pt-2 border-t border-white/10">
                          Tarif dégressif : chaque employé est facturé selon le palier de sa position.
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {[
                        'Réservations illimitées',
                        'Profil mis en avant dans l\'app',
                        'Gestion multi-staff & agenda',
                        'Statistiques & rapports',
                        'Notifications clients automatiques',
                        'Support prioritaire 7j/7',
                      ].map(f => (
                        <li key={f} className="flex items-center gap-3 text-sm text-gray-200">
                          <Check className="w-4 h-4 text-[#C57B57] flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => setStep(1)}
                        className="w-full py-4 bg-white rounded-2xl font-bold text-black hover:bg-gray-100 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        S'inscrire
                        <ArrowRight className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowCalculator(true)}
                        className="w-full py-4 border-2 border-white/30 rounded-2xl font-bold text-white hover:bg-white/10 transition-all duration-200"
                      >
                        Calculer mes frais
                      </button>
                    </div>
                  </div>
                </div>

                {/* Fee calculator modal — first month vs following months */}
                {showCalculator && billingConfig && (
                  <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowCalculator(false)}
                  >
                    <div
                      className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl animate-in zoom-in-95 duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-900">Estimer mes frais</h3>
                        <button
                          onClick={() => setShowCalculator(false)}
                          className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                          aria-label="Fermer"
                        >
                          <X className="w-5 h-5 text-gray-500" />
                        </button>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre de salons
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={calcSalons}
                            onChange={(e) => setCalcSalons(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre d'employés (tous salons)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={calcEmployees}
                            onChange={(e) => setCalcEmployees(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                          />
                        </div>
                      </div>

                      {(() => {
                        const salonTotal = calcSalons * billingConfig.pricePerSalon;
                        const empFee = calcEmployeeFee(calcEmployees);
                        const firstMonth = salonTotal + empFee;
                        return (
                          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-5 space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                Salons ({calcSalons} × {billingConfig.pricePerSalon} {billingConfig.currency})
                              </span>
                              <span className="font-semibold text-gray-900">
                                {salonTotal.toLocaleString('fr-FR')} {billingConfig.currency}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Employés (mensuel)</span>
                              <span className="font-semibold text-gray-900">
                                {empFee.toLocaleString('fr-FR')} {billingConfig.currency}
                              </span>
                            </div>
                            <div className="border-t border-gray-200 pt-3 flex justify-between items-baseline">
                              <span className="text-sm font-semibold text-gray-900">1er mois</span>
                              <span className="text-2xl font-extrabold text-gray-900">
                                {firstMonth.toLocaleString('fr-FR')} {billingConfig.currency}
                              </span>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-sm text-gray-600">Mois suivants</span>
                              <span className="text-xl font-bold text-gray-900">
                                {empFee.toLocaleString('fr-FR')} {billingConfig.currency}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400">
                              Le frais par salon n'est payé qu'une seule fois — les mois suivants ne
                              couvrent que les employés.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 1: User Type Selection */}
            {step === 1 && (
              <motion.div
                key="step1"

                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="text-center space-y-8 animate-in fade-in duration-500"
              >
                <div className="space-y-4">
                  <h1 className="text-4xl md:text-5xl font-normal text-gray-900">
                    Devenir partenaire Reza Pro
                  </h1>
                  <p className="text-lg text-gray-600">
                    Soyez visibles auprès de <span className="font-semibold">milliers d'utilisateurs</span>.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-8 py-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-600" />
                    Sans engagement
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-600" />
                    Sans commission
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  {/* Active card: Professional */}
                  <button
                    onClick={() => handleUserTypeSelection('professional')}
                    className="w-full bg-black border-2 border-black rounded-2xl p-6 group transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                        <img src="/icons/pro.png" alt="Pro Icon" className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-lg font-semibold text-white">
                          Je suis gérant d'un établissement
                        </h3>
                        <p className="text-sm text-gray-200">
                          Coiffure, esthétique, barber, bien-être...
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>

                  {/* Inactive card: Client */}
                  <button
                    onClick={() => handleUserTypeSelection('client')}
                    className="w-full"
                    style={{ backgroundColor: '#f5f7f3' }}
                  >
                    <div className="border-2 border-gray-200 rounded-2xl p-6 hover:bg-gray-50 transition-all duration-200 group flex items-center gap-4">
                      <div className="w-12 h-12 bg-transparent rounded-full flex items-center justify-center">
                        <img src="/icons/calendar.png" alt="Appointment Icon" className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Je ne suis pas un professionnel
                        </h3>
                        <p className="text-sm text-gray-600">
                          Je souhaite prendre un rendez-vous beauté
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 5: Success */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="space-y-8 animate-in fade-in duration-500"
              >
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h1 className="text-4xl font-normal text-gray-900">
                    Compte créé avec succès !
                  </h1>
                  <p className="text-gray-600">
                    Votre compte professionnel a été créé. Un email de confirmation a été envoyé à{" "}
                    <span className="font-medium text-gray-900">{formData.email}</span> — cliquez sur le lien pour
                    activer votre compte, puis connectez-vous avec votre email et mot de passe.
                  </p>
                </div>

                <div className="bg-[#f5f7f3] rounded-2xl border-2 border-gray-200 p-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <div className="w-full px-4 py-3 bg-white border border-gray-300 rounded-full text-gray-900 font-mono text-sm">
                      {formData.email}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => {
                      const raw = (process.env.NEXT_PUBLIC_SAAS_LOGIN_URL || 'http://localhost:3000/login').trim();
                      // Normalize: if the env value lacks a protocol (e.g. "reza-pro.vercel.app/login"),
                      // the browser would treat it as a relative path on the client domain → 404.
                      const saasLoginUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
                      // Pass email as URL parameter for auto-fill
                      const loginUrl = `${saasLoginUrl}?email=${encodeURIComponent(formData.email)}`;
                      window.location.href = loginUrl;
                    }}
                    className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 transition-all flex items-center gap-2"
                  >
                    Aller à la page de connexion
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Business Information Form */}
            {step === 4 && !loading && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="space-y-8 animate-in fade-in duration-500"
              >
                <div className="text-center space-y-4">
                  <h1 className="text-4xl font-normal text-gray-900">
                    Informations sur votre établissement
                  </h1>
                  <p className="text-gray-600">
                    Remplissez les informations ci-dessous pour créer votre compte professionnel
                  </p>
                </div>

                <div className="bg-[#f5f7f3] rounded-2xl border-1 border-gray-200 p-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nom de l'établissement *
                      </label>
                      <input
                        type="text"
                        value={formData.establishmentName}
                        onChange={(e) => handleInputChange('establishmentName', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent text-gray-900 placeholder-gray-400"
                        placeholder="Mon Salon / Mon Institut"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ville *
                      </label>
                      {/* Custom Dropdown */}
                      <div className="relative" ref={cityDropdownRef}>
                        <button
                          type="button"
                          className="w-full px-4 py-3 border border-gray-300 rounded-full text-left text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent flex justify-between items-center"
                          style={{ backgroundColor: '#f5f7f3' }}
                          onClick={() => setCityDropdownOpen((open) => !open)}
                        >
                          {formData.city
                            ? cities.find((c) => c.value === formData.city)?.label
                            : 'Sélectionner une ville'}
                          <svg
                            className={`w-4 h-4 ml-2 transition-transform ${cityDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {cityDropdownOpen && (
                          <div
                            className="absolute z-10 mt-2 w-full border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto animate-in fade-in duration-100"
                            style={{ backgroundColor: '#f5f7f3' }}
                          >
                            {cities.map((city) => (
                              <button
                                key={city.value}
                                type="button"
                                disabled={!city.available}
                                onClick={() => {
                                  if (city.available) {
                                    handleInputChange('city', city.value);
                                    setCityDropdownOpen(false);
                                  }
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors ${
                                  !city.available
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-gray-900'
                                } ${formData.city === city.value ? 'bg-gray-100 font-semibold' : ''}`}
                              >
                                {city.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Prénom
                        </label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent text-gray-900 placeholder-gray-400"
                          placeholder="Jean"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nom
                        </label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent text-gray-900 placeholder-gray-400"
                          placeholder="Dupont"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent text-gray-900 placeholder-gray-400"
                        placeholder="vous@exemple.com"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Mot de passe *
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent text-gray-900 placeholder-gray-400"
                            placeholder="Minimum 8 caractères"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">Minimum 8 caractères</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirmer le mot de passe *
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-black focus:border-transparent text-gray-900 placeholder-gray-400"
                            placeholder="Confirmez votre mot de passe"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex justify-between items-center pt-4">
                  <button
                    onClick={() => {
                      setStep(1);
                      setError(null);
                    }}
                    className="px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Retour
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !formData.establishmentName || !formData.firstName || !formData.lastName || !formData.email || !formData.city || !formData.password || !formData.confirmPassword}
                    className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 transition-all flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Création en cours...' : 'Créer mon compte'}
                    {!loading && <ArrowRight className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="[background-color:#f5f7f3] border-t border-gray-200 py-8 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-600">
            Des questions ? Contactez-nous à{' '}
            <a href="mailto:pro@reza.ma" className="underline hover:no-underline font-medium">
              pro@reza.ma
            </a>
          </p>
        </div>
      </footer>

      <style jsx global>{`
        .animate-fadein {
          opacity: 0;
          animation: fadein-anim 0.4s forwards;
        }
        @keyframes fadein-anim {
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}