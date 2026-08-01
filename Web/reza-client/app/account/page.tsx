'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, Calendar, Users, Lock, LogOut, Phone, Mail, MapPin, Edit2, Plus, X, Trash2, Check, Clock, Star, ChevronRight, Bell, Shield, CreditCard, Gift, Camera, Award, TrendingUp, Heart, Sparkles, Eye, EyeOff, Key, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import RezaNavbar from '../../components/Header';
import Footer from '../../components/Footer';
import { formatMoroccoDate, getImageUrl } from '../../lib/utils';

// Import tab components
import OverviewTab from './OverviewTab';
import AppointmentsTab from './AppointmentsTab';
import FamilyTab from './FamilyTab';
import ProfileTab from './ProfileTab';
import ReviewsTab from './ReviewsTab';
import Loading from '../salon/Loading';

const DashboardIcon = (props: any) => (
  <svg
    width={props.width || 16}
    height={props.height || 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" />
    <path d="M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" />
    <path d="M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1" />
    <path d="M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1" />
  </svg>
);

const ProchesIcon = (props: any) => (
  <svg
    width={props.width || 16}
    height={props.height || 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M5.931 6.936l1.275 4.249m5.607 5.609l4.251 1.275" />
    <path d="M11.683 12.317l5.759 -5.759" />
    <path d="M5.5 5.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" />
    <path d="M18.5 5.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" />
    <path d="M18.5 18.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" />
    <path d="M8.5 15.5m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0" />
  </svg>
);

const CalendarIcon = (props: any) => (
  <svg
    width={props.width || 16}
    height={props.height || 16}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={props.className}
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M16 2a1 1 0 0 1 .993 .883l.007 .117v1h1a3 3 0 0 1 2.995 2.824l.005 .176v12a3 3 0 0 1 -2.824 2.995l-.176 .005h-12a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-12a3 3 0 0 1 2.824 -2.995l.176 -.005h1v-1a1 1 0 0 1 1.993 -.117l.007 .117v1h6v-1a1 1 0 0 1 1 -1zm3 7h-14v9.625c0 .705 .386 1.286 .883 1.366l.117 .009h12c.513 0 .936 -.53 .993 -1.215l.007 -.16v-9.625z" />
    <path d="M12 12a1 1 0 0 1 .993 .883l.007 .117v3a1 1 0 0 1 -1.993 .117l-.007 -.117v-2a1 1 0 0 1 -.117 -1.993l.117 -.007h1z" />
  </svg>
);

const formatCardNumber = (value: string) => {
  const cleaned = value.replace(/\s/g, '');
  const chunks = cleaned.match(/.{1,4}/g);
  return chunks ? chunks.join(' ') : cleaned;
};
const formatExpiry = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
  }
  return cleaned;
};

// Add ArrowAutofitLeftIcon component
const ArrowAutofitLeftIcon = (props: any) => (
  <svg
    width={props.width || 16}
    height={props.height || 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M4 12v-6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8" />
    <path d="M20 18h-17" />
    <path d="M6 15l-3 3l3 3" />
  </svg>
);

// Add GiftTablerIcon for rewards tab
const GiftTablerIcon = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.width || 24}
    height={props.height || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    {...props}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" />
    <path d="M12 8l0 13" />
    <path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />
  </svg>
);

