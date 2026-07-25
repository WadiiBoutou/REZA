'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamic page loader - loads pages based on route path
// This replaces the hardcoded static imports with a truly dynamic system
const createDynamicPageLoader = (routePath: string) => {
  // Map route paths to their actual file locations
  // This allows us to dynamically load any page without hardcoding imports
  const routeToPathMap: Record<string, () => Promise<any>> = {
    // Paramétrage Établissement
    'param-etablissement/informations-landing-page': () => import('../param-etablissement/informations-landing-page/page'),
    'param-etablissement/gestion-photos': () => import('../param-etablissement/gestion-photos/page'),
    'param-etablissement/gestion-horaires-delais': () => import('../param-etablissement/gestion-horaires-delais/page'),
    'param-etablissement/descriptif-etablissement': () => import('../param-etablissement/descriptif-etablissement/page'),
    'param-etablissement/gestion-liste-attente': () => import('../param-etablissement/gestion-liste-attente/page'),
    'param-etablissement/gestion-message': () => import('../param-etablissement/gestion-message/page'),
    'param-etablissement/notifications-rdv-web': () => import('../param-etablissement/notifications-rdv-web/page'),
    'param-etablissement/moyen-de-paiement': () => import('../param-etablissement/moyen-de-paiement/page'),
    
    // Paramétrage Agenda
    'param-agenda/gestion-de-prestations': () => import('../param-agenda/gestion-de-prestations/page'),
    'param-agenda/gestion-des-agendas': () => import('../param-agenda/gestion-des-agendas/page'),
    'param-agenda/gestion-affichage-rdv': () => import('../param-agenda/gestion-affichage-rdv/page'),
    
    // Statistiques RDV
    'statistiques-rdv/indicateurs-cles': () => import('../statistiques-rdv/indicateurs-cles/page'),
    'statistiques-rdv/autres': () => import('../statistiques-rdv/autres/page'),
    'statistiques-rdv/prestations': () => import('../statistiques-rdv/prestations/page'),
    'statistiques-rdv/collaborateurs': () => import('../statistiques-rdv/collaborateurs/page'),
    'statistiques-rdv/rdv': () => import('../statistiques-rdv/rdv/page'),
    'statistiques-rdv/rdv-pas-venus': () => import('../statistiques-rdv/rdv-pas-venus/page'),
    
    // Taux d'occupation
    'taux-occupation/prestations': () => import('../taux-occupation/prestations/page'),
    'taux-occupation/collaborateurs': () => import('../taux-occupation/collaborateurs/page'),
    'taux-occupation/vue-ensemble': () => import('../taux-occupation/vue-ensemble/page'),
    
    // Corbeille RDV
    'corbeille-rdv/rdv-annules': () => import('../corbeille-rdv/rdv-annules/page'),
    
    // Mes Factures
    'mes-factures/liste-des-factures': () => import('../mes-factures/liste-des-factures/page'),
    'mes-factures/moyen-paiement-plateforme': () => import('../mes-factures/moyen-paiement-plateforme/page'),
    
    // Fiche Clients
    'fiche-clients/gestion-fiche-clients': () => import('../fiche-clients/gestion-fiche-clients/page'),
  };

  // Default redirects for parent routes (when no sub-route is specified)
  const defaultRedirects: Record<string, string> = {
    'param-etablissement': 'param-etablissement/informations-landing-page',
    'param-agenda': 'param-agenda/gestion-de-prestations',
    'statistiques-rdv': 'statistiques-rdv/indicateurs-cles',
    'taux-occupation': 'taux-occupation/vue-ensemble',
    'corbeille-rdv': 'corbeille-rdv/rdv-annules',
    'mes-factures': 'mes-factures/liste-des-factures',
    'fiche-clients': 'fiche-clients/gestion-fiche-clients',
  };

  // Check if this is a parent route that should redirect
  if (defaultRedirects[routePath]) {
    // Return a redirect component
    return dynamic(() => Promise.resolve({
      default: () => {
        // This will be handled by the useEffect redirect logic
        return null;
      }
    }), { ssr: false });
  }

  // Try to find the route in the map
  const importFn = routeToPathMap[routePath];
  
  if (importFn) {
    // Return a dynamic component that loads the page
    return dynamic(importFn, { 
      ssr: false,
      loading: () => (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin text-[#002366] w-8 h-8" />
        </div>
      )
    });
  }

  // Route not found in map
  console.warn(`[DynamicAdminPage] Route not found in map: ${routePath}`);
  return null;
};

export default function DynamicAdminPage({ params }: { params: Promise<{ slug: string[] }> | { slug: string[] } }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [routeKey, setRouteKey] = useState<string>('');
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    // Handle both Promise and direct params (Next.js versions compatibility)
    const resolveParams = async () => {
      try {
        const resolvedParams = params instanceof Promise ? await params : params;
        const key = resolvedParams?.slug?.join('/') || '';
        const routeKey =
          key.toLowerCase() === 'statistiques-rdv/prestations' ? 'statistiques-rdv/prestations' : key;
        
        if (!routeKey) {
          // No route key, redirect to default
          router.replace('/dashboard/admin/param-etablissement/informations-landing-page');
          return;
        }
        
        console.log('[DynamicAdminPage] Loading route:', routeKey);
        setRouteKey(routeKey);
        setLoading(true);
        setError(null);
        
        // Check for default redirects for parent routes
        const defaultRedirects: Record<string, string> = {
          'param-etablissement': 'param-etablissement/informations-landing-page',
          'param-agenda': 'param-agenda/gestion-de-prestations',
          'statistiques-rdv': 'statistiques-rdv/indicateurs-cles',
          'taux-occupation': 'taux-occupation/vue-ensemble',
          'corbeille-rdv': 'corbeille-rdv/rdv-annules',
          'mes-factures': 'mes-factures/liste-des-factures',
          'fiche-clients': 'fiche-clients/gestion-fiche-clients',
        };

        // If this is a parent route, redirect to default sub-route
        if (defaultRedirects[routeKey]) {
          router.replace(`/dashboard/admin/${defaultRedirects[routeKey]}`);
          return;
        }
        
        // Dynamically load the page component
        const PageComponent = createDynamicPageLoader(routeKey);
        
        if (PageComponent) {
          setComponent(() => PageComponent);
          setLoading(false);
        } else {
          setError('Page not found');
          setLoading(false);
          // Redirect to default after a short delay
          setTimeout(() => {
            router.replace('/dashboard/admin/param-etablissement/informations-landing-page');
          }, 2000);
        }
      } catch (err) {
        console.error('[DynamicAdminPage] Error resolving params:', err);
        setError('Error loading page');
        setLoading(false);
        setTimeout(() => {
          router.replace('/dashboard/admin/param-etablissement/informations-landing-page');
        }, 2000);
      }
    };
    resolveParams();
  }, [params, router]);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-[#002366] w-8 h-8" />
      </div>
    );
  }

  if (error || !Component) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Page non trouvée</h1>
          <p className="text-gray-600">{error || 'Redirection en cours...'}</p>
        </div>
      </div>
    );
  }

  return <Component />;
}
