'use client';

// Shared helpers for the sidebar family — extracted from components/Sidebar.tsx
// so each sidebar is importable independently.
import { Home, UserCheck, Users, CreditCard, Settings2, Check } from 'lucide-react';

const menuItems = [
	{ name: 'Agenda', href: '/dashboard/rendez-vous', icon: Home },
	{ name: 'Personnels', href: '/dashboard/personels/gestion', icon: UserCheck },
	{ name: 'Clients', href: '/dashboard/clients/fichier-client/gestion', icon: Users },
	{ name: 'Caisse', href: '/dashboard/caisse', icon: CreditCard },
	{ name: 'Admin', href: '/dashboard/admin/param-agenda/gestion-de-prestations', icon: Settings2 },
];
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

export {
  menuItems,
  API_STATUS_TO_FILTER,
  toAgendaFilterStatus,
  appointmentEmployeeName,
  matchesAgendaFilters,
  AgendaEmployeeRow,
};
