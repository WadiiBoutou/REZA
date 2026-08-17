import { Camera } from 'lucide-react';
import React, { useState } from 'react';
import SaveModal from './modals/SaveModal';

const ProfileTab = ({ userData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: userData.email,
    phone: userData.phone,
    address: userData.address,
    profileImage: null
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

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

  const handleSave = () => {
    setShowSaveModal(true);
  };

  const confirmSave = () => {
    // Here you would typically save to your backend
    setIsEditing(false);
    setShowSaveModal(false);
  };

  const handleCancel = () => {
    setFormData({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      profileImage: null
    });
    setPreviewImage(null);
    setIsEditing(false);
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
                <img src={previewImage} alt="Profile" className="w-24 h-24 object-cover rounded-full" />
              ) : (
                <div className="w-24 h-24 bg-gray-900 flex items-center justify-center text-white text-2xl font-light rounded-full">
                  {formData.firstName[0]}{formData.lastName[0]}
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
              <label
                htmlFor="profile-pic"
                className={`absolute -bottom-2 -right-2 w-8 h-8 bg-[#f5f7f3] border border-gray-200 flex items-center justify-center hover:bg-[#f5f7f3] transition-all rounded-full ${isEditing ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                <Camera className="w-4 h-4 text-gray-600" />
              </label>
            </div>
            <div>
              <div className="text-xl font-light text-gray-900 mb-1">{formData.firstName} {formData.lastName}</div>
              <div className="text-xs text-gray-400">Membre depuis {userData.joinDate}</div>
            </div>
          </div>
          {isEditing ? (
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className=" hover:border-gray-300 text-xs tracking-wide text-gray-600 hover:text-gray-900 transition-all rounded"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-xs tracking-wide text-white transition-all rounded-full"
              >
                Enregistrer
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-6 py-3 hover:border-gray-900 text-xs tracking-wide text-gray-600 hover:text-gray-900 transition-all"
            >
              Modifier
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-8">
          {[
            { label: 'Prénom', value: 'firstName' },
            { label: 'Nom', value: 'lastName' },
            { label: 'Email', value: 'email' },
            { label: 'Téléphone', value: 'phone' }
          ].map((field, idx) => (
            <div key={idx}>
              <div className="text-xs text-gray-400 tracking-wide uppercase mb-3">{field.label}</div>
              {isEditing ? (
                <input
                  type="text"
                  value={formData[field.value]}
                  onChange={(e) => handleInputChange(field.value, e.target.value)}
                  className="w-full text-sm font-light text-gray-900 border-b border-gray-200 focus:border-gray-900 outline-none pb-2 transition-colors"
                />
              ) : (
                <div className="text-sm font-light text-gray-900">{formData[field.value]}</div>
              )}
            </div>
          ))}
          <div className="col-span-2">
            <div className="text-xs text-gray-400 tracking-wide uppercase mb-3">Adresse</div>
            {isEditing ? (
              <textarea
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full text-sm font-light text-gray-900 border-b border-gray-200 focus:border-gray-900 outline-none pb-2 transition-colors resize-none"
                rows={2}
              />
            ) : (
              <div className="text-sm font-light text-gray-900">{formData.address}</div>
            )}
          </div>
        </div>
      </div>
      <SaveModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={confirmSave}
        title="Enregistrer le profil"
        description="Voulez-vous enregistrer les modifications de votre profil ?"
        confirmText="Enregistrer"
      />
    </div>
  );
};

export default ProfileTab;