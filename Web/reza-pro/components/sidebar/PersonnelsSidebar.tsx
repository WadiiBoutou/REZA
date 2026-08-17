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

const PersonnelsSidebar = () => {
	const [mounted, setMounted] = useState(false);
	const pathname = usePathname();

	const linkClass = (href: string) =>
		`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${pathname?.startsWith(href) ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'}`;

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
			<div className="space-y-1">
				<Link href="/dashboard/personels/gestion" className={linkClass('/dashboard/personels/gestion')}>
					Gestion des employés
				</Link>
				<Link
					href="/dashboard/personels/statistiques"
					className={linkClass('/dashboard/personels/statistiques')}
				>
					Statistiques
				</Link>
				<Link
					href="/dashboard/personels/taux-occupation"
					className={linkClass('/dashboard/personels/taux-occupation')}
				>
					Taux d'occupation
				</Link>
			</div>
		</div>
	);
};

export { PersonnelsSidebar };
