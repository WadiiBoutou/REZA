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

const menuItems = [
	{ name: 'Agenda', href: '/dashboard/rendez-vous', icon: Home },
	{ name: 'Personnels', href: '/dashboard/personels/gestion', icon: UserCheck },
	{ name: 'Clients', href: '/dashboard/clients/fichier-client/gestion', icon: Users },
	{ name: 'Caisse', href: '/dashboard/caisse', icon: CreditCard },
	{ name: 'Admin', href: '/dashboard/admin/param-agenda/gestion-de-prestations', icon: Settings2 },
];

/** Align API appointment status with agenda sidebar filter values (same map as rendez-vous page). */
const API_STATUS_TO_FILTER: Record<string, string> = {
	PENDING: 'pending',
	CONFIRMED: 'confirmed',
	IN_PROGRESS: 'in_progress',
	COMPLETED: 'completed',
	CANCELLED: 'cancelled',
	NO_SHOW: 'no_show',
};

function toAgendaFilterStatus(apiStatus: string): string {
	return API_STATUS_TO_FILTER[apiStatus] || String(apiStatus || '').toLowerCase();
}

function appointmentEmployeeName(apt: { employee?: { firstName?: string; lastName?: string } | null }): string {
	if (!apt.employee) return '';
	return `${apt.employee.firstName || ''} ${apt.employee.lastName || ''}`.trim();
}

/** Same rules as agenda grid: status + employee filters (multi-select by name). */
function matchesAgendaFilters(
	apt: {
		status: string;
		employee?: { firstName?: string; lastName?: string } | null;
		services?: Array<{ employee?: { firstName?: string; lastName?: string } | null } | null> | null;
	},
	statusFilter: string,
	selectedEmployees: string[]
): boolean {
	const status = toAgendaFilterStatus(apt.status);
	if (statusFilter !== 'all' && status !== statusFilter) return false;

	if (selectedEmployees.length > 0) {
		const target = selectedEmployees.map((s) => s.trim().toLowerCase());
		// Check per-service employees first (multi-service appointments), then legacy single employee
		if (Array.isArray(apt.services)) {
			for (const s of apt.services) {
				if (s?.employee) {
					const name = `${s.employee.firstName || ''} ${s.employee.lastName || ''}`.trim().toLowerCase();
					if (name && target.includes(name)) return true;
				}
			}
		}
		const name = appointmentEmployeeName(apt);
		if (name && target.includes(name.trim().toLowerCase())) return true;
		return false;
	}
	return true;
}

