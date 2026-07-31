import { Calendar, Users, Gift, Heart, ChevronRight, Bell, Check } from 'lucide-react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { formatMoroccoDate, formatMoroccoDateTime, getImageUrl } from '../../lib/utils';

type OverviewTabProps = {
  userData: any;
  familyMembers: any[];
  appointments: any[];
  favoritesCount: number;
  notifications?: any[];
  unreadNotificationsCount?: number;
  setActiveTab: (tab: string) => void;
  onMarkNotificationAsRead: (id: string) => void;
};

const OverviewTab = ({ userData, familyMembers, appointments, favoritesCount, notifications = [], unreadNotificationsCount = 0, setActiveTab, onMarkNotificationAsRead }: OverviewTabProps) => {
  const router = useRouter();
  
  // Debug: Log notifications to verify they're being passed
  
  return (
  <div className="space-y-12 sm:space-y-16 animate-fadeIn pb-24">
    {/* Stats Grid - High End Minimalist */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200 overflow-hidden rounded-2xl">
      <div className="group relative bg-white p-6 sm:p-8 hover:bg-gray-50 transition-colors duration-300">
        <div className="flex justify-between items-start mb-6">
          <Calendar className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
        </div>
        <div className="text-4xl sm:text-5xl font-light text-gray-900 tracking-tight mb-2">{userData.totalBookings}</div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Réservations</div>
      </div>

      <div className="group relative bg-white p-6 sm:p-8 hover:bg-gray-50 transition-colors duration-300">
        <div className="flex justify-between items-start mb-6">
          <Users className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
        </div>
        <div className="text-4xl sm:text-5xl font-light text-gray-900 tracking-tight mb-2">{familyMembers.length}</div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Proches</div>
      </div>

      <div className="group relative bg-white p-6 sm:p-8 hover:bg-gray-50 transition-colors duration-300">
        <div className="flex justify-between items-start mb-6">
          <Gift className="w-5 h-5 text-gray-400 group-hover:text-[#8b7260] transition-colors" />
          <span className="bg-[#8b7260] text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Bientôt</span>
        </div>
        <div className="text-4xl sm:text-5xl font-light text-gray-900 tracking-tight mb-2">0</div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Points Fidélité</div>
      </div>

      <div className="group relative bg-white p-6 sm:p-8 hover:bg-gray-50 transition-colors duration-300">
        <div className="flex justify-between items-start mb-6">
          <Heart className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
        </div>
        <div className="text-4xl sm:text-5xl font-light text-gray-900 tracking-tight mb-2">{favoritesCount || 0}</div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Favoris</div>
      </div>
    </div>

    {/* Quick Actions - Prominent & Premium */}
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-light text-gray-900 tracking-tight">Actions Rapides</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <button 
          onClick={() => router.push('/search-results')}
          className="group relative overflow-hidden flex flex-col items-start p-8 bg-gray-900 text-white rounded-2xl hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] transition-all duration-300 transform hover:-translate-y-1 text-left"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Calendar className="w-24 h-24 transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500" />
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-16 group-hover:bg-[#8b7260] transition-colors duration-300">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div className="relative z-10 mt-auto">
            <div className="text-lg font-medium mb-1">Nouveau rendez-vous</div>
            <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Réserver une prestation</div>
          </div>
        </button>

        <button 
          onClick={() => setActiveTab('family')}
          className="group relative overflow-hidden flex flex-col items-start p-8 bg-white border border-gray-200 text-gray-900 rounded-2xl hover:border-gray-900 transition-all duration-300 transform hover:-translate-y-1 text-left shadow-sm hover:shadow-lg"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-24 h-24 transform group-hover:scale-110 transition-all duration-500" />
          </div>
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-16 group-hover:bg-gray-900 transition-colors duration-300">
            <Users className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
          </div>
          <div className="relative z-10 mt-auto">
            <div className="text-lg font-medium mb-1">Ajouter un proche</div>
            <div className="text-sm text-gray-500">Gérer les comptes liés</div>
          </div>
        </button>

        <button className="group relative overflow-hidden flex flex-col items-start p-8 bg-white border border-gray-200 text-gray-900 rounded-2xl hover:border-[#8b7260] transition-all duration-300 transform hover:-translate-y-1 text-left shadow-sm hover:shadow-lg">
          <div className="absolute top-6 right-6">
             <span className="bg-[#8b7260]/10 text-[#8b7260] text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider">Bientôt</span>
          </div>
          <div className="absolute bottom-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Gift className="w-24 h-24 transform group-hover:scale-110 -rotate-12 transition-all duration-500" />
          </div>
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-16 group-hover:bg-[#8b7260] transition-colors duration-300">
            <Gift className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
          </div>
          <div className="relative z-10 mt-auto">
            <div className="text-lg font-medium mb-1">Mes récompenses</div>
            <div className="text-sm text-gray-500">Découvrir le programme</div>
          </div>
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8">
      {/* Upcoming Appointments Preview */}
      <div>
        <div className="flex items-end justify-between mb-6 border-b border-gray-100 pb-4">
          <h3 className="text-xl font-light text-gray-900 tracking-tight">Rendez-vous à venir</h3>
          <button 
            onClick={() => setActiveTab('appointments')}
            className="text-sm font-semibold text-[#8b7260] hover:text-gray-900 uppercase tracking-wider transition-colors"
          >
            Voir tout
          </button>
        </div>
        
        <div className="space-y-4">
          {appointments.filter(a => a.status === 'confirmed').slice(0, 3).map((apt) => (
            <div 
              key={apt.id} 
              className="group flex gap-5 p-4 bg-white border border-gray-100 hover:border-gray-300 transition-all duration-300 cursor-pointer"
              onClick={() => setActiveTab('appointments')}
            >
              <div className="w-20 h-20 overflow-hidden bg-gray-100 flex-shrink-0">
                <img 
                  src={getImageUrl(apt.image) || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80'} 
                  alt={apt.salon} 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
                  }}
                />
              </div>
              <div className="flex flex-col justify-center flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 mb-1 truncate">{apt.service}</div>
                <div className="text-xs text-gray-500 mb-3 truncate">{apt.salon}</div>
                <div className="flex items-center gap-4 text-xs font-medium text-gray-900 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#8b7260]" />
                    {formatMoroccoDate(apt.date, { day: 'numeric', month: 'short' })}
                  </span>
                  <span>{apt.time}</span>
                </div>
              </div>
            </div>
          ))}
          {appointments.filter(a => a.status === 'confirmed').length === 0 && (
            <div className="py-12 px-6 border border-gray-100 bg-gray-50/50 text-center">
              <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-4" />
              <p className="text-sm font-semibold text-gray-900 mb-1">Aucun rendez-vous</p>
              <p className="text-sm text-gray-500">Votre agenda est libre.</p>
            </div>
          )}
        </div>
      </div>

      {/* Notifications Section */}
      <div>
        <div className="flex items-end justify-between mb-6 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-light text-gray-900 tracking-tight">Notifications</h3>
            {unreadNotificationsCount > 0 && (
              <span className="bg-gray-900 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
                {unreadNotificationsCount}
              </span>
            )}
          </div>
        </div>
        
        {notifications && notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.slice(0, 5).map((notification: any) => (
              <div 
                key={notification.id}
                className={`group flex items-start gap-4 p-4 transition-all border ${
                  !notification.isRead 
                    ? 'border-l-4 border-l-[#8b7260] border-y border-y-gray-100 border-r border-r-gray-100 bg-white shadow-sm' 
                    : 'border border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className="mt-1">
                  <div className={`w-2 h-2 rounded-full ${!notification.isRead ? 'bg-[#8b7260]' : 'bg-gray-200'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4 mb-1">
                    <div className={`text-sm ${!notification.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                      {notification.title}
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest whitespace-nowrap mt-0.5">
                      {formatMoroccoDateTime(notification.createdAt, {
                        day: 'numeric', month: 'short'
                      })}
                    </div>
                  </div>
                  <div className={`text-sm ${!notification.isRead ? 'text-gray-600' : 'text-gray-500'} leading-relaxed`}>
                    {notification.message}
                  </div>
                </div>
                {!notification.isRead && onMarkNotificationAsRead && (
                  <button
                    onClick={() => onMarkNotificationAsRead(notification.id)}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-900 transition-colors"
                    title="Marquer comme lu"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 px-6 border border-gray-100 bg-gray-50/50 text-center">
            <Bell className="w-8 h-8 text-gray-300 mx-auto mb-4" />
            <p className="text-sm font-semibold text-gray-900 mb-1">Aucune notification</p>
            <p className="text-sm text-gray-500">Tout est calme ici.</p>
          </div>
        )}
      </div>
    </div>
  </div>
  );
};

export default OverviewTab;