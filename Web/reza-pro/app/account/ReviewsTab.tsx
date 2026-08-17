// @ts-nocheck
import { Star, Calendar, MapPin, Edit2, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import DeleteModal from './modals/DeleteModal';
import SaveModal from './modals/SaveModal';

const ReviewsTab = ({
  reviews = [],
  // Handlers accept the same arguments that callers provide so TS
  // doesn't infer zero-arg function types.
  handleEditReview = (updatedReview) => {},
  handleDeleteReview = (reviewId) => {},
}) => {
  const [editingReview, setEditingReview] = useState(null);
  const [formData, setFormData] = useState({});
  const [deleteReviewId, setDeleteReviewId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingSaveId, setPendingSaveId] = useState(null);

  const startEditing = (review) => {
    setEditingReview(review.id);
    setFormData({
      rating: review.rating,
      comment: review.comment,
      detailedRatings: review.detailedRatings || {
        quality: 0,
        professionalism: 0,
        cleanliness: 0,
        value: 0
      }
    });
  };

  const handleCancel = () => {
    setEditingReview(null);
    setFormData({});
  };

  const handleSave = (reviewId) => {
    setPendingSaveId(reviewId);
    setShowSaveModal(true);
  };

  const confirmSave = () => {
    handleEditReview({ id: pendingSaveId, ...formData });
    setEditingReview(null);
    setFormData({});
    setShowSaveModal(false);
    setPendingSaveId(null);
  };

  const handleDelete = (reviewId) => {
    setDeleteReviewId(reviewId);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    handleDeleteReview(deleteReviewId);
    setShowDeleteModal(false);
    setDeleteReviewId(null);
  };

  const updateDetailedRating = (category, value) => {
    setFormData({
      ...formData,
      detailedRatings: {
        ...formData.detailedRatings,
        [category]: value
      }
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-extralight text-gray-900 tracking-tight mb-2">Mes Avis</h2>
        <p className="text-xs text-gray-400 tracking-wide">{reviews.length} avis publiés</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {reviews.length === 0 && (
          <div className="col-span-2 text-gray-400 text-sm text-center py-12">
            Vous n'avez pas encore laissé d'avis.
          </div>
        )}
        
        {reviews.map((review) => {
          const isEditing = editingReview === review.id;
          const displayData = isEditing ? formData : review;

          return (
            <div 
              key={review.id} 
              className="group bg-[#f5f7f3] border border-gray-200 hover:border-gray-300 rounded-2xl p-8 transition-all"
            >
              {/* Header with Image and Salon Info */}
              <div className="flex items-start gap-6 mb-6">
                <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0">
                  <img 
                    src={review.salonImage} 
                    alt={review.salon} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" 
                  />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-light text-gray-900 mb-1">{review.salon}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" /> 
                        {review.salonLocation}
                      </div>
                    </div>
                    
                    {!isEditing && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditing(review)}
                          className="w-8 h-8 hover:bg-gray-100 flex items-center justify-center transition-all rounded-full"
                        >
                          <Edit2 className="w-3 h-3 text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(review.id)}
                          className="w-8 h-8 hover:bg-red-50 flex items-center justify-center transition-all rounded-full"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-400 mb-3">{review.service}</div>
                  
                  {/* Star Rating */}
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setFormData({ ...formData, rating: star })}
                          >
                            <Star 
                              className={`w-5 h-5 transition-all cursor-pointer ${
                                star <= formData.rating
                                  ? 'text-gray-900 fill-gray-900'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star 
                            key={i} 
                            className={`w-4 h-4 ${
                              i <= displayData.rating 
                                ? 'text-gray-900 fill-gray-900' 
                                : 'text-gray-300'
                            }`} 
                          />
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Comment Section */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                {isEditing ? (
                  <textarea
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    className="w-full px-4 py-3 bg-[#f5f7f3] border border-gray-200 rounded-2xl text-sm text-gray-900 font-light placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors resize-none"
                    rows={4}
                    placeholder="Votre commentaire..."
                  />
                ) : (
                  <p className="text-sm text-gray-700 font-light leading-relaxed">
                    {displayData.comment}
                  </p>
                )}
              </div>

              {/* Detailed Ratings (only in edit mode) */}
              {isEditing && (
                <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                  <div className="text-xs text-gray-400 font-light tracking-wide mb-3">ÉVALUATIONS DÉTAILLÉES</div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-light">Qualité du service</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => updateDetailedRating('quality', star)}
                        >
                          <Star 
                            className={`w-4 h-4 transition-all cursor-pointer ${
                              star <= formData.detailedRatings.quality
                                ? 'text-gray-900 fill-gray-900'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-light">Professionnalisme</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => updateDetailedRating('professionalism', star)}
                        >
                          <Star 
                            className={`w-4 h-4 transition-all cursor-pointer ${
                              star <= formData.detailedRatings.professionalism
                                ? 'text-gray-900 fill-gray-900'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-light">Propreté</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => updateDetailedRating('cleanliness', star)}
                        >
                          <Star 
                            className={`w-4 h-4 transition-all cursor-pointer ${
                              star <= formData.detailedRatings.cleanliness
                                ? 'text-gray-900 fill-gray-900'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-light">Rapport qualité/prix</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => updateDetailedRating('value', star)}
                        >
                          <Star 
                            className={`w-4 h-4 transition-all cursor-pointer ${
                              star <= formData.detailedRatings.value
                                ? 'text-gray-900 fill-gray-900'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" /> 
                  {review.appointmentDate}
                </div>
                
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 transition-all rounded-full"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleSave(review.id)}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs transition-all rounded-full"
                    >
                      Enregistrer
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">{review.date}</span>
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
        title="Supprimer l'avis"
        description="Êtes-vous sûr de vouloir supprimer cet avis ? Cette action est irréversible."
        confirmText="Supprimer"
      />
      <SaveModal
        open={showSaveModal}
        onClose={() => { setShowSaveModal(false); setPendingSaveId(null); }}
        onConfirm={confirmSave}
        title="Enregistrer l'avis"
        description="Voulez-vous enregistrer les modifications de cet avis ?"
        confirmText="Enregistrer"
      />
    </div>
  );
};

export default ReviewsTab;