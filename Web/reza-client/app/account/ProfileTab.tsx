import { Camera, Venus, Mars } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import SaveModal from './dialogue/savemodal';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { isValidMoroccanPhone, getMoroccanPhoneError, normalizeMoroccanPhone } from '../../lib/utils';

interface ProfileTabProps {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    joinDate?: string;
    avatar?: string | null;
    gender?: string;
  };
  onUpdate?: (updatedClientData?: any) => void | Promise<void>;
}


const ProfileTab: React.FC<ProfileTabProps> = ({ userData, onUpdate }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const skipSyncRef = useRef(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    gender: '',
    profileImage: null as string | null
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Only sync when NOT editing and skipSyncRef is false
  useEffect(() => {
    if (skipSyncRef.current) {
      // Don't reset skipSyncRef here - let it be reset by the code that set it
      return;
    }
    
    if (!isEditing) {
      const syncedFormData = {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        address: userData.address || '',
        gender: userData.gender || '',
        profileImage: userData.avatar || null
      };
      setFormData(syncedFormData);
      setPreviewImage(userData.avatar || null);
    }
  }, [userData.firstName, userData.lastName, userData.email, userData.phone, userData.address, userData.gender, userData.avatar, isEditing]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewImage(result);
        setFormData(prev => ({ ...prev, profileImage: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (saveError) setSaveError(null);
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleEditClick = () => {
    // Set skip flag to prevent useEffect from interfering
    skipSyncRef.current = true;
    
    // Load current userData into form
    const newFormData = {
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      email: userData.email || '',
      phone: userData.phone || '',
      address: userData.address || '',
      gender: userData.gender || '',
      profileImage: userData.avatar || null
    };
    
    setFormData(newFormData);
    setPreviewImage(userData.avatar || null);
    setIsEditing(true);
    setSaveError(null);
    setSaveSuccess(null);
    setFormErrors({});
  };

  const handleCancel = () => {
    skipSyncRef.current = true;
    setFormData({
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      email: userData.email || '',
      phone: userData.phone || '',
      address: userData.address || '',
      gender: userData.gender || '',
      profileImage: userData.avatar || null
    });
    setPreviewImage(userData.avatar || null);
    setIsEditing(false);
    setSaveError(null);
    setSaveSuccess(null);
    setFormErrors({});
    const fileInput = document.getElementById('profile-pic') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    // Validate firstName (required, minimum 2 characters)
    if (!formData.firstName || !formData.firstName.trim() || formData.firstName.trim().length < 2) {
      errors.firstName = 'Le prénom est requis (minimum 2 caractères)';
    }

    // Validate lastName (required, minimum 2 characters)
    if (!formData.lastName || !formData.lastName.trim() || formData.lastName.trim().length < 2) {
      errors.lastName = 'Le nom est requis (minimum 2 caractères)';
    }

    // Validate email format (required)
    if (!formData.email || formData.email.trim().length === 0) {
      errors.email = 'L\'email est requis';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Format d\'email invalide';
      }
    }

    // Validate phone format if provided (optional but should be valid if provided)
    if (formData.phone && formData.phone.trim().length > 0) {
      if (!isValidMoroccanPhone(formData.phone.trim())) {
        errors.phone = getMoroccanPhoneError(formData.phone.trim());
      }
    }

    setFormErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    return isValid;
  };

  const handleSave = () => {
    // Validate form before showing save modal
    if (!validateForm()) {
      // Scroll to first error if validation fails
      const firstErrorField = Object.keys(formErrors)[0];
      if (firstErrorField) {
        const errorElement = document.querySelector(`[data-field="${firstErrorField}"]`);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (errorElement as HTMLElement).focus();
        }
      }
      return; // Don't show save modal if validation fails
    }
    setSaveError(null);
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    // Validate again before saving
    if (!validateForm()) {
      setShowSaveModal(false);
      // Scroll to first error
      const firstErrorField = Object.keys(formErrors)[0];
      if (firstErrorField) {
        const errorElement = document.querySelector(`[data-field="${firstErrorField}"]`);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (errorElement as HTMLElement).focus();
        }
      }
      return;
    }

    if (!user?.email) {
      setSaveError('Email utilisateur manquant');
      setShowSaveModal(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const updateData: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      };

      // Always include phone, even if empty (to clear it if needed)
      if (formData.phone?.trim()) {
        // Normalize phone number before saving (remove spaces, dashes, etc.)
        updateData.phone = normalizeMoroccanPhone(formData.phone.trim());
      } else {
        updateData.phone = '';
      }

      if (formData.address?.trim()) {
        updateData.address = formData.address.trim();
      } else {
        updateData.address = '';
      }

      if (formData.gender) {
        updateData.gender = formData.gender;
      }

      updateData.avatar = formData.profileImage || null;

      
      let response;
      try {
        response = await api.updateClientProfile(user.email, updateData);
      } catch (apiError: any) {
        console.error('[ProfileTab] API call failed:', apiError);
        throw apiError;
      }

      if (response && response.client) {
        const updatedClient = response.client;
        const savedAvatar = (updatedClient as any).avatar;
        
        
        // Update local form data with response - use values from API response
        // Always use the API response values, even if they're empty strings
        const updatedFormData = {
          firstName: updatedClient.firstName || '',
          lastName: updatedClient.lastName || '',
          email: updatedClient.email || '',
          phone: updatedClient.phone || '',
          address: (updatedClient as any).address || '',
          gender: (updatedClient as any).gender || '',
          profileImage: savedAvatar || null,
        };
        
        
        // Set skip flag BEFORE updating formData to prevent useEffect from overwriting
        skipSyncRef.current = true;
        
        // Update formData first with the response data
        setFormData(updatedFormData);
        setPreviewImage(savedAvatar ?? null);
        
        // Verify formData was set by checking it in next tick
        setTimeout(() => {
        }, 0);
        
        // Exit editing mode
        setIsEditing(false);
        setFormErrors({});
        
        // Call onUpdate to update parent component's userData
        if (onUpdate) {
          await onUpdate(updatedClient);
        }
        
        setSaveSuccess('Profil mis à jour avec succès');
        setShowSaveModal(false);

        // Keep skip flag true longer to ensure userData is updated in parent
        // Wait for userData to be updated, then allow sync
        setTimeout(() => {
          skipSyncRef.current = false;
        }, 500);

        setTimeout(() => {
          setSaveSuccess(null);
        }, 3000);
      } else {
        throw new Error('Réponse invalide du serveur');
      }
    } catch (error: any) {
      console.error('[ProfileTab] Error updating profile:', error);
      console.error('[ProfileTab] Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        data: error.data
      });
      
      const errorMessage = error.data?.message || error.message || 'Erreur lors de la mise à jour du profil. Veuillez réessayer.';
      setSaveError(errorMessage);
      setShowSaveModal(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-extralight text-gray-900 tracking-tight mb-2">Profil</h2>
        <p className="text-xs text-gray-400 tracking-wide">Gérez vos informations personnelles</p>
      </div>
      <div className="bg-[#f5f7f3] border border-gray-100 p-12 rounded-2xl">
        <div className="flex items-start justify-between mb-12">
          <div className="flex items-center gap-6">
            <div className="relative">
              {previewImage ? (
                <img 
                  src={previewImage} 
                  alt="Profile" 
                  className="w-24 h-24 object-cover rounded-full"
                  onError={() => setPreviewImage(null)}
                />
              ) : (
                <div className="w-24 h-24 bg-gray-900 flex items-center justify-center text-white text-2xl font-light rounded-full">
                  {(formData.firstName?.[0] || userData.firstName?.[0] || 'U')}
                  {(formData.lastName?.[0] || userData.lastName?.[0] || '')}
                </div>
              )}
              <input
                type="file"
                id="profile-pic"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={!isEditing}
              />
              {isEditing && (
                <label
                  htmlFor="profile-pic"
                  className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 hover:border-gray-900 transition-all rounded-full cursor-pointer shadow-sm"
                >
                  <Camera className="w-4 h-4 text-gray-600" />
                </label>
              )}
            </div>
            <div>
              <div className="text-xl font-light text-gray-900 mb-1">
                {formData.firstName || userData.firstName} {formData.lastName || userData.lastName}
              </div>
              <div className="text-xs text-gray-400">Membre depuis {userData.joinDate || 'maintenant'}</div>
            </div>
          </div>
          {isEditing ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 border border-gray-200 hover:border-gray-300 text-xs tracking-wide text-gray-600 hover:text-gray-900 transition-all rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || Object.keys(formErrors).length > 0 || !formData.firstName?.trim() || !formData.lastName?.trim() || !formData.email?.trim()}
                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs tracking-wide text-white transition-all rounded-full"
                title={Object.keys(formErrors).length > 0 ? 'Veuillez corriger les erreurs' : !formData.firstName?.trim() || !formData.lastName?.trim() || !formData.email?.trim() ? 'Veuillez remplir tous les champs requis' : 'Enregistrer'}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleEditClick}
              className="px-6 py-3 border border-gray-200 hover:border-gray-900 text-xs tracking-wide text-gray-600 hover:text-gray-900 transition-all rounded cursor-pointer relative z-10"
            >
              Modifier
            </button>
          )}
        </div>
        
        {saveError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm animate-fadeIn">
            <div className="font-medium mb-1">Erreur</div>
            <div>{saveError}</div>
          </div>
        )}
        
        {saveSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-600 rounded-xl px-4 py-3 text-sm animate-fadeIn">
            <div className="font-medium mb-1">Succès</div>
            <div>{saveSuccess}</div>
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-x-12 gap-y-8">
          {[
            { label: 'Prénom', value: 'firstName' },
            { label: 'Nom', value: 'lastName' },
            { label: 'Email', value: 'email' },
            { label: 'Téléphone', value: 'phone' }
          ].map((field, idx) => (
            <div key={idx}>
              <div className="text-xs text-gray-400 tracking-wide uppercase mb-3">{field.label}</div>
              {isEditing ? (
                <div>
                  <input
                    type={field.value === 'email' ? 'email' : field.value === 'phone' ? 'tel' : 'text'}
                    data-field={field.value}
                    value={formData[field.value as keyof typeof formData] as string || ''}
                    onChange={(e) => handleInputChange(field.value, e.target.value)}
                    disabled={field.value === 'email'}
                    className={`w-full text-sm font-light text-gray-900 border-b ${
                      formErrors[field.value] ? 'border-red-300' : 'border-gray-200'
                    } focus:border-gray-900 outline-none pb-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    placeholder={field.value === 'phone' ? '+212XXXXXXXXX ou 0XXXXXXXXX' : ''}
                  />
                  {formErrors[field.value] && (
                    <p className="text-xs text-red-500 mt-1">{formErrors[field.value]}</p>
                  )}
                </div>
              ) : (
                <div className="text-sm font-light text-gray-900">
                  {(() => {
                    const formValue = formData[field.value as keyof typeof formData] as string;
                    const userValue = userData[field.value as keyof typeof userData] as string;
                    const displayValue = formValue || userValue || '-';
                    // Log for debugging
                    if (field.value === 'phone' || field.value === 'address') {
                    }
                    return displayValue;
                  })()}
                </div>
              )}
            </div>
          ))}
          <div>
            <div className="text-xs text-gray-400 tracking-wide uppercase mb-3">Adresse</div>
            {isEditing ? (
              <textarea
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full text-sm font-light text-gray-900 border-b border-gray-200 focus:border-gray-900 outline-none pb-2 transition-colors resize-none"
                rows={2}
              />
            ) : (
              <div className="text-sm font-light text-gray-900">{formData.address || userData.address || '-'}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-400 tracking-wide uppercase mb-3">Genre</div>
            {isEditing ? (
              <div className="flex gap-3">
                {[
                  { value: 'female', label: 'Femme', Icon: Venus },
                  { value: 'male', label: 'Homme', Icon: Mars },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleInputChange('gender', formData.gender === value ? '' : value)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-sm font-medium ${
                      formData.gender === value
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm font-light text-gray-900">
                {formData.gender === 'female' ? 'Femme' : formData.gender === 'male' ? 'Homme' : '-'}
              </div>
            )}
          </div>
        </div>
      </div>
      <SaveModal
        open={showSaveModal}
        onClose={() => {
          if (!saving) {
            setShowSaveModal(false);
            setSaveError(null);
          }
        }}
        onConfirm={confirmSave}
        title="Enregistrer le profil"
        description="Voulez-vous enregistrer les modifications de votre profil ?"
        confirmText={saving ? 'Enregistrement...' : 'Enregistrer'}
        loading={saving}
      />
    </div>
  );
};

export default ProfileTab;
