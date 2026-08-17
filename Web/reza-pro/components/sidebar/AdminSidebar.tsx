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

const AdminSidebar = () => {
	const [mounted, setMounted] = useState(false);
	const [showParamAgenda, setShowParamAgenda] = useState(true);
	const [showParamEtablissement, setShowParamEtablissement] = useState(false);
	const [showStatistiquesRDV, setShowStatistiquesRDV] = useState(false);
	const [showTauxOccupation, setShowTauxOccupation] = useState(false);
	const [showCorbeilleRDV, setShowCorbeilleRDV] = useState(false);
	const [showMesFactures, setShowMesFactures] = useState(false);
	const pathname = usePathname();

	const paramAgendaLinks = [
	    { label: 'Gestion de prestations', path: '/dashboard/admin/param-agenda/gestion-de-prestations' },
		{ label: 'Gestion affichage RDV', path: '/dashboard/admin/param-agenda/gestion-affichage-rdv' },
	];

	const paramEtablissementLinks = [
		{ label: 'Informations Landing Page', path: '/dashboard/admin/param-etablissement/informations-landing-page' },
		{ label: 'Horaires', path: '/dashboard/admin/param-etablissement/gestion-horaires-delais' },
		{ label: 'Notifications RDV Web', path: '/dashboard/admin/param-etablissement/notifications-rdv-web' },
		{ label: 'Moyen de paiement', path: '/dashboard/admin/param-etablissement/moyen-de-paiement' },
	];

	const statistiquesRDVLinks = [
	    { label: 'Indicateurs clés', path: '/dashboard/admin/statistiques-rdv/indicateurs-cles' },
	    { label: 'Autres indicateurs', path: '/dashboard/admin/statistiques-rdv/autres' },
	    { label: 'Prestations', path: '/dashboard/admin/statistiques-rdv/prestations' },
    { label: 'RDV', path: '/dashboard/admin/statistiques-rdv/rdv' },
	];

	useEffect(() => {
		setMounted(true);
		// Auto-expand sections based on current path
		if (pathname?.startsWith('/dashboard/admin/param-etablissement')) {
			setShowParamEtablissement(true);
		}
		if (pathname?.startsWith('/dashboard/admin/param-agenda')) {
			setShowParamAgenda(true);
		}
		if (pathname?.startsWith('/dashboard/admin/statistiques-rdv')) {
			setShowStatistiquesRDV(true);
		}
		if (pathname?.startsWith('/dashboard/admin/taux-occupation')) {
			setShowTauxOccupation(true);
		}
		if (pathname?.startsWith('/dashboard/admin/corbeille-rdv')) {
			setShowCorbeilleRDV(true);
		}
		if (pathname?.startsWith('/dashboard/admin/mes-factures') || pathname?.startsWith('/dashboard/admin/mon-abonnement')) {
			setShowMesFactures(true);
		}
	}, [pathname]);

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
				{/* Mes salons */}
				<div className="space-y-3">
					<Link
						href="/dashboard/admin/salons/mes-salons"
						className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${
							pathname?.startsWith('/dashboard/admin/salons/mes-salons')
								? 'bg-[#002366] text-white'
								: 'text-gray-700 hover:bg-gray-100'
						}`}
					>
						Mes salons
					</Link>
				</div>

				{/* Paramétrage Agenda */}
				<div className="space-y-3">
					<button
						onClick={() => setShowParamAgenda(!showParamAgenda)}
						className="w-full flex items-center justify-between group"
					>
						<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 group-hover:text-gray-900 transition-colors">
							<Settings2 size={14} />
							Agenda
						</h3>
						<ChevronDown size={14} className={`text-gray-500 transition-transform ${showParamAgenda ? 'rotate-180' : ''}`} />
					</button>
					{showParamAgenda && (
						<div className="space-y-1 animate-fadeIn">
							{paramAgendaLinks.map((item) => (
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

				{/* Paramètre Établissement */}
				<div className="space-y-3">
					<button
						onClick={() => setShowParamEtablissement(!showParamEtablissement)}
						className="w-full flex items-center justify-between group"
					>
						<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 group-hover:text-gray-900 transition-colors">
							<Settings2 size={14} />
							Établissement
						</h3>
						<ChevronDown size={14} className={`text-gray-500 transition-transform ${showParamEtablissement ? 'rotate-180' : ''}`} />
					</button>
					{showParamEtablissement && (
						<div className="space-y-1 animate-fadeIn">
							{paramEtablissementLinks.map((item) => (
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


				{/* Statistiques RDV (new section at the bottom) */}
				<div className="space-y-3">
                    <button
                        onClick={() => setShowStatistiquesRDV(!showStatistiquesRDV)}
                        className="w-full flex items-center justify-between group"
                    >
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 group-hover:text-gray-900 transition-colors">
                            <BarChart3 size={14} />
                            Statistiques RDV
                        </h3>
                        <ChevronDown size={14} className={`text-gray-500 transition-transform ${showStatistiquesRDV ? 'rotate-180' : ''}`} />
                    </button>
                    {showStatistiquesRDV && (
                        <div className="space-y-1 animate-fadeIn">
                            {statistiquesRDVLinks.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${pathname === item.path ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Taux d'occupation Section */}
                <div className="space-y-3">
                    <button
                        onClick={() => setShowTauxOccupation(!showTauxOccupation)}
                        className="w-full flex items-center justify-between group"
                    >
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 group-hover:text-gray-900 transition-colors">
                            <TrendingUp size={14} />
                            Taux d'occupation
                        </h3>
                        <ChevronDown size={14} className={`text-gray-500 transition-transform ${showTauxOccupation ? 'rotate-180' : ''}`} />
                    </button>
                    {showTauxOccupation && (
                        <div className="space-y-1 animate-fadeIn">
                            <Link
                                href="/dashboard/admin/taux-occupation/vue-ensemble"
                                className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${pathname === '/dashboard/admin/taux-occupation/vue-ensemble' ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                                Vue d'ensemble
                            </Link>
                            <Link
                                href="/dashboard/admin/taux-occupation/prestations"
                                className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${pathname === '/dashboard/admin/taux-occupation/prestations' ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                                Prestations
                            </Link>
                        </div>
                    )}
                </div>

                {/* Corbeille RDV Section */}
                <div className="space-y-3">
                    <button
                        onClick={() => setShowCorbeilleRDV(!showCorbeilleRDV)}
                        className="w-full flex items-center justify-between group"
                    >
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 group-hover:text-gray-900 transition-colors">
                            <Trash2 size={14} />
                            Corbeille RDV
                        </h3>
                        <ChevronDown size={14} className={`text-gray-500 transition-transform ${showCorbeilleRDV ? 'rotate-180' : ''}`} />
                    </button>
                    {showCorbeilleRDV && (
                        <div className="space-y-1 animate-fadeIn">
                            <Link
                                href="/dashboard/admin/corbeille-rdv/rdv-annules"
                                className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${pathname === '/dashboard/admin/corbeille-rdv/rdv-annules' ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                                RDV annulés
                            </Link>
                        </div>
                    )}
                </div>

				{/* Mes factures Section */}
				<div className="space-y-3">
					<button
						onClick={() => setShowMesFactures(!showMesFactures)}
						className="w-full flex items-center justify-between group"
					>
						<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 group-hover:text-gray-900 transition-colors">
							<File size={14} />
							Abonnement &amp; Factures
						</h3>
						<ChevronDown size={14} className={`text-gray-500 transition-transform ${showMesFactures ? 'rotate-180' : ''}`} />
					</button>
					{showMesFactures && (
						<div className="space-y-1 animate-fadeIn">
							<Link
								href="/dashboard/admin/mes-factures"
								className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${pathname === '/dashboard/admin/mes-factures' ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
							>
								Mes factures
							</Link>
							<Link
								href="/dashboard/admin/mon-abonnement"
								className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${pathname === '/dashboard/admin/mon-abonnement' ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
							>
								Mon abonnement
							</Link>
							<Link
								href="/dashboard/admin/mes-factures/moyen-paiement-plateforme"
								className={`block w-full px-3 py-2 text-left text-sm rounded-full transition-all ${pathname === '/dashboard/admin/mes-factures/moyen-paiement-plateforme' ? 'bg-[#002366] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
							>
								Moyen de paiement plateforme
							</Link>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export { AdminSidebar };
