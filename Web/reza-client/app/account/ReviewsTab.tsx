import { Star, Calendar, MapPin, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import DeleteModal from './modals/DeleteModal';
import { getImageUrl } from '../../lib/utils';

type Review = {
  id: number;
  salon: string;
  salonImage: string;
  salonLocation: string;
  service: string;
  rating: number;
  comment: string;
  date: string;
  appointmentDate: string;
  detailedRatings?: {
    quality?: number;
    professionalism?: number;
    cleanliness?: number;
    value?: number;
  };
};

type ReviewsTabProps = {
  reviews?: Review[];
  handleDeleteReview?: (reviewId: number) => void;
};

const ReviewsTab = ({ reviews = [], handleDeleteReview = () => {} }: ReviewsTabProps) => {
  const [deleteReviewId, setDeleteReviewId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = (reviewId: number) => {
    setDeleteReviewId(reviewId);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (deleteReviewId !== null) {
      handleDeleteReview(deleteReviewId);
      setShowDeleteModal(false);
      setDeleteReviewId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-extralight text-gray-900 tracking-tight mb-2">Mes Avis</h2>
        <p className="text-xs text-gray-400 tracking-wide">{reviews.length} avis publiés</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {reviews.length === 0 && (
          <div className="col-span-1 lg:col-span-2 text-gray-400 text-sm text-center py-12">
            Vous n'avez pas encore laissé d'avis.
          </div>
        )}
        
        {reviews.map((review) => {
          return (
            <div 
              key={review.id} 
              className="group bg-[#f5f7f3] border border-gray-200 hover:border-gray-300 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 transition-all"
            >
              {/* Header with Image and Salon Info */}
              <div className="flex items-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden flex-shrink-0">
                  <img 
                    src={getImageUrl(review.salonImage) || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80'} 
                    alt={review.salon} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
                    }}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-light text-gray-900 mb-1">{review.salon}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" /> 
                        {review.salonLocation}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDelete(review.id)}
                        className="w-8 h-8 hover:bg-red-50 flex items-center justify-center transition-all rounded-full"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 mb-3">{review.service}</div>
                  
                  {/* Star Rating */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star 
                        key={i} 
                        className={`w-4 h-4 ${
                          i <= (review.rating || 0)
                            ? 'text-gray-900 fill-gray-900' 
                            : 'text-gray-300'
                        }`} 
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Comment Section */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <p className="text-sm text-gray-700 font-light leading-relaxed">
                  {review.comment}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" /> 
                  {review.appointmentDate}
                </div>
                
                <span className="text-xs text-gray-400">{review.date}</span>
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
    </div>
  );
};

export default ReviewsTab;