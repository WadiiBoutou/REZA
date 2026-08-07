'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ProCTASection() {
  return (
    <section className="bg-[#E8F3EE] dark:bg-[#0f1512] w-full overflow-hidden relative">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col lg:flex-row items-center">

          {/* Text Content — left side with padding */}
          <div className="w-full lg:w-[45%] px-8 sm:px-12 lg:px-20 py-16 md:py-20 shrink-0">
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-extrabold text-[#2F2E2C] dark:text-white leading-[1.1] mb-6 tracking-tight">
              Reza pour<br />professionnels
            </h2>

            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-10 leading-relaxed font-light">
              Boostez votre activité avec la meilleure plateforme de réservation au monde pour les salons et les spas. Indépendamment voté n° 1 par les professionnels de l'industrie.
            </p>

            <Link
              href="/pro-info"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-colors"
            >
              En savoir plus
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Image — right column, bleeds off right edge */}
          <div className="hidden lg:flex lg:w-[55%] items-center justify-start overflow-hidden self-stretch">
            <img
              src="/pro.png"
              alt="Tableau de bord REZA pour professionnels"
              className="w-full h-auto object-contain object-left-top"
            />
          </div>

        </div>
      </div>
    </section>
  );
}
