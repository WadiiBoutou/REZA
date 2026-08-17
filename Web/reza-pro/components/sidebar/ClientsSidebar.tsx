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

import { menuItems } from './shared';

const ClientsSidebar = () => {
	const [mounted, setMounted] = useState(false);
	const [showFichierClient, setShowFichierClient] = useState(true);
	const [showMesAvis, setShowMesAvis] = useState(false);
	const [showStatistiquesClients, setShowStatistiquesClients] = useState(false);
	const pathname = usePathname();

	const menuItems = {
		fichier: [
			{ label: 'Gestion', path: '/dashboard/clients/fichier-client/gestion' },
			{ label: 'Doublons', path: '/dashboard/clients/fichier-client/doublons' }
		],
		avis: [
			{ label: 'Avis à modérer', path: '/dashboard/clients/mes-avis/avis-a-moderer' },
			{ label: 'Avis modérés', path: '/dashboard/clients/mes-avis/avis-moderes' },
			{ label: 'Avis refusés', path: '/dashboard/clients/mes-avis/avis-refuses' }
		],
		stats: [
			{ label: '100 meilleurs clients', path: '/dashboard/clients/statistiques/meilleurs-clients' },
			{ label: 'Nouveaux clients', path: '/dashboard/clients/statistiques/nouveaux-clients' },
			{ label: 'Fréquences globales', path: '/dashboard/clients/statistiques/frequences-globales' },
			{ label: 'Statistiques avis', path: '/dashboard/clients/statistiques/avis' }
		]
	};

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="flex-1 overflow-y-auto p-6">
				<div className="space-y-6">
					<div className="animate-pulse bg-gray-200 h-64 rounded-xl"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-6">
			<div className="space-y-6">
				{/* Fichier Client */}
				<div className="space-y-3">
					<button
						onClick={() => setShowFichierClient(!showFichierClient)}
						className="w-full flex items-center justify-between group"
					>
						<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 group-hover:text-gray-900 transition-colors">
							<FileText size={14} />
							Fichier Client
						</h3>
						<ChevronDown size={14} className={`text-gray-500 transition-transform ${showFichierClient ? 'rotate-180' : ''}`} />
					</button>
					{showFichierClient && (
						<div className="space-y-1 animate-fadeIn">
							{menuItems.fichier.map((item) => (
								<Link
									key={item.path}
									href={item.path}
									className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${
										pathname === item.path ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'
									}`}
								>
									{item.label}
								</Link>
							))}
						</div>
					)}
				</div>

				{/* Mes Avis */}
				<div className="space-y-3">
					<button
						onClick={() => setShowMesAvis(!showMesAvis)}
						className="w-full flex items-center justify-between group"
					>
						<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 group-hover:text-gray-900 transition-colors">
							<UserCheck size={14} />
							Mes Avis
						</h3>
						<ChevronDown size={14} className={`text-gray-500 transition-transform ${showMesAvis ? 'rotate-180' : ''}`} />
					</button>
					{showMesAvis && (
						<div className="space-y-1 animate-fadeIn">
							{menuItems.avis.map((item) => (
								<Link
								key={item.path}
									href={item.path}
									className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${
										pathname === item.path ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'
									}`}
								>
									{item.label}
								</Link>
							))}
						</div>
					)}
				</div>

				{/* Statistiques Clients */}
				<div className="space-y-3">
					<button
						onClick={() => setShowStatistiquesClients(!showStatistiquesClients)}
						className="w-full flex items-center justify-between group"
					>
						<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 group-hover:text-gray-900 transition-colors">
							<TrendingUp size={14} />
							Statistiques Clients
						</h3>
						<ChevronDown size={14} className={`text-gray-500 transition-transform ${showStatistiquesClients ? 'rotate-180' : ''}`} />
					</button>
					{showStatistiquesClients && (
						<div className="space-y-1 animate-fadeIn">
							{menuItems.stats.map((item) => (
								<Link
								key={item.path}
									href={item.path}
									className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${
										pathname === item.path ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'
									}`}
								>
									{item.label}
								</Link>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export { ClientsSidebar };
