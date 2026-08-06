import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

interface UseAvailabilityOptions {
  tenantId: string;
  date: string | null;
  serviceIds: string[];
  employeeId?: string;
  enabled?: boolean;
  pollInterval?: number;
  clientEmail?: string;
  existingParticipants?: Array<{
    serviceIds: string[];
    startTime: string;
    serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>;
  }>;
  serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>;
}

interface AvailabilityState {
  slots: string[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

/**
 * Custom hook for real-time availability updates
 * Automatically polls the API for available time slots and updates in real-time
 */
export function useAvailability({
  tenantId,
  date,
  serviceIds,
  employeeId,
  enabled = true,
  pollInterval = 30000, // 30 seconds default
  clientEmail,
  existingParticipants,
  serviceEmployees,
}: UseAvailabilityOptions) {
  const [state, setState] = useState<AvailabilityState>({
    slots: [],
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use refs to store latest values to avoid dependency issues
  const serviceIdsRef = useRef(serviceIds);
  const enabledRef = useRef(enabled);
  const dateRef = useRef(date);
  const tenantIdRef = useRef(tenantId);
  const employeeIdRef = useRef(employeeId);
  const clientEmailRef = useRef(clientEmail);
  const existingParticipantsRef = useRef(existingParticipants);
  const serviceEmployeesRef = useRef(serviceEmployees);

  // Update refs when values change
  useEffect(() => {
    serviceIdsRef.current = serviceIds;
    enabledRef.current = enabled;
    dateRef.current = date;
    tenantIdRef.current = tenantId;
    employeeIdRef.current = employeeId;
    clientEmailRef.current = clientEmail;
    existingParticipantsRef.current = existingParticipants;
    serviceEmployeesRef.current = serviceEmployees;
  }, [serviceIds, enabled, date, tenantId, employeeId, clientEmail, existingParticipants, serviceEmployees]);

  const fetchAvailability = useCallback(async () => {
    const currentServiceIds = serviceIdsRef.current;
    const currentEnabled = enabledRef.current;
    const currentDate = dateRef.current;
    const currentTenantId = tenantIdRef.current;
    const currentEmployeeId = employeeIdRef.current;

    if (!currentEnabled || !currentDate || !currentTenantId || currentServiceIds.length === 0) {
      setState(prev => {
        // Only update if state actually changed to prevent infinite loops
        if (prev.loading || prev.slots.length > 0) {
          return { ...prev, loading: false, slots: [] };
        }
        return prev;
      });
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    // Stale-while-revalidate: keep showing cached slots while fetching new ones
    setState(prev => {
      if (prev.slots.length > 0) {
        return { ...prev, error: null };
      }
      return { ...prev, loading: true, error: null };
    });

    try {
      const slots = await api.getAvailableSlots(
        currentTenantId,
        currentDate,
        currentServiceIds,
        currentEmployeeId,
        existingParticipantsRef.current,
        clientEmailRef.current,
        serviceEmployeesRef.current
      );

      setState(prev => {
        // Only update if slots actually changed
        const newSlots = slots.slots || [];
        if (JSON.stringify(prev.slots) !== JSON.stringify(newSlots)) {
          return {
            slots: newSlots,
            loading: false,
            error: null,
            lastUpdated: new Date(),
          };
        }
        return { ...prev, loading: false };
      });
    } catch (error: any) {
      // Don't set error if request was aborted
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Error fetching availability:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to fetch availability',
      }));
    }
  }, []); // Empty dependency array - we use refs instead

  // Initial fetch and set up polling
  useEffect(() => {
    if (!enabled || !date || !tenantId || serviceIds.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setState(prev => {
        if (prev.loading || prev.slots.length > 0) {
          return { ...prev, loading: false, slots: [] };
        }
        return prev;
      });
      return;
    }

    // Initial fetch
    fetchAvailability();

    // Get poll interval from environment or use default
    const interval = typeof window !== 'undefined' 
      ? parseInt(process.env.NEXT_PUBLIC_AVAILABILITY_POLL_INTERVAL || String(pollInterval), 10)
      : pollInterval;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      fetchAvailability();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, date, tenantId, serviceIds.join(','), employeeId, fetchAvailability, pollInterval, JSON.stringify(existingParticipants), JSON.stringify(serviceEmployees)]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return {
    ...state,
    refresh,
  };
}
