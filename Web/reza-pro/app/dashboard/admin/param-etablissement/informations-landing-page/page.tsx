'use client';

import React, { useState, useEffect } from 'react';
import { Globe, MapPin, Tag, Building, Image as ImageIcon, Check, Loader2, X, Plus, Star, BadgeCheck, Instagram, Facebook, Phone, Mail, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getImageUrl } from '@/lib/utils';
import SalonScopeNotice from '@/components/SalonScopeNotice';
import SalonLocationPicker from '@/components/SalonLocationPicker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import toast from 'react-hot-toast';

// Brand icons (lucide has no X / TikTok / WhatsApp logos)
const XBrandIcon = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const WhatsAppBrandIcon = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const TikTokBrandIcon = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const InformationsLandingPage = () => {
  const { isAuthenticated, salonFilter, effectiveSalonIds, isSalonFilterMulti } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Tenant fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  // Multiple cover images (up to 20). One is explicitly designated as the
  // primary cover (stored on tenant.coverImage); the rest live in
  // settings.coverImages.
  const [coverImages, setCoverImages] = useState<string[]>([]);
  const [primaryCover, setPrimaryCover] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [shortDescription, setShortDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Settings fields
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [badges, setBadges] = useState<string[]>([]);
  const [newBadge, setNewBadge] = useState('');
  const [socialMedia, setSocialMedia] = useState({
    instagram: '',
    facebook: '',
    x: '',
    tiktok: '',
    whatsapp: ''
  });

  
  // Display controls
  const [showMap, setShowMap] = useState(true);
  const [showOpeningHours, setShowOpeningHours] = useState(true);
  const [showOnlineReservation, setShowOnlineReservation] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [onlineReservationEnabled, setOnlineReservationEnabled] = useState(true);

  const categories = [
    'Coiffeur',
    'Barbier',
    'Manucure',
    'Institut de beauté',
    'Spa',
    'Massage',
    'Établissement'
  ];

  const moroccanCities = [
    'Agadir',
    'Beni Mellal',
    'Casablanca',
    'El Jadida',
    'Fès',
    'Kenitra',
    'Khouribga',
    'Marrakech',
    'Meknès',
    'Mohammedia',
    'Oujda',
    'Rabat',
    'Safi',
    'Salé',
    'Tanger',
    'Tétouan',
    'Autre'
  ];

  const commonAmenities = [
    'WiFi gratuit',
    'Climatisation',
    'Parking',
    'Accessible PMR',
    'Cabine privée',
    'Douche',
    'Hammam',
    'Sauna',
    'Jacuzzi',
    'Terrasse'
  ];

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
  }, [isAuthenticated, salonFilterKey]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tenantRes, settingsRes] = await Promise.all([
        api.getTenant(),
        api.getTenantSettings()
      ]);

      const tenant = tenantRes.tenant;
      const settings = settingsRes.settings;

      // Set tenant fields
      setName(tenant.name || '');
      setAddress(tenant.address || '');
      setCategory(tenant.category || '');
      // Cover images: primary cover (tenant.coverImage) + additional cover images (settings.coverImages)
      const extraCovers = Array.isArray(settings.coverImages) ? settings.coverImages : [];
      const primary = tenant.coverImage || extraCovers[0] || '';
      setPrimaryCover(primary);
      setCoverImages(primary ? [primary, ...extraCovers.filter((c) => c !== primary)] : extraCovers);
      setShortDescription(tenant.shortDescription || '');
      setWebsite(tenant.website || '');
      setPhone(tenant.phone || '');
      setEmail(tenant.email || '');
      setCity(tenant.city || '');
      setLatitude(tenant.latitude?.toString() || '');
      setLongitude(tenant.longitude?.toString() || '');
      setTags(tenant.tags || []);

      // Set settings fields
      setAmenities((settings.amenities as string[]) || []);
      setBadges(((settings as any).badges as string[]) || []);
      // Legacy key 'twitter' is migrated to 'x' on load
      const sm = (settings.socialMedia as any) || {};
      setSocialMedia({
        instagram: sm.instagram || '',
        facebook: sm.facebook || '',
        x: sm.x || sm.twitter || '',
        tiktok: sm.tiktok || '',
        whatsapp: sm.whatsapp || ''
      });

      
      // Set display controls
      setShowMap(settings.showMap !== false);
      setShowOpeningHours(settings.showOpeningHours !== false);
      setShowOnlineReservation(settings.showOnlineReservation !== false);
      setShowReviews(settings.showReviews !== false);
      setOnlineReservationEnabled(settings.onlineReservationEnabled !== false);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      toast.error(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;

    try {
      setSaving(true);
      const loadingToast = toast.loading('Enregistrement des informations...');

      // Update tenant (explicit primary cover; coordinates come from the map picker)
      await api.updateTenant({
        name: name || undefined,
        address: address || undefined,
        category: category || undefined,
        coverImage: primaryCover || '',
        shortDescription: shortDescription || undefined,
        website: website || undefined,
        phone: phone || undefined,
        email: email || undefined,
        city: city || undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        tags: tags.length > 0 ? tags : undefined
      });

      // Update settings
      await api.updateTenantSettings({
        amenities: amenities.length > 0 ? amenities : undefined,
        badges: badges.length > 0 ? badges : [],
        coverImages: coverImages.filter((c) => c !== primaryCover),
        socialMedia: Object.values(socialMedia).some(v => v) ? socialMedia : undefined,
        showMap,
        showOpeningHours,
        showOnlineReservation,
        showReviews,
        onlineReservationEnabled
      });

      toast.dismiss(loadingToast);
      toast.success('Informations enregistrées avec succès');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving data:', err);
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const addAmenity = (amenity: string) => {
    if (!amenities.includes(amenity)) {
      setAmenities([...amenities, amenity]);
    }
  };

  const removeAmenity = (amenity: string) => {
    setAmenities(amenities.filter(a => a !== amenity));
  };

  const addBadge = () => {
    const trimmed = newBadge.trim();
    if (trimmed && !badges.includes(trimmed)) {
      setBadges([...badges, trimmed]);
      setNewBadge('');
    }
  };

  const removeBadge = (badge: string) => {
    setBadges(badges.filter(b => b !== badge));
  };

  const addCustomAmenity = () => {
    if (newAmenity.trim() && !amenities.includes(newAmenity.trim())) {
      setAmenities([...amenities, newAmenity.trim()]);
      setNewAmenity('');
    }
  };

  const MAX_COVER_IMAGES = 20;

  // Persist the current cover-image set (primary + extras) to the backend so
  // uploads, deletions, reorders and primary changes survive a page refresh
  // without requiring the full "SAUVEGARDER" click.
  const persistCovers = async (nextCovers: string[], nextPrimary: string) => {
    try {
      await api.updateTenant({ coverImage: nextPrimary });
      await api.updateTenantSettings({ coverImages: nextCovers.filter((c) => c !== nextPrimary) });
    } catch (err: any) {
      console.error('Error persisting cover images:', err);
      toast.error(err.message || "Erreur lors de l'enregistrement des images");
    }
  };

  const handleUploadCoverImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (coverImages.length + files.length > MAX_COVER_IMAGES) {
      toast.error(`Maximum ${MAX_COVER_IMAGES} images de couverture (${coverImages.length} déjà ajoutées)`);
      return;
    }
    setUploadingImage(true);
    try {
      // Upload every selected file (each one only stores the file + returns its
      // URL — it never overwrites the current primary cover).
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const result = await api.uploadCoverImage(file);
        const raw = result.coverImage;
        if (raw && !uploaded.includes(raw)) uploaded.push(raw);
      }
      if (uploaded.length === 0) return;

      // APPEND to the existing set (never replace it), and default the primary
      // to the first image when none is set yet.
      const nextCovers = [...coverImages];
      let nextPrimary = primaryCover;
      for (const u of uploaded) {
        if (!nextCovers.includes(u)) nextCovers.push(u);
        if (!nextPrimary) nextPrimary = u;
      }
      setCoverImages(nextCovers);
      if (nextPrimary !== primaryCover) setPrimaryCover(nextPrimary);
      await persistCovers(nextCovers, nextPrimary);
      toast.success('Images uploadées avec succès');
    } catch (err: any) {
      console.error('Error uploading images:', err);
      toast.error(err.message || "Erreur lors de l'upload des images");
    } finally {
      setUploadingImage(false);
    }
  };

  // Explicitly designate an image as the primary one (star button on the
  // thumbnail). Persists immediately so the choice survives a refresh.
  const handleSetPrimaryCover = async (index: number) => {
    const url = coverImages[index];
    if (!url || url === primaryCover) return;
    const nextPrimary = url;
    setPrimaryCover(nextPrimary);
    setCoverImages((prev) => [nextPrimary, ...prev.filter((c) => c !== nextPrimary)]);
    await persistCovers(coverImages, nextPrimary);
  };

  const moveCoverImage = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= coverImages.length) return;
    // Compute the reordered array from the current state so persistence uses
    // the exact same list that gets rendered (no functional-updater race).
    const next = [...coverImages];
    [next[index], next[target]] = [next[target], next[index]];
    setCoverImages(next);
    await persistCovers(next, primaryCover);
  };

  const removeCoverImage = async (index: number) => {
    const removed = coverImages[index];
    const next = coverImages.filter((_, i) => i !== index);
    const nextPrimary = removed === primaryCover ? next[0] || '' : primaryCover;
    setCoverImages(next);
    if (nextPrimary !== primaryCover) setPrimaryCover(nextPrimary);
    await persistCovers(next, nextPrimary);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-0 md:p-0 max-w-[2000px] mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#002366] w-8 h-8" />
          <span className="ml-3 text-gray-600">Chargement des informations...</span>
        </div>
      </div>
    );
  }

  // Landing-page content is salon-specific: require a single salon selection.
  if (isSalonFilterMulti) {
    return (
      <SalonScopeNotice
        title="Informations Landing Page"
        subtitle="Gérez les informations affichées sur votre page publique Reza"
      />
    );
  }

  return (
    <div className="min-h-screen p-0 md:p-0 max-w-[2000px] mx-auto">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>

      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed top-6 right-6 bg-green-400 text-white px-6 py-3 rounded shadow-lg z-50 flex items-center gap-3 animate-fadeIn">
          <Check size={20} />
          <span className="font-medium">Modifications enregistrées avec succès</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 animate-slideUp">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-2">
              Informations Landing Page
            </h1>
            <p className="text-sm text-gray-500">
              Gérez les informations affichées sur votre page publique Reza
            </p>
          </div>
        </div>
      </div>

      {/* Form Sections */}
      <div className="space-y-6 animate-fadeIn">
        {/* Name */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nom du salon *
          </label>
          <div className="flex items-center gap-3">
            <Building className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de votre établissement"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
            />
          </div>
        </div>

        {/* Category */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Catégorie principale *
          </label>
          <Select value={category || 'none'} onValueChange={(v) => setCategory(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-full rounded-xl border border-gray-300 bg-white">
              <SelectValue placeholder="Sélectionner une catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sélectionner une catégorie</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Short Description */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            rows={3}
            maxLength={200}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] text-sm text-gray-700 resize-none"
            placeholder="Une description courte qui apparaîtra dans les résultats de recherche..."
          />
          <div className="mt-1 text-xs text-gray-500 text-right">
            {shortDescription.length}/200 caractères
          </div>
        </div>

        {/* Cover Images (up to 20) */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Images de couverture
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Jusqu'à {MAX_COVER_IMAGES} images. Cliquez sur l'étoile pour définir l'image
            principale ; toutes sont affichées en galerie sur votre page publique (portfolio et carrousel).
          </p>
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-gray-400" />
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                void handleUploadCoverImages(e.target.files);
                e.target.value = '';
              }}
              disabled={uploadingImage || coverImages.length >= MAX_COVER_IMAGES}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#002366] file:text-white hover:file:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          {uploadingImage && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Upload en cours...</span>
            </div>
          )}
          {coverImages.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2">
                {coverImages.length} / {MAX_COVER_IMAGES} image{coverImages.length > 1 ? 's' : ''}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {coverImages.map((img, idx) => (
                  <div
                    key={`${img}-${idx}`}
                    className="relative group rounded-xl overflow-hidden border border-gray-200"
                  >
                    <img
                      src={getImageUrl(img)}
                      alt={`Couverture ${idx + 1}`}
                      className="w-full h-52 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSetPrimaryCover(idx)}
                      disabled={img === primaryCover}
                      title={img === primaryCover ? 'Image principale' : 'Définir comme image principale'}
                      className={`absolute top-1.5 left-1.5 p-1.5 rounded-full shadow transition-colors ${
                        img === primaryCover
                          ? 'bg-amber-400 text-white cursor-default'
                          : 'bg-white/90 text-gray-400 hover:text-amber-500'
                      }`}
                    >
                      <Star size={14} className={img === primaryCover ? 'fill-white' : ''} />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveCoverImage(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 rounded bg-white/90 text-gray-700 hover:bg-white disabled:opacity-40"
                          title="Monter"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCoverImage(idx, 1)}
                          disabled={idx === coverImages.length - 1}
                          className="p-1 rounded bg-white/90 text-gray-700 hover:bg-white disabled:opacity-40"
                          title="Descendre"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCoverImage(idx)}
                        className="p-1 rounded bg-white/90 text-red-600 hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Website */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Site web
          </label>
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-gray-400" />
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.example.com"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
            />
          </div>
        </div>

        {/* Phone */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Téléphone
          </label>
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 6XX XXX XXX"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
            />
          </div>
        </div>

        {/* Email */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
            />
          </div>
        </div>

        {/* City */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ville
          </label>
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
            <SearchableSelect
              value={city}
              onValueChange={setCity}
              options={moroccanCities.map((c) => ({ value: c, label: c }))}
              placeholder="Sélectionner une ville"
              searchPlaceholder="Rechercher une ville…"
              emptyLabel="Aucune ville trouvée"
              className="flex-1"
            />
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Adresse
          </label>
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rue, quartier, n° ..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
            />
          </div>
        </div>

        {/* Location — interactive map picker (OpenStreetMap). The Google Maps link
            is auto-generated from these coordinates on the public page, so the old
            manual "Lien Google Maps" field has been removed. */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <SalonLocationPicker
            value={latitude && longitude ? { lat: parseFloat(latitude), lng: parseFloat(longitude) } : null}
            onChange={(c) => {
              setLatitude(String(c.lat));
              setLongitude(String(c.lng));
            }}
            onAddressSuggest={(suggestion) => {
              if (suggestion.address && !address.trim()) {
                setAddress(suggestion.address);
              }
              if (suggestion.city && !city) {
                setCity(suggestion.city);
              }
            }}
          />
        </div>

        {/* Tags */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (pour la recherche)
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Ajouter un tag"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
            />
            <button
              onClick={addTag}
              className="px-4 py-2 bg-[#002366] text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  <Tag size={14} />
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Amenities */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Équipements et services
          </label>
          <div className="mb-4">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAmenity())}
                placeholder="Ajouter un équipement personnalisé"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
              />
              <button
                onClick={addCustomAmenity}
                className="px-4 py-2 bg-[#002366] text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-2">Équipements courants :</div>
            <div className="flex flex-wrap gap-2">
              {commonAmenities.map(amenity => (
                <button
                  key={amenity}
                  onClick={() => amenities.includes(amenity) ? removeAmenity(amenity) : addAmenity(amenity)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    amenities.includes(amenity)
                      ? 'bg-[#002366] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {amenities.includes(amenity) && <Check size={14} className="inline mr-1" />}
                  {amenity}
                </button>
              ))}
            </div>
          </div>
          {amenities.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Équipements sélectionnés :</div>
              <div className="flex flex-wrap gap-2">
                {amenities.map(amenity => (
                  <span
                    key={amenity}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {amenity}
                    <button
                      onClick={() => removeAmenity(amenity)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Badges / Certifications */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Badges &amp; Certifications
          </label>
          <p className="text-xs text-gray-400 mb-3">Ex. : &quot;Certifié bio&quot;, &quot;Prix qualité 2025&quot;, &quot;Agréé professionnel&quot;</p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newBadge}
              onChange={(e) => setNewBadge(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBadge())}
              placeholder="Ajouter un badge..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
            />
            <button
              type="button"
              onClick={addBadge}
              className="px-4 py-2 bg-[#002366] text-white rounded-lg text-sm hover:bg-[#001a4d] transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badges.map(badge => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-sm font-medium"
                >
                  <BadgeCheck size={14} />
                  {badge}
                  <button
                    onClick={() => removeBadge(badge)}
                    className="text-amber-500 hover:text-red-500 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Social Media */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Réseaux sociaux
          </label>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Instagram className="w-5 h-5 text-pink-500" />
              <input
                type="url"
                value={socialMedia.instagram}
                onChange={(e) => setSocialMedia({ ...socialMedia, instagram: e.target.value })}
                placeholder="https://instagram.com/votre-compte"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
              />
            </div>
            <div className="flex items-center gap-3">
              <Facebook className="w-5 h-5 text-blue-600" />
              <input
                type="url"
                value={socialMedia.facebook}
                onChange={(e) => setSocialMedia({ ...socialMedia, facebook: e.target.value })}
                placeholder="https://facebook.com/votre-page"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
              />
            </div>
            <div className="flex items-center gap-3">
              <XBrandIcon className="text-gray-800" />
              <input
                type="url"
                value={socialMedia.x}
                onChange={(e) => setSocialMedia({ ...socialMedia, x: e.target.value })}
                placeholder="https://x.com/votre-compte"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
              />
            </div>
            <div className="flex items-center gap-3">
              <TikTokBrandIcon className="text-gray-800" />
              <input
                type="url"
                value={socialMedia.tiktok}
                onChange={(e) => setSocialMedia({ ...socialMedia, tiktok: e.target.value })}
                placeholder="https://tiktok.com/@votre-compte"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
              />
            </div>
            <div className="flex items-center gap-3">
              <WhatsAppBrandIcon className="text-green-500" />
              <input
                type="tel"
                value={socialMedia.whatsapp}
                onChange={(e) => setSocialMedia({ ...socialMedia, whatsapp: e.target.value })}
                placeholder="+212 6XX XXX XXX"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
              />
            </div>
          </div>
        </div>

        {/* Display Controls */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Contrôles d'affichage</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showMap}
                onChange={(e) => setShowMap(e.target.checked)}
                className="w-5 h-5 text-[#002366] border-gray-300 rounded focus:ring-[#002366]"
              />
              <span className="text-sm font-medium text-gray-700">
                Afficher la carte
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-8">
              Affiche la carte avec votre localisation sur la page publique
            </p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showOpeningHours}
                onChange={(e) => setShowOpeningHours(e.target.checked)}
                className="w-5 h-5 text-[#002366] border-gray-300 rounded focus:ring-[#002366]"
              />
              <span className="text-sm font-medium text-gray-700">
                Afficher les horaires d'ouverture
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-8">
              Affiche les horaires d'ouverture sur la page publique
            </p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlineReservation}
                onChange={(e) => setShowOnlineReservation(e.target.checked)}
                className="w-5 h-5 text-[#002366] border-gray-300 rounded focus:ring-[#002366]"
              />
              <span className="text-sm font-medium text-gray-700">
                Afficher le bouton de réservation en ligne
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-8">
              Affiche le bouton "Réserver maintenant" sur la page publique
            </p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showReviews}
                onChange={(e) => setShowReviews(e.target.checked)}
                className="w-5 h-5 text-[#002366] border-gray-300 rounded focus:ring-[#002366]"
              />
              <span className="text-sm font-medium text-gray-700">
                Afficher les avis clients
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-8">
              Affiche la section des avis clients sur la page publique
            </p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onlineReservationEnabled}
                onChange={(e) => setOnlineReservationEnabled(e.target.checked)}
                className="w-5 h-5 text-[#002366] border-gray-300 rounded focus:ring-[#002366]"
              />
              <span className="text-sm font-medium text-gray-700">
                Activer la réservation en ligne
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-8">
              Permet aux clients de réserver en ligne via votre page publique
            </p>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#002366] hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 rounded-full transition-colors uppercase text-sm tracking-wide flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin w-4 h-4" />
              Enregistrement...
            </>
          ) : (
            'SAUVEGARDER'
          )}
        </button>
      </div>
    </div>
  );
};

export default InformationsLandingPage;

