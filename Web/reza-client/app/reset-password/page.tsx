'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import CurvySlideButton from '@/components/UI/CurvySlideButton';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Lien invalide. Veuillez refaire une demande de réinitialisation.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Lien invalide. Veuillez refaire une demande de réinitialisation.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#f6f6ef] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-[#000000] mb-3">Mot de passe réinitialisé</h1>
          <p className="text-gray-600 text-sm leading-relaxed mb-8">
            Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
          </p>
          <CurvySlideButton
            type="button"
            onClick={() => router.push('/login')}
            text="Se connecter"
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
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6ef] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="mb-6 flex items-center gap-2 text-gray-900 font-bold hover:text-gray-700 transition-colors text-sm"
          aria-label="Retour à la connexion"
        >
          <ArrowLeft size={20} className="inline-block" />
          Retour à la connexion
        </button>
        <h1 className="text-3xl font-bold text-[#000000] mb-2">Nouveau mot de passe</h1>
        <p className="text-gray-500 text-sm mb-8">
          Choisissez un nouveau mot de passe pour votre compte Reza.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-900 mb-2">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Au moins 8 caractères"
                className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 text-base font-medium pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-900 mb-2">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le mot de passe"
                className="w-full px-6 py-3 bg-transparent border border-gray-200 rounded-full focus:ring-1 focus:ring-[#082259] outline-none transition-all text-gray-900 placeholder-gray-400 text-base font-medium pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showConfirm ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <CurvySlideButton
            type="submit"
            disabled={loading}
            text={loading ? 'Enregistrement...' : 'Réinitialiser le mot de passe'}
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
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          />
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f6ef]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
