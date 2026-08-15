import { Plus, Edit2, Trash2, Phone, Mail, Camera, X } from 'lucide-react';
import React, { useState } from 'react';
import DeleteModal from './dialogue/deletemodal';
import SaveModal from './dialogue/savemodal';
import { isValidMoroccanPhone, getMoroccanPhoneError, normalizeMoroccanPhone } from '../../lib/utils';

interface FamilyMember {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  relationship: string;
  phone?: string;
  email?: string;
  avatar?: string | null;
  profileImage?: string | null;
  gender?: string | null;
}

interface FamilyFormData {
  name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  profileImage?: string | null;
  avatar?: string | null;
  gender?: string;
}

interface FamilyTabProps {
  familyMembers?: FamilyMember[];
  handleEditPerson?: (person: FamilyMember) => void;
  handleDeletePerson?: (id: string) => void;
  handleAddPerson?: (person: Omit<FamilyMember, 'id'>) => Promise<void>;
  handleSaveEditedPerson?: (memberData?: any) => Promise<void>;
}

const FamilyTab: React.FC<FamilyTabProps> = ({
  familyMembers: familyMembersProp = [],
  handleEditPerson = () => {},
  handleDeletePerson = () => {},
  handleAddPerson = async () => {},
  handleSaveEditedPerson = async () => {},
}) => {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(familyMembersProp);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState<FamilyFormData>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Sync local state if prop changes
  React.useEffect(() => {
    setFamilyMembers(familyMembersProp);
  }, [familyMembersProp]);

  const startEditing = (member: FamilyMember) => {
    setEditingMember(member.id);
    setIsAddingNew(false);
    setFormData({
      name: member.name,
      relationship: member.relationship,
      phone: member.phone || '',
      email: member.email || '',
      profileImage: member.profileImage || member.avatar || null,
      gender: member.gender || ''
    });
    setPreviewImage(member.profileImage || member.avatar || null);
  };

  const startAddingNew = () => {
    setIsAddingNew(true);
    setEditingMember(null);
    setFormData({
      name: '',
      relationship: '',
      phone: '',
      email: '',
      profileImage: null,
      gender: ''
    });
    setPreviewImage(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewImage(result);
        setFormData({ ...formData, profileImage: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: keyof FamilyFormData, value: string) => {
    const updatedFormData = { ...formData, [field]: value };
    setFormData(updatedFormData);
    
    // Clear error for this field when user starts typing
    const updatedErrors = { ...formErrors };
    if (updatedErrors[field]) {
      delete updatedErrors[field];
    }
    
    // Re-validate the specific field in real-time
    if (field === 'phone' && value && value.trim().length > 0) {
      if (isValidMoroccanPhone(value.trim())) {
        delete updatedErrors.phone;
      } else {
        updatedErrors.phone = getMoroccanPhoneError(value.trim());
      }
    } else if (field === 'phone' && (!value || value.trim().length === 0)) {
      // Phone is optional, so clear error if empty
      delete updatedErrors.phone;
    }
    
    if (field === 'email' && value && value.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(value)) {
        delete updatedErrors.email;
      } else {
        updatedErrors.email = 'Format d\'email invalide';
      }
    } else if (field === 'email' && (!value || value.trim().length === 0)) {
      // Email is optional, so clear error if empty
      delete updatedErrors.email;
    }
    
    if (field === 'name') {
      if (value && value.trim().length >= 2) {
        delete updatedErrors.name;
      } else if (value && value.trim().length > 0) {
        updatedErrors.name = 'Le nom complet est requis (minimum 2 caractères)';
      } else {
        updatedErrors.name = 'Le nom complet est requis (minimum 2 caractères)';
      }
    }
    
    if (field === 'relationship') {
      if (value && value.trim().length > 0) {
        delete updatedErrors.relationship;
      } else {
        updatedErrors.relationship = 'La relation est requise';
      }
    }
    
    // Clear general error if it exists
    if (updatedErrors._general) {
      delete updatedErrors._general;
    }
    
    setFormErrors(updatedErrors);
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    // Validate name (required, minimum 2 characters)
    if (!formData.name || formData.name.trim().length < 2) {
      errors.name = 'Le nom complet est requis (minimum 2 caractères)';
    }

    // Validate relationship (required)
    if (!formData.relationship || formData.relationship.trim().length === 0) {
      errors.relationship = 'La relation est requise';
    }

    // Validate email format if provided
    if (formData.email && formData.email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
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
    return Object.keys(errors).length === 0;
  };

  const handleSave = (memberId: string | null) => {
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
    setPendingSaveId(memberId);
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

    try {
      if (isAddingNew) {
        // Prepare data for API
        const nameParts = formData.name?.split(' ') || [];
        const newMember = {
          name: formData.name || '',
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          relationship: formData.relationship || '',
          phone: formData.phone ? normalizeMoroccanPhone(formData.phone.trim()) : '',
          email: formData.email ? formData.email.trim() : '',
          avatar: formData.profileImage || null,
          gender: formData.gender || null
        };
        await handleAddPerson(newMember);
        setIsAddingNew(false);
        // Clear form after successful add
        setPreviewImage(null);
        setFormData({});
        setFormErrors({});
      } else {
        // For editing, prepare the updated member data and save
        const nameParts = formData.name?.split(' ') || [];
        if (pendingSaveId) {
          const updatedMember = {
            id: pendingSaveId,
            name: formData.name || '',
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            relationship: formData.relationship || '',
            phone: formData.phone ? normalizeMoroccanPhone(formData.phone.trim()) : '',
            email: formData.email ? formData.email.trim() : '',
            avatar: formData.profileImage || null,
            gender: formData.gender || null
          };
          // Save with the updated member data directly
          // No need to call handleEditPerson as FamilyTab handles its own editing UI
          await handleSaveEditedPerson(updatedMember);
        } else {
          console.error('No pendingSaveId for editing');
        }
        setEditingMember(null);
        // Keep preview image and form data until refresh completes
        // They will be cleared when the parent refreshes the data
      }
      setFormErrors({});
      setShowSaveModal(false);
      setPendingSaveId(null);
    } catch (error: any) {
      console.error('Error saving family member:', error);
      setShowSaveModal(false);
      // Show error message to user
      setFormErrors({ 
        ...formErrors, 
        _general: error.message || 'Erreur lors de l\'enregistrement. Veuillez réessayer.' 
      });
    }
  };

  const handleDelete = (memberId: string) => {
    setDeleteMemberId(memberId);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (deleteMemberId) {
      setFamilyMembers(familyMembers.filter((m) => m.id !== deleteMemberId));
      handleDeletePerson(deleteMemberId);
      setShowDeleteModal(false);
      setDeleteMemberId(null);
    }
  };

  const handleCancel = () => {
    setEditingMember(null);
    setIsAddingNew(false);
    setFormData({});
    setPreviewImage(null);
    setFormErrors({});
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extralight text-gray-900 tracking-tight mb-2">Mes Proches</h2>
          <p className="text-[10px] sm:text-xs text-gray-400 tracking-wide">Gérez les comptes de votre famille</p>
        </div>
        <button
          onClick={startAddingNew}
          className="group relative px-4 sm:px-5 py-1.5 sm:py-2 bg-gray-900 text-white text-xs sm:text-sm tracking-wide overflow-hidden rounded-full"
        >
          <span className="relative z-10 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Ajouter
          </span>
          <div className="absolute inset-0 bg-[#8b7260] transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-full"></div>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {isAddingNew && (
          <div className="bg-[#f5f7f3] border-2 border-gray-900 p-8 transition-all rounded-2xl">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {previewImage ? (
                    <img src={previewImage} alt="Profile" className="w-12 h-12 object-cover rounded-full" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 flex items-center justify-center text-gray-400 text-sm font-light rounded-full">
                      ?
                    </div>
                  )}
                  <input
                    type="file"
                    id="profile-pic-new"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="profile-pic-new"
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all rounded-full cursor-pointer"
                  >
                    <Camera className="w-3 h-3 text-gray-600" />
                  </label>
                </div>
                <div className="flex-1">
                  <div className="space-y-2">
                      <div>
                        <input
                          type="text"
                          data-field="name"
                          value={formData.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className={`w-full text-sm font-light text-gray-900 border-b ${
                            formErrors.name ? 'border-red-300' : 'border-gray-200'
                          } focus:border-gray-900 outline-none pb-1 transition-colors`}
                          placeholder="Nom complet"
                        />
                        {formErrors.name && (
                          <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="text"
                          data-field="relationship"
                          value={formData.relationship || ''}
                          onChange={(e) => handleInputChange('relationship', e.target.value)}
                          className={`w-full text-xs text-gray-400 border-b ${
                            formErrors.relationship ? 'border-red-300' : 'border-gray-200'
                          } focus:border-gray-900 outline-none pb-1 transition-colors`}
                          placeholder="Relation (ex: Épouse, Fils, etc.)"
                        />
                        {formErrors.relationship && (
                          <p className="text-xs text-red-500 mt-1">{formErrors.relationship}</p>
                        )}
                      </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="w-8 h-8 hover:bg-gray-100 flex items-center justify-center transition-all rounded-full"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
                <button
                  onClick={() => handleSave(null)}
                  disabled={!formData.name?.trim() || !formData.relationship?.trim() || Object.keys(formErrors).filter(key => formErrors[key]).length > 0}
                  className="w-8 h-8 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all rounded-full"
                  title={!formData.name?.trim() || !formData.relationship?.trim() ? 'Veuillez remplir le nom et la relation' : Object.keys(formErrors).filter(key => formErrors[key]).length > 0 ? 'Veuillez corriger les erreurs' : 'Enregistrer'}
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-6 pb-6 border-b border-gray-100">
              {formErrors._general && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-xs">
                  {formErrors._general}
                </div>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-300" />
                  <input
                    type="tel"
                    data-field="phone"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`flex-1 text-xs text-gray-600 border-b ${
                      formErrors.phone ? 'border-red-300' : 'border-gray-200'
                    } focus:border-gray-900 outline-none pb-1 transition-colors`}
                    placeholder="+212XXXXXXXXX ou 0XXXXXXXXX"
                  />
                </div>
                {formErrors.phone && (
                  <p className="text-xs text-red-500 mt-1 ml-7">{formErrors.phone}</p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-300" />
                  <input
                    type="email"
                    data-field="email"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`flex-1 text-xs text-gray-600 border-b ${
                      formErrors.email ? 'border-red-300' : 'border-gray-200'
                    } focus:border-gray-900 outline-none pb-1 transition-colors`}
                    placeholder="Adresse email"
                  />
                </div>
                {formErrors.email && (
                  <p className="text-xs text-red-500 mt-1 ml-7">{formErrors.email}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-4 h-4" />
                <div className="flex gap-2">
                  {['female', 'male'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleInputChange('gender', formData.gender === g ? '' : g)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        formData.gender === g ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {g === 'female' ? 'Femme' : 'Homme'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-400 text-center py-3">
              Nouvelle personne
            </div>
          </div>
        )}

        {familyMembers.map((member) => {
          const isEditing = editingMember === member.id;
          const displayData: (FamilyMember | FamilyFormData) & { name?: string; relationship?: string; phone?: string; email?: string; avatar?: string | null } = isEditing ? formData : member;

          return (
            <div 
              key={member.id} 
              className="group bg-[#f5f7f3] border border-gray-200 hover:border-gray-300 p-5 sm:p-6 lg:p-8 transition-all rounded-xl sm:rounded-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {(isEditing && previewImage) || (!isEditing && displayData.avatar) ? (
                      <img 
                        src={isEditing ? (previewImage || '') : (displayData.avatar || '')} 
                        alt="Profile" 
                        className="w-12 h-12 object-cover rounded-full"
                        onError={(e) => {
                          // If image fails to load, fallback to initials
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = parent.querySelector('.family-avatar-fallback');
                            if (fallback) {
                              (fallback as HTMLElement).style.display = 'flex';
                            }
                          }
                        }}
                      />
                    ) : null}
                    <div 
                      className={`w-12 h-12 bg-gray-900 flex items-center justify-center text-white text-sm font-light rounded-full ${(isEditing && previewImage) || (!isEditing && displayData.avatar) ? 'family-avatar-fallback hidden' : ''}`}
                      style={{ display: ((isEditing && previewImage) || (!isEditing && displayData.avatar)) ? 'none' : 'flex' }}
                    >
                      {displayData.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                    </div>
                    {isEditing && (
                      <>
                        <input
                          type="file"
                          id={`profile-pic-${member.id}`}
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <label
                          htmlFor={`profile-pic-${member.id}`}
                          className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all rounded-full cursor-pointer"
                        >
                          <Camera className="w-3 h-3 text-gray-600" />
                        </label>
                      </>
                    )}
                  </div>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div>
                          <input
                            type="text"
                            data-field="name"
                            value={formData.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className={`w-full text-sm font-light text-gray-900 border-b ${
                              formErrors.name ? 'border-red-300' : 'border-gray-200'
                            } focus:border-gray-900 outline-none pb-1 transition-colors`}
                            placeholder="Nom"
                          />
                          {formErrors.name && (
                            <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
                          )}
                        </div>
                        <div>
                          <input
                            type="text"
                            data-field="relationship"
                            value={formData.relationship || ''}
                            onChange={(e) => handleInputChange('relationship', e.target.value)}
                            className={`w-full text-xs text-gray-400 border-b ${
                              formErrors.relationship ? 'border-red-300' : 'border-gray-200'
                            } focus:border-gray-900 outline-none pb-1 transition-colors`}
                            placeholder="Relation"
                          />
                          {formErrors.relationship && (
                            <p className="text-xs text-red-500 mt-1">{formErrors.relationship}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-light text-gray-900 mb-1">{displayData.name || ''}</div>
                        <div className="text-xs text-gray-400">{displayData.relationship || ''}</div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancel();
                        }}
                        className="w-8 h-8 hover:bg-gray-100 flex items-center justify-center transition-all rounded-full"
                        title="Annuler"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSave(member.id);
                        }}
                        disabled={!formData.name?.trim() || !formData.relationship?.trim() || Object.keys(formErrors).filter(key => formErrors[key]).length > 0}
                        className="w-8 h-8 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all rounded-full"
                        title={!formData.name?.trim() || !formData.relationship?.trim() ? 'Veuillez remplir le nom et la relation' : Object.keys(formErrors).filter(key => formErrors[key]).length > 0 ? 'Veuillez corriger les erreurs' : 'Enregistrer'}
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startEditing(member);
                        }}
                        className="w-8 h-8 hover:bg-gray-100 hover:rounded-full flex items-center justify-center transition-all rounded-full cursor-pointer"
                        title="Modifier"
                        aria-label="Modifier les informations"
                      >
                        <Edit2 className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(member.id);
                        }}
                        className="w-8 h-8 hover:bg-red-50 hover:rounded-full flex items-center justify-center transition-all rounded-full cursor-pointer"
                        title="Supprimer"
                        aria-label="Supprimer ce proche"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                {isEditing ? (
                  <>
                    {formErrors._general && (
                      <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-xs">
                        {formErrors._general}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-300" />
                        <input
                          type="tel"
                          data-field="phone"
                          value={formData.phone || ''}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className={`flex-1 text-xs text-gray-600 border-b ${
                            formErrors.phone ? 'border-red-300' : 'border-gray-200'
                          } focus:border-gray-900 outline-none pb-1 transition-colors`}
                          placeholder="+212XXXXXXXXX ou 0XXXXXXXXX"
                        />
                      </div>
                      {formErrors.phone && (
                        <p className="text-xs text-red-500 mt-1 ml-7">{formErrors.phone}</p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-300" />
                        <input
                          type="email"
                          data-field="email"
                          value={formData.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className={`flex-1 text-xs text-gray-600 border-b ${
                            formErrors.email ? 'border-red-300' : 'border-gray-200'
                          } focus:border-gray-900 outline-none pb-1 transition-colors`}
                          placeholder="Email"
                        />
                      </div>
                      {formErrors.email && (
                        <p className="text-xs text-red-500 mt-1 ml-7">{formErrors.email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4" />
                      <div className="flex gap-2">
                        {['female', 'male'].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleInputChange('gender', formData.gender === g ? '' : g)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                              formData.gender === g ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {g === 'female' ? 'Femme' : 'Homme'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {displayData.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-300" />
                        <span className="text-xs text-gray-600">{displayData.phone}</span>
                      </div>
                    )}
                    {displayData.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-300" />
                        <span className="text-xs text-gray-600">{displayData.email}</span>
                      </div>
                    )}
                  </>
                )}
              </div>


            </div>
          );
        })}
      </div>

      <DeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Supprimer le proche"
        description="Êtes-vous sûr de vouloir supprimer ce membre de votre famille ? Cette action est irréversible."
        confirmText="Supprimer"
      />
      <SaveModal
        open={showSaveModal}
        onClose={() => { setShowSaveModal(false); setPendingSaveId(null); }}
        onConfirm={confirmSave}
        title={isAddingNew ? "Ajouter le proche" : "Enregistrer les modifications"}
        description={isAddingNew
          ? "Voulez-vous ajouter ce membre à votre famille ?"
          : "Voulez-vous enregistrer les modifications apportées à ce membre ?"}
        confirmText={isAddingNew ? "Ajouter" : "Enregistrer"}
      />
    </div>
  );
};

export default FamilyTab;