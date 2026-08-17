// @ts-nocheck
import { Bell, Shield, Key, Smartphone, CreditCard, Plus, Check, Lock, ChevronRight, X, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import DeleteModal from './modals/DeleteModal';
import SaveModal from './modals/SaveModal';
import { useRouter } from 'next/navigation';
import Loading from '../salon/Loading';

// Accept a generic props object so that parents (like account/page.tsx)
// can pass configuration/state without causing TypeScript prop errors.
const SettingsTab = (props) => {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [show2FAForm, setShow2FAForm] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorStep, setTwoFactorStep] = useState(1);
  const [twoFactorSaved, setTwoFactorSaved] = useState(false);
  const [savedCards, setSavedCards] = useState([]);
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    cardName: '',
    cardExpiry: '',
    cardCVV: ''
  });
  const [cardFormErrors, setCardFormErrors] = useState({});
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [deleteCardId, setDeleteCardId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const router = useRouter();
  const [showLogoutLoading, setShowLogoutLoading] = useState(false);

  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\s/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiry = (value) => {
    if (value.length >= 2) {
      return value.slice(0, 2) + '/' + value.slice(2);
    }
    return value;
  };

  const handleDisable2FA = () => {
    setTwoFactorEnabled(false);
    setShow2FAForm(false);
    setTwoFactorStep(1);
    setTwoFactorCode('');
  };

  const validatePassword = () => {
    const errors = {};
    
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Le mot de passe actuel est requis';
    }
    
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      errors.newPassword = 'Le nouveau mot de passe doit contenir au moins 8 caractères';
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePassword = () => {
    if (validatePassword()) {
      setPasswordSaved(true);
      setTimeout(() => {
        setPasswordSaved(false);
        setShowPasswordForm(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordErrors({});
      }, 2000);
    }
  };

  const handleEnable2FA = () => {
    if (twoFactorStep === 1) {
      setTwoFactorStep(2);
    } else if (twoFactorStep === 2 && twoFactorCode.length === 6) {
      setTwoFactorEnabled(true);
      setTwoFactorSaved(true);
      setTimeout(() => {
        setTwoFactorSaved(false);
        setShow2FAForm(false);
        setTwoFactorStep(1);
        setTwoFactorCode('');
      }, 2000);
    }
  };

  const validateCard = () => {
    const errors = {};
    
    if (!cardForm.cardNumber || cardForm.cardNumber.length !== 16) {
      errors.cardNumber = true;
    }
    
    if (!cardForm.cardName.trim()) {
      errors.cardName = true;
    }
    
    if (!cardForm.cardExpiry || cardForm.cardExpiry.length !== 5) {
      errors.cardExpiry = true;
    }
    
    if (!cardForm.cardCVV || cardForm.cardCVV.length !== 3) {
      errors.cardCVV = true;
    }
    
    setCardFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCard = () => {
    setShowSaveModal(true);
  };

  const confirmSaveCard = () => {
    if (validateCard()) {
      const newCard = {
        id: Date.now(),
        cardNumber: cardForm.cardNumber,
        cardName: cardForm.cardName,
        cardExpiry: cardForm.cardExpiry,
        lastFour: cardForm.cardNumber.slice(-4),
        type: cardForm.cardNumber.startsWith('4') ? 'visa' : cardForm.cardNumber.startsWith('5') ? 'mastercard' : 'other'
      };
      
      setSavedCards([...savedCards, newCard]);
      setCardSaved(true);
      
      setTimeout(() => {
        setCardSaved(false);
        setShowCardForm(false);
        setCardForm({ cardNumber: '', cardName: '', cardExpiry: '', cardCVV: '' });
        setCardFormErrors({});
      }, 2000);
      setShowSaveModal(false);
    } else {
      setShowSaveModal(false);
    }
  };

  const handleDeleteCard = (cardId) => {
    setDeleteCardId(cardId);
    setShowDeleteModal(true);
  };

  const confirmDeleteCard = () => {
    setSavedCards(savedCards.filter(card => card.id !== deleteCardId));
    setShowDeleteModal(false);
    setDeleteCardId(null);
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
                {/* Make password fields in a row */}
                <div className="flex flex-col gap-4 md:flex-row md:gap-6">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-2 font-medium">Mot de passe actuel</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={e => {
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value });
                        setPasswordErrors({ ...passwordErrors, currentPassword: '' });
                      }}
                      className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none transition-colors ${
                        passwordErrors.currentPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-[#8b7260]'
                      } text-black placeholder-black`}
                      placeholder="••••••••"
                    />
                    {passwordErrors.currentPassword && (
                      <p className="text-red-500 text-xs mt-1">{passwordErrors.currentPassword}</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-2 font-medium">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={e => {
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                        setPasswordErrors({ ...passwordErrors, newPassword: '' });
                      }}
                      className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none transition-colors ${
                        passwordErrors.newPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-[#8b7260]'
                      } text-black placeholder-black`}
                      placeholder="••••••••"
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-2 font-medium">Confirmer le mot de passe</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={e => {
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                        setPasswordErrors({ ...passwordErrors, confirmPassword: '' });
                      }}
                      className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none transition-colors ${
                        passwordErrors.confirmPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-[#8b7260]'
                      } text-black placeholder-black`}
                      placeholder="••••••••"
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      setPasswordErrors({});
                    }}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSavePassword}
                    className="px-5 py-2 bg-gray-900 text-white text-xs rounded-full hover:bg-[#8b7260] transition-all"
                  >
                    Enregistrer
                  </button>
                  {passwordSaved && (
                    <span className="flex items-center text-green-600 text-xs">
                      <Check className="w-4 h-4 mr-1" /> Mot de passe modifié !
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div>
            <button 
              onClick={() => {
                if (twoFactorEnabled) {
                  handleDisable2FA();
                } else {
                  setShow2FAForm(!show2FAForm);
                  if (show2FAForm) {
                    setTwoFactorStep(1);
                    setTwoFactorCode('');
                    setTwoFactorSaved(false);
                  }
                }
              }}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Authentification à deux facteurs</span>
              </div>
              <div className="flex items-center gap-3">
                {twoFactorEnabled && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Activée</span>
                )}
                <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${show2FAForm ? 'rotate-90' : ''}`} />
              </div>
            </button>
            
            {show2FAForm && !twoFactorEnabled && (
              <div className="p-6 bg-[#f5f7f3]">
                {twoFactorStep === 1 && (
                  <div className="space-y-4">
                    <div className="bg-[#f5f7f3] border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700 mb-3">
                        L'authentification à deux facteurs ajoute une couche de sécurité supplémentaire à votre compte.
                      </p>
                      <div className="flex items-start gap-2 text-xs text-gray-600">
                        <Shield className="w-4 h-4 text-[#8b7260] mt-0.5 flex-shrink-0" />
                        <span>Vous devrez saisir un code de vérification à chaque connexion.</span>
                      </div>
                    </div>
                    
                   <div className="bg-[#f5f7f3] rounded-lg p-4 text-center">
                      <div className="w-48 h-48 mx-auto bg-[#f5f7f3] rounded-lg border-gray-200 p-3 mb-3">
                        <svg viewBox="0 0 29 29" className="w-full h-full">
                          {/* Positioning markers (corners) */}
                          {/* Top-left */}
                          <rect x="0" y="0" width="7" height="7" fill="black"/>
                          <rect x="1" y="1" width="5" height="5" fill="white"/>
                          <rect x="2" y="2" width="3" height="3" fill="black"/>
                          
                          {/* Top-right */}
                          <rect x="22" y="0" width="7" height="7" fill="black"/>
                          <rect x="23" y="1" width="5" height="5" fill="white"/>
                          <rect x="24" y="2" width="3" height="3" fill="black"/>
                          
                          {/* Bottom-left */}
                          <rect x="0" y="22" width="7" height="7" fill="black"/>
                          <rect x="1" y="23" width="5" height="5" fill="white"/>
                          <rect x="2" y="24" width="3" height="3" fill="black"/>
                          
                          {/* Timing patterns */}
                          {Array.from({ length: 13 }).map((_, i) => (
                            <g key={`timing-${i}`}>
                              <rect x={8 + i} y="6" width="1" height="1" fill={i % 2 === 0 ? 'black' : 'white'}/>
                              <rect x="6" y={8 + i} width="1" height="1" fill={i % 2 === 0 ? 'black' : 'white'}/>
                            </g>
                          ))}
                          
                          {/* Alignment pattern */}
                          <rect x="20" y="20" width="5" height="5" fill="black"/>
                          <rect x="21" y="21" width="3" height="3" fill="white"/>
                          <rect x="22" y="22" width="1" height="1" fill="black"/>
                          
                          {/* Data modules - realistic pattern */}
                          {[
                            [8,0],[9,0],[10,0],[11,0],[13,0],[14,0],[15,0],[16,0],[17,0],[19,0],[20,0],
                            [8,1],[10,1],[11,1],[13,1],[15,1],[17,1],[19,1],[20,1],
                            [8,2],[9,2],[11,2],[13,2],[14,2],[15,2],[16,2],[19,2],[20,2],
                            [8,3],[10,3],[11,3],[13,3],[14,3],[16,3],[17,3],[19,3],[20,3],
                            [8,4],[9,4],[10,4],[13,4],[15,4],[16,4],[19,4],[20,4],
                            [8,5],[11,5],[13,5],[14,5],[15,5],[17,5],[19,5],[20,5],
                            [10,7],[11,7],[12,7],[13,7],[14,7],[15,7],[16,7],[17,7],[19,7],[20,7],
                            [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[9,8],[11,8],[13,8],[14,8],[16,8],[17,8],[20,8],[23,8],[24,8],[25,8],[26,8],[27,8],[28,8],
                            [9,9],[10,9],[12,9],[13,9],[15,9],[16,9],[18,9],[19,9],
                            [9,10],[11,10],[12,10],[14,10],[16,10],[17,10],[18,10],[20,10],
                            [9,11],[10,11],[11,11],[13,11],[14,11],[15,11],[17,11],[19,11],[20,11],
                            [9,12],[11,12],[12,12],[13,12],[15,12],[17,12],[18,12],[19,12],
                            [9,13],[10,13],[14,13],[15,13],[16,13],[17,13],[19,13],
                            [9,14],[10,14],[11,14],[12,14],[14,14],[16,14],[18,14],[19,14],[20,14],
                            [9,15],[11,15],[13,15],[15,15],[16,15],[17,15],[18,15],[20,15],
                            [9,16],[10,16],[11,16],[12,16],[13,16],[15,16],[17,16],[19,16],
                            [9,17],[11,17],[12,17],[14,17],[15,17],[16,17],[18,17],[19,17],[20,17],
                            [9,18],[10,18],[13,18],[14,18],[16,18],[17,18],[18,18],
                            [9,19],[11,19],[12,19],[13,19],[15,19],[17,19],[18,19],
                            [9,20],[10,20],[11,20],[12,20],[14,20],[15,20],[16,20],[17,20],[18,20],
                            [0,21],[2,21],[3,21],[4,21],[5,21],[6,21],[9,21],[11,21],[13,21],[14,21],[16,21],[18,21],[19,21],
                            [0,22],[6,22],[10,22],[12,22],[13,22],[15,22],[17,22],[18,22],[19,22],[20,22],
                            [0,23],[2,23],[3,23],[4,23],[6,23],[9,23],[11,23],[12,23],[14,23],[16,23],[17,23],[19,23],
                            [0,24],[2,24],[3,24],[4,24],[6,24],[9,24],[10,24],[11,24],[13,24],[15,24],[16,24],[18,24],
                            [0,25],[2,25],[3,25],[4,25],[6,25],[9,25],[12,25],[13,25],[14,25],[16,25],[18,25],[19,25],
                            [0,26],[6,26],[9,26],[10,26],[11,26],[12,26],[15,26],[17,26],[18,26],[19,26],[20,26],
                            [8,27],[9,27],[10,27],[11,27],[12,27],[14,27],[15,27],[17,27],[19,27],[20,27],
                            [8,28],[10,28],[11,28],[13,28],[14,28],[15,28],[16,28],[18,28],[19,28],[20,28]
                          ].map(([x, y], i) => (
                            <rect key={`data-${i}`} x={x} y={y} width="1" height="1" fill="black"/>
                          ))}
                        </svg>
                      </div>
                      <p className="text-xs text-gray-500">Scannez ce QR code avec votre application d'authentification</p>
                    </div>
                    <button
                      onClick={handleEnable2FA}
                      className="w-full px-5 py-2.5 bg-gray-900 text-white text-sm hover:bg-[#8b7260] transition-all"
                    >
                      Continuer
                    </button>
                  </div>
                )}
                
                {twoFactorStep === 2 && (
                  <div className="space-y-4">
                    <div className="bg-[#f5f7f3] border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700 mb-1 font-medium">Entrez le code de vérification</p>
                      <p className="text-xs text-gray-500">Saisissez le code à 6 chiffres de votre application</p>
                    </div>
                    
                    <div>
                      <input
                        type="text"
                        value={twoFactorCode}
                        onChange={e => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 6) {
                            setTwoFactorCode(value);
                          }
                        }}
                        className="w-full px-4 py-3 text-center text-2xl text-gray-900 font-mono border border-gray-300 rounded-lg focus:outline-none focus:border-[#8b7260] tracking-widest"
                        placeholder="000000"
                        maxLength={6}
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setTwoFactorStep(1);
                          setTwoFactorCode('');
                        }}
                        className="flex-1 px-5 py-2.5 text-gray-700 text-sm rounded-full transition-all"
                      >
                        Retour
                      </button>
                      <button
                        onClick={handleEnable2FA}
                        disabled={twoFactorCode.length !== 6}
                        className="flex-1 px-5 py-2.5 bg-gray-900 text-white text-sm rounded-full hover:bg-[#8b7260] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Activer
                      </button>
                    </div>
                    
                    {twoFactorSaved && (
                      <div className="flex items-center justify-center text-green-600 text-sm">
                        <Check className="w-5 h-5 mr-2" /> 2FA activée avec succès !
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="bg-[#f5f7f3] border border-gray-200 p-8 rounded-2xl">
        <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-light text-gray-900 mb-1">Paiement</h3>
              <p className="text-xs text-gray-400">Gérez vos moyens de paiement</p>
            </div>
          </div>
          <button
            className="flex items-center justify-center w-9 h-9 rounded-full text-gray-900 hover:text-[#8b7260] transition-all"
            onClick={() => {
              setShowCardForm((v) => !v);
              if (showCardForm) {
                setCardForm({ cardNumber: '', cardName: '', cardExpiry: '', cardCVV: '' });
                setCardFormErrors({});
                setCardSaved(false);
              }
            }}
            title={showCardForm ? "Fermer" : "Ajouter une carte bancaire"}
          >
            {showCardForm ? <X className="w-5 h-5" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {/* Saved Cards List */}
        {savedCards.length > 0 && !showCardForm && (
          <div className="space-y-4 mb-6">
            {savedCards.map((card) => (
              <div key={card.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 rounded flex items-center justify-center">
                    <CreditCard className="w-8 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">•••• {card.lastFour}</p>
                    <p className="text-xs text-gray-500">{card.cardName}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Supprimer la carte"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Card setup form below header */}
        {showCardForm && (
          <div className="mt-8">
            <style>{`
              .perspective-1000 {
                perspective: 1000px;
              }
              .card-3d {
                width: 100%;
                height: 220px;
                position: relative;
                transform-style: preserve-3d;
                transition: transform 0.7s cubic-bezier(.4,2,.6,1);
              }
              .card-3d.flipped {
                transform: rotateY(180deg);
              }
              .card-face {
                position: absolute;
                width: 100%;
                height: 100%;
                backface-visibility: hidden;
                top: 0; left: 0;
              }
              .card-face.back {
                transform: rotateY(180deg);
              }
              .magnetic-stripe {
                height: 38px;
                background: linear-gradient(90deg, #222 80%, #444 100%);
                margin-top: 24px;
                border-radius: 6px;
              }
              .signature-box {
                background: #fff;
                height: 28px;
                width: 60%;
                margin-top: 24px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                padding: 0 10px;
                font-size: 0.95em;
                letter-spacing: 0.1em;
                position: relative;
                overflow: hidden;
              }
              .cvv-box {
                background: #f3f3f3;
                height: 28px;
                width: 60px;
                margin-left: 12px;
                margin-top: 24px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: monospace;
                font-size: 1em;
                color: #222;
                font-weight: bold;
                letter-spacing: 0.2em;
              }
              .card-back-logo {
                position: absolute;
                bottom: 30px; 
                right: 24px;
                opacity: 0.7;
              }
              .card-back-pattern {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: repeating-linear-gradient(
                  120deg,
                  rgba(255,255,255,0.04) 0px,
                  rgba(255,255,255,0.04) 2px,
                  transparent 2px,
                  transparent 8px
                );
                z-index: 0;
                pointer-events: none;
              }
              .card-3d,
              .card-face {
                will-change: transform;
              }
            `}</style>
            <div className="flex flex-col md:flex-row md:items-start md:gap-10">
              {/* Card Form Fields */}
              <div className="flex-1 order-2 md:order-1">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2 tracking-wide uppercase text-[11px] font-medium">
                      Numéro de carte
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cardForm.cardNumber ? formatCardNumber(cardForm.cardNumber) : ''}
                        onChange={e => {
                          const value = e.target.value.replace(/\s/g, '');
                          if (/^\d*$/.test(value) && value.length <= 16) {
                            setCardForm({ ...cardForm, cardNumber: value });
                            setCardFormErrors({ ...cardFormErrors, cardNumber: false });
                          }
                        }}
                        className={`w-full px-3 py-3 pr-14 text-base border-1 rounded-lg focus:outline-none transition-colors text-gray-900 font-mono ${
                          cardFormErrors.cardNumber ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#8b7260]'
                        } placeholder-gray-400`}
                        placeholder="1234 5678 9012 3456"
                      />
                      {cardForm.cardNumber && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {cardForm.cardNumber.startsWith('4') ? (
                            <span className="text-blue-600 text-xs font-bold">VISA</span>
                          ) : cardForm.cardNumber.startsWith('5') ? (
                            <div className="flex gap-[-2px]">
                              <div className="w-4 h-4 rounded-full bg-red-500"></div>
                              <div className="w-4 h-4 rounded-full bg-yellow-500 -ml-2"></div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                    {cardFormErrors.cardNumber && (
                      <p className="text-red-500 text-xs mt-1">Numéro de carte invalide (16 chiffres requis)</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2 tracking-wide uppercase text-[11px] font-medium">
                      Nom du titulaire
                    </label>
                    <input
                      type="text"
                      value={cardForm.cardName}
                      onChange={e => {
                        setCardForm({ ...cardForm, cardName: e.target.value.toUpperCase() });
                        setCardFormErrors({ ...cardFormErrors, cardName: false });
                      }}
                      className={`w-full px-3 py-3 text-sm border-1 rounded-lg focus:outline-none transition-colors text-gray-900 uppercase ${
                        cardFormErrors.cardName ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#8b7260]'
                      } placeholder-gray-400`}
                      placeholder="NOM PRÉNOM"
                    />
                    {cardFormErrors.cardName && (
                      <p className="text-red-500 text-xs mt-1">Le nom du titulaire est requis</p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-600 mb-2 tracking-wide uppercase text-[11px] font-medium">
                        Date d'expiration
                      </label>
                      <input
                        type="text"
                        value={cardForm.cardExpiry}
                        onChange={e => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 4) {
                            const formatted = formatExpiry(value);
                            setCardForm({ ...cardForm, cardExpiry: formatted });
                            setCardFormErrors({ ...cardFormErrors, cardExpiry: false });
                          }
                        }}
                        className={`w-full px-3 py-3 text-base border-1 rounded-lg focus:outline-none transition-colors text-gray-900 font-mono ${
                          cardFormErrors.cardExpiry ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#8b7260]'
                        } placeholder-gray-400`}
                        placeholder="MM/AA"
                        maxLength={5}
                      />
                      {cardFormErrors.cardExpiry && (
                        <p className="text-red-500 text-xs mt-1">Format: MM/AA</p>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm text-gray-600 mb-2 tracking-wide uppercase text-[11px] font-medium">
                        CVV
                      </label>
                      <input
                        type="password"
                        value={cardForm.cardCVV}
                        onChange={e => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 3) {
                            setCardForm({ ...cardForm, cardCVV: value });
                            setCardFormErrors({ ...cardFormErrors, cardCVV: false });
                          }
                        }}
                        onFocus={() => setIsCardFlipped(true)}
                        onBlur={() => setIsCardFlipped(false)}
                        className={`w-full px-3 py-3 text-base border-1 rounded-lg focus:outline-none transition-colors text-gray-900 font-mono ${
                          cardFormErrors.cardCVV ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#8b7260]'
                        } placeholder-gray-400`}
                        placeholder="123"
                        maxLength={3}
                      />
                      {cardFormErrors.cardCVV && (
                        <p className="text-red-500 text-xs mt-1">CVV invalide (3 chiffres)</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 mt-8 items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCardForm(false);
                      setCardForm({ cardNumber: '', cardName: '', cardExpiry: '', cardCVV: '' });
                      setCardFormErrors({});
                    }}
                    className="text-xs text-gray-500 hover:text-gray-900 bg-transparent border-0 px-0 py-0 shadow-none"
                    style={{ minWidth: 0, padding: 0 }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveCard}
                    className="px-6 py-2 bg-gray-900 text-white text-xs rounded-full hover:bg-[#8b7260] transition-all"
                  >
                    Enregistrer
                  </button>
                  {cardSaved && (
                    <span className="flex items-center text-green-600 text-xs ml-2">
                      <Check className="w-4 h-4 mr-1" /> Carte enregistrée !
                    </span>
                  )}
                </div>
              </div>
              {/* 3D Card Preview */}
              <div className="w-full max-w-md mx-auto mt-10 md:mt-0 md:mx-0 md:w-[350px] order-1 md:order-2">
                <div className="perspective-1000">
                  <div className={`card-3d${isCardFlipped ? ' flipped' : ''}`}>
                    {/* Front of Card */}
                    <div className="card-face front card-shine rounded-xl p-8 text-white aspect-[1.586/1] flex flex-col justify-between relative overflow-hidden"
                      style={{
                        background: '#000',
                        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
                      }}>
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                          <img
                            src="/payment/chip.png"
                            alt="Carte Chip"
                            className="w-8 h-5 object-contain rounded"
                            style={{ background: 'rgba(255,255,255,0.15)' }}
                          />
                          <div className="flex items-center gap-2">
                            {cardForm.cardNumber.startsWith('4') ? (
                              <img src="/payment/visa.png" alt="Visa" className="h-4 w-auto object-contain" />
                            ) : cardForm.cardNumber.startsWith('5') ? (
                              <div className="flex gap-[-4px]">
                                <div className="w-8 h-8 rounded-full bg-red-500 opacity-80"></div>
                                <div className="w-8 h-8 rounded-full bg-yellow-500 opacity-80 -ml-3"></div>
                              </div>
                            ) : (
                              <img
                                src="/payment/logo-transparent.png"
                                alt="Logo"
                                className="w-8 h-8 object-contain opacity-80"
                                style={{ filter: 'brightness(0) invert(1)', marginTop: '-4px' }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="space-y-6">
                          <div
                            className="font-mono tracking-[0.18em]"
                            style={{
                              fontSize: '1rem',
                              letterSpacing: '0.18em',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {cardForm.cardNumber
                              ? formatCardNumber(cardForm.cardNumber)
                              : '•••• •••• •••• ••••'}
                          </div>
                          <div className="flex justify-between items-end">
                            <div className="flex-1 mt-3">
                              <div className="text-[9px] opacity-70 mb-1 uppercase tracking-wider">Titulaire de la carte</div>
                              <div className="font-medium tracking-wider uppercase text-xs truncate pr-4">
                                {cardForm.cardName || 'VOTRE NOM'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[9px] opacity-70 mb-1 uppercase tracking-wider">Expire fin</div>
                              <div className="font-mono font-semibold text-xs">
                                {cardForm.cardExpiry || 'MM/AA'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Back of Card */}
                    <div className="card-face back card-shine rounded-xl p-8 text-white aspect-[1.586/1] flex flex-col justify-between relative overflow-hidden"
                      style={{
                        background: '#000',
                        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
                      }}>
                      <div className="card-back-pattern" />
                      <div className="magnetic-stripe" />
                      <div className="flex items-center mt-6 relative z-10">
                        <div className="signature-box">
                          {cardForm.cardName || 'Signature'}
                          <span
                            style={{
                              position: 'absolute',
                              right: 12,
                              color: '#000',
                              fontWeight: 600,
                              fontSize: '0.9em',
                              letterSpacing: '0.1em',
                            }}
                          >
                            2026
                          </span>
                        </div>
                        <div className="cvv-box ml-2">
                          {cardForm.cardCVV
                            ? cardForm.cardCVV.padEnd(3, '•')
                            : '•••'}
                        </div>
                      </div>
                      <div className="absolute left-8 bottom-8 text-xs text-gray-400 z-10" style={{ opacity: 0.7 }}>
                      </div>
                      <div className="card-back-logo z-10">
                        {cardForm.cardNumber.startsWith('4') ? (
                          <img src="/payment/visa2.png" alt="Visa" className="h-4 w-auto object-contain" />
                        ) : cardForm.cardNumber.startsWith('5') ? (
                          <div className="flex gap-[-4px]">
                            <div className="w-8 h-8 rounded-full bg-red-500 opacity-80"></div>
                            <div className="w-8 h-8 rounded-full bg-yellow-500 opacity-80 -ml-3"></div>
                          </div>
                        ) : (
                          <img
                            src="/payment/logo-transparent.png"
                            alt="Logo"
                            className="w-8 h-8 object-contain opacity-80"
                            style={{ filter: 'brightness(0) invert(1)' }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-0 text-xs text-gray-500 rounded-xl mt-4">
                  <Lock className="w-4 h-4 text-slate-600" />
                  <span>Paiement 100% sécurisé et crypté SSL</span>
                </div>
              </div>
            </div>
          </div>
        )}
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

      <DeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteCard}
        title="Supprimer la carte"
        description="Êtes-vous sûr de vouloir supprimer cette carte bancaire ? Cette action est irréversible."
        confirmText="Supprimer"
      />

      <SaveModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={confirmSaveCard}
        title="Enregistrer la carte"
        description="Voulez-vous enregistrer cette carte bancaire ?"
        confirmText="Enregistrer"
      />
    </div>
  );
};

export default SettingsTab;