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

import { matchesAgendaFilters, AgendaEmployeeRow, toAgendaFilterStatus, appointmentEmployeeName } from './shared';

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

export { RendezVousSidebar };
