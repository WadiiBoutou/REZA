'use client';

import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { filterCompleteTenants } from '../lib/utils';

interface StatsSectionProps {
  category: string;
}

export default function StatsSection({ category }: StatsSectionProps) {
  const [stats, setStats] = useState({
    partners: 0,
    averageRating: 0,
    loading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all tenants for this category
        const response = await api.searchTenants(undefined, category, undefined, 1000);
        // Filter to only count tenants with complete information (all required fields from landing page)
        const completeTenants = filterCompleteTenants(response.tenants || []);
        
        // Calculate average rating (only from complete tenants)
        const tenantsWithRatings = completeTenants.filter((t: any) => t.rating && t.rating > 0);
        const avgRating = tenantsWithRatings.length > 0
          ? tenantsWithRatings.reduce((sum: number, t: any) => sum + (t.rating || 0), 0) / tenantsWithRatings.length
          : 0;
        
        setStats({
          partners: completeTenants.length,
          averageRating: avgRating,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStats({
          partners: 0,
          averageRating: 0,
          loading: false
        });
      }
    };

    fetchStats();
  }, [category]);

  if (stats.loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className="bg-white rounded-xl p-6 text-center border border-gray-300 animate-pulse">
            <div className="h-10 w-16 bg-gray-200 rounded mx-auto mb-2" />
            <div className="h-4 w-24 bg-gray-200 rounded mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16">
      <div className="bg-white rounded-xl p-6 text-center border border-gray-300">
        <div className="text-4xl font-light text-black mb-2">{stats.partners}+</div>
        <div className="text-sm text-gray-600">Partenaires</div>
      </div>
      <div className="bg-white rounded-xl p-6 text-center border border-gray-300">
        <div className="text-4xl font-light text-black mb-2">24/7</div>
        <div className="text-sm text-gray-600">Réservation en ligne</div>
      </div>
      <div className="bg-white rounded-xl p-6 text-center border border-gray-300">
        <div className="text-4xl font-light text-black mb-2">
          {stats.averageRating > 0 ? `${stats.averageRating.toFixed(1)}/5` : '4.8/5'}
        </div>
        <div className="text-sm text-gray-600">Note moyenne</div>
      </div>
      <div className="bg-white rounded-xl p-6 text-center border border-gray-300">
        <div className="text-4xl font-light text-black mb-2">100%</div>
        <div className="text-sm text-gray-600">Gratuit</div>
      </div>
    </div>
  );
}