export default function AccountDashboard() {
  const { user, isAuthenticated, logout: logoutFromContext, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Initialize activeTab with default value to avoid hydration mismatch
  // We'll load from localStorage after component mounts (client-side only)
  const [activeTab, setActiveTab] = useState('overview');
  const [isClient, setIsClient] = useState(false);
  
  // Load saved tab from localStorage after component mounts (client-side only)
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('accountActiveTab');
      // Validate that the saved tab is a valid tab ID
      const validTabs = ['overview', 'appointments', 'family', 'profile', 'avis', 'rewards'];
      if (savedTab && validTabs.includes(savedTab)) {
        setActiveTab(savedTab);
      }
    }
  }, []); // Only run once on mount
  
  // Save activeTab to localStorage whenever it changes (client-side only)
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      localStorage.setItem('accountActiveTab', activeTab);
    }
  }, [activeTab, isClient]);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [newPerson, setNewPerson] = useState({ name: '', relationship: '', phone: '', email: '' });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState('setup'); // 'setup', 'verify', 'success'

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const fetchingRef = useRef(false); // Prevent multiple simultaneous fetches

  // User data from API
  const [userData, setUserData] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    joinDate: string;
    totalBookings: number;
    avatar: string | null;
  }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    joinDate: '',
    totalBookings: 0,
    avatar: null
  });

  // Appointments from API
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clientData, setClientData] = useState<any>(null);
  const [appointmentsSortBy, setAppointmentsSortBy] = useState<'createdAt' | 'startTime'>('createdAt');

  // Family members from API
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [loadingFamilyMembers, setLoadingFamilyMembers] = useState(false);

  // Reviews from API
  const [reviews, setReviews] = useState<any[]>([]);

  // Favorites from API
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // Notifications from API
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Fetch user data and appointments
  useEffect(() => {
    // Don't redirect if we're still loading auth state
    if (authLoading) {
      return;
    }

    if (!isAuthenticated || !user?.email) {
      // Redirect to login if not authenticated (only after loading is complete)
      router.push('/login');
      return;
    }

    // If we're already fetching, don't start another fetch
    if (fetchingRef.current || loading) {
      return;
    }

    // Reset userData when user changes to prevent stale data
    // But preserve avatar if it exists to avoid clearing it unnecessarily
    setUserData(prev => ({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      joinDate: '',
      totalBookings: 0,
      avatar: prev.avatar // Preserve existing avatar during reset
    }));
    setAppointments([]);
    setClientData(null);
    setFamilyMembers([]);
    setReviews([]);
    setFavoritesCount(0);
    setNotifications([]);
    setUnreadNotificationsCount(0);

    const fetchAccountData = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        setLoading(true);
        const userEmail = user.email;

        // Fetch appointments and client data
        setLoadingAppointments(true);
        const appointmentsRes = await api.getClientAppointments(userEmail, undefined, 100, appointmentsSortBy);
        
        // Fetch services for all unique serviceIds to get prices
        const uniqueServiceIds = [...new Set((appointmentsRes.appointments || [])
          .map((apt: any) => apt.serviceId)
          .filter(Boolean))];
        
        const servicePriceMap = new Map<string, number>();
        if (uniqueServiceIds.length > 0 && appointmentsRes.appointments?.[0]?.tenantId) {
          try {
            const tenantId = appointmentsRes.appointments[0].tenantId;
            const servicesRes = await api.getTenantServices(tenantId);
            (servicesRes.services || []).forEach((service: any) => {
              if (service.id && (service.price || service.priceFrom)) {
                const servicePrice = service.price || service.priceFrom || 0;
                servicePriceMap.set(service.id, typeof servicePrice === 'number' ? servicePrice : parseFloat(servicePrice) || 0);
              }
            });
          } catch (error) {
            console.error('[Account] Error fetching services for prices:', error);
          }
        }
        
        // Transform appointments to ensure proper mapping of price and professional
        const transformedAppointments = (appointmentsRes.appointments || []).map((apt: any) => {
          // Extract professional/employee name - check multiple sources
          // Priority 1: professional field (already formatted) - PRESERVE IT
          let professional = apt.professional;
          
          // Priority 2: Try employee object
          if (!professional && apt.employee) {
            if (typeof apt.employee === 'string') {
              professional = apt.employee;
            } else if (apt.employee && typeof apt.employee === 'object') {
              const firstName = apt.employee.firstName?.trim() || '';
              const lastName = apt.employee.lastName?.trim() || '';
              const fullName = `${firstName} ${lastName}`.trim();
              if (fullName) {
                professional = fullName;
              }
            }
          }
          
          // Extract price - check multiple sources in order of priority
          let price = apt.price;
          let totalPrice = apt.totalPrice;
          
          // Convert to number if string
          if (typeof price === 'string') {
            price = parseFloat(price) || 0;
          }
          if (typeof totalPrice === 'string') {
            totalPrice = parseFloat(totalPrice) || 0;
          }
          
          // Priority 1: Check if price is directly available and valid (non-zero)
          if (price && price !== 0 && price !== '0' && price !== '') {
            // Price is already set and valid, use it
          } else {
            // Priority 2: Try to get price from servicePriceMap using serviceId
            if (apt.serviceId && servicePriceMap.has(apt.serviceId)) {
              const servicePrice = servicePriceMap.get(apt.serviceId);
              if (servicePrice && servicePrice > 0) {
                price = servicePrice;
              }
            }
            
            // Priority 3: Try service object (single service) - but service might be a string
            if ((!price || price === 0) && apt.service && typeof apt.service === 'object') {
              if (apt.service.price && apt.service.price !== 0 && apt.service.price !== '0') {
                price = typeof apt.service.price === 'number' ? apt.service.price : parseFloat(apt.service.price) || 0;
              } else if (apt.service.priceFrom && apt.service.priceFrom !== 0 && apt.service.priceFrom !== '0') {
                price = typeof apt.service.priceFrom === 'number' ? apt.service.priceFrom : parseFloat(apt.service.priceFrom) || 0;
              }
            }
            
            // Priority 4: Try services array (multiple services)
            if ((!price || price === 0) && apt.services && Array.isArray(apt.services) && apt.services.length > 0) {
              const sum = apt.services.reduce((sum: number, s: any) => {
                if (!s) return sum;
                const servicePrice = s.price || s.priceFrom || 0;
                const numPrice = typeof servicePrice === 'number' ? servicePrice : parseFloat(String(servicePrice)) || 0;
                return sum + numPrice;
              }, 0);
              if (sum > 0) {
                price = sum;
              }
            }
            
            // Priority 5: Try totalPrice as fallback
            if ((!price || price === 0) && totalPrice && totalPrice !== 0 && totalPrice !== '0') {
              price = totalPrice;
            }
            
            // Priority 6: Try to extract from notes (e.g., "Services réservés: ... (70 min - 0 MAD)")
            if ((!price || price === 0) && apt.notes) {
              const priceMatch = apt.notes.match(/(\d+(?:\.\d+)?)\s*MAD/i);
              if (priceMatch) {
                const extractedPrice = parseFloat(priceMatch[1]);
                if (extractedPrice > 0) {
                  price = extractedPrice;
                }
              }
            }
          }
          
          // Ensure totalPrice is set
          if (!totalPrice || totalPrice === 0 || totalPrice === '0') {
            totalPrice = price || 0;
          }
          
          const transformed = {
            ...apt,
            // CRITICAL: Preserve professional field - it's already in the data!
            professional: professional || apt.professional || undefined,
            price: price !== undefined && price !== null ? Number(price) : (apt.price || 0),
            totalPrice: totalPrice !== undefined && totalPrice !== null ? Number(totalPrice) : (price || apt.price || 0)
          };
          
          return transformed;
        });
        
        setAppointments(transformedAppointments);
        setClientData(appointmentsRes.client);

        // Update user data from client data
        if (appointmentsRes.client) {
          const client = appointmentsRes.client;
          const clientAvatar = (client as any).avatar;
          setUserData(prev => {
            const newData = {
              ...prev,
              firstName: client.firstName || '',
              lastName: client.lastName || '',
              email: client.email || userEmail,
              phone: client.phone || '',
              address: client.address || '',
              // Only update avatar if it's actually present, otherwise keep existing value
              avatar: clientAvatar !== undefined && clientAvatar !== null ? clientAvatar : prev.avatar,
              totalBookings: appointmentsRes.appointments?.length || 0,
              joinDate: appointmentsRes.appointments && appointmentsRes.appointments.length > 0
                ? formatMoroccoDate(appointmentsRes.appointments[appointmentsRes.appointments.length - 1].date, { month: 'long', year: 'numeric' })
                : formatMoroccoDate(new Date(), { month: 'long', year: 'numeric' })
            };
            return newData;
          });
        } else {
          // Fallback to user data from auth context
          // Use firstName and lastName from user context if available
          let firstName = user.firstName || '';
          let lastName = user.lastName || '';
          
          // If not available in context, try to extract from user.name
          if (!firstName && !lastName) {
            if (user.name && !user.name.includes('@')) {
              // user.name is a proper name, split it
              const nameParts = user.name.trim().split(/\s+/);
              firstName = nameParts[0] || '';
              lastName = nameParts.slice(1).join(' ') || '';
            } else {
              // user.name is missing or looks like an email, extract from email
              const emailPrefix = userEmail.split('@')[0];
              const emailParts = emailPrefix.split(/[._-]/);
              firstName = emailParts[0] || emailPrefix || 'Utilisateur';
              lastName = emailParts.slice(1).join(' ') || '';
            }
          }
          
          setUserData(prev => ({
            ...prev,
            firstName: firstName,
            lastName: lastName,
            email: userEmail,
            phone: user.phone || '',
            totalBookings: 0
          }));
        }

        // Fetch reviews
        setLoadingReviews(true);
        try {
          const reviewsRes = await api.getClientReviews(userEmail);
          
          // The API already returns formatted reviews, but ensure all fields are present
          const formattedReviews = (reviewsRes.reviews || []).map((review: any) => ({
            id: review.id,
            salon: review.salon || 'Salon',
            salonImage: getImageUrl(review.salonImage) || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
            salonLocation: review.salonLocation || '',
            service: review.service || 'Service',
            rating: review.rating || 0,
            comment: review.comment || '',
            date: review.date || formatMoroccoDate(review.createdAt || Date.now()),
            appointmentDate: review.appointmentDate || null,
            detailedRatings: review.detailedRatings || {
              quality: 0,
              professionalism: 0,
              cleanliness: 0,
              value: 0
            }
          }));
          
          setReviews(formattedReviews);
        } catch (error) {
          console.error('Error fetching reviews:', error);
          setReviews([]);
        }

        // Fetch family members (no tenantId needed - clients can reserve in multiple salons)
        setLoadingFamilyMembers(true);
        try {
          const familyRes = await api.getClientFamilyMembers(userEmail);
          // Transform API data to match component format
          const formattedMembers = (familyRes.familyMembers || []).map((member: any) => ({
            id: member.id,
            name: `${member.firstName} ${member.lastName}`,
            firstName: member.firstName,
            lastName: member.lastName,
            relationship: member.relationship,
            phone: member.phone || '',
            email: member.email || '',
            avatar: member.avatar || null
          }));
          setFamilyMembers(formattedMembers);
        } catch (familyError: any) {
          console.error('Error fetching family members:', familyError);
          // Keep empty array on error
          setFamilyMembers([]);
        } finally {
          setLoadingFamilyMembers(false);
        }

        // Fetch favorites count
        setLoadingFavorites(true);
        try {
          const favoritesRes = await api.getClientFavorites(userEmail);
          setFavoritesCount(favoritesRes.count || 0);
        } catch (favoritesError: any) {
          console.error('Error fetching favorites:', favoritesError);
          setFavoritesCount(0);
        } finally {
          setLoadingFavorites(false);
        }

        // Fetch notifications
        setLoadingNotifications(true);
        try {
          const notificationsRes = await api.getClientNotifications(userEmail, { limit: 50 });
          setNotifications(notificationsRes.notifications || []);
          setUnreadNotificationsCount(notificationsRes.unreadCount || 0);
        } catch (notificationsError: any) {
          console.error('Error fetching notifications:', notificationsError);
          setNotifications([]);
          setUnreadNotificationsCount(0);
        } finally {
          setLoadingNotifications(false);
        }

      } catch (error: any) {
        console.error('Error fetching account data:', error);
        // Keep default/empty data on error
      } finally {
        setLoading(false);
        setLoadingAppointments(false);
        setLoadingReviews(false);
        fetchingRef.current = false;
      }
    };

    fetchAccountData();
  }, [isAuthenticated, user?.email, router, authLoading]);

  // Handle sort changes - refetch appointments without full loading state
  useEffect(() => {
    // Only run if user is authenticated and has fetched data at least once
    if (!isAuthenticated || !user?.email || appointments.length === 0) {
      return;
    }

    // Call refreshAppointments when sort changes
    refreshAppointments();
  }, [appointmentsSortBy]);

  // Refresh appointments
  const refreshAppointments = async () => {
    if (!user?.email) return;
    try {
      setLoadingAppointments(true);
      const appointmentsRes = await api.getClientAppointments(user.email, undefined, 100, appointmentsSortBy);
      
      // Fetch services for all unique serviceIds to get prices
      const uniqueServiceIds = [...new Set((appointmentsRes.appointments || [])
        .map((apt: any) => apt.serviceId)
        .filter(Boolean))];
      
      const servicePriceMap = new Map<string, number>();
      if (uniqueServiceIds.length > 0 && appointmentsRes.appointments?.[0]?.tenantId) {
        try {
          const tenantId = appointmentsRes.appointments[0].tenantId;
          const servicesRes = await api.getTenantServices(tenantId);
          (servicesRes.services || []).forEach((service: any) => {
            if (service.id && (service.price || service.priceFrom)) {
              const servicePrice = service.price || service.priceFrom || 0;
              servicePriceMap.set(service.id, typeof servicePrice === 'number' ? servicePrice : parseFloat(servicePrice) || 0);
            }
          });
        } catch (error) {
          console.error('[Account] Error fetching services for prices:', error);
        }
      }
      
      // Transform appointments to ensure proper mapping of price and professional
      const transformedAppointments = (appointmentsRes.appointments || []).map((apt: any) => {
        // Extract professional/employee name - check multiple sources
        let professional = apt.professional;
        
        // Try employee object first (most common case)
        if (!professional && apt.employee) {
          if (typeof apt.employee === 'string') {
            professional = apt.employee;
          } else if (apt.employee && typeof apt.employee === 'object') {
            const firstName = apt.employee.firstName?.trim() || '';
            const lastName = apt.employee.lastName?.trim() || '';
            const fullName = `${firstName} ${lastName}`.trim();
            if (fullName) {
              professional = fullName;
            }
          }
        }
        
        // Extract price - check multiple sources in order of priority
        let price = apt.price;
        let totalPrice = apt.totalPrice;
        
        // Convert to number if string
        if (typeof price === 'string') {
          price = parseFloat(price) || 0;
        }
        if (typeof totalPrice === 'string') {
          totalPrice = parseFloat(totalPrice) || 0;
        }
        
        // Priority 1: Check if price is directly available and valid (non-zero)
        if (price && price !== 0 && price !== '0' && price !== '') {
          // Price is already set and valid, use it
        } else {
          // Priority 2: Try to get price from servicePriceMap using serviceId
          if (apt.serviceId && servicePriceMap.has(apt.serviceId)) {
            const servicePrice = servicePriceMap.get(apt.serviceId);
            if (servicePrice && servicePrice > 0) {
              price = servicePrice;
            }
          }
          
          // Priority 3: Try service object (single service) - but service might be a string
          if ((!price || price === 0) && apt.service && typeof apt.service === 'object') {
            if (apt.service.price && apt.service.price !== 0 && apt.service.price !== '0') {
              price = typeof apt.service.price === 'number' ? apt.service.price : parseFloat(apt.service.price) || 0;
            } else if (apt.service.priceFrom && apt.service.priceFrom !== 0 && apt.service.priceFrom !== '0') {
              price = typeof apt.service.priceFrom === 'number' ? apt.service.priceFrom : parseFloat(apt.service.priceFrom) || 0;
            }
          }
          
          // Priority 4: Try services array (multiple services)
          if ((!price || price === 0) && apt.services && Array.isArray(apt.services) && apt.services.length > 0) {
            const sum = apt.services.reduce((sum: number, s: any) => {
              if (!s) return sum;
              const servicePrice = s.price || s.priceFrom || 0;
              const numPrice = typeof servicePrice === 'number' ? servicePrice : parseFloat(String(servicePrice)) || 0;
              return sum + numPrice;
            }, 0);
            if (sum > 0) {
              price = sum;
            }
          }
          
          // Priority 5: Try totalPrice as fallback
          if ((!price || price === 0) && totalPrice && totalPrice !== 0 && totalPrice !== '0') {
            price = totalPrice;
          }
          
          // Priority 6: Try to extract from notes
          if ((!price || price === 0) && apt.notes) {
            const priceMatch = apt.notes.match(/(\d+(?:\.\d+)?)\s*MAD/i);
            if (priceMatch) {
              const extractedPrice = parseFloat(priceMatch[1]);
              if (extractedPrice > 0) {
                price = extractedPrice;
              }
            }
          }
        }
        
        // Ensure totalPrice is set
        if (!totalPrice || totalPrice === 0 || totalPrice === '0') {
          totalPrice = price || 0;
        }
        
        return {
          ...apt,
          // CRITICAL: Preserve professional field - it's already in the data!
          professional: professional || apt.professional || undefined,
          price: price !== undefined && price !== null ? Number(price) : (apt.price || 0),
          totalPrice: totalPrice !== undefined && totalPrice !== null ? Number(totalPrice) : (price || apt.price || 0)
        };
      });
      
      setAppointments(transformedAppointments);
      if (appointmentsRes.client) {
        setClientData(appointmentsRes.client);
        setUserData(prev => ({
          ...prev,
          totalBookings: appointmentsRes.appointments?.length || 0
        }));
      }
    } catch (error: any) {
      console.error('Error refreshing appointments:', error);
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Refresh reviews
  const refreshReviews = async () => {
    if (!user?.email) return;
    try {
      setLoadingReviews(true);
      const reviewsRes = await api.getClientReviews(user.email);
      // Transform API data to match ReviewsTab expected format
      const formattedReviews = (reviewsRes.reviews || []).map((review: any) => ({
        id: review.id,
        salon: review.salon || 'Salon',
        salonImage: getImageUrl(review.salonImage) || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
        salonLocation: review.salonLocation || '',
        service: review.service || 'Service',
        rating: review.rating || 0,
        comment: review.comment || '',
        date: review.date || formatMoroccoDate(review.createdAt || Date.now()),
        appointmentDate: review.appointmentDate || null,
        detailedRatings: review.detailedRatings || {
          quality: 0,
          professionalism: 0,
          cleanliness: 0,
          value: 0
        }
      }));
      setReviews(formattedReviews);
    } catch (error: any) {
      console.error('Error refreshing reviews:', error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  // Add review handler
  const handleAddReview = async (review: any) => {
    // Refresh reviews from API after adding
    await refreshReviews();
    setActiveTab('avis');
  };

  // Delete review handler
  const handleDeleteReview = async (reviewId: string) => {
    if (!user?.email) {
      console.error('User email missing');
      return;
    }

    try {
      await api.deleteReview(reviewId, user.email);
      
      // Refresh reviews from API after deleting
      await refreshReviews();
    } catch (error: any) {
      console.error('Error deleting review:', error);
      // Optionally show error message to user
      alert(error.message || 'Erreur lors de la suppression de l\'avis');
    }
  };

  const handleAddPerson = async (personData: any) => {
    if (!user?.email) {
      console.error('User email missing');
      throw new Error('Email utilisateur manquant');
    }

    try {
      // Parse name into firstName and lastName
      const nameParts = personData.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      if (!firstName || firstName.trim().length < 2) {
        throw new Error('Le prénom est requis (minimum 2 caractères)');
      }

      if (!personData.relationship || personData.relationship.trim().length === 0) {
        throw new Error('La relation est requise');
      }

      const newMember = await api.createFamilyMember({
        clientEmail: user.email,
        firstName,
        lastName,
        email: personData.email || undefined,
        phone: personData.phone || undefined,
        relationship: personData.relationship,
        avatar: personData.avatar || undefined
      });

      // Refresh family members
      const familyRes = await api.getClientFamilyMembers(user.email);
      const formattedMembers = (familyRes.familyMembers || []).map((member: any) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        firstName: member.firstName,
        lastName: member.lastName,
        relationship: member.relationship,
        phone: member.phone || '',
        email: member.email || '',
        avatar: member.avatar || null
      }));
      setFamilyMembers(formattedMembers);
    } catch (error: any) {
      console.error('Error adding family member:', error);
      throw error; // Re-throw to be handled by FamilyTab
    }
  };

  const handleDeletePerson = async (id: string) => {
    if (!user?.email) {
      console.error('User email missing');
      return;
    }

    try {
      await api.deleteFamilyMember(id, user.email);
      // Refresh family members
      const familyRes = await api.getClientFamilyMembers(user.email);
      const formattedMembers = (familyRes.familyMembers || []).map((member: any) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        firstName: member.firstName,
        lastName: member.lastName,
        relationship: member.relationship,
        phone: member.phone || '',
        email: member.email || '',
        avatar: member.avatar || null
      }));
      setFamilyMembers(formattedMembers);
    } catch (error: any) {
      console.error('Error deleting family member:', error);
    }
  };

  const handleEditPerson = (person: any) => {
    // This is called by FamilyTab to update editingPerson state
    // The actual editing UI is handled within FamilyTab, not in this modal
    setEditingPerson(person);
    // Don't show the modal - FamilyTab handles its own editing UI
    // setShowEditModal(true);
  };

  const saveEditedPerson = async (memberData?: any) => {
    // Use memberData if provided, otherwise fall back to editingPerson
    const dataToSave = memberData || editingPerson;
    
    if (!user?.email || !dataToSave || !dataToSave.id) {
      console.error('Missing required data for editing:', { 
        hasUser: !!user, 
        hasEmail: !!user?.email, 
        hasData: !!dataToSave, 
        hasId: !!dataToSave?.id 
      });
      throw new Error('Données manquantes pour la mise à jour');
    }

    try {
      // Parse name into firstName and lastName if needed
      let firstName = dataToSave.firstName;
      let lastName = dataToSave.lastName;
      
      if (!firstName && dataToSave.name) {
        const nameParts = dataToSave.name.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      if (!firstName || firstName.trim().length < 2) {
        throw new Error('Le prénom est requis (minimum 2 caractères)');
      }

      if (!dataToSave.relationship || dataToSave.relationship.trim().length === 0) {
        throw new Error('La relation est requise');
      }

      const response = await api.updateFamilyMember(dataToSave.id, {
        clientEmail: user.email,
        firstName: firstName || dataToSave.firstName,
        lastName: lastName || dataToSave.lastName,
        email: dataToSave.email || undefined,
        phone: dataToSave.phone || undefined,
        relationship: dataToSave.relationship,
        avatar: dataToSave.avatar || undefined
      });

      // Refresh family members to get updated data including avatar
      const familyRes = await api.getClientFamilyMembers(user.email);
      const formattedMembers = (familyRes.familyMembers || []).map((member: any) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        firstName: member.firstName,
        lastName: member.lastName,
        relationship: member.relationship,
        phone: member.phone || '',
        email: member.email || '',
        avatar: member.avatar || null
      }));
      setFamilyMembers(formattedMembers);
      setShowEditModal(false);
      setEditingPerson(null);
    } catch (error: any) {
      console.error('Error updating family member:', error);
      throw error; // Re-throw to be handled by FamilyTab
    }
  };

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handlePasswordChange = () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      setPasswordError('Veuillez remplir tous les champs');
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      setPasswordError('Les nouveaux mots de passe ne correspondent pas');
      return;
    }
    if (passwordData.new.length < 8) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    // Simulate password change
    setPasswordSuccess('Mot de passe changé avec succès!');
    setPasswordData({ current: '', new: '', confirm: '' });
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordSuccess(null);
    }, 1500);
  };

  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  const handleEnable2FA = () => {
    if (verificationCode.length !== 6) {
      setTwoFactorError('Veuillez entrer le code à 6 chiffres');
      return;
    }
    setTwoFactorError(null);
    // Simulate 2FA verification
    setTwoFactorEnabled(true);
    setTwoFactorStep('success');
    setTimeout(() => {
      setShow2FAModal(false);
      setTwoFactorStep('setup');
      setVerificationCode('');
    }, 2000);
  };

  const [disable2FASuccess, setDisable2FASuccess] = useState<string | null>(null);

  const handleDisable2FA = () => {
    if (window.confirm('Êtes-vous sûr de vouloir désactiver l\'authentification à deux facteurs?')) {
      setTwoFactorEnabled(false);
      setDisable2FASuccess('Authentification à deux facteurs désactivée');
      setTimeout(() => setDisable2FASuccess(null), 3000);
    }
  };

  const getStatusText = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'confirmed':
      case 'confirmé': 
        return 'Confirmé';
      case 'completed':
      case 'terminé': 
        return 'Terminé';
      case 'cancelled':
      case 'annulé': 
        return 'Annulé';
      case 'pending':
      case 'en attente': 
        return 'En attente';
      case 'in_progress':
      case 'en cours': 
        return 'En cours';
      case 'no_show':
      case 'absent': 
        return 'Absent';
      default: 
        return status || 'Inconnu';
    }
  };

  // Card setup state for account page (must be before early return)
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    cardName: '',
    cardExpiry: '',
    cardCVV: '',
  });
  const [cardFormErrors, setCardFormErrors] = useState<{ [k: string]: boolean }>({});
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [showLogoutLoading, setShowLogoutLoading] = useState(false);

  // Show loading state while fetching initial data or if auth is loading
  if (authLoading || (loading && appointments.length === 0 && reviews.length === 0 && !userData.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7f3]">
        <Loading />
      </div>
    );
  }

  // Card form validation
  const validateCardForm = () => {
    const errs: { [k: string]: boolean } = {};
    if (!cardForm.cardNumber.replace(/\s/g, '').match(/^\d{16}$/)) errs.cardNumber = true;
    if (!cardForm.cardName.trim()) errs.cardName = true;
    if (!cardForm.cardExpiry.match(/^\d{2}\/\d{2}$/)) errs.cardExpiry = true;
    if (!cardForm.cardCVV.match(/^\d{3}$/)) errs.cardCVV = true;
    setCardFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveCard = () => {
    if (validateCardForm()) {
      setCardSaved(true);
      setTimeout(() => setShowCardForm(false), 1200);
    }
  };

  return (
    <>
      {/* Navbar */}
      <RezaNavbar />
      
      {showLogoutLoading ? (
        <Loading text="Déconnexion..." />
      ) : (
        <div className="min-h-screen bg-white pt-20">
          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideIn {
              from { opacity: 0; transform: translateX(-20px); }
              to { opacity: 1; transform: translateX(0); }
            }
            .animate-fadeIn {
              animation: fadeIn 0.4s ease-out forwards;
            }
            .animate-slideIn {
              animation: slideIn 0.5s ease-out forwards;
            }
            .gradient-text {
              background: linear-gradient(135deg, #8b7260 0%, #5d4a3d 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            .perspective-1000 {
              perspective: 1000px;
            }
            .card-3d {
              width: 100%;
              height: 220px;
              position: relative;
              transform-style: preserve-3d;
              transition: transform 0.7s cubic-bezier(.4,2,.6,1);
            }
            .card-3d.flipped {
              transform: rotateY(180deg);
            }
            .card-face {
              position: absolute;
              width: 100%;
              height: 100%;
              backface-visibility: hidden;
              top: 0; left: 0;
            }
            .card-face.back {
              transform: rotateY(180deg);
            }
            .magnetic-stripe {
              height: 38px;
              background: linear-gradient(90deg, #222 80%, #444 100%);
              margin-top: 24px;
              border-radius: 6px;
            }
            .signature-box {
              background: #fff;
              height: 28px;
              width: 60%;
              margin-top: 24px;
              border-radius: 4px;
              display: flex;
              align-items: center;
              padding: 0 10px;
              font-size: 0.95em;
              letter-spacing: 0.1em;
            }
            .cvv-box {
              background: #f3f3f3;
              height: 28px;
              width: 60px;
              margin-left: 12px;
              margin-top: 24px;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: monospace;
              font-size: 1em;
              color: #222;
              font-weight: bold;
              letter-spacing: 0.2em;
            }
            .card-back-logo {
              position: absolute;
              bottom: 30px; 
              right: 24px;
              opacity: 0.7;
            }
            
            /* Hide scrollbar for Chrome, Safari and Opera */
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
            
            /* Hide scrollbar for IE, Edge and Firefox */
            .scrollbar-hide {
              -ms-overflow-style: none;  /* IE and Edge */
              scrollbar-width: none;  /* Firefox */
            }
          `}</style>


          {/* ========================== COMPACT PROFILE HEADER ========================== */}
          <div className="bg-white border-b border-gray-100 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

              {/* Top row: avatar + name + actions */}
              <div className="flex items-center gap-3 py-3">

                {/* Avatar — teal circle with initials */}
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-[#111827] flex items-center justify-center overflow-hidden shadow-sm">
                    {userData.avatar ? (
                      <img
                        src={userData.avatar}
                        alt="Profil"
                        className="w-full h-full object-cover"
                        onError={() => setUserData(prev => ({ ...prev, avatar: null }))}
                      />
                    ) : (
                      <span className="text-xs font-bold text-white select-none tracking-wide">
                        {userData.firstName?.[0]?.toUpperCase() || userData.email?.[0]?.toUpperCase() || 'U'}
                        {userData.lastName?.[0]?.toUpperCase() || ''}
                      </span>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
                </div>

                {/* Name & email */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                    {[userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.email?.split('@')[0] || ''}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{userData.email}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Réserver — premium pill */}
                  <button
                    onClick={() => router.push('/search-results')}
                    className="group relative flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-semibold transition-all duration-200 overflow-hidden shadow-md hover:shadow-[#111827]/40 hover:-translate-y-0.5 active:translate-y-0"
                    style={{ background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Réserver</span>
                    {/* shine effect */}
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white transition-opacity duration-200 rounded-full" />
                  </button>

                  {/* Logout icon */}
                  <button
                    onClick={() => {
                      setShowLogoutLoading(true);
                      setUserData({ firstName: '', lastName: '', email: '', phone: '', address: '', joinDate: '', totalBookings: 0, avatar: null });
                      setAppointments([]); setClientData(null); setFamilyMembers([]); setReviews([]); setFavoritesCount(0);
                      logoutFromContext();
                      setTimeout(() => router.push('/login'), 500);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                    title="Déconnexion"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tab nav — underline style */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
                {[
                  { id: 'overview', label: "Vue d'ensemble", icon: DashboardIcon },
                  { id: 'appointments', label: 'Rendez-vous', icon: CalendarIcon },
                  { id: 'family', label: 'Proches', icon: ProchesIcon },
                  { id: 'avis', label: 'Mes Avis', icon: ArrowAutofitLeftIcon },
                  { id: 'rewards', label: 'Récompenses', icon: GiftTablerIcon, disabled: true, soon: true },
                  { id: 'profile', label: 'Profil', icon: User }
                ].map(({ id, label, icon: Icon, disabled, soon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { if (!disabled) setActiveTab(id); }}
                    disabled={disabled}
                    className={`relative flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all duration-200 border-b-2
                      ${ activeTab === id
                          ? 'border-[#111827] text-[#111827]'
                          : disabled
                          ? 'border-transparent text-gray-300 cursor-not-allowed'
                          : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                      }`}
                    tabIndex={disabled ? -1 : 0}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="relative">
                      {label}
                      {soon && (
                        <span className="absolute -top-2 -right-6 bg-[#111827] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold tracking-wide" style={{ transform: 'rotate(10deg)' }}>Soon</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>

            </div>
          </div>
          {/* White content area */}
          <div className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">


            {/* Tab Content */}
            {activeTab === 'overview' && (
              <OverviewTab
                userData={userData}
                familyMembers={familyMembers}
                appointments={appointments}
                favoritesCount={favoritesCount}
                notifications={notifications}
                unreadNotificationsCount={unreadNotificationsCount}
                setActiveTab={setActiveTab}
                onMarkNotificationAsRead={async (notificationId: string) => {
                  try {
                    await api.markClientNotificationAsRead(notificationId);
                    setNotifications(prev => prev.map(n => 
                      n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
                    ));
                    setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
                  } catch (error) {
                    console.error('Error marking notification as read:', error);
                  }
                }}
              />
            )}
            {activeTab === 'appointments' && (
              loadingAppointments ? (
                <div className="flex items-center justify-center py-32">
                  <Loading />
                </div>
              ) : (
                <AppointmentsTab
                  appointments={appointments}
                  getStatusText={getStatusText}
                  handleAddReview={handleAddReview}
                  onUpdateAppointment={refreshAppointments}
                  onSortChange={(sortBy) => setAppointmentsSortBy(sortBy)}
                  currentSort={appointmentsSortBy}
                />
              )
            )}
            {activeTab === 'family' && (
              <FamilyTab
                familyMembers={familyMembers}
                handleEditPerson={handleEditPerson}
                handleDeletePerson={handleDeletePerson}
                handleAddPerson={handleAddPerson}
                handleSaveEditedPerson={saveEditedPerson}
              />
            )}
            {activeTab === 'avis' && (
              loadingReviews ? (
                <div className="flex items-center justify-center py-32">
                  <Loading />
                </div>
              ) : (
                <ReviewsTab
                  reviews={reviews as any}
                  handleDeleteReview={handleDeleteReview as any}
                />
              )
            )}
            {/* Coming Soon for Mes récompenses */}
            {activeTab === 'rewards' && (
              <div className="flex flex-col items-center justify-center py-32 animate-fadeIn">
                <GiftTablerIcon className="w-16 h-16 text-[#8b7260] mb-6" />
                <h2 className="text-2xl font-light text-gray-900 mb-2">Mes récompenses</h2>
                <p className="text-lg text-gray-400 mb-4">Bientôt disponible !</p>
                <span className="inline-block bg-[#f5f7f3] text-[#8b7260] px-4 py-2 rounded-full text-xs font-medium">Coming Soon</span>
              </div>
            )}
            {activeTab === 'profile' && (
              <ProfileTab 
                userData={userData} 
                onUpdate={async (updatedClientData?: any) => {
                  // If updated client data is provided directly from the update response, use it
                  // This avoids the issue where getClientAppointments doesn't return the avatar
                  if (updatedClientData) {
                    const clientAvatar = (updatedClientData as any).avatar;
                    setUserData(prev => {
                      // Always use the values from the API response, even if they're empty strings
                      const newData = {
                        ...prev,
                        firstName: updatedClientData.firstName || '',
                        lastName: updatedClientData.lastName || '',
                        email: updatedClientData.email || '',
                        phone: updatedClientData.phone || '',
                        address: (updatedClientData as any).address || '',
                        avatar: clientAvatar !== undefined && clientAvatar !== null ? clientAvatar : prev.avatar,
                      };
                      return newData;
                    });
                  } else {
                    // Fallback: refresh from API if no data provided
                    try {
                      if (user?.email) {
                        const appointmentsRes = await api.getClientAppointments(user.email);
                        if (appointmentsRes.client) {
                          const client = appointmentsRes.client;
                          const clientAvatar = (client as any).avatar;
                          setUserData(prev => ({
                            ...prev,
                            firstName: client.firstName ?? prev.firstName,
                            lastName: client.lastName ?? prev.lastName,
                            email: client.email ?? prev.email,
                            phone: client.phone ?? prev.phone ?? '',
                            address: client.address ?? prev.address ?? '',
                            avatar: clientAvatar !== undefined && clientAvatar !== null ? clientAvatar : prev.avatar,
                          }));
                        }
                      }
                    } catch (error: any) {
                      console.error('[Account] Error refreshing user data:', error);
                    }
                  }
                }}
              />
            )}
          </div>
          </div>
          {/* Add Person Modal */}
          {showAddPersonModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8 relative animate-fadeIn">
                <button
                  onClick={() => setShowAddPersonModal(false)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
                <h3 className="text-lg font-light text-gray-900 mb-6">Ajouter un proche</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nom</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={newPerson.name}
                      onChange={e => setNewPerson({ ...newPerson, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Lien de parenté</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={newPerson.relationship}
                      onChange={e => setNewPerson({ ...newPerson, relationship: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Téléphone</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={newPerson.phone}
                      onChange={e => setNewPerson({ ...newPerson, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                      value={newPerson.email}
                      onChange={e => setNewPerson({ ...newPerson, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-8">
                  <button
                    onClick={() => setShowAddPersonModal(false)}
                    className="px-6 py-2 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-900 text-xs rounded transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAddPerson}
                    className="px-6 py-2 bg-gray-900 text-white text-xs rounded hover:bg-[#8b7260] transition-all"
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Person Modal */}
          {showEditModal && editingPerson && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8 relative animate-fadeIn">
                <button
                  onClick={() => { setShowEditModal(false); setEditingPerson(null); }}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
                <h3 className="text-lg font-light text-gray-900 mb-6">Modifier le proche</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nom</label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={editingPerson?.name || ''}
                        onChange={e => setEditingPerson({ ...(editingPerson || {}), name: e.target.value })}
                      />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Lien de parenté</label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={editingPerson?.relationship || ''}
                        onChange={e => setEditingPerson({ ...(editingPerson || {}), relationship: e.target.value })}
                      />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Téléphone</label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={editingPerson?.phone || ''}
                        onChange={e => setEditingPerson({ ...(editingPerson || {}), phone: e.target.value })}
                      />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        className="w-full border border-gray-200 px-4 py-2 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={editingPerson?.email || ''}
                        onChange={e => setEditingPerson({ ...(editingPerson || {}), email: e.target.value })}
                      />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-8">
                  <button
                    onClick={() => { setShowEditModal(false); setEditingPerson(null); }}
                    className="px-6 py-2 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-900 text-xs rounded transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveEditedPerson}
                    className="px-6 py-2 bg-gray-900 text-white text-xs rounded hover:bg-[#8b7260] transition-all"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Password Change Modal */}
          {showPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8 relative animate-fadeIn">
                <button
                  onClick={() => { 
                    setShowPasswordModal(false); 
                    setPasswordData({ current: '', new: '', confirm: '' });
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                    <Key className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-light text-gray-900">Changer le mot de passe</h3>
                    <p className="text-xs text-gray-400">Sécurisez votre compte</p>
                  </div>
                </div>
                
                {/* Error Message */}
                {passwordError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
                    {passwordError}
                  </div>
                )}
                
                {/* Success Message */}
                {passwordSuccess && (
                  <div className="mb-4 bg-green-50 border border-green-200 text-green-600 rounded-lg px-4 py-3 text-sm">
                    {passwordSuccess}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Mot de passe actuel</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        className="w-full border border-gray-200 px-4 py-2 pr-10 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={passwordData.current}
                        onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        className="w-full border border-gray-200 px-4 py-2 pr-10 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={passwordData.new}
                        onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Minimum 8 caractères</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Confirmer le mot de passe</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className="w-full border border-gray-200 px-4 py-2 pr-10 text-sm rounded focus:outline-none focus:border-gray-900"
                        value={passwordData.confirm}
                        onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-8">
                  <button
                    onClick={() => { 
                      setShowPasswordModal(false); 
                      setPasswordData({ current: '', new: '', confirm: '' });
                      setShowCurrentPassword(false);
                      setShowNewPassword(false);
                      setShowConfirmPassword(false);
                    }}
                    className="px-6 py-2 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-900 text-xs rounded transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handlePasswordChange}
                    className="px-6 py-2 bg-gray-900 text-white text-xs rounded hover:bg-[#8b7260] transition-all"
                  >
                    Modifier
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2FA Modal */}
          {show2FAModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8 relative animate-fadeIn">
                <button
                  onClick={() => { 
                    setShow2FAModal(false); 
                    setTwoFactorStep('setup');
                    setVerificationCode('');
                  }}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-all"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
                
                {twoFactorStep === 'setup' && (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-light text-gray-900">Authentification à deux facteurs</h3>
                        <p className="text-xs text-gray-400">Renforcez la sécurité de votre compte</p>
                      </div>
                    </div>
                    <div className="space-y-4 mb-6">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-3">Scannez ce code QR avec votre application d'authentification (Google Authenticator, Authy, etc.)</p>
                        <div className="w-48 h-48 mx-auto bg-white p-4 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-40 h-40 bg-gray-200 rounded mb-2 flex items-center justify-center">
                              <span className="text-xs text-gray-400">QR Code</span>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-3 text-center">Code de secours: ABCD-EFGH-IJKL-MNOP</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTwoFactorStep('verify')}
                      className="w-full px-6 py-3 bg-gray-900 text-white text-sm rounded hover:bg-[#8b7260] transition-all"
                    >
                      Continuer
                    </button>
                  </>
                )}

                {twoFactorStep === 'verify' && (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-light text-gray-900">Vérification</h3>
                        <p className="text-xs text-gray-400">Entrez le code de votre application</p>
                      </div>
                    </div>
                    
                    {/* Error Message */}
                    {twoFactorError && (
                      <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
                        {twoFactorError}
                      </div>
                    )}
                    
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-xs text-gray-400 mb-2">Code de vérification</label>
                        <input
                          type="text"
                          maxLength={6}
                          className="w-full border border-gray-200 px-4 py-3 text-center text-2xl font-light tracking-widest rounded focus:outline-none focus:border-gray-900"
                          placeholder="000000"
                          value={verificationCode}
                          onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setTwoFactorStep('setup');
                          setVerificationCode('');
                        }}
                        className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-900 text-sm rounded transition-all"
                      >
                        Retour
                      </button>
                      <button
                        onClick={handleEnable2FA}
                        className="flex-1 px-6 py-3 bg-gray-900 text-white text-sm rounded hover:bg-[#8b7260] transition-all"
                      >
                        Vérifier
                      </button>
                    </div>
                  </>
                )}

                {twoFactorStep === 'success' && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-light text-gray-900 mb-2">Authentification activée!</h3>
                    <p className="text-sm text-gray-400">Votre compte est maintenant protégé par l'authentification à deux facteurs</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Footer */}
      <Footer />
    </>
  );
}