'use client';

import { useState, useEffect } from 'react';
import { Search, Star, MessageSquare, Trash2, User, Bubbles } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Review {
  id: string;
  clientName: string;
  clientEmail: string;
  clientAvatar?: string;
  rating: number;
  comment: string;
  service?: string;
  date: Date;
  status: 'approved';
  employeeName?: string;
}

export default function AvisModeresPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUnpublishModal, setShowUnpublishModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApprovedReviews();
  }, []);

  const fetchApprovedReviews = async () => {
    try {
      setLoading(true);
      toast.loading('Chargement des avis modérés...', { id: 'loading-reviews' });

      const response = await api.getApprovedReviews();

      // Transform API response to match Review interface
      const formattedReviews: Review[] = (response.reviews || response || []).map((review: any) => ({
        id: review.id,
        clientName: review.client
          ? `${review.client.firstName || ''} ${review.client.lastName || ''}`.trim()
          : review.clientName || 'Client',
        clientEmail: review.client?.email || review.clientEmail || '',
        clientAvatar: review.client?.avatar || review.clientAvatar || '',
        rating: review.rating || 0,
        comment: review.comment || review.text || '',
        service: review.service?.name || review.serviceName || review.service,
        date: review.createdAt ? new Date(review.createdAt) : new Date(),
        status: 'approved' as const,
        employeeName: review.employee
          ? `${review.employee.firstName || ''} ${review.employee.lastName || ''}`.trim()
          : review.employeeName,
      }));

      setReviews(formattedReviews);
      toast.success(`${formattedReviews.length} avis modéré(s) chargé(s)`, { id: 'loading-reviews' });
    } catch (err: any) {
      console.error('Error fetching approved reviews:', err);
      toast.error(err.message || 'Erreur lors du chargement des avis modérés', { id: 'loading-reviews' });
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch =
      review.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.comment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (review.service && review.service.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRating = ratingFilter === 'all' || review.rating.toString() === ratingFilter;

    return matchesSearch && matchesRating;
  });

  const handleUnpublish = (review: Review) => {
    setSelectedReview(review);
    setShowUnpublishModal(true);
  };

  const confirmUnpublish = async () => {
    if (!selectedReview) return;

    try {
      // Update review status to PENDING via API
      await api.moderateReview(selectedReview.id, 'PENDING');

      const updatedReviews = reviews.filter(r => r.id !== selectedReview.id);
      setReviews(updatedReviews);
      toast.success('Avis renvoyé vers la modération');

      setShowUnpublishModal(false);
      setSelectedReview(null);

      // Refresh the list
      await fetchApprovedReviews();
    } catch (err: any) {
      console.error('Error unpublishing review:', err);
      toast.error(err.message || 'Erreur lors de la dépublication');
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

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

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
      <div className="mb-8 animate-slideUp">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">Avis modérés</h1>
            <p className="text-sm text-gray-400">
              {loading ? 'Chargement...' : `${filteredReviews.length} ${filteredReviews.length === 1 ? 'avis' : 'avis'}`}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 animate-fadeIn">
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Note moyenne</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <Star className="text-blue-600" size={16} />
            </div>
          </div>
          <p className="text-3xl font-light text-black">{averageRating}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total avis</span>
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <MessageSquare className="text-gray-600" size={16} />
            </div>
          </div>
          <p className="text-3xl font-light text-black">{reviews.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">5 étoiles</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <Star className="text-emerald-600" size={16} />
            </div>
          </div>
          <p className="text-3xl font-light text-black">{reviews.filter(r => r.rating === 5).length}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 animate-fadeIn">
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
      {!loading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
          {filteredReviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group"
            >
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
                      <span className="text-xs text-gray-400">
                        {format(new Date(review.date), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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
              </div>
              <div className="mb-4">
                <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{review.comment}</p>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleUnpublish(review)}
                  className="w-full px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-full transition-colors flex items-center justify-center gap-1.5 text-xs font-medium"
                  title="Dépublier"
                >
                  <Trash2 size={14} />
                  Dépublier
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && (
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
                          <div className="text-[10px] text-gray-400 truncate">{format(new Date(review.date), 'dd MMM yyyy', { locale: fr })}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderStars(review.rating)}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      {review.service ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                          {review.service}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      {review.employeeName ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                          {review.employeeName}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-600 line-clamp-2 max-w-md">{review.comment}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleUnpublish(review)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Dépublier"
                        >
                          <Trash2 size={14} />
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

      {/* Empty State */}
      {!loading && filteredReviews.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-100 p-16 text-center animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-light text-gray-900 mb-2">Aucun avis modéré</h3>
          <p className="text-gray-400 text-sm">
            {searchTerm ? 'Essayez de modifier votre recherche' : 'Les avis approuvés apparaîtront ici'}
          </p>
        </div>
      )}

      {/* Unpublish Modal */}
      {showUnpublishModal && selectedReview && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full animate-slideUp">
            <div className="px-8 py-6">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h2 className="text-xl font-medium text-gray-900 text-center mb-2">
                Dépublier cet avis ?
              </h2>
              <p className="text-sm text-gray-600 text-center mb-6">
                Cet avis sera retiré de la liste et renvoyé vers les avis à modérer.
              </p>
            </div>
            <div className="border-t border-gray-100 px-8 py-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowUnpublishModal(false)}
                className="flex-1 px-6 py-2.5 text-sm font-medium accent-text hover:text-blue-700 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmUnpublish}
                className="flex-1 px-6 py-2.5 bg-red-600 text-white text-sm font-medium rounded-full hover:bg-red-700 transition-colors"
              >
                Dépublier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
