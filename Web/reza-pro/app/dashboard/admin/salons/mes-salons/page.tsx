'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  Building,
  Plus,
  Check,
  Loader2,
  FileText,
  ImagePlus,
  X,
  Pencil,
  Trash2,
  Landmark,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth, type Salon } from '@/contexts/AuthContext';
import { getImageUrl } from '@/lib/utils';
import { SalonFilterControl } from '@/components/SalonFilterControl';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { LatLng } from '@/components/SalonLocationPicker';

const SalonLocationPicker = dynamic(() => import('@/components/SalonLocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-56 sm:h-64 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
      Chargement de la carte…
    </div>
  ),
});

const CATEGORIES = [
  'Coiffeur',
  'Barbier',
  'Manucure',
  'Institut de beauté',
  'Spa',
  'Massage',
  'Établissement',
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  category: '',
  shortDescription: '',
};

function coverUrl(path?: string | null): string | null {
  const url = getImageUrl(path);
  return url || null;
}

export default function MesSalonsPage() {
  const {
    salons,
    subscription,
    subscriptionActive,
    setSalonFilter,
    effectiveSalonIds,
    createSalon,
    deleteSalon,
  } = useAuth();

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Salon | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const formComplete = useMemo(() => {
    const hasCover = !!coverFile;
    return (
      form.name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.phone.trim().length > 0 &&
      form.city.trim().length > 0 &&
      form.category.trim().length > 0 &&
      form.shortDescription.trim().length > 0 &&
      hasCover &&
      coords != null
    );
  }, [form, coverFile, coords]);

  const resetForm = () => {
    setForm(emptyForm);
    setCoords(null);
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image trop volumineuse (max 5 Mo)');
      return;
    }
    setError(null);
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formComplete || !coverFile || !coords) {
      setError('Tous les champs obligatoires, la carte et l\'image de couverture sont requis');
      return;
    }
    setSubmitting(true);
    const result = await createSalon({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim() || undefined,
      city: form.city.trim(),
      category: form.category.trim(),
      shortDescription: form.shortDescription.trim(),
      coverImage: coverFile,
      latitude: coords.lat,
      longitude: coords.lng,
    });
    setSubmitting(false);
    if (result.success) {
      resetForm();
      setShowAddForm(false);
    } else {
      setError(result.error || 'Impossible de créer le salon');
    }
  };

  const handleFocusSalon = (tenantId: string) => {
    setSwitching(tenantId);
    setSalonFilter([tenantId]);
    setSwitching(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    const result = await deleteSalon(deleteTarget.id);
    setDeleting(false);
    if (result.success) {
      setDeleteTarget(null);
    } else {
      setError(result.error || 'Impossible de supprimer le salon');
      setDeleteTarget(null);
    }
  };

  const previewSrc = coverPreview;

  const renderSalonForm = () => (
    <form
      onSubmit={handleCreate}
      className="rounded-2xl border border-gray-200 bg-white p-6 mb-8"
    >
      <h2 className="text-base font-semibold text-gray-900 mb-4">Nouveau salon</h2>
      <p className="text-xs text-gray-500 mb-4">
        Tous les champs marqués * sont obligatoires pour que le salon puisse apparaître côté client.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
          placeholder="Nom du salon *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
          placeholder="Email du salon *"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
          placeholder="Téléphone *"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
        <input
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
          placeholder="Ville *"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          required
        />
        <input
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
          placeholder="Adresse"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <select
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30 bg-white"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          required
        >
          <option value="">Catégorie *</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <div className="md:col-span-2">
          <textarea
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30 resize-none"
            placeholder="Description courte *"
            rows={3}
            maxLength={200}
            value={form.shortDescription}
            onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
            required
          />
          <p className="text-[11px] text-gray-400 mt-1 text-right">
            {form.shortDescription.length}/200
          </p>
        </div>
        <div className="md:col-span-2">
          <SalonLocationPicker
            key="create"
            value={coords}
            onChange={setCoords}
            onAddressSuggest={(suggestion) => {
              setForm((prev) => ({
                ...prev,
                address:
                  !prev.address.trim() && suggestion.address
                    ? suggestion.address
                    : prev.address,
                city:
                  !prev.city.trim() && suggestion.city ? suggestion.city : prev.city,
              }));
            }}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image de couverture *
          </label>
          {!previewSrc ? (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-8 cursor-pointer hover:border-[#002366] hover:bg-[#002366]/5 transition-all">
              <ImagePlus size={28} className="text-[#002366]" />
              <span className="text-sm text-gray-600">Choisir une image (max 5 Mo)</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverChange}
              />
            </label>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc}
                alt="Aperçu couverture"
                className="w-full h-40 object-cover"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <label className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow cursor-pointer">
                  <Pencil size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverChange}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
                    setCoverFile(null);
                    setCoverPreview(null);
                  }}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-gray-700 hover:bg-white shadow"
                  aria-label="Retirer l'image"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-5">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowAddForm(false);
          }}
          className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={submitting || !formComplete}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
            submitting || !formComplete
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-[#002366] text-white hover:bg-[#001a4d]'
          }`}
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Créer le salon
        </button>
      </div>
    </form>
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Building className="text-[#002366]" size={26} />
            Salons
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {salons.length} salon{salons.length > 1 ? 's' : ''} {salons.length > 1 ? 'utilisés' : 'utilisé'}
          </p>
          {salons.length > 1 && (
            <p className="text-xs text-gray-400 mt-2 max-w-lg">
              Le filtre ci-dessous s&apos;applique à l&apos;Agenda, Clients et Caisse.
              Sélectionnez un salon pour configurer ou consulter ses données.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SalonFilterControl />
          <button
            onClick={() => {
              resetForm();
              setShowAddForm((v) => !v);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-[#002366] text-white hover:bg-[#001a4d] transition-all"
          >
            <Plus size={18} />
            Ajouter un salon
          </button>
        </div>
      </div>

      <div
        className={`rounded-2xl border p-5 mb-8 flex items-center justify-between gap-4 ${
          subscriptionActive ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        }`}
      >
        <div>
          <p className={`text-sm font-semibold ${subscriptionActive ? 'text-green-800' : 'text-amber-800'}`}>
            {subscriptionActive
              ? 'Abonnement actif'
              : 'Aucun abonnement actif'}
          </p>
          <p className={`text-xs mt-1 ${subscriptionActive ? 'text-green-700' : 'text-amber-700'}`}>
            {subscriptionActive
              ? subscription?.currentPeriodEnd
                ? `Valable jusqu'au ${new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR')}`
                : 'Vos salons sont visibles par les clients.'
              : 'Vos salons ne sont pas visibles par les clients tant que votre facturation n’est pas réglée.'}
          </p>
          <Link
            href="/dashboard/admin/mon-abonnement"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#002366] hover:underline mt-1"
          >
            <FileText size={12} />
            Voir mon abonnement
          </Link>
        </div>
        {!subscriptionActive && (
          <Link
            href="/dashboard/admin/mon-abonnement"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#002366] text-white text-sm font-semibold hover:bg-[#001a4d] transition-all shrink-0"
          >
            <Landmark size={16} />
            Régler ma facture
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {showAddForm && renderSalonForm()}

      <div className="space-y-4">
        {salons.map((salon) => {
          const isFocused =
            effectiveSalonIds.length === 1 && effectiveSalonIds[0] === salon.id;
          const thumb = coverUrl(salon.coverImage);
          return (
            <div
              key={salon.id}
              className={`rounded-2xl border bg-white p-5 flex items-center justify-between gap-4 transition-all ${
                isFocused
                  ? 'border-[#002366] ring-1 ring-[#002366]/20'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    className="w-11 h-11 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isFocused ? 'bg-[#002366] text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Building size={20} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                    {salon.name}
                    {isFocused && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#002366] bg-[#002366]/10 px-2 py-0.5 rounded-full">
                        <Check size={12} /> Filtré
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {salon.city || 'Ville non renseignée'}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {salon.subscriptionActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check size={11} /> Visible aux clients
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        Non visible aux clients
                      </span>
                    )}
                    {!salon.subscriptionActive && (
                      <Link
                        href={`/dashboard/admin/mon-abonnement?salonId=${salon.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#002366] hover:underline"
                      >
                        <Landmark size={11} />
                        À couvrir
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(salon)}
                  disabled={salons.length <= 1}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-semibold transition-all ${
                    salons.length <= 1
                      ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                      : 'border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                  title={
                    salons.length <= 1
                      ? 'Impossible de supprimer le dernier salon'
                      : 'Supprimer'
                  }
                >
                  <Trash2 size={14} />
                </button>
                {!isFocused && (
                  <button
                    onClick={() => handleFocusSalon(salon.id)}
                    disabled={switching === salon.id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#002366] text-[#002366] text-sm font-semibold hover:bg-[#002366] hover:text-white transition-all"
                  >
                    {switching === salon.id && <Loader2 size={14} className="animate-spin" />}
                    Gérer
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {salons.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            Aucun salon pour le moment. Ajoutez votre premier salon.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title="Désactiver ce salon ?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" sera masqué de votre liste et des clients.\n\nLes rendez-vous, clients et prestations restent en base (désactivation, pas suppression définitive).\n\nCette action est bloquée s'il s'agit de votre seul salon actif.`
            : undefined
        }
        confirmText="Désactiver"
        cancelText="Annuler"
        variant="destructive"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
