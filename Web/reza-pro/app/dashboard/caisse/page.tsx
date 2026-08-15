'use client';

import { useState, useEffect, useRef, Suspense, Fragment } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DollarSign, RefreshCcw, Download, Plus, Search, Filter, Calendar, Users, X, ChevronDown, ChevronUp, ChevronRight, TrendingUp, TrendingDown, Wallet, Receipt, Clock, BarChart3, PieChart, Eye, Printer, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { generateCaissePDF } from '@/components/CaissePrintDocument';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface TransactionItem {
  serviceName: string;
  price: number;
  quantity: number;
  employeeName?: string;
  participantName?: string;
}

interface Transaction {
  id: string;
  type: 'Vente' | 'Remboursement' | 'Dépôt' | 'Retrait';
  amount: number;
  method: string;
  client?: string;
  employee?: string;
  date: Date;
  note?: string;
  category?: string;
  invoiceId?: string;
  items?: TransactionItem[];
  /** Booking group ID for group invoices */
  bookingGroupId?: string | null;
  /** Number of participants in the group (for display) */
  participantCount?: number;
}

// API Invoice type
type ApiInvoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  tax: number;
  total: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHECK' | 'ONLINE' | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  } | null;
  items?: Array<{
    id: string;
    serviceId: string | null;
    serviceName: string;
    price: number;
    quantity: number;
    /** Per-item employee — set when a manual caisse sale assigns an employee per service */
    employee?: { firstName: string; lastName: string } | null;
    /** Participant name for group billing */
    participantName?: string | null;
  }>;
  appointment: {
    id: string;
    startTime: string;
    service: {
      name: string;
    };
    employee: {
      firstName: string;
      lastName: string;
    } | null;
    /** Per-service employee info from AppointmentServiceItem */
    services?: Array<{
      id: string;
      serviceId: string | null;
      serviceName: string;
      employeeId: string | null;
      employee?: { firstName: string; lastName: string } | null;
    }>;
    /** Participant display name for group-booked appointments */
    bookingParticipant?: {
      displayName: string;
    } | null;
  } | null;
  /** Top-level employee — populated for manual caisse sales with an assigned employee (no appointment) */
  employee?: {
    firstName: string;
    lastName: string;
  } | null;
  /** Booking group ID for group invoices */
  bookingGroupId?: string | null;
  /** Booking group with participant data for employee resolution */
  bookingGroup?: {
    id: string;
    participants?: Array<{
      displayName: string;
      clientId?: string | null;
      appointment?: {
        services?: Array<{
          serviceName: string;
          employeeId?: string | null;
          employee?: { firstName: string; lastName: string } | null;
        }>;
      } | null;
    }>;
  } | null;
};

type CatalogService = {
  id: string;
  name: string;
  price: number | null;
  priceFrom?: number | null;
  tenantId?: string;
};

type ModalMode = 'sale' | 'movement';

const PAYMENT_METHOD_TO_API: Record<string, 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHECK' | 'ONLINE'> = {
  Espèces: 'CASH',
  Carte: 'CARD',
  Virement: 'BANK_TRANSFER',
  Chèque: 'CHECK',
};

const emptySaleForm = () => ({
  serviceIds: [] as string[],
  amount: 0,
  method: 'Espèces',
  clientId: '',
  /** Per-service employee assignments: serviceId -> employeeId (empty string = unassigned) */
  serviceEmployees: {} as Record<string, string>,
  note: '',
  tenantId: '',
});

const emptyMovementForm = () => ({
  type: 'Dépôt' as 'Dépôt' | 'Retrait' | 'Remboursement',
  amount: 0,
  method: 'Espèces',
  note: '',
  tenantId: '',
});

interface CaissePageProps {
  methodFilter?: string;
  typeFilter?: 'all' | 'Vente' | 'Remboursement' | 'Dépôt' | 'Retrait';
  selectedPeriod?: 'day' | 'week' | 'month' | 'all';
  setMethodFilter?: (filter: 'all' | 'Espèces' | 'Carte' | 'Virement' | 'Chèque') => void;
  setTypeFilter?: (filter: 'all' | 'Vente' | 'Remboursement' | 'Dépôt' | 'Retrait') => void;
  setSelectedPeriod?: (period: 'day' | 'week' | 'month' | 'all') => void;
}

