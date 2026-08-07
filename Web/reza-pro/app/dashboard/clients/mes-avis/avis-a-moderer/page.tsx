'use client';

import { useState, useEffect } from 'react';
import { Search, X, Star, ThumbsUp, ThumbsDown, Mail, Check, AlertCircle, User, Bubbles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface Review {
  id: string;
  clientName: string;
  clientEmail: string;
  clientAvatar?: string;
  rating: number;
  comment: string;
  service?: string;
  employeeName?: string;
  date: Date;
  status: 'pending' | 'approved' | 'rejected';
}

const formatDate = (date: Date, format: 'short' | 'long' = 'short') => {
  const d = new Date(date);
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const monthsFull = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  
  if (format === 'short') {
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }
  return `${d.getDate()} ${monthsFull[d.getMonth()]} ${d.getFullYear()}`;
};

export default function AvisAModererPage() {
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch pending reviews from API
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchPendingReviews = async () => {
      try {
        setLoading(true);
        const response = await api.getReviews({ status: 'PENDING', limit: 100 });
        const apiReviews = response.reviews || [];
        
        // Format reviews to match frontend interface
        const formattedReviews: Review[] = apiReviews.map((review: any) => ({
          id: review.id,
          clientName: review.client ? `${review.client.firstName || ''} ${review.client.lastName || ''}`.trim() : 'Client',
          clientEmail: review.client?.email || '',
          clientAvatar: review.client?.avatar || '',
          rating: review.rating || 0,
          comment: review.comment || '',
          service: review.appointment?.service?.name || undefined,
          employeeName: review.appointment?.employee ? `${review.appointment.employee.firstName || ''} ${review.appointment.employee.lastName || ''}`.trim() : undefined,
          date: review.createdAt ? new Date(review.createdAt) : new Date(),
          status: 'pending' as const
        }));
        
        setReviews(formattedReviews);
      } catch (error: any) {
        console.error('Error fetching pending reviews:', error);
        toast.error('Erreur lors du chargement des avis');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingReviews();
  }, [isAuthenticated]);

  const filteredReviews = reviews.filter(review => {
    const matchesSearch =
      review.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.comment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (review.service && review.service.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRating = ratingFilter === 'all' || review.rating.toString() === ratingFilter;
    
    return matchesSearch && matchesRating;
  });

  const handleAction = (review: Review, type: 'approve' | 'reject') => {
    setSelectedReview(review);
    setActionType(type);
    setRejectReason('');
    setShowActionModal(true);
  };

  const confirmAction = async () => {
    if (!selectedReview) return;

    try {
      const status = actionType === 'approve' ? 'APPROVED' : 'REJECTED';
      await api.moderateReview(
        selectedReview.id,
        status,
        status === 'REJECTED' && rejectReason.trim() ? rejectReason.trim() : undefined
      );
      
      // Remove from list
      const updatedReviews = reviews.filter(r => r.id !== selectedReview.id);
      setReviews(updatedReviews);
      
      toast.success(actionType === 'approve' ? 'Avis approuvé avec succès' : 'Avis rejeté');
      setShowActionModal(false);
      setSelectedReview(null);
    } catch (error: any) {
      console.error('Error moderating review:', error);
      toast.error(error.message || 'Erreur lors de la modération de l\'avis');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= rating ? 'fill-[#002366] text-[#002366]' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s ease-out; }
        .accent-bg { background-color: #002366 !important; }
        .accent-text { color: #002366 !important; }
        .accent-border { border-color: #002366 !important; }
      `}</style>

      {/* Header */}
      <div className="mb-12 animate-slideUp">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">Modération</h1>
            <p className="text-sm text-gray-400">
              {filteredReviews.length} {filteredReviews.length === 1 ? 'avis en attente' : 'avis en attente'}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 animate-fadeIn">
        <div className="flex items-center gap-4">
          
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un avis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full bg-white border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-transparent transition-all"
            />
          </div>
          {/* Move View Toggle here */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'grid' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Grille
            </button>
            <span className="text-gray-300">/</span>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'list' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Liste
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
          {filteredReviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden accent-bg flex items-center justify-center flex-shrink-0">
                        {review.clientAvatar ? (
                          <img src={review.clientAvatar} alt={review.clientName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-medium text-sm">{review.clientName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate text-sm">{review.clientName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Service & Date */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {review.service && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                    <Bubbles size={12} className="text-gray-400" />
                    {review.service}
                  </span>
                )}
                {review.employeeName && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                    <User size={12} className="text-gray-400" />
                    {review.employeeName}
                  </span>
                )}
                <span className="text-[10px] text-gray-400">
                  {formatDate(review.date, 'short')}
                </span>
              </div>

              {/* Comment */}
              <div className="mb-4">
                <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{review.comment}</p>
              </div>

              {/* Contact */}
              <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-4 pb-4 border-b border-gray-100">
                <Mail size={10} />
                <span className="truncate">{review.clientEmail}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAction(review, 'approve')}
                  className="flex-1 px-3 py-2 accent-bg text-white text-xs font-medium rounded-full hover:bg-blue-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ThumbsUp size={12} />
                  Approuver
                </button>
                <button
                  onClick={() => handleAction(review, 'reject')}
                  className="px-3 py-2 border border-gray-200 accent-text text-xs font-medium rounded-full hover:bg-gray-50 transition-colors"
                >
                  <ThumbsDown size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">Note</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Service</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider hidden xl:table-cell">Employé</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">Commentaire</th>
                  <th className="px-6 py-4 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                  <th className="px-6 py-4 text-right text-[10px] font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden accent-bg flex items-center justify-center flex-shrink-0">
                        {review.clientAvatar ? (
                          <img src={review.clientAvatar} alt={review.clientName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-medium text-xs">{review.clientName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{review.clientName}</div>
                          <div className="text-[10px] text-gray-400 truncate">{review.clientEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderStars(review.rating)}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      {review.service ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                          <Bubbles size={12} className="text-gray-400" />
                          {review.service}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      {review.employeeName ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                          <User size={12} className="text-gray-400" />
                          {review.employeeName}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-600 line-clamp-2 max-w-md">{review.comment}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap hidden md:table-cell">
                      {formatDate(review.date, 'long')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(review, 'approve')}
                          className="p-2 accent-text hover:text-blue-700 hover:bg-gray-100 rounded-md transition-colors"
                          title="Approuver"
                        >
                          <ThumbsUp size={14} />
                        </button>
                        <button
                          onClick={() => handleAction(review, 'reject')}
                          className="p-2 text-gray-400 hover:accent-text hover:bg-gray-100 rounded-md transition-colors"
                          title="Rejeter"
                        >
                          <ThumbsDown size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg border border-gray-100 p-16 text-center animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ThumbsUp size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-light text-gray-900 mb-2">Chargement des avis...</h3>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredReviews.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-100 p-16 text-center animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <ThumbsUp size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-light text-gray-900 mb-2">Aucun avis en attente</h3>
          <p className="text-gray-400 text-sm">
            {searchTerm ? 'Modifiez votre recherche' : 'Tous les avis ont été traités'}
          </p>
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedReview && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-6 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    actionType === 'approve' ? 'accent-bg' : 'bg-gray-100'
                  }`}>
                    {actionType === 'approve' ? (
                      <Check className="text-white" size={18} />
                    ) : (
                      <AlertCircle className="accent-text" size={18} />
                    )}
                  </div>
                  <h2 className="text-2xl font-light accent-text">
                    {actionType === 'approve' ? 'Approuver l\'avis' : 'Rejeter l\'avis'}
                  </h2>
                </div>
                <button 
                  onClick={() => setShowActionModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-8 py-6">
              {/* Review Details */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden accent-bg flex items-center justify-center flex-shrink-0">
                        {selectedReview.clientAvatar ? (
                          <img src={selectedReview.clientAvatar} alt={selectedReview.clientName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-medium">{selectedReview.clientName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-2">{selectedReview.clientName}</h3>
                    <div className="flex items-center gap-3 mb-3">
                      {renderStars(selectedReview.rating)}
                      <span className="text-xs text-gray-400">
                        {formatDate(selectedReview.date, 'long')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedReview.service && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-gray-600">
                          {selectedReview.service}
                        </span>
                      )}
                      {selectedReview.employeeName && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                          {selectedReview.employeeName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{selectedReview.comment}</p>
              </div>

              {/* Reject Reason */}
              {actionType === 'reject' && (
                <div className="mb-6">
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    Raison du rejet (optionnel)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    placeholder="Expliquez pourquoi cet avis est rejeté..."
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-transparent transition-all resize-none"
                  />
                </div>
              )}

              {/* Confirmation Message */}
              <div className={`p-4 rounded-lg ${
                actionType === 'approve' ? 'bg-gray-100' : 'bg-gray-100'
              }`}>
                <p className="text-xs">
                  {actionType === 'approve'
                    ? 'Cet avis sera publié et visible par tous les visiteurs.'
                    : 'Cet avis sera archivé et ne sera pas publié.'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-8 py-4 flex gap-3">
              <button 
                type="button"
                onClick={() => setShowActionModal(false)}
                className="flex-1 px-6 py-2.5 text-sm font-medium accent-text hover:text-blue-700 transition-colors"
              >
                Annuler
              </button>
              <button 
                type="button"
                onClick={confirmAction}
                className={`flex-1 px-6 py-2.5 text-white text-sm font-medium rounded-full transition-colors ${
                  actionType === 'approve'
                    ? 'accent-bg hover:bg-blue-900'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {actionType === 'approve' ? 'Approuver' : 'Rejeter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}