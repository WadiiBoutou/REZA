'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Home, Trash2, Users, Settings, File, BarChart3, LogOut, Settings2, ChevronRight, LayoutPanelLeft, Calendar, Filter, UserCheck, Building, TrendingUp, FileText, ChevronDown, Bell, Menu, CreditCard, LifeBuoy, X, Check, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { getRealtimeSocket, disconnectRealtime } from '@/lib/realtime';
import ConfirmDialog from '@/components/ConfirmDialog';
import ProfileModal from '@/components/ProfileModal';
import { SalonFilterControl } from '@/components/SalonFilterControl';
import {
  RendezVousSidebar,
  ClientsSidebar,
  PersonnelsSidebar,
  AdminSidebar,
  CaisseSidebar,
} from './sidebar/index';
import { menuItems } from './sidebar/shared';

export default function Sidebar() {
	const pathname = usePathname();
	const { logout, user, isAuthenticated, salons } = useAuth();
	const [mounted, setMounted] = useState(false);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
	const [showProfileModal, setShowProfileModal] = useState(false);
	const [showClearNotificationsConfirm, setShowClearNotificationsConfirm] = useState(false);
	const [clearingNotifications, setClearingNotifications] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();
	
	// Initialize filters from URL params or default to 'all'
	const [caisseMethodFilter, setCaisseMethodFilter] = useState(() => {
		return searchParams?.get('method') || 'all';
	});
	const [caisseTypeFilter, setCaisseTypeFilter] = useState(() => {
		return searchParams?.get('type') || 'all';
	});
	const [caissePeriod, setCaissePeriod] = useState(() => {
		return searchParams?.get('period') || 'all';
	});
	
	// Update URL when filters change (only for caisse page)
	// This is a one-way sync: sidebar -> URL
	useEffect(() => {
		if (pathname?.startsWith('/dashboard/caisse')) {
			const params = new URLSearchParams();
			if (caisseMethodFilter !== 'all') {
				params.set('method', caisseMethodFilter);
			}
			if (caisseTypeFilter !== 'all') {
				params.set('type', caisseTypeFilter);
			}
			if (caissePeriod !== 'all') {
				params.set('period', caissePeriod);
			}
			const newParams = params.toString();
			const newUrl = newParams ? `${pathname}?${newParams}` : pathname;
			router.replace(newUrl, { scroll: false });
		}
	}, [caisseMethodFilter, caisseTypeFilter, caissePeriod, pathname, router]);

	// Notification sidebar state
	const [showNotificationSidebar, setShowNotificationSidebar] = useState(false);
	const [notificationTab, setNotificationTab] = useState<'all' | 'unread'>('all');
	const notificationSidebarRef = useRef<HTMLDivElement>(null);
	const [notifications, setNotifications] = useState<any[]>([]);
	const [groupedNotifications, setGroupedNotifications] = useState<any>({});
	const [unreadCount, setUnreadCount] = useState(0);
	const [loadingNotifications, setLoadingNotifications] = useState(false);


	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!showNotificationSidebar) return;
		function handleClickOutside(event: MouseEvent) {
			if (notificationSidebarRef.current && !notificationSidebarRef.current.contains(event.target as Node)) {
				setShowNotificationSidebar(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showNotificationSidebar]);

	// Fetch notifications
	useEffect(() => {
		if (isAuthenticated) {
			fetchNotifications();
		}
	}, [isAuthenticated, notificationTab, showNotificationSidebar]);

	// Live notifications: Socket.IO push only (no polling). We also resync
	// when the socket (re)connects — the backend may have been asleep or
	// restarted, and a notification emitted before our reconnect would
	// otherwise be missed. Same for when the tab becomes visible again.
	useEffect(() => {
		if (!isAuthenticated) return;

		const socket = getRealtimeSocket();
		const refreshNotifications = () => {
			fetchNotifications();
		};
		socket?.on('notification:new', refreshNotifications);
		socket?.on('connect', refreshNotifications);

		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				fetchNotifications();
			}
		};
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			socket?.off('notification:new', refreshNotifications);
			socket?.off('connect', refreshNotifications);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAuthenticated]);

	const fetchNotifications = async () => {
		try {
			setLoadingNotifications(true);
			const response = await api.getNotifications({
				unreadOnly: notificationTab === 'unread',
				limit: 100
			});
			setNotifications(response.notifications || []);
			setGroupedNotifications(response.grouped || {});
			setUnreadCount(response.unreadCount || 0);
		} catch (error) {
			console.error('Error fetching notifications:', error);
		} finally {
			setLoadingNotifications(false);
		}
	};

	const handleMarkAsRead = async (notificationId: string) => {
		try {
			await api.markNotificationAsRead(notificationId);
			// Update local state
			setNotifications(prev => prev.map(n => 
				n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
			));
			setUnreadCount(prev => Math.max(0, prev - 1));
		} catch (error) {
			console.error('Error marking notification as read:', error);
		}
	};

	const handleNotificationClick = async (notification: any) => {
		// Mark as read if unread
		if (!notification.isRead) {
			await handleMarkAsRead(notification.id);
		}

		// Navigate to the notification link if it exists
		if (notification.link) {
			// Close the notification sidebar
			setShowNotificationSidebar(false);
			// Navigate to the link
			router.push(notification.link);
		}
	};

	const handleMarkAllAsRead = async () => {
		try {
			await api.markAllNotificationsAsRead();
			// Update local state
			setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date() })));
			setUnreadCount(0);
		} catch (error) {
			console.error('Error marking all notifications as read:', error);
		}
	};

	const handleClearAllNotifications = async () => {
		if (notifications.length === 0) return;
		try {
			setClearingNotifications(true);
			await api.deleteAllNotifications();
			// Update local state
			setNotifications([]);
			setGroupedNotifications({});
			setUnreadCount(0);
		} catch (error) {
			console.error('Error clearing all notifications:', error);
		} finally {
			setClearingNotifications(false);
		}
	};

	// Helper function to get icon for notification type
	const getNotificationIcon = (type: string) => {
		switch (type) {
			case 'APPOINTMENT_CONFIRMED':
			case 'APPOINTMENT_CANCELLED':
			case 'APPOINTMENT_REMINDER':
				return Calendar;
			case 'NEW_REVIEW':
				return UserCheck;
			case 'PAYMENT_RECEIVED':
			case 'PAYMENT_APPROVED':
			case 'PAYMENT_REJECTED':
				return CreditCard;
			case 'NEW_CLIENT':
				return Users;
			case 'INVOICE_GENERATED':
				return FileText;
			case 'SYSTEM_UPDATE':
				return Building;
			default:
				return Bell;
		}
	};

	// Helper function to format time ago
	const formatTimeAgo = (date: Date | string) => {
		const now = new Date();
		const notificationDate = new Date(date);
		const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);
		
		if (diffInSeconds < 60) return 'Il y a quelques secondes';
		if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) > 1 ? 's' : ''}`;
		if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} heure${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''}`;
		if (diffInSeconds < 604800) return `Il y a ${Math.floor(diffInSeconds / 86400)} jour${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''}`;
		
		// Format date for older notifications
		return notificationDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
	};

	const handleLogout = () => {
		setShowLogoutConfirm(true);
	};

	const confirmLogout = () => {
		disconnectRealtime();
		logout();
		router.push('/login');
	};

	const getSidebarContent = () => {
		if (pathname?.startsWith('/dashboard/personels')) {
				return <PersonnelsSidebar />;
			} else if (pathname?.startsWith('/dashboard/admin')) {
				return <AdminSidebar />;
			} else if (pathname === '/dashboard' || pathname === '/dashboard/rendez-vous') {
				return <RendezVousSidebar />;
			} else if (pathname?.startsWith('/dashboard/clients')) {
			return <ClientsSidebar />;
		} else if (pathname?.startsWith('/dashboard/caisse')) {
			return (
				<CaisseSidebar
					methodFilter={caisseMethodFilter}
					setMethodFilter={setCaisseMethodFilter}
					typeFilter={caisseTypeFilter}
					setTypeFilter={setCaisseTypeFilter}
					selectedPeriod={caissePeriod}
					setSelectedPeriod={setCaissePeriod}
				/>
			);
		}
		return <RendezVousSidebar />;
	};

	return (
		<>
			{/* Modern Top Bar */}
			<header className="fixed top-0 left-68 right-0 h-20 backdrop-blur-lg border-b border-gray-200/50 z-40">
				<div className="h-full ml-0 px-8 flex items-center justify-between">
					{/* Left Section - Navigation */}
					<nav className="flex items-center gap-2">
						{menuItems.map((item) => {
							const Icon = item.icon;
							// Make 'Clients' active for all /dashboard/clients routes
							const isActive = item.href === '/dashboard/clients/fichier-client/gestion'
							  ? pathname?.startsWith('/dashboard/clients')
							  : pathname === item.href;
							return (
								<Link
									key={item.href}
									href={item.href}
									className={`relative px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 inline-flex items-center gap-2.5 ${
										isActive
											? 'bg-[#002366] text-white'
											: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
									}`}
								>
									<Icon size={18} strokeWidth={2.5} />
									<span>{item.name}</span>
								</Link>
							);
						})}
					</nav>

					{/* Right Section - Actions & Profile */}
					<div className="flex items-center gap-3">
						{/* Global multi-salon filter */}
						{mounted && salons.length > 1 && (
							<SalonFilterControl />
						)}

						{/* Notifications */}
						<button className="relative p-2.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all" onClick={() => setShowNotificationSidebar(true)} title="Notifications">
							<Bell size={20} strokeWidth={2} />
							{unreadCount > 0 && (
								<span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
									{unreadCount > 99 ? '+99' : unreadCount}
								</span>
							)}
						</button>
						
						{/* Divider */}
						<div className="w-px h-8 bg-gray-200"></div>

						{/* User Profile — click to open the profile editor (avatar + password) */}
						<button
							onClick={() => setShowProfileModal(true)}
							className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-50 transition-colors text-left"
							title="Modifier mon profil"
						>
							<div className="text-right">
								<p className="text-sm font-semibold text-gray-900 leading-tight">
									{mounted ? (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'User') : ''}
								</p>
								<p className="text-xs text-gray-500 leading-tight mt-0.5">
									{mounted ? user?.email || 'admin@example.com' : ''}
								</p>
							</div>
							<div className="relative">
							{user?.avatar ? (
								<img src={user.avatar} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
							) : (
									<div className="w-10 h-10 rounded-full bg-[#002366] flex items-center justify-center">
										<span className="text-white font-semibold text-sm">
											{mounted ? (user?.firstName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U') : ''}
										</span>
									</div>
								)}
								<div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
							</div>
						</button>

						{/* Logout */}
						{mounted && (
							<button
								onClick={handleLogout}
								className="p-2.5 rounded-full text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all ml-1"
								title="Se déconnecter"
							>
								<LogOut size={20} strokeWidth={2} />
							</button>
						)}
					</div>
				</div>
			</header>

			{/* Profile Editor Modal (avatar + password) */}
			<ProfileModal open={showProfileModal} onOpenChange={setShowProfileModal} />

			{/* Logout Confirmation Dialog */}
			<ConfirmDialog
				open={showLogoutConfirm}
				onOpenChange={setShowLogoutConfirm}
				onConfirm={confirmLogout}
				title="Se déconnecter"
				description="Êtes-vous sûr de vouloir vous déconnecter ?"
				confirmText="Se déconnecter"
				cancelText="Annuler"
				variant="destructive"
			/>

			{/* Clear Notifications Confirmation Dialog */}
			<ConfirmDialog
				open={showClearNotificationsConfirm}
				onOpenChange={setShowClearNotificationsConfirm}
				onConfirm={handleClearAllNotifications}
				title="Effacer toutes les notifications ?"
				description="Cette action est irréversible. Toutes les notifications de cet établissement seront supprimées."
				confirmText="Tout effacer"
				cancelText="Annuler"
				variant="destructive"
				loading={clearingNotifications}
			/>

			{/* Sidebar */}
			<aside className="fixed left-0 top-0 w-66 bg-white h-screen flex flex-col border-r border-gray-200 z-50">
				<div className="p-6 pb-4">
					<div className="flex items-center justify-between">
						<h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
							<img src="/logos/logo-blue.svg" alt="Logo" className="w-6 h-6 ml-2" />

							Reza Pro
						</h1>
						{/* <button className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all" aria-label="Collapse sidebar">
							<LayoutPanelLeft size={22} className="text-gray-400" />
						</button>*/}
					</div>
				</div>

				{getSidebarContent()}
			</aside>

			{/* Notification Sidebar (right) */}
	{showNotificationSidebar && (
		<>
			
			
			<div ref={notificationSidebarRef} className="fixed top-0 right-0 h-screen w-[480px] bg-white shadow-lg z-50 transition-transform duration-300 animate-slideIn flex flex-col">
				{/* Header - Ultra Minimalist */}
				<div className="px-8 py-8 border-b border-gray-100">
					<div className="flex items-start justify-between mb-6">
						<div>
							<h2 className="text-3xl font-light text-gray-900 tracking-tight">Notifications</h2>
							<p className="text-sm text-gray-400 mt-1 font-light">{unreadCount} non lue{unreadCount !== 1 ? 's' : ''}</p>
						</div>
						<button 
							onClick={() => setShowNotificationSidebar(false)} 
							className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
						>
							<X size={20} />
						</button>
					</div>

					{/* Tabs */}
					<div className="flex items-center gap-1">
						<button
							className={`px-4 py-1.5 text-xs font-medium transition-colors ${notificationTab === 'all' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
							onClick={() => setNotificationTab('all')}
						>
							Toutes
						</button>
						<span className="text-gray-300">/</span>
						<button
							className={`px-4 py-1.5 text-xs font-medium transition-colors ${notificationTab === 'unread' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
							onClick={() => setNotificationTab('unread')}
						>
							Non lues
						</button>
					</div>
				</div>

				{/* Notifications List */}
				<div className="flex-1 overflow-y-auto">
					{loadingNotifications ? (
						<div className="px-8 py-12 text-center text-gray-400">
							<p>Chargement des notifications...</p>
						</div>
					) : notifications.length === 0 ? (
						<div className="px-8 py-12 text-center text-gray-400">
							<p>Aucune notification</p>
						</div>
					) : (
						<>
							{/* Today Section */}
							{groupedNotifications.today && groupedNotifications.today.length > 0 && (
								<div className="px-8 py-6">
									<p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Aujourd'hui</p>
									{groupedNotifications.today
										.filter((n: any) => notificationTab === 'all' || !n.isRead)
										.map((notification: any) => {
											const Icon = getNotificationIcon(notification.type);
											return (
												<div
													key={notification.id}
													onClick={() => handleNotificationClick(notification)}
													className={`group relative bg-white border border-gray-100 rounded-lg p-4 mb-2 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer ${notification.isRead ? 'opacity-60 hover:opacity-100' : ''}`}
												>
													{!notification.isRead && (
														<div className="absolute top-4 right-4 w-1.5 h-1.5 bg-[#002366] rounded-full"></div>
													)}
													<div className={`flex gap-4 ${!notification.isRead ? 'pr-4' : ''}`}>
														<div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
															<Icon size={16} className="text-gray-600" />
														</div>
														<div className="flex-1 min-w-0">
															<p className="text-sm font-medium text-gray-900 mb-1">{notification.title}</p>
															<p className="text-xs text-gray-500 leading-relaxed mb-2">{notification.message}</p>
															<span className="text-xs text-gray-400 font-light">{formatTimeAgo(notification.createdAt)}</span>
														</div>
													</div>
												</div>
											);
										})}
								</div>
							)}
							
							{/* Yesterday Section */}
							{notificationTab === 'all' && groupedNotifications.yesterday && groupedNotifications.yesterday.length > 0 && (
								<div className="px-8 py-6 border-t border-gray-100">
									<p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Hier</p>
									{groupedNotifications.yesterday.map((notification: any) => {
										const Icon = getNotificationIcon(notification.type);
										return (
											<div
												key={notification.id}
												onClick={() => handleNotificationClick(notification)}
												className={`group relative bg-white border border-gray-100 rounded-lg p-4 mb-2 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer ${notification.isRead ? 'opacity-60 hover:opacity-100' : ''}`}
											>
												{!notification.isRead && (
													<div className="absolute top-4 right-4 w-1.5 h-1.5 bg-[#002366] rounded-full"></div>
												)}
												<div className={`flex gap-4 ${!notification.isRead ? 'pr-4' : ''}`}>
													<div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
														<Icon size={16} className="text-gray-600" />
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-gray-900 mb-1">{notification.title}</p>
														<p className="text-xs text-gray-500 leading-relaxed mb-2">{notification.message}</p>
														<span className="text-xs text-gray-400 font-light">{formatTimeAgo(notification.createdAt)}</span>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
							
							{/* This Week Section */}
							{notificationTab === 'all' && groupedNotifications.thisWeek && groupedNotifications.thisWeek.length > 0 && (
								<div className="px-8 py-6 border-t border-gray-100">
									<p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Cette semaine</p>
									{groupedNotifications.thisWeek.map((notification: any) => {
										const Icon = getNotificationIcon(notification.type);
										return (
											<div
												key={notification.id}
												onClick={() => handleNotificationClick(notification)}
												className={`group relative bg-white border border-gray-100 rounded-lg p-4 mb-2 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer ${notification.isRead ? 'opacity-60 hover:opacity-100' : ''}`}
											>
												{!notification.isRead && (
													<div className="absolute top-4 right-4 w-1.5 h-1.5 bg-[#002366] rounded-full"></div>
												)}
												<div className={`flex gap-4 ${!notification.isRead ? 'pr-4' : ''}`}>
													<div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
														<Icon size={16} className="text-gray-600" />
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-gray-900 mb-1">{notification.title}</p>
														<p className="text-xs text-gray-500 leading-relaxed mb-2">{notification.message}</p>
														<span className="text-xs text-gray-400 font-light">{formatTimeAgo(notification.createdAt)}</span>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
							
							{/* Older Section */}
							{notificationTab === 'all' && groupedNotifications.older && groupedNotifications.older.length > 0 && (
								<div className="px-8 py-6 border-t border-gray-100">
									<p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Plus ancien</p>
									{groupedNotifications.older.map((notification: any) => {
										const Icon = getNotificationIcon(notification.type);
										return (
											<div
												key={notification.id}
												onClick={() => handleNotificationClick(notification)}
												className={`group relative bg-white border border-gray-100 rounded-lg p-4 mb-2 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer ${notification.isRead ? 'opacity-60 hover:opacity-100' : ''}`}
											>
												{!notification.isRead && (
													<div className="absolute top-4 right-4 w-1.5 h-1.5 bg-[#002366] rounded-full"></div>
												)}
												<div className={`flex gap-4 ${!notification.isRead ? 'pr-4' : ''}`}>
													<div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
														<Icon size={16} className="text-gray-600" />
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-gray-900 mb-1">{notification.title}</p>
														<p className="text-xs text-gray-500 leading-relaxed mb-2">{notification.message}</p>
														<span className="text-xs text-gray-400 font-light">{formatTimeAgo(notification.createdAt)}</span>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</>
					)}
				</div>

				{/* Footer Actions */}
				<div className="border-t border-gray-100 p-6">
					<button 
						onClick={handleMarkAllAsRead}
						disabled={unreadCount === 0}
						className="w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Marquer tout comme lu
					</button>
					<button
						onClick={() => setShowClearNotificationsConfirm(true)}
						disabled={notifications.length === 0}
						className="w-full py-2.5 text-sm font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
					>
						<Trash2 size={14} />
						Tout effacer
					</button>
				</div>
			</div>
		</>
	)}

			{/* Main Content Wrapper to prevent overlap */}
			<div className="ml-66">
			</div>
		</>
	);
}

// Re-export the individual sidebars so routes/embeddings can import them
// independently (they no longer live in this file).
export {
  RendezVousSidebar,
  ClientsSidebar,
  PersonnelsSidebar,
  AdminSidebar,
  CaisseSidebar,
};
