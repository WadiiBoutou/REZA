// @ts-nocheck
import { Plus, Edit2, Trash2, Phone, Mail, Camera, X } from 'lucide-react';
import React, { useState } from 'react';
import DeleteModal from './modals/DeleteModal';
import SaveModal from './modals/SaveModal';

const FamilyTab = ({
  familyMembers: familyMembersProp = [],
  // Default handlers accept the same arguments that callers provide,
  // preventing TypeScript from inferring zero-arg function types.
  handleEditPerson = (person) => {},
  handleDeletePerson = (id) => {},
  handleAddPerson = (person) => {},
  // Optional modal state setter from parent; accepts the open state.
  setShowAddPersonModal = (open) => {},
}) => {
  const [familyMembers, setFamilyMembers] = useState(familyMembersProp);
  const [editingMember, setEditingMember] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [deleteMemberId, setDeleteMemberId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingSaveId, setPendingSaveId] = useState(null);

  // Sync local state if prop changes
  React.useEffect(() => {
    setFamilyMembers(familyMembersProp);
  }, [familyMembersProp]);

  const startEditing = (member) => {
    setEditingMember(member.id);
    setIsAddingNew(false);
    setFormData({
      name: member.name,
      relationship: member.relationship,
      phone: member.phone || '',
      email: member.email || '',
      profileImage: member.profileImage || null
    });
    setPreviewImage(member.profileImage || null);
  };

  const startAddingNew = () => {
    setIsAddingNew(true);
    setEditingMember(null);
    setFormData({
      name: '',
      relationship: '',
      phone: '',
      email: '',
      profileImage: null
    });
    setPreviewImage(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
        setFormData({ ...formData, profileImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = (memberId) => {
    setPendingSaveId(memberId);
    setShowSaveModal(true);
  };

  const confirmSave = () => {
    if (isAddingNew) {
      // Generate a unique id for the new member
      const newMember = {
        ...formData,
        id: Date.now().toString(),
      };
      setFamilyMembers([...familyMembers, newMember]);
      handleAddPerson(newMember);
      setIsAddingNew(false);
    } else {
      const updatedMembers = familyMembers.map((m) =>
        m.id === pendingSaveId ? { ...m, ...formData } : m
      );
      setFamilyMembers(updatedMembers);
      handleEditPerson({ id: pendingSaveId, ...formData });
      setEditingMember(null);
    }
    setPreviewImage(null);
    setFormData({});
    setShowSaveModal(false);
    setPendingSaveId(null);
  };

  const handleDelete = (memberId) => {
    setDeleteMemberId(memberId);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    setFamilyMembers(familyMembers.filter((m) => m.id !== deleteMemberId));
    handleDeletePerson(deleteMemberId);
    setShowDeleteModal(false);
    setDeleteMemberId(null);
  };

  const handleCancel = () => {
    setEditingMember(null);
    setIsAddingNew(false);
    setFormData({});
    setPreviewImage(null);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extralight text-gray-900 tracking-tight mb-2">Mes Proches</h2>
          <p className="text-xs text-gray-400 tracking-wide">Gérez les comptes de votre famille</p>
        </div>
        <button
          onClick={startAddingNew}
          className="group relative px-5 py-2 bg-gray-900 text-white text-sm tracking-wide overflow-hidden rounded-full"
        >
          <span className="relative z-10 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Ajouter
          </span>
          <div className="absolute inset-0 bg-[#8b7260] transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-full"></div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full text-sm font-light text-gray-900 border-b border-gray-200 focus:border-gray-900 outline-none pb-1 transition-colors"
                      placeholder="Nom complet"
                    />
                    <input
                      type="text"
                      value={formData.relationship}
                      onChange={(e) => handleInputChange('relationship', e.target.value)}
                      className="w-full text-xs text-gray-400 border-b border-gray-200 focus:border-gray-900 outline-none pb-1 transition-colors"
                      placeholder="Relation (ex: Épouse, Fils, etc.)"
                    />
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
                  disabled={!formData.name || !formData.relationship}
                  className="w-8 h-8 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center transition-all rounded-full"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-6 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-300" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="flex-1 text-xs text-gray-600 border-b border-gray-200 focus:border-gray-900 outline-none pb-1 transition-colors"
                  placeholder="Numéro de téléphone"
                />
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-300" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="flex-1 text-xs text-gray-600 border-b border-gray-200 focus:border-gray-900 outline-none pb-1 transition-colors"
                  placeholder="Adresse email"
                />
              </div>
            </div>

            <div className="text-xs text-gray-400 text-center py-3">
              Nouvelle personne
            </div>
          </div>
        )}

        {familyMembers.map((member) => {
          const isEditing = editingMember === member.id;
          const displayData = isEditing ? formData : member;

          return (
            <div 
              key={member.id} 
              className="group bg-[#f5f7f3] border border-gray-200 hover:border-gray-300 p-8 transition-all rounded-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {isEditing && previewImage ? (
                      <img src={previewImage} alt="Profile" className="w-12 h-12 object-cover rounded-full" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-900 flex items-center justify-center text-white text-sm font-light rounded-full">
                        {displayData.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
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
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full text-sm font-light text-gray-900 border-b border-gray-200 focus:border-gray-900 outline-none pb-1 transition-colors"
                          placeholder="Nom"
                        />
                        <input
                          type="text"
                          value={formData.relationship}
                          onChange={(e) => handleInputChange('relationship', e.target.value)}
                          className="w-full text-xs text-gray-400 border-b border-gray-200 focus:border-gray-900 outline-none pb-1 transition-colors"
                          placeholder="Relation"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-light text-gray-900 mb-1">{displayData.name}</div>
                        <div className="text-xs text-gray-400">{displayData.relationship}</div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancel}
                        className="w-8 h-8 hover:bg-gray-100 flex items-center justify-center transition-all rounded-full"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleSave(member.id)}
                        className="w-8 h-8 bg-gray-900 hover:bg-gray-800 flex items-center justify-center transition-all rounded-full"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditing(member)}
                        className="w-8 h-8 hover:bg-gray-100 hover:rounded-full flex items-center justify-center transition-all rounded-full"
                      >
                        <Edit2 className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="w-8 h-8 hover:bg-red-50 hover:rounded-full flex items-center justify-center transition-all rounded-full"
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
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-gray-300" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="flex-1 text-xs text-gray-600 border-b border-gray-200 focus:border-gray-900 outline-none pb-1 transition-colors"
                        placeholder="Téléphone"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-gray-300" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="flex-1 text-xs text-gray-600 border-b border-gray-200 focus:border-gray-900 outline-none pb-1 transition-colors"
                        placeholder="Email"
                      />
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

              <button
                className="w-full py-3 bg-[#f5f7f3] hover:bg-gray-900 text-gray-600 hover:text-white text-xs tracking-wide transition-all"
                onClick={() => window.location.href = '/search-results'}
              >
                Réserver pour {displayData.name.split(' ')[0]}
              </button>
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