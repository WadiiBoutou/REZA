'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Key, Loader2, Eye, EyeOff, Check, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isValidMoroccanPhone, getMoroccanPhoneError, normalizeMoroccanPhone } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ open, onOpenChange }) => {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState<'profile' | 'password'>('profile');

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile fields
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab('profile');
      setAvatarPreview(user?.avatar || null);
      setPhone(user?.phone || '');
      setProfileError(null);
      setCurrentPassword('');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setCodeSent(false);
      setPasswordError(null);
    }
  }, [open, user?.avatar]);

  if (!open) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    try {
      const { avatar } = await api.uploadAuthAvatar(file);
      updateUser({ avatar });
      toast.success('Photo de profil mise à jour');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload de la photo");
      setAvatarPreview(user?.avatar || null);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!phone || !phone.trim()) {
      setProfileError('Le téléphone est requis.');
      return;
    }
    const phoneError = getMoroccanPhoneError(phone.trim());
    if (phoneError) {
      setProfileError(phoneError);
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      const { user: updated } = await api.updateAuthProfile({ phone: normalizeMoroccanPhone(phone.trim()) });
      updateUser({ phone: updated.phone });
      toast.success('Téléphone mis à jour');
    } catch (err: any) {
      setProfileError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendCode = async () => {
    if (!currentPassword) {
      setPasswordError('Veuillez entrer votre mot de passe actuel.');
      return;
    }
    setSendingCode(true);
    setPasswordError(null);
    try {
      const res = await api.sendPasswordCode(currentPassword);
      setCodeSent(true);
      toast.success(res.message || 'Code envoyé à votre adresse email');
    } catch (err: any) {
      setPasswordError(err.message || "Erreur lors de l'envoi du code");
    } finally {
      setSendingCode(false);
    }
  };

  const handleChangePassword = async () => {
    if (!code) {
      setPasswordError('Veuillez entrer le code reçu par email.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }
    setChangingPassword(true);
    setPasswordError(null);
    try {
      const res = await api.changePassword(code, newPassword);
      toast.success(res.message || 'Mot de passe modifié avec succès');
      setCurrentPassword('');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setCodeSent(false);
    } catch (err: any) {
      setPasswordError(err.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setChangingPassword(false);
    }
  };

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : 'U';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Mon profil</h2>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {([
            { key: 'profile', label: 'Photo de profil', icon: Camera },
            { key: 'password', label: 'Mot de passe', icon: Key },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                tab === key ? 'bg-[#002366] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'profile' && (
            <div className="flex flex-col items-center gap-6">
              <div className="w-full space-y-2">
                <label className="block text-xs text-gray-600 mb-2 font-medium">Téléphone *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setProfileError(null);
                  }}
                  placeholder="06 12 34 56 78"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#002366]"
                />
              </div>
              <div className="relative">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="Photo de profil"
                    className="w-28 h-28 rounded-full object-cover border-4 border-gray-100"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-[#002366] flex items-center justify-center border-4 border-gray-100">
                    <span className="text-white font-semibold text-3xl">{initials}</span>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#002366] text-white flex items-center justify-center hover:bg-[#001a4d] transition-colors disabled:opacity-50"
                  title="Changer la photo"
                >
                  {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-xs font-medium text-[#002366] hover:underline disabled:opacity-50"
              >
                {uploadingAvatar ? 'Envoi en cours...' : 'Changer la photo de profil'}
              </button>

              {profileError && (
                <div className="w-full bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                  {profileError}
                </div>
              )}

              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-[#001a4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {savingProfile ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          )}

          {tab === 'password' && (
            <div className="space-y-4">
              {!codeSent ? (
                <>
                  <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                    <Mail size={14} className="shrink-0 mt-0.5 text-gray-400" />
                    <span>
                      Pour changer votre mot de passe, un code de vérification sera envoyé à{' '}
                      <strong>{user?.email}</strong>. Saisissez d&apos;abord votre mot de passe actuel.
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-2 font-medium">Mot de passe actuel</label>
                    <div className="relative">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          setPasswordError(null);
                        }}
                        className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#002366]"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 rounded-xl p-3">
                    <Mail size={14} className="shrink-0 mt-0.5 text-blue-400" />
                    <span>
                      Un code à 6 chiffres a été envoyé à <strong>{user?.email}</strong>. Saisissez-le
                      ci-dessous avec votre nouveau mot de passe.
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-2 font-medium">Code de vérification</label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setPasswordError(null);
                      }}
                      inputMode="numeric"
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#002366] tracking-[0.5em] text-center font-semibold"
                      placeholder="••••••"
                      maxLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-2 font-medium">Nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setPasswordError(null);
                        }}
                        className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#002366]"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-2 font-medium">Confirmer le mot de passe</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordError(null);
                        }}
                        className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#002366]"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                  {passwordError}
                </div>
              )}

              {!codeSent ? (
                <button
                  onClick={handleSendCode}
                  disabled={sendingCode}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-[#001a4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingCode ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  {sendingCode ? 'Envoi...' : 'Envoyer le code'}
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-[#001a4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    {changingPassword ? 'Modification...' : 'Changer le mot de passe'}
                  </button>
                  <button
                    onClick={() => {
                      setCodeSent(false);
                      setCode('');
                      setPasswordError(null);
                    }}
                    className="w-full text-center text-xs text-gray-500 hover:text-gray-900"
                  >
                    Annuler et recommencer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