// Single checkbox row used in the sidebar list and the employee picker modal.
const AgendaEmployeeRow = ({
	checked,
	onClick,
	label,
	subtitle,
	color,
	avatar,
	showDot = true,
}: {
	checked: boolean;
	onClick: () => void;
	label: string;
	subtitle?: string;
	color?: string;
	avatar?: string;
	showDot?: boolean;
}) => (
	<button
		onClick={onClick}
		className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
			checked ? 'bg-[#002366]/5' : 'hover:bg-gray-50'
		}`}
	>
		<span
			className={`w-4 h-4 rounded border grid place-content-center shrink-0 transition-colors ${
				checked ? 'bg-[#002366] border-[#002366]' : 'border-gray-300 bg-white'
			}`}
		>
			{checked && <Check size={10} className="text-white" />}
		</span>
		{showDot &&
			(avatar ? (
				<img src={avatar} alt={label} className="w-4 h-4 rounded-full object-cover shrink-0" />
			) : (
				<span
					className="w-4 h-4 rounded-full shrink-0"
					style={{ backgroundColor: color || '#3B82F6' }}
				/>
			))}
		<span className="min-w-0">
			<span className={`block truncate ${checked ? 'text-[#002366] font-medium' : 'text-gray-700'}`}>
				{label}
			</span>
			{subtitle && <span className="block truncate text-[11px] text-gray-400">{subtitle}</span>}
		</span>
	</button>
);

// Sidebar content components remain the same
const RendezVousSidebar = () => {
	const { isAuthenticated, salonFilter, effectiveSalonIds, isSalonFilterMulti, salons } = useAuth();
	const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
	const [mounted, setMounted] = useState(false);
	const [selectedDate, setSelectedDate] = useState(() => {
		const date = new Date();
		date.setHours(0, 0, 0, 0);
		return date;
	});
	// Multi-select employee filter: empty array = show everyone ('Tous').
	const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
	const [showEmployeeModal, setShowEmployeeModal] = useState(false);
	const [employeeModalSearch, setEmployeeModalSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [monthYear, setMonthYear] = useState('');
	const [employees, setEmployees] = useState<Array<{id: string, name: string, color: string, avatar?: string, salonName?: string}>>([]);
	const [monthAppointments, setMonthAppointments] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	// Fetch employees from API (single-salon filter)
	useEffect(() => {
		if (!isAuthenticated) return;
		
		const fetchEmployees = async () => {
			try {
				setLoading(true);
				const response = await api.getEmployees({ active: true });
				const employeesData = response.employees || [];
				
				const transformed = employeesData.map((emp: any) => {
					const agendaSettings = emp.agendaSettings || {};
					const name = `${emp.firstName} ${emp.lastName}`;
					const color = agendaSettings.color || '#3B82F6';
					return {
						id: emp.id,
						name,
						color,
						avatar: emp.avatar || undefined,
						salonName: salons.find((s) => s.id === emp.tenantId)?.name,
					};
				});
				
				setEmployees(transformed);
			} catch (err) {
				console.error('Error fetching employees:', err);
				setEmployees([]);
			} finally {
				setLoading(false);
			}
		};
		
		fetchEmployees();
	}, [isAuthenticated, salonFilterKey, salons]);

	// Broadcast the employee + status filters. The agenda page listens for these;
	// after a salon switch the page remounts (layout salonKey), so we re-emit on
	// salon change and answer the page's 'rendezVousPageReady' request to stay in sync.
	const dispatchEmployeeFilter = (next: string[]) => {
		setSelectedEmployees(next);
		window.dispatchEvent(new CustomEvent('employeeFilterChange', { detail: next }));
	};

	const toggleAllEmployees = () => {
		dispatchEmployeeFilter([]);
	};

	const toggleEmployee = (name: string) => {
		const has = selectedEmployees.includes(name);
		const next = has ? selectedEmployees.filter((n) => n !== name) : [...selectedEmployees, name];
		dispatchEmployeeFilter(next);
	};

	useEffect(() => {
		const syncFilters = () => {
			window.dispatchEvent(new CustomEvent('employeeFilterChange', { detail: selectedEmployees }));
			window.dispatchEvent(new CustomEvent('statusFilterChange', { detail: statusFilter }));
		};
		syncFilters();
		window.addEventListener('rendezVousPageReady', syncFilters);
		return () => window.removeEventListener('rendezVousPageReady', syncFilters);
	}, [selectedEmployees, statusFilter, salonFilterKey]);

	// Fetch month appointments; day dots derived from filtered set below
	useEffect(() => {
		if (!isAuthenticated || !mounted) return;
		
		const fetchAppointments = async () => {
			try {
				const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
				monthStart.setHours(0, 0, 0, 0);
				const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
				monthEnd.setHours(23, 59, 59, 999);
				
				const response = await api.getAppointments({
					startDate: monthStart.toISOString(),
					endDate: monthEnd.toISOString(),
					limit: 1000
				});
				
				setMonthAppointments(response.appointments || []);
			} catch (err) {
				console.error('Error fetching appointments:', err);
				setMonthAppointments([]);
			}
		};
		
		fetchAppointments();
	}, [isAuthenticated, mounted, selectedDate, salonFilterKey]);

	// Day dots = counts after same statut + employé filters as agenda list
	const appointmentsByDate = useMemo(() => {
		const counts: Record<string, number> = {};
		monthAppointments.forEach((apt: any) => {
			if (!matchesAgendaFilters(apt, statusFilter, selectedEmployees)) return;
			const date = new Date(apt.startTime);
			const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
			counts[dateKey] = (counts[dateKey] || 0) + 1;
		});
		return counts;
	}, [monthAppointments, statusFilter, selectedEmployees]);
	
	useEffect(() => {
		setMounted(true);
		
		// Listen for main calendar date changes
		const handleMainCalendarDateChange = (event: CustomEvent) => {
			setSelectedDate(new Date(event.detail));
		};
		
		window.addEventListener('mainCalendarDateChange', handleMainCalendarDateChange as EventListener);
		
		return () => {
			window.removeEventListener('mainCalendarDateChange', handleMainCalendarDateChange as EventListener);
		};
	}, []);

	useEffect(() => {
		if (mounted) {
			setMonthYear(selectedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
		}
	}, [selectedDate, mounted]);

	const getDaysInMonth = () => {
		const year = selectedDate.getFullYear();
		const month = selectedDate.getMonth();
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
		
		const days = [];
		for (let i = 0; i < adjustedFirstDay; i++) {
			days.push(null);
		}
		for (let i = 1; i <= daysInMonth; i++) {
			days.push(i);
		}
		return days;
	};

	const handleDayClick = (day: number | null) => {
		if (!day) return;
		const year = selectedDate.getFullYear();
		const month = selectedDate.getMonth();
		const newDate = new Date(year, month, day);
		newDate.setHours(0, 0, 0, 0);
		setSelectedDate(newDate);
		window.dispatchEvent(new CustomEvent('sidebarDateChange', { detail: newDate }));
	};

	const changeMonth = (delta: number) => {
		setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + delta, 1));
	};

	const goToToday = () => {
		setSelectedDate(new Date());
	};

	if (!mounted) {
		return (
			<div className="flex-1 overflow-y-auto p-4">
				<div className="space-y-4">
					<div className="animate-pulse bg-gray-200 h-64 rounded-xl"></div>
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="flex-1 overflow-y-auto p-6">
				<div className="space-y-6">
					<div className="bg-white">
					<div className="flex items-center justify-between mb-4">
						<button
							onClick={() => changeMonth(-1)}
							className="p-1 hover:bg-gray-100 rounded transition-all"
						>
							<ChevronDown size={16} className="rotate-90 text-gray-600" />
						</button>
						<h3 className="text-sm font-semibold text-gray-900">
							{monthYear}
						</h3>
						<button
							onClick={() => changeMonth(1)}
							className="p-1 hover:bg-gray-100 rounded transition-all"
						>
							<ChevronDown size={16} className="-rotate-90 text-gray-600" />
						</button>
					</div>
					<div className="grid grid-cols-7 gap-1 mb-2">
						{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
							<div key={i} className="text-center text-xs font-medium text-gray-500 py-1">
								{day}
							</div>
						))}
					</div>
					<div className="grid grid-cols-7 gap-1">
						{getDaysInMonth().map((day, i) => {
							const isSelected = day === selectedDate.getDate();
							const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
							const appointmentCount = appointmentsByDate[dateKey] || 0;
							
							return day ? (
								<button
									key={i}
									onClick={() => handleDayClick(day)}
									className={`aspect-square rounded-md text-xs font-medium transition-all relative ${
										isSelected
											? 'bg-[#4ADE80] text-white'
											: 'text-gray-700 hover:bg-gray-100'
									}`}
								>
									{day}
									{appointmentCount > 0 && (
										<span className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${
											isSelected ? 'bg-white' : 'bg-[#002366]'
										}`}></span>
									)}
								</button>
							) : (
								<div key={i} className="aspect-square"></div>
							);
						})}
					</div>
				</div>

				<div className="space-y-3">
					<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
						<UserCheck size={14} />
						Employés
						{selectedEmployees.length > 0 && (
							<span className="ml-auto text-[10px] font-semibold bg-[#002366] text-white rounded-full px-2 py-0.5">
								{selectedEmployees.length} sélectionné{selectedEmployees.length > 1 ? 's' : ''}
							</span>
						)}
					</h3>
					{loading ? (
						<div className="flex items-center justify-center py-4">
							<div className="animate-pulse text-xs text-gray-400">Chargement...</div>
						</div>
					) : (
						<>
							<div className="space-y-0.5">
								<AgendaEmployeeRow
									checked={selectedEmployees.length === 0}
									onClick={toggleAllEmployees}
									label="Tous"
									showDot={false}
								/>
								{employees.slice(0, 5).map((employee) => (
									<AgendaEmployeeRow
										key={employee.id}
										checked={selectedEmployees.includes(employee.name)}
										onClick={() => toggleEmployee(employee.name)}
										label={employee.name}
										subtitle={isSalonFilterMulti ? employee.salonName : undefined}
										color={employee.color}
										avatar={employee.avatar}
									/>
								))}
							</div>
							{employees.length > 5 && (
								<button
									onClick={() => setShowEmployeeModal(true)}
									className="w-full text-left px-2 py-1.5 text-xs font-semibold text-[#002366] hover:bg-[#002366]/5 rounded-lg transition-colors"
								>
									+{employees.length - 5} Afficher plus
								</button>
							)}
							{employees.length === 0 && (
								<p className="text-xs text-gray-400 px-2">Aucun employé actif</p>
							)}
						</>
					)}
				</div>

				<div className="space-y-3">
					<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
						<Filter size={14} />
						Statut
					</h3>
					<div className="flex flex-wrap gap-2">
						{[
							{ value: 'all', label: 'Tous', color: 'gray' },
							{ value: 'confirmed', label: 'Confirmé', color: 'green' },
							{ value: 'pending', label: 'En attente', color: 'yellow' },
							{ value: 'completed', label: 'Terminé', color: 'emerald' },
							{ value: 'cancelled', label: 'Annulé', color: 'red' },
							{ value: 'no_show', label: 'Absent', color: 'orange' }
						].map((status) => (
							<button
								key={status.value}
								onClick={() => {
									setStatusFilter(status.value);
									// Dispatch event for the rendez-vous page to listen to
									window.dispatchEvent(new CustomEvent('statusFilterChange', { detail: status.value }));
								}}
								className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105 ${
									statusFilter === status.value
										? status.color === 'gray'
											? 'bg-[#002366] text-white'
											: status.color === 'green'
											? 'bg-[#002366] text-white'
											: status.color === 'yellow'
											? 'bg-[#002366] text-white'
											: 'bg-[#002366] text-white'
										: 'bg-gray-100 text-gray-600 hover:bg-gray-200'
								}`}
							>
								{status.label}
							</button>
						))}
					</div>
				</div>
			</div>

				{/* Employee filter modal (shared selection state with the sidebar list) */}
				{showEmployeeModal && (
					<div
						className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4"
						onClick={() => setShowEmployeeModal(false)}
					>
						<div
							className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
								<h3 className="text-lg font-semibold text-gray-900">Filtrer par employé</h3>
								<button
									onClick={() => setShowEmployeeModal(false)}
									className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
								>
									<X size={18} />
								</button>
							</div>

							<div className="px-6 py-3 border-b border-gray-100">
								<div className="relative">
									<Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
									<input
										type="text"
										value={employeeModalSearch}
										onChange={(e) => setEmployeeModalSearch(e.target.value)}
										placeholder="Rechercher un employé..."
										className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent"
									/>
								</div>
							</div>

							<div className="flex-1 overflow-y-auto px-3 py-2">
								<AgendaEmployeeRow
									checked={selectedEmployees.length === 0}
									onClick={toggleAllEmployees}
									label="Tous"
									showDot={false}
								/>
								{employees
									.filter((emp) =>
										emp.name.toLowerCase().includes(employeeModalSearch.trim().toLowerCase()) ||
										(emp.salonName || '').toLowerCase().includes(employeeModalSearch.trim().toLowerCase())
									)
									.map((emp) => (
										<AgendaEmployeeRow
											key={emp.id}
											checked={selectedEmployees.includes(emp.name)}
											onClick={() => toggleEmployee(emp.name)}
											label={emp.name}
											subtitle={isSalonFilterMulti ? emp.salonName : undefined}
											color={emp.color}
											avatar={emp.avatar}
										/>
									))}
								{employees.filter((emp) =>
									emp.name.toLowerCase().includes(employeeModalSearch.trim().toLowerCase()) ||
									(emp.salonName || '').toLowerCase().includes(employeeModalSearch.trim().toLowerCase())
								).length === 0 && (
									<p className="px-2 py-4 text-center text-xs text-gray-400">Aucun employé trouvé</p>
								)}
							</div>

							<div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
								<span className="text-xs text-gray-500">
									{selectedEmployees.length} sélectionné{selectedEmployees.length > 1 ? 's' : ''}
								</span>
								<button
									onClick={() => setShowEmployeeModal(false)}
									className="px-5 py-2 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
								>
									Terminé
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</>
	);
};

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

const CaisseSidebar = ({
  methodFilter,
  setMethodFilter,
  typeFilter,
  setTypeFilter,
  selectedPeriod,
  setSelectedPeriod
}: {
  methodFilter: string;
  setMethodFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  selectedPeriod: string;
  setSelectedPeriod: (v: string) => void;
}) => {
  // Dynamic payment methods: only the methods the salon actually configured
  // (any language / spelling) appear in the filter — never a hardcoded list.
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .getAcceptedPaymentMethods()
      .then((res) => {
        if (!cancelled && res.methods && res.methods.length > 0) {
          setPaymentMethods(res.methods);
        }
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const methods = paymentMethods.length > 0 ? paymentMethods : ['Espèces', 'Carte', 'Virement', 'Chèque'];
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <CreditCard size={14} />
            Filtres Caisse
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-2">Méthode</label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-full px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                  <SelectValue placeholder="Sélectionner la méthode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {methods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="Vente">Vente</SelectItem>
                  <SelectItem value="Remboursement">Remboursement</SelectItem>
                  <SelectItem value="Dépôt">Dépôt</SelectItem>
                  <SelectItem value="Retrait">Retrait</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Période</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-full px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                  <SelectValue placeholder="Sélectionner la période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Aujourd'hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                  <SelectItem value="all">Tout</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

			// Appointment notifications: open the agenda on the appointment's day
			// (select that day on the calendar, matching the sidebar mini-calendar).
			const isAppointment = String(notification.type || '').startsWith('APPOINTMENT');
			const meta = notification.metadata || {};
			const appointmentId = meta.appointmentId || meta.appointmentIds?.[0];
			if (isAppointment && appointmentId) {
				try {
					const appointment = await api.getAppointment(appointmentId);
					if (appointment?.startTime) {
						const day = new Date(appointment.startTime);
						day.setHours(0, 0, 0, 0);
						// Persist so a fresh mount of the agenda page picks it up
						try {
							sessionStorage.setItem('rdv:currentDate', day.toISOString());
						} catch {}
						// If the agenda is already mounted, select the day live
						window.dispatchEvent(new CustomEvent('sidebarDateChange', { detail: day }));
					}
				} catch (error) {
					console.error('Error resolving appointment date for notification:', error);
				}
			}

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