function CaissePageContent({
  methodFilter: propMethodFilter,
  typeFilter: propTypeFilter,
  selectedPeriod: propSelectedPeriod,
  setMethodFilter: propSetMethodFilter,
  setTypeFilter: propSetTypeFilter,
  setSelectedPeriod: propSetSelectedPeriod,
}: CaissePageProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, salonFilter, effectiveSalonIds, isSalonFilterMulti, salons } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  
  // Initialize filters from URL params or props or default to 'all'
  const [internalMethodFilter, setInternalMethodFilter] = useState<string>(() => {
    return (searchParams?.get('method') as any) || 'all';
  });
  const [internalTypeFilter, setInternalTypeFilter] = useState<'all' | 'Vente' | 'Remboursement' | 'Dépôt' | 'Retrait'>(() => {
    return (searchParams?.get('type') as any) || 'all';
  });
  const [internalSelectedPeriod, setInternalSelectedPeriod] = useState<'day' | 'week' | 'month' | 'all'>(() => {
    return (searchParams?.get('period') as any) || 'all';
  });
  
  // Sync filters from URL when searchParams change
  useEffect(() => {
    const method = searchParams?.get('method') || 'all';
    const type = searchParams?.get('type') || 'all';
    const period = searchParams?.get('period') || 'all';
    if (method !== internalMethodFilter) setInternalMethodFilter(method as any);
    if (type !== internalTypeFilter) setInternalTypeFilter(type as any);
    if (period !== internalSelectedPeriod) setInternalSelectedPeriod(period as any);
    setCurrentPage(1);
  }, [searchParams]);
  
  // Use props if provided, otherwise use internal state
  const methodFilter = propMethodFilter ?? internalMethodFilter;
  const typeFilter = propTypeFilter ?? internalTypeFilter;
  const selectedPeriod = propSelectedPeriod ?? internalSelectedPeriod;
  const setMethodFilter = propSetMethodFilter ?? setInternalMethodFilter;
  const setTypeFilter = propSetTypeFilter ?? setInternalTypeFilter;
  const setSelectedPeriod = propSetSelectedPeriod ?? setInternalSelectedPeriod;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string; tenantId?: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('sale');
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [amountOverridden, setAmountOverridden] = useState(false);
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<string[]>(['Espèces', 'Carte', 'Virement', 'Chèque']);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  // Group billing modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [pendingGroups, setPendingGroups] = useState<Array<{
    id: string;
    bookerClientId: string;
    participantCount: number;
    participantNames: string[];
    alreadyInvoiced: boolean;
    hasInvoicedAppointment: boolean;
    createdAt: string;
  }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [groupLoading, setGroupLoading] = useState(false);
  // Unique participant id of the payer (NOT clientId — two participants can
  // share a client record, e.g. a guest merged onto the booker's client).
  const [payerParticipantId, setPayerParticipantId] = useState<string>('');
  const [groupPaymentMethod, setGroupPaymentMethod] = useState<string>('Espèces');
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  // Pagination for the pending-groups list (5 groups per page).
  const [groupPage, setGroupPage] = useState(0);
  const GROUP_PAGE_SIZE = 5;
  const [expandedGroupInvoices, setExpandedGroupInvoices] = useState<Set<string>>(new Set());

  const servicePrice = (s: CatalogService) => s.price ?? s.priceFrom ?? 0;

  const saleSalonId =
    saleForm.tenantId ||
    (!isSalonFilterMulti && effectiveSalonIds.length === 1 ? effectiveSalonIds[0] : '');

  const visibleCatalogServices = catalogServices.filter((s) => {
    if (!saleSalonId) return !isSalonFilterMulti;
    return !s.tenantId || s.tenantId === saleSalonId;
  });

  // Clients are per-salon: only those belonging to the sale salon.
  const visibleClients = !saleSalonId
    ? []
    : clients.filter((c) => c.tenantId === saleSalonId);

  const saleSubmitDisabled =
    !saleForm.clientId ||
    saleForm.serviceIds.length === 0 ||
    !saleForm.amount ||
    saleForm.amount <= 0 ||
    (isSalonFilterMulti && !saleForm.tenantId);

  const servicesSum = saleForm.serviceIds.reduce((sum, id) => {
    const s = catalogServices.find((x) => x.id === id);
    return sum + (s ? servicePrice(s) : 0);
  }, 0);

  // Transform API invoice to Transaction
  const transformInvoiceToTransaction = (invoice: ApiInvoice): Transaction => {
    const paymentMethodMap: Record<string, string> = {
      'CASH': 'Espèces',
      'CARD': 'Carte',
      'BANK_TRANSFER': 'Virement',
      'CHECK': 'Chèque',
      'ONLINE': 'Virement'
    };

    let type: Transaction['type'] = 'Vente';
    let amount = invoice.total;
    
    if (invoice.status === 'REFUNDED') {
      type = 'Remboursement';
      amount = -invoice.total;
    } else if (invoice.status === 'PAID') {
      type = 'Vente';
      amount = invoice.total;
    }

    let clientName: string | undefined;
    if (invoice.client) {
      const firstName = invoice.client.firstName?.trim() || '';
      const lastName = invoice.client.lastName?.trim() || '';
      clientName = `${firstName} ${lastName}`.trim() || undefined;
    }

    // Build employee map from AppointmentServiceItem (per-service employee)
    const serviceEmployeeMap = new Map<string, string>();
    if (invoice.appointment?.services) {
      for (const svc of invoice.appointment.services) {
        if (svc.employee) {
          const name = `${svc.employee.firstName?.trim() || ''} ${svc.employee.lastName?.trim() || ''}`.trim();
          if (name) serviceEmployeeMap.set(svc.serviceName, name);
        }
      }
    }
    // For group invoices: build participant → service → employee map
    const participantServiceEmployeeMap = new Map<string, Map<string, string>>();
    if (invoice.bookingGroupId && invoice.bookingGroup?.participants) {
      for (const p of invoice.bookingGroup.participants) {
        if (p.appointment?.services) {
          const svcMap = new Map<string, string>();
          for (const svc of p.appointment.services) {
            if (svc.employee) {
              const name = `${svc.employee.firstName?.trim() || ''} ${svc.employee.lastName?.trim() || ''}`.trim();
              if (name && !svcMap.has(svc.serviceName)) {
                svcMap.set(svc.serviceName, name);
              }
            }
          }
          participantServiceEmployeeMap.set(p.displayName, svcMap);
        }
      }
    }

    // Group booking participant name (shared across all line items for this appointment)
    const groupParticipantName = invoice.appointment?.bookingParticipant?.displayName || undefined;

    let employeeName: string | undefined;
    if (invoice.appointment?.employee) {
      const firstName = invoice.appointment.employee.firstName?.trim() || '';
      const lastName = invoice.appointment.employee.lastName?.trim() || '';
      employeeName = `${firstName} ${lastName}`.trim() || undefined;
    } else if (invoice.employee) {
      // Manual sale with explicit employee assignment (no appointment)
      const firstName = invoice.employee.firstName?.trim() || '';
      const lastName = invoice.employee.lastName?.trim() || '';
      employeeName = `${firstName} ${lastName}`.trim() || undefined;
    }

    const invoiceItems: TransactionItem[] = (invoice.items || [])
      .map((item) => {
        let itemEmployee: string | undefined;
        // 1) Per-item employee from InvoiceItem (manual multi-employee sale — not currently persisted)
        if (item.employee) {
          itemEmployee = `${item.employee.firstName?.trim() || ''} ${item.employee.lastName?.trim() || ''}`.trim() || undefined;
        }
        // 2) For group invoices: look up by participant name + service name
        if (!itemEmployee && item.participantName) {
          const participantSvcs = participantServiceEmployeeMap.get(item.participantName);
          if (participantSvcs) {
            itemEmployee = participantSvcs.get(item.serviceName);
          }
        }
        // 3) Look up per-service employee from AppointmentServiceItem (single appointment)
        if (!itemEmployee) {
          itemEmployee = serviceEmployeeMap.get(item.serviceName);
        }
        // 4) Fallback to legacy appointment-level employee
        if (!itemEmployee && invoice.appointment?.employee) {
          itemEmployee = `${invoice.appointment.employee.firstName?.trim() || ''} ${invoice.appointment.employee.lastName?.trim() || ''}`.trim() || undefined;
        }
        // Per-item participant name (group invoices) or shared group name or undefined
        const participant = item.participantName || groupParticipantName || undefined;
        return {
          serviceName: item.serviceName,
          price: item.price,
          quantity: item.quantity,
          employeeName: itemEmployee,
          participantName: participant,
        };
      });

    const itemNames = invoiceItems.map((item) =>
      item.quantity > 1 ? `${item.serviceName} x${item.quantity}` : item.serviceName
    );
    const servicesLabel =
      itemNames.length > 0
        ? itemNames.join(', ')
        : invoice.appointment?.service?.name || undefined;

    // Use paidAt (actual payment moment) then createdAt; guard against null/invalid
    const rawDate = invoice.paidAt || invoice.createdAt;
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const txDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    return {
      id: invoice.id,
      type,
      amount,
      method: invoice.paymentMethod ? paymentMethodMap[invoice.paymentMethod] || 'Espèces' : 'Espèces',
      client: clientName,
      employee: employeeName,
      date: txDate,
      note: invoice.notes || servicesLabel || undefined,
      category: servicesLabel,
      invoiceId: invoice.id,
      items: invoiceItems.length > 0 ? invoiceItems : undefined,
      bookingGroupId: invoice.bookingGroupId || null,
      participantCount: invoiceItems.filter((i) => i.participantName).length || undefined,
    };
  };

  const defaultTenantId = () =>
    !isSalonFilterMulti && effectiveSalonIds.length === 1 ? effectiveSalonIds[0] : '';

  const openSaleModal = () => {
    setModalMode('sale');
    setSaleForm({ ...emptySaleForm(), tenantId: defaultTenantId() });
    setMovementForm({ ...emptyMovementForm(), tenantId: defaultTenantId() });
    setAmountOverridden(false);
    setShowModal(true);
  };

  const openGroupBillingModal = async () => {
    setGroupModalOpen(true);
    setSelectedGroupId('');
    setGroupDetails(null);
    setPayerParticipantId('');
    setGroupPaymentMethod('Espèces');
    setGroupPage(0);
    try {
      const res = await api.getPendingGroups();
      setPendingGroups(res.groups || []);
    } catch (err) {
      console.error('Error fetching pending groups:', err);
      toast.error('Erreur lors du chargement des groupes');
    }
  };

  const fetchGroupDetails = async (groupId: string) => {
    if (!groupId) return;
    setGroupLoading(true);
    try {
      const res = await api.getGroupDetails(groupId);
      setGroupDetails(res.group);
      // Default payer = booker
      setPayerParticipantId(
        res.group.participants?.find((p: any) => p.isBooker)?.participantId ||
        res.group.participants?.[0]?.participantId ||
        ''
      );
    } catch (err) {
      console.error('Error fetching group details:', err);
      toast.error('Erreur lors du chargement du groupe');
    } finally {
      setGroupLoading(false);
    }
  };

  const handleSubmitGroupSale = async () => {
    if (!groupDetails || !payerParticipantId || !selectedGroupId) return;
    setGroupSubmitting(true);
    try {
      const pmKey = PAYMENT_METHOD_TO_API[groupPaymentMethod] || 'CASH';
      const payerParticipant = (groupDetails.participants || []).find(
        (p: any) => p.participantId === payerParticipantId
      );
      await api.createGroupSale({
        bookingGroupId: selectedGroupId,
        payerParticipantId,
        payerClientId: payerParticipant?.clientId || undefined,
        paymentMethod: pmKey as any,
      });
      toast.success('Groupe facturé avec succès');
      setGroupModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error creating group sale:', err);
      const msg = err?.message || err?.error || "Erreur lors de la facturation du groupe";
      toast.error(msg);
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleSubmitGroupSaleSeparate = async () => {
    if (!groupDetails || !selectedGroupId) return;
    setGroupSubmitting(true);
    try {
      const pmKey = PAYMENT_METHOD_TO_API[groupPaymentMethod] || 'CASH';
      await api.separateGroupSale({
        bookingGroupId: selectedGroupId,
        paymentMethod: pmKey as any,
      });
      toast.success('Chaque participant a été facturé séparément');
      setGroupModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error separate group sale:', err);
      const msg = err?.message || err?.error || "Erreur lors de la facturation séparée";
      toast.error(msg);
    } finally {
      setGroupSubmitting(false);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Load data from API
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchData();
    }
  }, [isAuthenticated, authLoading, salonFilterKey]);

  // Lock background scroll while the group billing modal is open
  useEffect(() => {
    if (!groupModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [groupModalOpen]);

  const fetchData = async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      return;
    }

    try {
      setLoading(true);
      toast.loading('Chargement des transactions...', { id: 'loading-transactions' });
      
      // Fetch invoices
      const invoicesResponse = await api.getInvoices({ 
        limit: 1000,
        type: 'SALE' // Only sale invoices, exclude subscription invoices
      });
      const invoices = invoicesResponse.invoices || [];
      
      // Transform invoices to transactions
      const invoiceTransactions = invoices
        .filter((inv: ApiInvoice) => inv.status === 'PAID' || inv.status === 'REFUNDED')
        .map((inv: ApiInvoice) => {
          try {
            const tx = transformInvoiceToTransaction(inv);
            return tx;
          } catch (err) {
            console.error('Error transforming invoice to transaction:', err, inv);
            return null;
          }
        })
        .filter((tx: Transaction | null): tx is Transaction => tx !== null && tx !== undefined);
      
      // Fetch cash transactions (deposits/withdrawals)
      let cashTransactions: any[] = [];
      try {
        const cashTransactionsResponse = await api.getCashTransactions({ 
          limit: 1000 
        });
        cashTransactions = cashTransactionsResponse.transactions || [];
      } catch (cashError) {
        console.warn('Error fetching cash transactions (may not be available yet):', cashError);
        // Continue without cash transactions if API is not ready
      }
      
      // Transform cash transactions to Transaction format
      const transformedCashTransactions: Transaction[] = cashTransactions
        .map((ct: any): Transaction | null => {
          try {
            const paymentMethodMap: Record<string, 'Espèces' | 'Carte' | 'Virement' | 'Chèque'> = {
              'CASH': 'Espèces',
              'CARD': 'Carte',
              'BANK_TRANSFER': 'Virement',
              'CHECK': 'Chèque',
              'ONLINE': 'Virement'
            };

            // Extract employee name from createdBy
            let employeeName: string | undefined;
            if (ct.createdBy) {
              const firstName = ct.createdBy.firstName?.trim() || '';
              const lastName = ct.createdBy.lastName?.trim() || '';
              employeeName = `${firstName} ${lastName}`.trim() || undefined;
            }

            const cashType: Transaction['type'] =
              ct.type === 'DEPOSIT' ? 'Dépôt' :
              ct.type === 'REFUND' ? 'Remboursement' :
              'Retrait';
            const signedAmount =
              ct.type === 'DEPOSIT' ? ct.amount : -Math.abs(ct.amount);

            return {
              id: ct.id,
              type: cashType,
              amount: signedAmount,
              method: paymentMethodMap[ct.paymentMethod] || 'Espèces',
              client: undefined,
              employee: employeeName,
              date: new Date(ct.createdAt),
              note: ct.notes || undefined,
            };
          } catch (err) {
            console.error('Error transforming cash transaction:', err, ct);
            return null;
          }
        })
        .filter((tx): tx is Transaction => tx !== null && tx !== undefined);
      
      // Combine all transactions and sort by date (newest first)
      const allTransactions = [...invoiceTransactions, ...transformedCashTransactions]
        .filter(tx => tx !== null && tx !== undefined); // Ensure no null transactions
      allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      
      setTransactions(allTransactions);
      
      if (allTransactions.length > 0) {
        toast.success(`${allTransactions.length} transaction(s) chargée(s)`, { id: 'loading-transactions' });
      } else {
        toast.success('Aucune transaction trouvée', { id: 'loading-transactions' });
      }

      // Fetch accepted payment methods
      try {
        const pmRes = await api.getAcceptedPaymentMethods();
        if (pmRes.methods && pmRes.methods.length > 0) {
          setAcceptedPaymentMethods(pmRes.methods);
        }
      } catch { /* use defaults */ }

      // Fetch clients, catalog services, and employees (for sale modal)
      const [clientsResponse, servicesResponse, employeesResponse] = await Promise.all([
        api.getClients(),
        api.getServices(),
        api.getEmployees({ active: true }),
      ]);
      const clientsData = clientsResponse.clients || [];
      setClients(clientsData.map((c: any) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        tenantId: c.tenantId,
      })));
      const servicesData = servicesResponse.services || servicesResponse || [];
      setCatalogServices(
        (Array.isArray(servicesData) ? servicesData : []).map((s: any) => ({
          id: s.id,
          name: s.name,
          price: s.price ?? null,
          priceFrom: s.priceFrom ?? null,
          tenantId: s.tenantId,
        }))
      );
      const employeesData = (employeesResponse.employees || employeesResponse || []) as any[];
      setEmployees(
        employeesData.map((e: any) => ({
          id: e.id,
          name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
        })).filter((e: { id: string; name: string }) => e.name)
      );
    } catch (err: any) {
      console.error('Error fetching caisse data:', err);
      
      // Handle 401 errors by redirecting to login
      if ((err as any)?.status === 401) {
        toast.error('Session expirée. Veuillez vous reconnecter.', { id: 'loading-transactions' });
        router.push('/login');
        return;
      }
      
      toast.error(err.message || 'Erreur lors du chargement des données', { id: 'loading-transactions' });
      setTransactions([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Filtering
  const filteredTransactions = transactions.filter(tx => {
    if (!tx || !tx.date) {
      console.warn('Invalid transaction found:', tx);
      return false;
    }

    // Search filter - only apply if searchTerm is not empty
    const matchesSearch = !searchTerm || searchTerm.trim() === '' || 
      (tx.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       tx.employee?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       tx.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       tx.method.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesMethod = methodFilter === 'all' || tx.method === methodFilter;
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    
    // Period filter
    let matchesPeriod = true;
    if (selectedPeriod !== 'all') {
      const now = new Date();
      const txDate = new Date(tx.date);
      
      // Validate date
      if (isNaN(txDate.getTime())) {
        console.warn('Invalid transaction date:', tx.date, tx);
        return false;
      }

      const startOfPeriod = new Date();
      
      switch (selectedPeriod) {
        case 'day':
          startOfPeriod.setHours(0, 0, 0, 0);
          startOfPeriod.setMinutes(0, 0, 0);
          matchesPeriod = txDate >= startOfPeriod && txDate <= now;
          break;
        case 'week':
          startOfPeriod.setDate(now.getDate() - 7);
          startOfPeriod.setHours(0, 0, 0, 0);
          startOfPeriod.setMinutes(0, 0, 0);
          matchesPeriod = txDate >= startOfPeriod && txDate <= now;
          break;
        case 'month':
          startOfPeriod.setMonth(now.getMonth() - 1);
          startOfPeriod.setDate(now.getDate());
          startOfPeriod.setHours(0, 0, 0, 0);
          startOfPeriod.setMinutes(0, 0, 0);
          matchesPeriod = txDate >= startOfPeriod && txDate <= now;
          break;
      }
    }
    
    return matchesSearch && matchesMethod && matchesType && matchesPeriod;
  });

  // Stats - use all transactions for overall stats, filtered for display
  const totalSales = transactions.filter(t => t.type === 'Vente').reduce((sum, t) => sum + t.amount, 0);
  const totalRefunds = Math.abs(transactions.filter(t => t.type === 'Remboursement').reduce((sum, t) => sum + t.amount, 0));
  const totalDeposits = transactions.filter(t => t.type === 'Dépôt').reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = Math.abs(transactions.filter(t => t.type === 'Retrait').reduce((sum, t) => sum + t.amount, 0));

  // Export CSV
  const exportToCSV = () => {
    const headers = ['Type', 'Montant', 'Méthode', 'Client', 'Employé', 'Date', 'Note'];
    const rows = filteredTransactions.map(tx => [
      tx.type,
      tx.amount,
      tx.method,
      tx.client || '',
      tx.employee || '',
      tx.date.toLocaleString('fr-FR'),
      tx.note || ''
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions-caisse.csv';
    a.click();
  };

  const toggleSaleService = (serviceId: string) => {
    setSaleForm((prev) => {
      const nextIds = prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((id) => id !== serviceId)
        : [...prev.serviceIds, serviceId];
      const nextSum = nextIds.reduce((sum, id) => {
        const s = catalogServices.find((x) => x.id === id);
        return sum + (s ? servicePrice(s) : 0);
      }, 0);
      // Clean up assignment for deselected service
      const nextAssignments = { ...prev.serviceEmployees };
      if (!nextIds.includes(serviceId)) delete nextAssignments[serviceId];
      return {
        ...prev,
        serviceIds: nextIds,
        amount: amountOverridden ? prev.amount : nextSum,
        serviceEmployees: nextAssignments,
      };
    });
  };

  // Flow A: vente / Flow B: mouvement caisse
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (modalMode === 'sale') {
      if (isSalonFilterMulti && !saleForm.tenantId) {
        toast.error('Veuillez sélectionner un salon');
        return;
      }
      if (saleForm.serviceIds.length === 0) {
        toast.error('Veuillez sélectionner au moins un service');
        return;
      }
      if (!saleForm.clientId?.trim()) {
        toast.error('Veuillez sélectionner un client');
        return;
      }
      if (!saleForm.amount || saleForm.amount <= 0) {
        toast.error('Montant invalide');
        return;
      }

      try {
        const loadingToast = toast.loading('Encaissement en cours...');
        await api.createSale({
          clientId: saleForm.clientId.trim(),
          items: saleForm.serviceIds.map((serviceId) => {
            const s = catalogServices.find((x) => x.id === serviceId);
            const empId = saleForm.serviceEmployees[serviceId];
            return {
              serviceId,
              price: s ? servicePrice(s) : undefined,
              // Only send employeeId when explicitly assigned
              ...(empId ? { employeeId: empId } : {}),
            };
          }),
          amount: amountOverridden ? Number(saleForm.amount) : undefined,
          paymentMethod: PAYMENT_METHOD_TO_API[saleForm.method] || 'CASH',
          notes: saleForm.note || undefined,
          ...(saleForm.tenantId ? { tenantId: saleForm.tenantId } : {}),
        });
        toast.dismiss(loadingToast);
        toast.success('Vente encaissée');
        await fetchData();
        setShowModal(false);
        setSaleForm(emptySaleForm());
        setAmountOverridden(false);
      } catch (err: any) {
        console.error('Error creating sale:', err);
        toast.error(err.message || "Erreur lors de l'encaissement");
      }
      return;
    }

    // Flow B — mouvement caisse
    if (isSalonFilterMulti && !movementForm.tenantId) {
      toast.error('Veuillez sélectionner un salon');
      return;
    }
    if (!movementForm.amount || movementForm.amount <= 0) {
      toast.error('Montant invalide');
      return;
    }

    try {
      const loadingToast = toast.loading('Création du mouvement...');
      const cashType =
        movementForm.type === 'Dépôt' ? 'DEPOSIT' :
        movementForm.type === 'Remboursement' ? 'REFUND' :
        'WITHDRAWAL';

      await api.createCashTransaction({
        type: cashType,
        amount: Number(movementForm.amount),
        paymentMethod: PAYMENT_METHOD_TO_API[movementForm.method] || 'CASH',
        notes: movementForm.note || undefined,
        ...(movementForm.tenantId ? { tenantId: movementForm.tenantId } : {}),
      });

      toast.dismiss(loadingToast);
      toast.success(`${movementForm.type} enregistré`);
      await fetchData();
      setShowModal(false);
      setMovementForm(emptyMovementForm());
    } catch (err: any) {
      console.error('Error creating cash movement:', err);
      toast.error(err.message || 'Erreur lors de la création du mouvement');
    }
  };

  // Print handler
  const handlePrint = () => {
    const now = new Date();
    const startDate = now.toLocaleDateString('fr-FR');
    const endDate = now.toLocaleDateString('fr-FR');
    const balance = totalSales + totalDeposits - totalRefunds - totalWithdrawals;
    
    generateCaissePDF({
      totalSales,
      totalRefunds,
      balance,
      startDate,
      endDate,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen p-0">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-12 rounded-xl w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-24 rounded-lg"></div>
            ))}
          </div>
          <div className="bg-gray-200 h-96 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
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
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .accent-bg { background-color: #002366 !important; }
        .accent-text { color: #002366 !important; }
        /* Hide number input arrows for montant field */
        input[type=number].no-arrows {
          appearance: textfield;
        }
        input[type=number].no-arrows::-webkit-inner-spin-button,
        input[type=number].no-arrows::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number].no-arrows {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Header */}
      <div className="mb-8 animate-slideUp">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">Caisse</h1>
            <p className="text-sm text-gray-400">Gestion des transactions et flux financiers</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="px-5 py-2 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Exporter
            </button>
            <button
              onClick={openGroupBillingModal}
              className="px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-full hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Users size={16} />
              Facturer un groupe
            </button>
            <button
              onClick={openSaleModal}
              className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Ajouter une transaction
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fadeIn">
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-gray-400" size={18} />
            <span className="text-xs text-gray-400">Ventes</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{totalSales} MAD</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCcw className="text-gray-400" size={18} />
            <span className="text-xs text-gray-400">Remboursements</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{totalRefunds} MAD</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-gray-400" size={18} />
            <span className="text-xs text-gray-400">Dépôts</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{totalDeposits} MAD</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-gray-400" size={18} />
            <span className="text-xs text-gray-400">Retraits</span>
          </div>
          <p className="text-2xl font-light text-gray-900">{totalWithdrawals} MAD</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-4 animate-fadeIn flex justify-end">
        <button
          onClick={handlePrint}
          className="px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full text-xs font-medium transition-colors flex items-center gap-2"
          title="Imprimer le rapport"
        >
          <Printer size={14} />
        </button>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 animate-fadeIn">
        {/* Daily Summary */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-medium text-gray-900">Résumé du jour</h3>
            <Calendar className="text-gray-400" size={18} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="text-emerald-600" size={16} />
                <span className="text-xs text-emerald-700 font-medium">Entrées</span>
              </div>
              <p className="text-2xl font-light text-emerald-900">{totalSales + totalDeposits} MAD</p>
              <p className="text-xs text-emerald-600 mt-1">{transactions.filter(t => t.amount > 0).length} transactions</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownRight className="text-red-600" size={16} />
                <span className="text-xs text-red-700 font-medium">Sorties</span>
              </div>
              <p className="text-2xl font-light text-red-900">{Math.abs(totalRefunds + totalWithdrawals)} MAD</p>
              <p className="text-xs text-red-600 mt-1">{transactions.filter(t => t.amount < 0).length} transactions</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Solde net</span>
              <span className="text-xl font-medium text-gray-900">
                {totalSales + totalDeposits - totalRefunds - totalWithdrawals} MAD
              </span>
            </div>
          </div>
        </div>

        {/* Payment Methods Distribution */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-medium text-gray-900">Répartition paiements</h3>
            <Wallet className="text-gray-400" size={18} />
          </div>
          <div className="space-y-3">
            {acceptedPaymentMethods.map((method, idx) => {
              const methodTotal = transactions
                .filter(t => t.method === method && t.amount > 0)
                .reduce((sum, t) => sum + t.amount, 0);
              const barColors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500'];
              const barColor = barColors[idx % barColors.length];
              const pct = totalSales > 0 ? (methodTotal / totalSales) * 100 : 0;
              return (
                <div key={method}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{method}</span>
                    <span className="text-sm font-medium text-gray-900">{methodTotal} MAD</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <h3 className="text-sm font-medium text-gray-900">Toutes les transactions</h3>
          {/* Search bar moved here — above the table, below the cards */}
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Rechercher…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#002366]/30 transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-full table-auto">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-10"></th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[160px]">Prestation</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Méthode</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Employé</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Client</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(tx => {
                   // Only multi-line transactions (multi-service, or a combined
                   // group invoice with several participant rows) expand — a
                   // single-service invoice, incl. a separately billed group
                   // participant, is a plain one-liner.
                   const isMultiService = tx.items && tx.items.length > 1;
                   const canExpand = isMultiService;
                   const isExpanded = expandedRows.has(tx.id);
                  const hasItems = tx.items && tx.items.length > 0;
                  const mainServiceLabel = tx.items && tx.items.length === 1
                    ? tx.items[0].serviceName
                    : (tx.items && tx.items.length > 1 ? 'Prestations multiples' : tx.note || undefined);
                  const toggleExpand = () => {
                    const next = new Set(expandedRows);
                    if (isExpanded) next.delete(tx.id);
                    else next.add(tx.id);
                    setExpandedRows(next);
                  };
                  // Smart employee for main row: single → show, multiple same → show, multiple different → indicator
                  const mainEmployee = (() => {
                    const empNames = tx.items?.map(i => i.employeeName).filter(Boolean) as string[] | undefined;
                    if (!empNames || empNames.length === 0) return tx.employee || undefined;
                    if (empNames.length === 1) return empNames[0];
                    const unique = [...new Set(empNames)];
                    return unique.length === 1 ? unique[0] : 'Diff\u00e9rents employ\u00e9s';
                  })();

                  return (
                  <Fragment key={tx.id}>
                  <tr
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}
                    onClick={toggleExpand}
                  >
                    <td className="px-4 py-4">
                      {canExpand && (
                        <ChevronRight
                          size={16}
                          className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        tx.type === 'Vente' ? 'bg-emerald-50 text-emerald-700' :
                        tx.type === 'Remboursement' ? 'bg-red-50 text-red-700' :
                        tx.type === 'Dépôt' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 truncate max-w-[200px]">
                      {mainServiceLabel ? <span>{mainServiceLabel}</span> : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{tx.method}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {mainEmployee ? <span>{mainEmployee}</span> : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {tx.client || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">{tx.date.toLocaleString('fr-FR')}</td>
                    <td className={`px-6 py-4 text-right font-light text-lg ${tx.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} MAD
                    </td>
                  </tr>
                  {isExpanded && canExpand && (
                    <tr>
                      <td colSpan={8} className="px-4 pb-4">
                        <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                          <table className="w-full min-w-full">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">Prestation</th>
                                <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">Employé</th>
                                <th className="px-4 py-2 text-right text-[10px] font-medium text-gray-400 uppercase tracking-wider">Prix</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tx.items!.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-50 last:border-b-0">
                                  <td className="px-4 py-2 text-sm text-gray-700">
                                    {item.serviceName}
                                    {item.participantName && (
                                      <span className="text-gray-400 text-xs ml-1">
                                        &mdash; pour {item.participantName}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-500">{item.employeeName || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-600 text-right">{item.price.toFixed(2)} MAD</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Receipt className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="text-gray-500">Aucune transaction trouvée</p>
                    {transactions.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        {transactions.length} transaction(s) au total, mais aucune ne correspond aux filtres
                      </p>
                    )}
                    {transactions.length === 0 && !loading && (
                      <p className="text-xs text-gray-400 mt-2">
                        Commencez par ajouter une transaction
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {filteredTransactions.length > PAGE_SIZE && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)} sur {filteredTransactions.length} transactions
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all"
              >
                <ChevronRight size={14} className="rotate-180" /> Préc.
              </button>
              <span className="text-xs text-gray-500 px-1">
                Page {currentPage} / {Math.ceil(filteredTransactions.length / PAGE_SIZE)}
              </span>
              <button
                disabled={currentPage >= Math.ceil(filteredTransactions.length / PAGE_SIZE)}
                onClick={() => setCurrentPage(p => p + 1)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all"
              >
                Suiv. <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal — Flow A vente / Flow B mouvement */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-light text-gray-900">
                  {modalMode === 'sale' ? 'Encaisser une vente' : 'Mouvement caisse'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-2 p-1 bg-gray-50 rounded-full">
                <button
                  type="button"
                  onClick={() => {
                    setModalMode('sale');
                    setSaleForm((prev) => ({ ...prev, tenantId: prev.tenantId || defaultTenantId() }));
                    setAmountOverridden(false);
                  }}
                  className={`flex-1 px-3 py-2 rounded-full text-xs font-medium transition-colors ${
                    modalMode === 'sale' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Encaisser une vente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalMode('movement');
                    setMovementForm((prev) => ({ ...prev, tenantId: prev.tenantId || defaultTenantId() }));
                  }}
                  className={`flex-1 px-3 py-2 rounded-full text-xs font-medium transition-colors ${
                    modalMode === 'movement' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Mouvement caisse
                </button>
              </div>
            </div>

            <form onSubmit={handleAddTransaction} className="px-8 py-6">
              <div className="space-y-5">
                {isSalonFilterMulti && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salon *</label>
                    <Select
                      value={(modalMode === 'sale' ? saleForm.tenantId : movementForm.tenantId) || undefined}
                      onValueChange={(v) => {
                        if (modalMode === 'sale') {
                          setSaleForm({ ...saleForm, tenantId: v, clientId: '', serviceIds: [] });
                          setAmountOverridden(false);
                        } else {
                          setMovementForm({ ...movementForm, tenantId: v });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                        <SelectValue placeholder="Choisir un salon" />
                      </SelectTrigger>
                      <SelectContent>
                        {salons
                          .filter((s) => effectiveSalonIds.includes(s.id))
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {modalMode === 'sale' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Services * <span className="text-gray-400 font-normal">({saleForm.serviceIds.length} sélectionné(s))</span>
                      </label>
                      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">
                        {visibleCatalogServices.length === 0 ? (
                          <p className="px-4 py-6 text-sm text-gray-400 text-center">Aucun service dans le catalogue</p>
                        ) : (
                          visibleCatalogServices.map((service) => {
                            const checked = saleForm.serviceIds.includes(service.id);
                            const price = servicePrice(service);
                            const empId = saleForm.serviceEmployees[service.id] || '__none__';
                            return (
                              <div key={service.id} className={`transition-colors ${checked ? 'bg-emerald-50/60' : ''}`}>
                                {/* Service row */}
                                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/60 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSaleService(service.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                                  />
                                  <span className="flex-1 text-sm text-gray-800">{service.name}</span>
                                  <span className="text-sm text-gray-500 tabular-nums">
                                    {price > 0 ? `${price.toFixed(2)} MAD` : '—'}
                                  </span>
                                </label>
                                {/* Employee dropdown — only when checked */}
                                {checked && (
                                  <div className="px-4 pb-3 flex items-center gap-2">
                                    <div className="w-4 h-4 shrink-0" />{/* aligns with checkbox */}
                                    <Select
                                      value={empId}
                                      onValueChange={(v) =>
                                        setSaleForm((prev) => ({
                                          ...prev,
                                          serviceEmployees: {
                                            ...prev.serviceEmployees,
                                            [service.id]: v === '__none__' ? '' : v,
                                          },
                                        }))
                                      }
                                    >
                                      <SelectTrigger className="flex-1 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs text-gray-600">
                                        <SelectValue placeholder="Employé (optionnel)" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">— Aucun employé</SelectItem>
                                        {employees.map((emp) => (
                                          <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">Montant</label>
                        {amountOverridden && (
                          <button
                            type="button"
                            className="text-xs text-[#002366] hover:underline"
                            onClick={() => {
                              setAmountOverridden(false);
                              setSaleForm({ ...saleForm, amount: servicesSum });
                            }}
                          >
                            Réinitialiser ({servicesSum.toFixed(2)} MAD)
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                          onClick={() => {
                            setAmountOverridden(true);
                            setSaleForm({ ...saleForm, amount: Math.max(0, Number(saleForm.amount) - 10) });
                          }}
                          aria-label="Diminuer le montant"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={saleForm.amount}
                          onChange={(e) => {
                            setAmountOverridden(true);
                            setSaleForm({ ...saleForm, amount: Number(e.target.value) });
                          }}
                          className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-center no-arrows"
                          required
                          placeholder="Montant en MAD"
                          min={0}
                          step="0.01"
                        />
                        <button
                          type="button"
                          className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                          onClick={() => {
                            setAmountOverridden(true);
                            setSaleForm({ ...saleForm, amount: Number(saleForm.amount) + 10 });
                          }}
                          aria-label="Augmenter le montant"
                        >
                          +
                        </button>
                      </div>
                      {!amountOverridden && saleForm.serviceIds.length > 0 && (
                        <p className="mt-1 text-xs text-gray-400">Somme des services sélectionnés</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Méthode *</label>
                        <Select
                          value={saleForm.method}
                          onValueChange={(v) => setSaleForm({ ...saleForm, method: v as Transaction['method'] })}
                        >
                          <SelectTrigger className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                            <SelectValue placeholder="Méthode" />
                          </SelectTrigger>
                          <SelectContent>
                            {acceptedPaymentMethods.map((method) => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Client *
                        </label>
                        <Select
                          value={saleForm.clientId || undefined}
                          onValueChange={(v) => setSaleForm({ ...saleForm, clientId: v })}
                        >
                          <SelectTrigger className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                            <SelectValue placeholder={saleSalonId ? 'Choisir un client' : 'Choisir un salon d\'abord'} />
                          </SelectTrigger>
                          <SelectContent>
                            {visibleClients.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-400">Aucun client pour ce salon</div>
                            ) : (
                              visibleClients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                        <input
                          type="text"
                          value={saleForm.note}
                          onChange={(e) => setSaleForm({ ...saleForm, note: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm"
                          placeholder="Note (sinon noms des services)"
                        />
                      </div>
                    </div>

                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                        <Select
                          value={movementForm.type}
                          onValueChange={(v) =>
                            setMovementForm({
                              ...movementForm,
                              type: v as 'Dépôt' | 'Retrait' | 'Remboursement',
                            })
                          }
                        >
                          <SelectTrigger className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Dépôt">Dépôt</SelectItem>
                            <SelectItem value="Retrait">Retrait</SelectItem>
                            <SelectItem value="Remboursement">Remboursement</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Montant *</label>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                            onClick={() =>
                              setMovementForm({
                                ...movementForm,
                                amount: Math.max(0, Number(movementForm.amount) - 10),
                              })
                            }
                            aria-label="Diminuer le montant"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={movementForm.amount}
                            onChange={(e) =>
                              setMovementForm({ ...movementForm, amount: Number(e.target.value) })
                            }
                            className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-center no-arrows"
                            required
                            placeholder="Montant en MAD"
                            min={0}
                            step="0.01"
                          />
                          <button
                            type="button"
                            className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                            onClick={() =>
                              setMovementForm({
                                ...movementForm,
                                amount: Number(movementForm.amount) + 10,
                              })
                            }
                            aria-label="Augmenter le montant"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Méthode *</label>
                        <Select
                          value={movementForm.method}
                          onValueChange={(v) =>
                            setMovementForm({ ...movementForm, method: v as Transaction['method'] })
                          }
                        >
                          <SelectTrigger className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                            <SelectValue placeholder="Méthode" />
                          </SelectTrigger>
                          <SelectContent>
                            {acceptedPaymentMethods.map((method) => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                        <input
                          type="text"
                          value={movementForm.note}
                          onChange={(e) => setMovementForm({ ...movementForm, note: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm"
                          placeholder="Motif (optionnel)"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      Pas de service requis — dépôt, retrait ou remboursement caisse.
                    </p>
                  </>
                )}
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-100 -mx-8 px-8 py-4 mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={modalMode === 'sale' && saleSubmitDisabled}
                  className="flex-1 px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {modalMode === 'sale' ? 'Encaisser' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Billing Modal */}
      {groupModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" onClick={() => setGroupModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Facturer un groupe</h2>
                <button onClick={() => setGroupModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Sélectionnez un groupe à facturer</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Step 1: Group selector (paginated, 5 per page) */}
              {!selectedGroupId && (
                <div className="space-y-3">
                  {(() => {
                    const available = pendingGroups.filter(
                      (g) => !g.alreadyInvoiced && !g.hasInvoicedAppointment
                    );
                    const pageCount = Math.max(1, Math.ceil(available.length / GROUP_PAGE_SIZE));
                    const current = Math.min(groupPage, pageCount - 1);
                    const pageGroups = available.slice(
                      current * GROUP_PAGE_SIZE,
                      (current + 1) * GROUP_PAGE_SIZE
                    );
                    return (
                      <>
                        {available.length === 0 && !groupLoading && (
                          <p className="text-sm text-gray-400 text-center py-8">
                            Aucun groupe en attente de facturation
                          </p>
                        )}
                        {pageGroups.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => {
                              setSelectedGroupId(g.id);
                              fetchGroupDetails(g.id);
                            }}
                            className="w-full text-left p-4 rounded-xl border transition-colors border-gray-200 hover:border-purple-300 hover:bg-purple-50 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {g.participantNames.join(' & ')}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {g.participantCount} participants
                                </p>
                              </div>
                              <ChevronRight size={16} className="text-gray-400" />
                            </div>
                          </button>
                        ))}
                        {pageCount > 1 && (
                          <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                              type="button"
                              disabled={current === 0}
                              onClick={() => setGroupPage(current - 1)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 disabled:opacity-40 transition-colors"
                            >
                              ← Précédent
                            </button>
                            <span className="text-xs text-gray-500 tabular-nums">
                              {current + 1} / {pageCount}
                            </span>
                            <button
                              type="button"
                              disabled={current >= pageCount - 1}
                              onClick={() => setGroupPage(current + 1)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 disabled:opacity-40 transition-colors"
                            >
                              Suivant →
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Step 2: Group details + payer selection */}
              {selectedGroupId && (
                <>
                  <button
                    onClick={() => { setSelectedGroupId(''); setGroupDetails(null); }}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    ← Retour à la liste
                  </button>

                  {groupLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                  )}

                  {groupDetails && !groupLoading && (
                    <div className="space-y-4">
                      {groupDetails.alreadyInvoiced && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                          Ce groupe a déjà été facturé (facture {groupDetails.existingInvoiceId}).
                        </div>
                      )}
                      {groupDetails.hasInvoicedAppointment && !groupDetails.alreadyInvoiced && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                          Un ou plusieurs RDV de ce groupe ont déjà été facturés individuellement.
                        </div>
                      )}

                      {/* Participants breakdown */}
                      <div className="space-y-3">
                        {groupDetails.participants.map((p: any) => (
                          <div key={p.participantId} className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-gray-900">
                                {p.displayName}
                                {p.isBooker && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Réservant</span>}
                              </p>
                              <p className="text-sm font-semibold text-gray-900">{p.subtotal.toFixed(2)} MAD</p>
                            </div>
                            <div className="space-y-1">
                              {p.services.map((s: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs text-gray-600">
                                  <span>{s.serviceName}{s.employee ? ` · ${s.employee.firstName} ${s.employee.lastName}` : ''}</span>
                                  <span>{s.price.toFixed(2)} MAD</span>
                                </div>
                              ))}
                              {p.startTime && (
                                <p className="text-xs text-gray-400 mt-1">
                                  <Clock size={10} className="inline mr-1" />
                                  {new Date(p.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Total</span>
                        <span className="text-xl font-bold text-gray-900">{groupDetails.total.toFixed(2)} MAD</span>
                      </div>

                      {/* Payer selector — radio buttons (unique participant id, not
                          clientId: two participants can share a client record) */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <label className="block text-xs font-medium text-gray-500 mb-2">
                          Qui paie la facture ?
                        </label>
                        <div className="space-y-2">
                          {groupDetails.participants.map((p: any) => (
                            <label
                              key={p.participantId}
                              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                payerParticipantId === p.participantId
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="group-payer"
                                checked={payerParticipantId === p.participantId}
                                disabled={groupSubmitting}
                                onChange={() => setPayerParticipantId(p.participantId)}
                                className="w-4 h-4 text-purple-600"
                              />
                              <span className="text-sm text-gray-900">{p.displayName}</span>
                              {p.isBooker && <span className="text-[10px] text-gray-400">(Réservant)</span>}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Payment method */}
                      <div className="mt-4">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Mode de paiement</label>
                        <Select value={groupPaymentMethod} onValueChange={setGroupPaymentMethod}>
                          <SelectTrigger className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
                            <SelectValue placeholder="Choisir" />
                          </SelectTrigger>
                          <SelectContent>
                            {acceptedPaymentMethods.map((method) => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {groupDetails.hasInvoicedAppointment && !groupDetails.alreadyInvoiced && (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Un participant a déjà été encaissé individuellement : la facturation
                          du groupe n'est plus possible, encaissez chaque participant un par un.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer — only visible once a group is selected; before that the
                list step has nothing to confirm, so keep the actions hidden
                instead of greyed out. */}
            {selectedGroupId && (
              <div className="px-6 pb-6 flex flex-col gap-2 flex-shrink-0">
                <button
                  type="button"
                  disabled={!payerParticipantId || groupSubmitting || groupLoading || groupDetails?.alreadyInvoiced || groupDetails?.hasInvoicedAppointment}
                  onClick={handleSubmitGroupSale}
                  className="w-full px-4 py-2.5 rounded-full text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {groupSubmitting ? 'Traitement…' : 'Confirmer — facturer au participant sélectionné'}
                </button>
                <button
                  type="button"
                  disabled={groupSubmitting || groupLoading || groupDetails?.alreadyInvoiced || groupDetails?.hasInvoicedAppointment}
                  onClick={handleSubmitGroupSaleSeparate}
                  className="w-full px-4 py-2.5 rounded-full text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {groupSubmitting ? 'Traitement…' : 'Facturer séparément (chaque participant)'}
                </button>
                <button
                  type="button"
                  disabled={groupSubmitting}
                  onClick={() => setGroupModalOpen(false)}
                  className="w-full px-4 py-2.5 rounded-full text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaissePage(props: CaissePageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CaissePageContent {...props} />
    </Suspense>
  );
}
