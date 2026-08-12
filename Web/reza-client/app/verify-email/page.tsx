'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Mail, ArrowLeft } from 'lucide-react';
import LoadingOverlay from '@/components/UI/LoadingOverlay';
import CurvySlideButton from '@/components/UI/CurvySlideButton';
import { useAuth } from '../../context/AuthContext';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [connected, setConnected] = useState(false);
  const { connectAfterVerification } = useAuth();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de vérification manquant.');
      return;
    }

    verifyEmail(token);
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/public/auth/client-verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Token expired') {
          setStatus('expired');
          setMessage(data.message || 'Le lien de vérification a expiré.');
        } else {
          setStatus('error');
          setMessage(data.message || 'Erreur lors de la vérification de l\'email.');
        }
        return;
      }

      setStatus('success');
      setMessage(data.message || 'Email vérifié avec succès.');
      if (data.client?.email) {
        setEmail(data.client.email);
      }
      if (data.client) {
        // The confirmation link proves email ownership — sign the user in now.
        connectAfterVerification(data.client);
        setConnected(true);
        setTimeout(() => {
          router.push('/account');
        }, 1500);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('Erreur lors de la vérification. Veuillez réessayer.');
    }
  };

  const resendVerification = async () => {
    if (!email) {
      setMessage('Impossible de renvoyer l\'email sans adresse email.');
      return;
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_URL}/public/auth/client-resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Email de vérification renvoyé avec succès. Vérifiez votre boîte de réception.');
      } else {
        setMessage(data.message || 'Erreur lors de l\'envoi de l\'email.');
      }
    } catch (error: any) {
      console.error('Resend error:', error);
      setMessage('Erreur lors de l\'envoi de l\'email. Veuillez réessayer.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6ef] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button
          onClick={() => router.push('/')}
          className="mb-6 flex items-center gap-2 text-gray-900 font-bold hover:text-gray-700 transition-colors text-sm"
        >
          <ArrowLeft size={20} />
          Retour à l'accueil
        </button>

        <div className="bg-white rounded-3xl shadow-lg p-8">
          {status === 'loading' && (
            <div className="text-center">
              <LoadingOverlay />
              <p className="mt-4 text-gray-600">Vérification de votre email en cours...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle size={64} className="text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Email vérifié !</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <p className="text-sm text-gray-500 mb-6">
                {connected
                  ? 'Vous êtes maintenant connecté. Redirection vers votre compte...'
                  : 'Vous pouvez maintenant vous connecter.'}
              </p>
              <CurvySlideButton
                onClick={() => router.push(connected ? '/account' : '/login')}
                text={connected ? 'Aller à mon compte' : 'Se connecter'}
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
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <XCircle size={64} className="text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Erreur de vérification</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                <CurvySlideButton
                  onClick={() => router.push('/login')}
                  text="Retour à la connexion"
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
          )}

          {status === 'expired' && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Mail size={64} className="text-orange-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Lien expiré</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                <CurvySlideButton
                  onClick={() => router.push('/login')}
                  text="Retour à la connexion"
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
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f6f6ef] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
            <LoadingOverlay />
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
