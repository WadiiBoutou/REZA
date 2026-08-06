'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Star, MessageSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { format, subDays, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReviewStats {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  averageRating: number;
  ratingDistribution: { rating: number; count: number }[];
  trendsLastMonth: {
    total: number;
    approved: number;
    rejected: number;
    averageRating: number;
  };
}

type ApiReview = {
  id: string;
  rating: number;
  comment?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  moderatedAt?: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export default function StatistiquesAvisPage() {
  const [stats, setStats] = useState<ReviewStats>({
    totalReviews: 0,
    pendingReviews: 0,
    approvedReviews: 0,
    rejectedReviews: 0,
    averageRating: 0,
    ratingDistribution: [],
    trendsLastMonth: {
      total: 0,
      approved: 0,
      rejected: 0,
      averageRating: 0,
    },
  });
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [allReviews, setAllReviews] = useState<ApiReview[]>([]);
  const [deltas, setDeltas] = useState<{
    totalPct: number | null;
    rating: number | null;
    approvalPp: number | null;
    positivePct: number | null;
  }>({ totalPct: null, rating: null, approvalPp: null, positivePct: null });

  useEffect(() => {
    fetchReviewStatistics();
  }, []);

  useEffect(() => {
    if (allReviews.length > 0) {
      calculateStats();
    }
  }, [allReviews, timeFilter]);

  const fetchReviewStatistics = async () => {
    try {
      setLoading(true);
      toast.loading('Chargement des statistiques...', { id: 'loading-stats' });
      
      // Fetch statistics from the dedicated endpoint
      const statsResponse = await api.getReviewStatistics();
      
      // If the endpoint returns pre-calculated stats, use them
      if (statsResponse.stats) {
        setStats({
          totalReviews: statsResponse.stats.totalReviews || 0,
          pendingReviews: statsResponse.stats.pendingReviews || 0,
          approvedReviews: statsResponse.stats.approvedReviews || 0,
          rejectedReviews: statsResponse.stats.rejectedReviews || 0,
          averageRating: statsResponse.stats.averageRating || 0,
          ratingDistribution: statsResponse.stats.ratingDistribution || [],
          trendsLastMonth: statsResponse.stats.trendsLastMonth || {
            total: 0,
            approved: 0,
            rejected: 0,
            averageRating: 0,
          },
        });
      }
      
      // Also fetch all reviews for detailed calculations
      const reviewsResponse = await api.getReviews({ limit: 1000 });
      const reviews = reviewsResponse.reviews || [];
      setAllReviews(reviews);
      
      toast.success('Statistiques chargées', { id: 'loading-stats' });
    } catch (err: any) {
      console.error('Error fetching review statistics:', err);
      toast.error(err.message || 'Erreur lors du chargement des statistiques', { id: 'loading-stats' });
      
      // Fallback: try to fetch reviews directly
      try {
        const reviewsResponse = await api.getReviews({ limit: 1000 });
        const reviews = reviewsResponse.reviews || [];
        setAllReviews(reviews);
      } catch (fallbackErr: any) {
        console.error('Error in fallback fetch:', fallbackErr);
        setAllReviews([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const now = new Date();
    let startDate: Date;
    
    // Filter reviews by time period
    switch (timeFilter) {
      case 'week':
        startDate = subDays(now, 7);
        break;
      case 'month':
        startDate = subDays(now, 30);
        break;
      case 'year':
        startDate = subDays(now, 365);
        break;
      default:
        startDate = subDays(now, 30);
    }

    const filteredReviews = allReviews.filter((r: ApiReview) => {
      const reviewDate = new Date(r.createdAt);
      return reviewDate >= startDate && reviewDate <= now;
    });

    const pending = filteredReviews.filter(r => r.status === 'PENDING');
    const approved = filteredReviews.filter(r => r.status === 'APPROVED');
    const rejected = filteredReviews.filter(r => r.status === 'REJECTED');
    
    const totalReviews = filteredReviews.length;
    const ratingsSum = filteredReviews.reduce((sum: number, r: ApiReview) => sum + (r.rating || 0), 0);
    const averageRating = totalReviews > 0 ? ratingsSum / totalReviews : 0;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    filteredReviews.forEach((r: ApiReview) => {
      if (r.rating) distribution[r.rating]++;
    });
    const ratingDistribution = Object.entries(distribution).map(([rating, count]) => ({
      rating: Number(rating),
      count,
    }));

    // Compare with the previous window of the same length (real deltas, not hardcoded)
    const windowLength = now.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - windowLength);
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevReviews = allReviews.filter((r: ApiReview) => {
      const reviewDate = new Date(r.createdAt);
      return reviewDate >= prevStart && reviewDate <= prevEnd;
    });
    const prevTotal = prevReviews.length;
    const prevRatingsSum = prevReviews.reduce((sum: number, r: ApiReview) => sum + (r.rating || 0), 0);
    const prevAvgRating = prevTotal > 0 ? prevRatingsSum / prevTotal : 0;
    const prevApproved = prevReviews.filter((r: ApiReview) => r.status === 'APPROVED').length;
    const prevPositive = prevReviews.filter((r: ApiReview) => (r.rating || 0) >= 4).length;
    const positiveCount = filteredReviews.filter((r: ApiReview) => (r.rating || 0) >= 4).length;

    setDeltas({
      totalPct: prevTotal > 0 ? Math.round(((totalReviews - prevTotal) / prevTotal) * 100) : null,
      rating: prevTotal > 0 ? Math.round((averageRating - prevAvgRating) * 10) / 10 : null,
      approvalPp:
        prevTotal > 0 && totalReviews > 0
          ? Math.round(((approved.length / totalReviews) - (prevApproved / prevTotal)) * 100)
          : null,
      positivePct: prevPositive > 0 ? Math.round(((positiveCount - prevPositive) / prevPositive) * 100) : null,
    });

    // Calculate trends for last month (30 days ago to now)
    const lastMonthStart = subDays(now, 30);
    const lastMonthReviews = allReviews.filter((r: ApiReview) => {
      const reviewDate = new Date(r.createdAt);
      return reviewDate >= lastMonthStart && reviewDate <= now;
    });
    const lastMonthApproved = lastMonthReviews.filter(r => r.status === 'APPROVED');
    const lastMonthRejected = lastMonthReviews.filter(r => r.status === 'REJECTED');
    const lastMonthRatingsSum = lastMonthReviews.reduce((sum: number, r: ApiReview) => sum + (r.rating || 0), 0);
    const lastMonthAvgRating = lastMonthReviews.length > 0 ? lastMonthRatingsSum / lastMonthReviews.length : 0;

    setStats({
      totalReviews,
      pendingReviews: pending.length,
      approvedReviews: approved.length,
      rejectedReviews: rejected.length,
      averageRating,
      ratingDistribution,
      trendsLastMonth: {
        total: lastMonthReviews.length,
        approved: lastMonthApproved.length,
        rejected: lastMonthRejected.length,
        averageRating: lastMonthAvgRating,
      },
    });
  };

  // Calculate trend data based on timeFilter
  const calculateTrendData = () => {
    const now = new Date();
    let startDate: Date;
    let interval: Date[];
    let formatLabel: (date: Date) => string;
    
    switch (timeFilter) {
      case 'week':
        startDate = subDays(now, 7);
        interval = eachDayOfInterval({ start: startDate, end: now });
        formatLabel = (date: Date) => format(date, 'EEE', { locale: fr }).substring(0, 3);
        break;
      case 'month':
        startDate = subDays(now, 30);
        // Group by week for month view
        const weeks = eachWeekOfInterval({ start: startDate, end: now }, { weekStartsOn: 1 });
        interval = weeks;
        formatLabel = (date: Date) => `S${weeks.indexOf(date) + 1}`;
        break;
      case 'year':
        startDate = subDays(now, 365);
        interval = eachMonthOfInterval({ start: startDate, end: now });
        formatLabel = (date: Date) => format(date, 'MMM', { locale: fr });
        break;
      default:
        startDate = subDays(now, 30);
        interval = eachDayOfInterval({ start: startDate, end: now });
        formatLabel = (date: Date) => format(date, 'EEE', { locale: fr }).substring(0, 3);
    }

    const trendData = interval.map((periodStart, index) => {
      let periodEnd: Date;
      if (index < interval.length - 1) {
        periodEnd = interval[index + 1];
      } else {
        periodEnd = now;
      }

      const periodReviews = allReviews.filter((r: ApiReview) => {
        const reviewDate = new Date(r.createdAt);
        return reviewDate >= periodStart && reviewDate < periodEnd;
      });

      return {
        name: formatLabel(periodStart),
        avis: periodReviews.length,
      };
    });

    return trendData;
  };

  // Calculate rating trend data (last 6 months)
  const calculateRatingTrendData = () => {
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 6);
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });

    return months.map((monthStart, index) => {
      let monthEnd: Date;
      if (index < months.length - 1) {
        monthEnd = months[index + 1];
      } else {
        monthEnd = now;
      }

      const monthReviews = allReviews.filter((r: ApiReview) => {
        const reviewDate = new Date(r.createdAt);
        return reviewDate >= monthStart && reviewDate < monthEnd;
      });

      const ratingsSum = monthReviews.reduce((sum: number, r: ApiReview) => sum + (r.rating || 0), 0);
      const avgRating = monthReviews.length > 0 ? ratingsSum / monthReviews.length : 0;

      return {
        month: format(monthStart, 'MMM', { locale: fr }),
        rating: avgRating,
      };
    });
  };

  const trendData = calculateTrendData();
  const ratingTrendData = calculateRatingTrendData();
  const distributionData = stats.ratingDistribution
    .sort((a, b) => b.rating - a.rating)
    .map(item => ({
      rating: `${item.rating}★`,
      count: item.count,
      percentage: stats.totalReviews > 0 ? ((item.count / stats.totalReviews) * 100).toFixed(0) : '0'
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-900">{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

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
        .accent-color { color: #002366; }
      `}</style>

      {/* Header */}
      <div className="mb-12 animate-slideUp">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">Statistiques</h1>
            <p className="text-sm text-gray-400">Vue d'ensemble des performances</p>
          </div>
          <div className="flex items-center gap-2">
            {(['week', 'month', 'year'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setTimeFilter(period)}
                className={`px-4 py-2 text-xs font-medium transition-all ${
                  timeFilter === period 
                    ? 'accent-color' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {period === 'week' ? '7j' : period === 'month' ? '30j' : '1an'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8 animate-fadeIn">
        {/* Total Reviews */}
        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <MessageSquare size={18} className="text-gray-400" />
            </div>
            {deltas.totalPct !== null ? (
              <div className={`flex items-center gap-1 ${deltas.totalPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {deltas.totalPct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span className="text-xs font-medium">{deltas.totalPct >= 0 ? '+' : ''}{deltas.totalPct}%</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Total avis</p>
            <p className="text-3xl font-light text-gray-900">{stats.totalReviews}</p>
          </div>
        </div>

        {/* Average Rating */}
        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <Star size={18} className="text-gray-400" />
            </div>
            {deltas.rating !== null ? (
              <div className={`flex items-center gap-1 ${deltas.rating >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {deltas.rating >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span className="text-xs font-medium">{deltas.rating >= 0 ? '+' : ''}{deltas.rating}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Note moyenne</p>
            <p className="text-3xl font-light text-gray-900">{stats.averageRating.toFixed(1)}</p>
          </div>
        </div>

        {/* Approval Rate */}
        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <TrendingUp size={18} className="text-gray-400" />
            </div>
            {deltas.approvalPp !== null ? (
              <div className={`flex items-center gap-1 ${deltas.approvalPp >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {deltas.approvalPp >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span className="text-xs font-medium">{deltas.approvalPp >= 0 ? '+' : ''}{deltas.approvalPp}%</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Taux approbation</p>
            <p className="text-3xl font-light text-gray-900">{stats.approvedReviews > 0 
              ? ((stats.approvedReviews / stats.totalReviews) * 100).toFixed(1)
              : '0'}%</p>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Reviews Trend - Large */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-100 p-6 animate-fadeIn">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Tendance des avis</h3>
            <p className="text-xs text-gray-400">Évolution sur {timeFilter === 'week' ? '7 jours' : timeFilter === 'month' ? '30 jours' : '1 an'}</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorAvis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#002366" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#002366" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={{ stroke: '#f0f0f0' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="avis" 
                stroke="#002366" 
                strokeWidth={2}
                fill="url(#colorAvis)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-lg border border-gray-100 p-6 animate-fadeIn">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Répartition</h3>
            <p className="text-xs text-gray-400">Status des avis</p>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Approuvés</span>
                <span className="text-sm font-medium text-gray-900">{stats.approvedReviews}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gray-900 rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalReviews > 0 ? (stats.approvedReviews / stats.totalReviews) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">En attente</span>
                <span className="text-sm font-medium text-gray-900">{stats.pendingReviews}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gray-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalReviews > 0 ? (stats.pendingReviews / stats.totalReviews) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Refusés</span>
                <span className="text-sm font-medium text-gray-900">{stats.rejectedReviews}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gray-300 rounded-full transition-all duration-500"
                  style={{ width: `${stats.totalReviews > 0 ? (stats.rejectedReviews / stats.totalReviews) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-2 gap-6 animate-fadeIn">
        {/* Rating Distribution */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Distribution des notes</h3>
            <p className="text-xs text-gray-400">Répartition par étoiles</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={distributionData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis 
                type="category" 
                dataKey="rating" 
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 || index === 1 ? '#002366' : '#d1d5db'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rating Trend */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Évolution de la note</h3>
            <p className="text-xs text-gray-400">6 derniers mois</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={ratingTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="month" 
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={{ stroke: '#f0f0f0' }}
                tickLine={false}
              />
              <YAxis 
                domain={[0, 5]}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="rating" 
                stroke="#002366" 
                strokeWidth={2}
                dot={{ fill: '#002366', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights Cards */}
      <div className="grid grid-cols-1 gap-4 mt-6 animate-fadeIn">
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">Avis positifs</p>
            {deltas.positivePct !== null ? (
              <div className={`flex items-center gap-1 ${deltas.positivePct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {deltas.positivePct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span className="text-[10px] font-medium">{deltas.positivePct >= 0 ? '+' : ''}{deltas.positivePct}%</span>
              </div>
            ) : (
              <span className="text-[10px] text-gray-300">—</span>
            )}
          </div>
          <p className="text-2xl font-light text-gray-900 mb-1">
            {stats.ratingDistribution.filter(d => d.rating >= 4).reduce((sum, d) => sum + d.count, 0)}
          </p>
          <p className="text-xs text-gray-500">4-5 étoiles</p>
        </div>
      </div>

      {/* Employee Statistics - TODO: Implement with API data when appointment/review relationship is available */}
      {allReviews.length === 0 && (
        <div className="mt-8 animate-fadeIn">
          <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
            <MessageSquare className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500">Aucun avis disponible</p>
            <p className="text-xs text-gray-400 mt-2">Les statistiques apparaîtront ici une fois que des avis seront créés</p>
          </div>
        </div>
      )}
    </div>
  );
}