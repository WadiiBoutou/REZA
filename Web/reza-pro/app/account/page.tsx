'use client';
// @ts-nocheck
import React, { useState } from 'react';
import { User, Calendar, Users, Lock, Settings, LogOut, Phone, Mail, MapPin, Edit2, Plus, X, Trash2, Check, Clock, Star, ChevronRight, Bell, Shield, CreditCard, Gift, Camera, Award, TrendingUp, Heart, Sparkles, Eye, EyeOff, Key, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getMoroccanPhoneError } from '@/lib/utils';
import { DEMO_SALON_PHOTOS } from '@/lib/demo-images';

// Import tab components
import OverviewTab from './OverviewTab';
// @ts-ignore - props are relaxed for runtime flexibility
import AppointmentsTab from './AppointmentsTab';
// @ts-ignore - props are relaxed for runtime flexibility
import FamilyTab from './FamilyTab';
// @ts-ignore - props are relaxed for runtime flexibility
import ProfileTab from './ProfileTab';
// @ts-ignore - props are relaxed for runtime flexibility
import SettingsTab from './SettingsTab';
// @ts-ignore - props are relaxed for runtime flexibility
import ReviewsTab from './ReviewsTab';
import Loading from '../salon/Loading';

const DashboardIcon = (props) => (
  <svg
    width={props.width || 16}
    height={props.height || 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" />
    <path d="M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" />
    <path d="M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" />
    <path d="M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" />
  </svg>
);

const ProchesIcon = (props) => (
  <svg
    width={props.width || 16}
    height={props.height || 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M5.931 6.936l1.275 4.249m5.607 5.609l4.251 1.275" />
    <path d="M11.683 12.317l5.759 -5.759" />
    <path d="M5.5 5.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" />
    <path d="M18.5 5.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" />
    <path d="M18.5 18.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" />
    <path d="M8.5 15.5m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0" />
  </svg>
);

const CalendarIcon = (props) => (
  <svg
    width={props.width || 16}
    height={props.height || 16}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={props.className}
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M16 2a1 1 0 0 1 .993 .883l.007 .117v1h1a3 3 0 0 1 2.995 2.824l.005 .176v12a3 3 0 0 1 -2.824 2.995l-.176 .005h-12a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-12a3 3 0 0 1 2.824 -2.995l.176 -.005h1v-1a1 1 0 0 1 1.993 -.117l.007 .117v1h6v-1a1 1 0 0 1 1 -1zm3 7h-14v9.625c0 .705 .386 1.286 .883 1.366l.117 .009h12c.513 0 .936 -.53 .993 -1.215l.007 -.16v-9.625z" />
    <path d="M12 12a1 1 0 0 1 .993 .883l.007 .117v3a1 1 0 0 1 -1.993 .117l-.007 -.117v-2a1 1 0 0 1 -.117 -1.993l.117 -.007h1z" />
  </svg>
);

const formatCardNumber = (value: string) => {
  const cleaned = value.replace(/\s/g, '');
  const chunks = cleaned.match(/.{1,4}/g);
  return chunks ? chunks.join(' ') : cleaned;
};
const formatExpiry = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
  }
  return cleaned;
};

// Add ArrowAutofitLeftIcon component
const ArrowAutofitLeftIcon = (props) => (
  <svg
    width={props.width || 16}
    height={props.height || 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M4 12v-6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8" />
    <path d="M20 18h-17" />
    <path d="M6 15l-3 3l3 3" />
  </svg>
);

// Add GiftTablerIcon for rewards tab
const GiftTablerIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.width || 24}
    height={props.height || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" />
    <path d="M12 8l0 13" />
    <path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />
  </svg>
);

const AccountDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [newPerson, setNewPerson] = useState({ name: '', relationship: '', phone: '', email: '' });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState('setup'); // 'setup', 'verify', 'success'

  // Mock user data
  const [userData, setUserData] = useState({
    firstName: 'Sarah',
    lastName: 'El Amrani',
    email: 'sarah.elamrani@email.com',
    phone: '+212 6 12 34 56 78',
    address: 'Boulevard Zerktouni, Casablanca',
    joinDate: 'Janvier 2024',
    totalBookings: 12,
    avatar: null
  });

  // Mock appointments
  const appointments = [
    {
      id: 1,
      salon: 'Salon Élégance',
      service: 'Coupe & Brushing',
      date: '2024-12-25',
      time: '14:30',
      status: 'confirmed',
      price: 350,
      professional: 'Sarah M.',
      image: DEMO_SALON_PHOTOS[0]
    },
    {
      id: 2,
      salon: 'Spa Royal',
      service: 'Massage Relaxant',
      date: '2024-12-28',
      time: '16:00',
      status: 'confirmed',
      price: 500,
      professional: 'Amina K.',
      image: DEMO_SALON_PHOTOS[2]
    },
    {
      id: 3,
      salon: 'Barber Studio',
      service: 'Coupe Homme',
      date: '2024-12-20',
      time: '10:00',
      status: 'completed',
      price: 200,
      professional: 'Karim L.',
      image: DEMO_SALON_PHOTOS[1]
    },
    {
      id: 4,
      salon: 'Nail Artistry',
      service: 'Manucure',
      date: '2024-12-22',
      time: '12:00',
      status: 'cancelled',
      price: 150,
      professional: 'Leila B.',
      image: DEMO_SALON_PHOTOS[3]
    }
  ];

  // Mock family/friends
  const [familyMembers, setFamilyMembers] = useState([
    { id: 1, name: 'Yasmine El Amrani', relationship: 'Fille', phone: '+212 6 11 22 33 44', email: 'yasmine@email.com' },
    { id: 2, name: 'Omar El Amrani', relationship: 'Fils', phone: '+212 6 55 66 77 88', email: 'omar@email.com' },
    { id: 3, name: 'Fatima Benzakour', relationship: 'Mère', phone: '+212 6 99 88 77 66', email: 'fatima@email.com' }
  ]);

  // Move reviews state here
  const [reviews, setReviews] = useState([
    {
      id: 1,
      salon: 'Salon Élégance',
      salonImage: DEMO_SALON_PHOTOS[0],
      salonLocation: 'Casablanca',
      service: 'Coupe & Brushing',
      rating: 5,
      comment: 'Super expérience, personnel très professionnel et à l’écoute.',
      date: '12/01/2024',
      appointmentDate: '25/12/2024'
    },
    {
      id: 2,
      salon: 'Spa Royal',
      salonImage: DEMO_SALON_PHOTOS[2],
      salonLocation: 'Casablanca',
      service: 'Massage Relaxant',
      rating: 4,
      comment: 'Moment très relaxant, je recommande!',
      date: '15/01/2024',
      appointmentDate: '28/12/2024'
    }
  ]);

  // Add review handler
  const handleAddReview = (review) => {
    setReviews(prev => [
      {
        ...review,
        id: Date.now(),
        date: new Date().toLocaleDateString('fr-FR'),
      },
      ...prev
    ]);
    setActiveTab('avis');
  };

  // Edit review handler
  const handleEditReview = (updatedReview) => {
    setReviews(prev =>
      prev.map(r => r.id === updatedReview.id ? { ...r, ...updatedReview } : r)
    );
  };

  // Delete review handler
  const handleDeleteReview = (reviewId) => {
    setReviews(prev => prev.filter(r => r.id !== reviewId));
  };

  const handleAddPerson = () => {
    if (newPerson.phone && newPerson.phone.trim() && getMoroccanPhoneError(newPerson.phone.trim())) {
      alert(getMoroccanPhoneError(newPerson.phone.trim()));
      return;
    }
    if (newPerson.name && newPerson.relationship) {
      setFamilyMembers([...familyMembers, { ...newPerson, id: Date.now() }]);
      setNewPerson({ name: '', relationship: '', phone: '', email: '' });
      setShowAddPersonModal(false);
    }
  };

  const handleDeletePerson = (id) => {
    setFamilyMembers(familyMembers.filter(member => member.id !== id));
  };

  const handleEditPerson = (person) => {
    setEditingPerson(person);
    setShowEditModal(true);
  };

  const saveEditedPerson = () => {
    if (editingPerson.phone && editingPerson.phone.trim() && getMoroccanPhoneError(editingPerson.phone.trim())) {
      alert(getMoroccanPhoneError(editingPerson.phone.trim()));
      return;
    }
    setFamilyMembers(familyMembers.map(m => m.id === editingPerson.id ? editingPerson : m));
    setShowEditModal(false);
    setEditingPerson(null);
  };

  const handlePasswordChange = () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      alert('Les nouveaux mots de passe ne correspondent pas');
      return;
    }
    if (passwordData.new.length < 8) {
      alert('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    // Simulate password change
    alert('Mot de passe changé avec succès!');
    setPasswordData({ current: '', new: '', confirm: '' });
    setShowPasswordModal(false);
  };

  const handleEnable2FA = () => {
    if (verificationCode.length !== 6) {
      alert('Veuillez entrer le code à 6 chiffres');
      return;
    }
    // Simulate 2FA verification
    setTwoFactorEnabled(true);
    setTwoFactorStep('success');
    setTimeout(() => {
      setShow2FAModal(false);
      setTwoFactorStep('setup');
      setVerificationCode('');
    }, 2000);
  };

  const handleDisable2FA = () => {
    if (confirm('Êtes-vous sûr de vouloir désactiver l\'authentification à deux facteurs?')) {
      setTwoFactorEnabled(false);
      alert('Authentification à deux facteurs désactivée');
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'confirmed': return 'Confirmé';
      case 'completed': return 'Terminé';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  // Card setup state for account page
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    cardName: '',
    cardExpiry: '',
    cardCVV: '',
  });
  const [cardFormErrors, setCardFormErrors] = useState<{ [k: string]: boolean }>({});
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);

  // Card form validation
  const validateCardForm = () => {
    const errs: { [k: string]: boolean } = {};
    if (!cardForm.cardNumber.replace(/\s/g, '').match(/^\d{16}$/)) errs.cardNumber = true;
    if (!cardForm.cardName.trim()) errs.cardName = true;
    if (!cardForm.cardExpiry.match(/^\d{2}\/\d{2}$/)) errs.cardExpiry = true;
    if (!cardForm.cardCVV.match(/^\d{3}$/)) errs.cardCVV = true;
    setCardFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveCard = () => {
    if (validateCardForm()) {
      setCardSaved(true);
      setTimeout(() => setShowCardForm(false), 1200);
    }
  };

  const router = useRouter();
  const [showLogoutLoading, setShowLogoutLoading] = useState(false);

  return (
    <>
      {showLogoutLoading ? (
        <Loading text="Déconnexion..." />
      ) : (
        <div className="min-h-screen bg-[#f5f7f3]">
          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideIn {
              from { opacity: 0; transform: translateX(-20px); }
              to { opacity: 1; transform: translateX(0); }
            }
            .animate-fadeIn {
              animation: fadeIn 0.4s ease-out forwards;
            }
            .animate-slideIn {
              animation: slideIn 0.5s ease-out forwards;
            }
            .gradient-text {
              background: linear-gradient(135deg, #8b7260 0%, #5d4a3d 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
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
          `}</style>

          {/* Minimalist Header */}
          <div className="border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-8 py-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-extralight tracking-tight text-gray-900 mb-2">
                    Bonjour, <span className="gradient-text font-light">{userData.firstName}</span>
                  </h1>
                  <p className="text-sm text-gray-400 tracking-wide">Gérez votre expérience bien-être</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    className="group relative px-6 py-2.5 bg-gray-900 text-white text-sm tracking-wide overflow-hidden rounded-full"
                    onClick={() => router.push('/search-results')}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Réserver
                    </span>
                    <div className="absolute inset-0 bg-[#8b7260] transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-full"></div>
                  </button>
                  {/* Profile picture - match SettingsTab style */}
                  <div
                    className="w-11 h-11 rounded-full border-2 border-gray-200 bg-gray-900 flex items-center justify-center overflow-hidden"
                    style={{
                      boxShadow: '0 2px 8px 0 rgba(31,38,135,0.06)',
                      objectFit: 'cover',
                    }}
                  >
                    {userData.avatar ? (
                      <img
                        src={userData.avatar}
                        alt="Profil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-white font-thin select-none">
                        {userData.firstName?.[0]}
                        {userData.lastName?.[0]}
                      </span>
                    )}
                  </div>
                  {/* Logout icon */}
                  <button
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
                    title="Déconnexion"
                    onClick={() => {
                      setShowLogoutLoading(true);
                      setTimeout(() => router.push('/login'), 1200);
                    }}
                  >
                    <LogOut className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-8 py-12">
            {/* Horizontal Navigation */}
            <nav className="flex items-center gap-1 mb-16 border-b border-gray-100">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: DashboardIcon },
                { id: 'appointments', label: 'Rendez-vous', icon: CalendarIcon },
                { id: 'family', label: 'Proches', icon: ProchesIcon },
                { id: 'avis', label: 'Mes Avis', icon: ArrowAutofitLeftIcon },
                { id: 'rewards', label: 'Mes récompenses', icon: GiftTablerIcon, disabled: true, soon: true }, // soon flag
                { id: 'profile', label: 'Profil', icon: User },
                { id: 'settings', label: 'Paramètres', icon: Settings }
              ].map(({ id, label, icon: Icon, disabled, soon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (!disabled) setActiveTab(id);
                  }}
                  disabled={disabled}
                  className={`relative px-6 py-4 text-sm tracking-wide transition-all
                    ${activeTab === id ? 'text-gray-900' : ''}
                    ${disabled ? 'text-gray-300 cursor-not-allowed' : activeTab !== id ? 'text-gray-400 hover:text-gray-600' : ''}
                  `}
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled ? 'true' : undefined}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="relative">
                      {label}
                      {soon && (
                        <span
                          className="absolute -top-1 -right-5 bg-[#8b7260] text-white text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            transform: 'rotate(18deg)',
                          }}
                        >
                          Bientôt
                        </span>
                      )}
                    </span>
                  </div>
                  {activeTab === id && !disabled && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
                  )}
                </button>
              ))}
            </nav>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <OverviewTab
                userData={userData}
                familyMembers={familyMembers}
                appointments={appointments}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 'appointments' && (
              <AppointmentsTab
                appointments={appointments}
                getStatusText={getStatusText}
                handleAddReview={handleAddReview}
              />
            )}
            {activeTab === 'family' && (
              <FamilyTab
                familyMembers={familyMembers}
                handleEditPerson={handleEditPerson}
                handleDeletePerson={handleDeletePerson}
              />
            )}
            {activeTab === 'avis' && (
              <ReviewsTab
                reviews={reviews}
                handleEditReview={handleEditReview}
                handleDeleteReview={handleDeleteReview}
              />
            )}
            {/* Coming Soon for Mes récompenses */}
            {activeTab === 'rewards' && (
              <div className="flex flex-col items-center justify-center py-32 animate-fadeIn">
                <GiftTablerIcon className="w-16 h-16 text-[#8b7260] mb-6" />
                <h2 className="text-2xl font-light text-gray-900 mb-2">Mes récompenses</h2>
                <p className="text-lg text-gray-400 mb-4">Bientôt disponible !</p>
                <span className="inline-block bg-[#f5f7f3] text-[#8b7260] px-4 py-2 rounded-full text-xs font-medium">Coming Soon</span>
              </div>
            )}
            {activeTab === 'profile' && (
              <ProfileTab userData={userData} />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                twoFactorEnabled={twoFactorEnabled}
                setShowPasswordModal={setShowPasswordModal}
                handleDisable2FA={handleDisable2FA}
                setShow2FAModal={setShow2FAModal}
                showCardForm={showCardForm}
                setShowCardForm={setShowCardForm}
                cardForm={cardForm}
                setCardForm={setCardForm}
                cardFormErrors={cardFormErrors}
                setCardFormErrors={setCardFormErrors}
                isCardFlipped={isCardFlipped}
                setIsCardFlipped={setIsCardFlipped}
                cardSaved={cardSaved}
                setCardSaved={setCardSaved}
                handleSaveCard={handleSaveCard}
                formatCardNumber={formatCardNumber}
                formatExpiry={formatExpiry}
                userData={userData}
                setUserData={setUserData}
              />
            )}
          </div>

          {/* Add Person Modal */}
          {showAddPersonModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8 relative animate-fadeIn">
                <button
                  onClick={() => setShowAddPersonModal(false)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
                <h3 className="text-lg font-light text-gray-900 mb-6">Ajouter un proche</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nom</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={newPerson.name}
                      onChange={e => setNewPerson({ ...newPerson, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Lien de parenté</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={newPerson.relationship}
                      onChange={e => setNewPerson({ ...newPerson, relationship: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Téléphone</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={newPerson.phone}
                      onChange={e => setNewPerson({ ...newPerson, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={newPerson.email}
                      onChange={e => setNewPerson({ ...newPerson, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-8">
                  <button
                    onClick={() => setShowAddPersonModal(false)}
                    className="px-6 py-2 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-900 text-xs rounded transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAddPerson}
                    className="px-6 py-2 bg-gray-900 text-white text-xs rounded hover:bg-[#8b7260] transition-all"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Person Modal */}
          {showEditModal && editingPerson && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8 relative animate-fadeIn">
                <button
                  onClick={() => { setShowEditModal(false); setEditingPerson(null); }}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
                <h3 className="text-lg font-light text-gray-900 mb-6">Modifier le proche</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nom</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={editingPerson.name}
                      onChange={e => setEditingPerson({ ...editingPerson, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Lien de parenté</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={editingPerson.relationship}
                      onChange={e => setEditingPerson({ ...editingPerson, relationship: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Téléphone</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={editingPerson.phone}
                      onChange={e => setEditingPerson({ ...editingPerson, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={editingPerson.email}
                      onChange={e => setEditingPerson({ ...editingPerson, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-8">
                  <button
                    onClick={() => { setShowEditModal(false); setEditingPerson(null); }}
                    className="px-6 py-2 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-900 text-xs rounded transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveEditedPerson}
                    className="px-6 py-2 bg-gray-900 text-white text-xs rounded hover:bg-[#8b7260] transition-all"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Password Change Modal */}
          {showPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8 relative animate-fadeIn">
                <button
                  onClick={() => { 
                    setShowPasswordModal(false); 
                    setPasswordData({ current: '', new: '', confirm: '' });
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                    <Key className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-light text-gray-900">Changer le mot de passe</h3>
                    <p className="text-xs text-gray-400">Sécurisez votre compte</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Mot de passe actuel</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        className="w-full border border-gray-200 px-4 py-2 pr-10 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={passwordData.current}
                        onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        className="w-full border border-gray-200 px-4 py-2 pr-10 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={passwordData.new}
                        onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Minimum 8 caractères</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Confirmer le mot de passe</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className="w-full border border-gray-200 px-4 py-2 pr-10 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={passwordData.confirm}
                        onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
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
                <div className="flex justify-end gap-2 mt-8">
                  <button
                    onClick={() => { 
                      setShowPasswordModal(false); 
                      setPasswordData({ current: '', new: '', confirm: '' });
                      setShowCurrentPassword(false);
                      setShowNewPassword(false);
                      setShowConfirmPassword(false);
                    }}
                    className="px-6 py-2 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-900 text-xs rounded transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handlePasswordChange}
                    className="px-6 py-2 bg-gray-900 text-white text-xs rounded hover:bg-[#8b7260] transition-all"
                  >
                    Modifier
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2FA Modal */}
          {show2FAModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8 relative animate-fadeIn">
                <button
                  onClick={() => { 
                    setShow2FAModal(false); 
                    setTwoFactorStep('setup');
                    setVerificationCode('');
                  }}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
                
                {twoFactorStep === 'setup' && (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-light text-gray-900">Authentification à deux facteurs</h3>
                        <p className="text-xs text-gray-400">Renforcez la sécurité de votre compte</p>
                      </div>
                    </div>
                    <div className="space-y-4 mb-6">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-3">Scannez ce code QR avec votre application d'authentification (Google Authenticator, Authy, etc.)</p>
                        <div className="w-48 h-48 mx-auto bg-white p-4 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-40 h-40 bg-gray-200 rounded mb-2 flex items-center justify-center">
                              <span className="text-xs text-gray-400">QR Code</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-3 text-center">Code de secours: ABCD-EFGH-IJKL-MNOP</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTwoFactorStep('verify')}
                      className="w-full px-6 py-3 bg-gray-900 text-white text-sm rounded hover:bg-[#8b7260] transition-all"
                    >
                      Continuer
                    </button>
                  </>
                )}

                {twoFactorStep === 'verify' && (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-light text-gray-900">Vérification</h3>
                        <p className="text-xs text-gray-400">Entrez le code de votre application</p>
                      </div>
                    </div>
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-xs text-gray-400 mb-2">Code de vérification</label>
                          <input
                            type="text"
                            maxLength={6}
                            className="w-full border border-gray-200 px-4 py-3 text-center text-2xl font-light tracking-widest rounded focus:outline-none focus:border-gray-900"
                            placeholder="000000"
                            value={verificationCode}
                            onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                          />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setTwoFactorStep('setup');
                          setVerificationCode('');
                        }}
                        className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-900 text-sm rounded transition-all"
                      >
                        Retour
                      </button>
                      <button
                        onClick={handleEnable2FA}
                        className="flex-1 px-6 py-3 bg-gray-900 text-white text-sm rounded hover:bg-[#8b7260] transition-all"
                      >
                        Vérifier
                      </button>
                    </div>
                  </>
                )}

                {twoFactorStep === 'success' && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-light text-gray-900 mb-2">Authentification activée!</h3>
                    <p className="text-sm text-gray-400">Votre compte est maintenant protégé par l'authentification à deux facteurs</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AccountDashboard;