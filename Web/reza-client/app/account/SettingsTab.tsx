import { Bell, Shield, Key, Check, ChevronRight, Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import Loading from '../salon/Loading';

const SettingsTab = () => {
  const { user } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<{ [key: string]: string }>({});
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const router = useRouter();
  const [showLogoutLoading, setShowLogoutLoading] = useState(false);

  // Step 1: verify the current password and email a verification code
  const handleSendCode = async () => {
    if (!passwordForm.currentPassword) {
      setPasswordErrors({ currentPassword: 'Le mot de passe actuel est requis' });
      return;
    }

    if (!user?.email) {
      setPasswordError('Email utilisateur manquant');
      return;
    }

    setSendingCode(true);
    setPasswordError(null);
    setPasswordSaved(false);

    try {
      await api.sendClientPasswordCode(user.email, passwordForm.currentPassword);
      setCodeSent(true);
      setPasswordError(null);
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de l\'envoi du code. Veuillez réessayer.';
      if (error.status !== 401 && error.status !== 400) {
        console.error('[SettingsTab] Unexpected error sending code:', error);
      }
      setPasswordError(errorMessage);
      setPasswordSaved(false);
    } finally {
      setSendingCode(false);
    }
  };

  // Step 2: validate the emailed code and set the new password
  const handleSavePassword = async () => {
    if (!code || code.length < 4) {
      setPasswordErrors({ code: 'Veuillez entrer le code reçu par email' });
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      setPasswordErrors({ newPassword: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrors({ confirmPassword: 'Les mots de passe ne correspondent pas' });
      return;
    }

    if (!user?.email) {
      setPasswordError('Email utilisateur manquant');
      return;
    }

    setChangingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);

    try {
      await api.changeClientPassword(user.email, {
        code,
        newPassword: passwordForm.newPassword
      });

      setPasswordSaved(true);
      setPasswordError(null);
      
      setTimeout(() => {
        setPasswordSaved(false);
        setShowPasswordForm(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordErrors({});
        setCode('');
        setCodeSent(false);
      }, 2000);
    } catch (error: any) {
      // Extract error message from API response
      const errorMessage = error.message || 'Erreur lors du changement de mot de passe. Veuillez réessayer.';
      
      // Only log unexpected errors (not 401/400 which are user input errors)
      if (error.status !== 401 && error.status !== 400) {
        console.error('[SettingsTab] Unexpected error changing password:', error);
      }
      
      // Display error message in UI
      setPasswordError(errorMessage);
      setPasswordSaved(false);
    } finally {
      setChangingPassword(false);
    }
  };


  if (showLogoutLoading) {
    return <Loading text="Déconnexion..." />;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Notifications */}
      <div className="bg-[#f5f7f3] border border-gray-200 p-8 rounded-2xl">
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-200">
          <Bell className="w-5 h-5 text-gray-400" />
          <div>
            <h3 className="text-sm font-light text-gray-900 mb-1">Notifications</h3>
            <p className="text-xs text-gray-400">Gérez vos préférences de notification</p>
          </div>
        </div>
        <div className="space-y-6">
          {['Rappels de rendez-vous', 'Offres spéciales', 'Nouveaux services'].map((item) => (
            <div key={item} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{item}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="bg-[#f5f7f3] border border-gray-200 p-8 rounded-2xl">
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-200">
          <Shield className="w-5 h-5 text-gray-400" />
          <div>
            <h3 className="text-sm font-light text-gray-900 mb-1">Sécurité</h3>
            <p className="text-xs text-gray-400">Protégez votre compte</p>
          </div>
        </div>
        <div className="space-y-0 border border-gray-200 rounded-2xl overflow-hidden">
          <div>
            <button 
              onClick={() => {
                setShowPasswordForm(!showPasswordForm);
                if (showPasswordForm) {
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordErrors({});
                  setPasswordSaved(false);
                }
              }}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-all border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Changer le mot de passe</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${showPasswordForm ? 'rotate-90' : ''}`} />
            </button>
            
            {showPasswordForm && (
              <div className="p-6 bg-[#f5f7f3] border-b border-gray-200">
                {!codeSent ? (
                  <>
                    <p className="text-xs text-gray-500 mb-4">
                      Un code de vérification sera envoyé à <strong>{user?.email}</strong>. Saisissez
                      d&apos;abord votre mot de passe actuel pour recevoir le code.
                    </p>
                    <div>
                      <label className="block text-xs text-gray-600 mb-2 font-medium">Mot de passe actuel</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwordForm.currentPassword}
                          onChange={e => {
                            setPasswordForm({ ...passwordForm, currentPassword: e.target.value });
                            setPasswordErrors({ ...passwordErrors, currentPassword: '' });
                          }}
                          className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:outline-none transition-colors ${
                            passwordErrors.currentPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-[#8b7260]'
                          } text-black placeholder-black`}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          tabIndex={-1}
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {passwordErrors.currentPassword && (
                        <p className="text-red-500 text-xs mt-1">{passwordErrors.currentPassword}</p>
                      )}
                    </div>
                    {passwordError && (
                      <div className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                        {passwordError}
                      </div>
                    )}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          setPasswordErrors({});
                          setPasswordError(null);
                          setShowCurrentPassword(false);
                          setShowNewPassword(false);
                          setShowConfirmPassword(false);
                        }}
                        disabled={sendingCode}
                        className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSendCode}
                        disabled={sendingCode}
                        className="px-5 py-2 bg-gray-900 text-white text-xs rounded-full hover:bg-[#8b7260] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingCode ? 'Envoi du code...' : 'Envoyer le code'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-4">
                      Un code à 6 chiffres a été envoyé à <strong>{user?.email}</strong>. Saisissez-le
                      ci-dessous avec votre nouveau mot de passe.
                    </p>
                    <div>
                      <label className="block text-xs text-gray-600 mb-2 font-medium">Code de vérification</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={code}
                        onChange={e => {
                          setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setPasswordErrors({ ...passwordErrors, code: '' });
                        }}
                        className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none transition-colors tracking-[0.5em] text-center font-semibold ${
                          passwordErrors.code ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-[#8b7260]'
                        } text-black placeholder-black`}
                        placeholder="••••••"
                      />
                      {passwordErrors.code && (
                        <p className="text-red-500 text-xs mt-1">{passwordErrors.code}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-4 mt-4 md:flex-row md:gap-6">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-2 font-medium">Nouveau mot de passe</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={passwordForm.newPassword}
                            onChange={e => {
                              setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                              setPasswordErrors({ ...passwordErrors, newPassword: '' });
                            }}
                            className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:outline-none transition-colors ${
                              passwordErrors.newPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-[#8b7260]'
                            } text-black placeholder-black`}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                          >
                            {showNewPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {passwordErrors.newPassword && (
                          <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-2 font-medium">Confirmer le mot de passe</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={passwordForm.confirmPassword}
                            onChange={e => {
                              setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                              setPasswordErrors({ ...passwordErrors, confirmPassword: '' });
                            }}
                            className={`w-full px-3 py-2.5 pr-10 text-sm border rounded-lg focus:outline-none transition-colors ${
                              passwordErrors.confirmPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-[#8b7260]'
                            } text-black placeholder-black`}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {passwordErrors.confirmPassword && (
                          <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>
                        )}
                      </div>
                    </div>
                    {passwordError && (
                      <div className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                        {passwordError}
                      </div>
                    )}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => {
                          setCodeSent(false);
                          setCode('');
                          setPasswordError(null);
                        }}
                        disabled={changingPassword}
                        className="text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Recommencer
                      </button>
                      <button
                        onClick={handleSavePassword}
                        disabled={changingPassword}
                        className="px-5 py-2 bg-gray-900 text-white text-xs rounded-full hover:bg-[#8b7260] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {changingPassword ? 'Changement...' : 'Changer le mot de passe'}
                      </button>
                      {passwordSaved && (
                        <span className="flex items-center text-green-600 text-xs">
                          <Check className="w-4 h-4 mr-1" /> Mot de passe modifié !
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        className="w-full p-4 border border-red-100 hover:border-red-200 text-red-600 text-sm tracking-wide transition-all flex items-center justify-center gap-2 rounded-2xl"
        onClick={() => {
          setShowLogoutLoading(true);
          setTimeout(() => router.push('/login'), 1200);
        }}
      >
        <ChevronRight className="w-4 h-4" />
        Déconnexion
      </button>

    </div>
  );
};

export default SettingsTab;