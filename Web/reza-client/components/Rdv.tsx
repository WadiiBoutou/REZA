'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BeautyAppointmentGrid = () => {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [role, setRole] = useState<'client' | 'professionnel'>('client');

  const statsClient = [
    {
      id: 1,
      value: '3 Clics',
      description: 'pour réserver, sans appel ni attente',
      hasButton: false
    },
    {
      id: 2,
      value: 'Offres',
      description: "Des avantages exclusifs tout au long de l'année",
      hasButton: false
    },
    {
      id: 3,
      value: '100%',
      description: 'Avis de clients authentiques et vérifiés',
      hasButton: false
    },
    {
      id: 4,
      value: 'Sécurisé',
      description: 'Payez en ligne ou sur place, sans stress',
      hasButton: false
    },
    {
      id: 5,
      value: '24/7',
      description: 'Réservez à tout moment, même en dehors des horaires',
      hasButton: false
    },
    {
      id: 6,
      value: 'Rappels',
      description: 'Recevez des notifications pour ne jamais oublier votre rendez-vous',
      hasButton: false
    }
  ];

  const statsPro = [
    {
      id: 1,
      value: 'Rappels automatiques',
      description: 'Fini les oublis et les no-show',
      hasButton: false
    },
    {
      id: 2,
      value: '7/7J, 24/24H',
      description: 'Vos clients prennent rendez-vous en autonomie',
      hasButton: false
    },
    {
      id: 3,
      value: 'Nouveaux clients',
      description: 'Augmentez votre présence en ligne et gagnez en visibilité',
      hasButton: false
    },
    {
      id: 4,
      value: 'Booster votre CA',
      description: 'Fidélisez vos clients et suivez vos performances',
      hasButton: false
    },
    {
      id: 5,
      value: 'Gestion simplifiée',
      description: 'Gérez vos rendez-vous et votre planning facilement',
      hasButton: false
    },
    {
      id: 6,
      value: 'Support dédié',
      description: 'Profitez d’un accompagnement personnalisé pour votre activité',
      hasButton: false
    }
  ];

  const stats = role === 'client' ? statsClient : statsPro;

  return (
    <div className="min-h-screen bg-white p-8 md:p-16 -mt-0 lg:-mt-16 pb-28 lg:pb-0">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm font-semibold text-gray-600 tracking-wider uppercase mb-4">
            UNE FORTE CROISSANCE
          </p>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-light text-gray-900 leading-tight flex flex-wrap items-center gap-4">
            Vous êtes un client ou professionnel de la beauté !<br />
            <span className="inline-block">Pourquoi choisir REZA ?</span>
            <span className="inline-block">
              <div className="relative flex items-center border-black/10 border justify-center w-[220px] sm:w-[260px] h-12 bg-white rounded-full ml-2">
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-0 left-0 h-full rounded-full"
                  style={{
                    width: '20%',
                    left: role === 'client' ? 0 : '30%',
                    background: '#8b7260',
                    zIndex: 1,
                  }}
                  animate={{
                    left: role === 'client' ? 0 : '50%',
                    width: '50%',
                  }}
                />
                <button
                  className={`relative z-10 w-1/2 h-full rounded-full font-semibold text-sm transition-colors duration-300 focus:outline-none ${role === 'client' ? 'text-white' : 'text-gray-700'}`}
                  onClick={() => setRole('client')}
                  style={{ background: 'transparent' }}
                >
                  Client
                </button>
                <button
                  className={`relative z-10 w-1/2 h-full rounded-full font-semibold text-sm transition-colors duration-300 focus:outline-none ${role === 'professionnel' ? 'text-white' : 'text-gray-700'}`}
                  onClick={() => setRole('professionnel')}
                  style={{ background: 'transparent' }}
                >
                  Professionnel
                </button>
              </div>
            </span>
          </h1>
        </div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-gray-200 rounded-lg overflow-hidden"
          >
            {stats.map((stat, index) => (
              <div
                key={stat.id}
                onMouseEnter={() => setHoveredCard(stat.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`
                  relative p-12 flex flex-col justify-center items-center text-center
                  transition-all duration-500 ease-out
                  bg-white
                  ${index % 3 !== 2 ? 'border-r border-gray-200' : ''}
                  ${index < 3 ? 'border-b border-gray-200' : ''}
                  cursor-pointer
                `}
                style={{
                  boxShadow: hoveredCard === stat.id 
                    ? '0 0 32px 8px rgba(0,0,0,0.18)'
                    : 'none'
                }}
              >
                {/* Top accent line appears only on hover */}
                {hoveredCard === stat.id && (
                  <div 
                    className={`absolute top-0 left-0 right-0 w-full pointer-events-none transition-opacity duration-500 ${hoveredCard === stat.id ? 'opacity-100' : 'opacity-0'}`}
                    style={{ height: '4px', background: '#8b7260', zIndex: 50 }}
                  />
                )}

                {/* Main Value */}
                <div 
                  className={`
                    text-2xl md:text-4xl font-light mb-6
                    transition-all duration-500
                    ${hoveredCard === stat.id ? 'text-gray-900 scale-105' : 'text-gray-900'}
                  `}
                >
                  {stat.value}
                </div>

                {/* Description */}
                <p 
                  className={`
                    text-base md:text-lg text-gray-600 leading-relaxed max-w-xs
                    transition-all duration-500
                  `}
                >
                  {stat.description}
                </p>

                {/* Hover effect overlay */}
                <div 
                  className={`
                    absolute inset-0 pointer-events-none
                    transition-opacity duration-500
                    ${hoveredCard === stat.id ? 'opacity-100' : 'opacity-0'}
                  `}
                  style={{
                    background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.03) 0%, transparent 70%)'
                  }}
                />
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Bottom spacing */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            Rejoignez des milliers de clients et professionnels qui font confiance à notre plateforme
          </p>
        </div>
      </div>
    </div>
  );
};

export default BeautyAppointmentGrid;