'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'expired'>('verifying');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const emailParam = searchParams.get('email');

      if (!token || !emailParam) {
        setStatus('error');
        setMessage('Lien de vérification invalide. Il manque le token ou l\'email.');
        return;
      }

      setEmail(emailParam);

      try {
        const response = await api.verifyEmail(token, emailParam);
        setStatus('success');
        setMessage(response.message || 'Email vérifié avec succès !');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login?verified=true');
        }, 3000);
      } catch (error: any) {
        console.error('[VerifyEmail] Verification error:', error);
        
        if (error.message?.includes('expiré') || error.message?.toLowerCase().includes('expired')) {
          setStatus('expired');
          setMessage(error.message || 'Le lien de vérification a expiré.');
        } else {
          setStatus('error');
          setMessage(error.message || 'Erreur lors de la vérification de l\'email.');
        }
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  const handleResendEmail = async () => {
    if (!email) return;

    try {
      setStatus('verifying');
      await api.resendVerificationEmail(email);
      setStatus('success');
      setMessage('Un nouvel email de vérification a été envoyé. Veuillez vérifier votre boîte de réception.');
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Erreur lors de l\'envoi de l\'email de vérification.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6ef] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {status === 'verifying' && (
            <>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h1 className="text-2xl font-bold text-[#000000] mb-4">
                Vérification en cours...
              </h1>
              <p className="text-gray-600">
                Veuillez patienter pendant que nous vérifions votre email.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#000000] mb-4">
                Email vérifié !
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Vous allez être redirigé vers la page de connexion...
              </p>
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-[#002366] text-white py-3 rounded-full font-semibold text-base hover:bg-[#003d99] transition-colors"
              >
                Aller à la connexion
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#000000] mb-4">
                Erreur de vérification
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/login')}
                  className="w-full bg-[#002366] text-white py-3 rounded-full font-semibold text-base hover:bg-[#003d99] transition-colors"
                >
                  Aller à la connexion
                </button>
                {email && (
                  <button
                    onClick={handleResendEmail}
                    className="w-full bg-transparent border border-[#002366] text-[#002366] py-3 rounded-full font-semibold text-base hover:bg-[#002366] hover:text-white transition-colors"
                  >
                    Renvoyer l'email de vérification
                  </button>
                )}
              </div>
            </>
          )}

          {status === 'expired' && (
            <>
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#000000] mb-4">
                Lien expiré
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                {email && (
                  <button
                    onClick={handleResendEmail}
                    className="w-full bg-[#002366] text-white py-3 rounded-full font-semibold text-base hover:bg-[#003d99] transition-colors"
                  >
                    Renvoyer l'email de vérification
                  </button>
                )}
                <button
                  onClick={() => router.push('/login')}
                  className="w-full bg-transparent border border-[#002366] text-[#002366] py-3 rounded-full font-semibold text-base hover:bg-[#002366] hover:text-white transition-colors"
                >
                  Aller à la connexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6ef]">
        <LoadingOverlay />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
