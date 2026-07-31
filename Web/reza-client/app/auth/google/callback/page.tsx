'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import LoadingOverlay from '@/components/UI/LoadingOverlay';

function GoogleCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGoogle } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed.current) {
      return;
    }

    const email = searchParams.get('email');
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (error) {
      hasProcessed.current = true;
      // Redirect to login with error
      router.replace('/login?error=google_auth_failed');
      return;
    }

    if (success === 'true' && email) {
      hasProcessed.current = true;
      // Login the user with the email from Google
      const handleAuth = async () => {
        try {
          // Wait a bit to ensure the client is fully created in the database
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Retry login up to 3 times with delays
          let result: { success: boolean; error?: string } | undefined;
          let retries = 3;
          while (retries > 0) {
            result = await loginWithGoogle(email);
            if (result && result.success) {
              break;
            }
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (result && result.success) {
            // Wait a bit for the auth state to update before redirecting
            await new Promise(resolve => setTimeout(resolve, 100));
            // Use replace instead of push to avoid adding to history
            router.replace('/account');
          } else {
            console.error('[Google Callback] Login failed after retries:', result?.error);
            router.replace(`/login?error=google_auth_failed&details=${encodeURIComponent(result?.error || 'Login failed')}`);
          }
        } catch (err) {
          console.error('Error authenticating with Google:', err);
          router.replace('/login?error=google_auth_failed');
        }
      };

      handleAuth();
    } else {
      hasProcessed.current = true;
      // No success or email, redirect to login
      router.replace('/login?error=google_auth_failed');
    }
  }, [searchParams, router, loginWithGoogle]);

  return (
    <div className="h-screen flex items-center justify-center bg-[#f6f6ef]">
      <div className="text-center">
        <LoadingOverlay />
        <p className="text-gray-600 mt-4">Connexion en cours...</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-[#f6f6ef]">
        <div className="text-center">
          <LoadingOverlay />
          <p className="text-gray-600 mt-4">Chargement...</p>
        </div>
      </div>
    }>
      <GoogleCallbackPageContent />
    </Suspense>
  );
}