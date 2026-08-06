"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";

export default function PlatformDescription() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-gradient-to-b from-white via-[#faf9f8] to-white overflow-hidden py-24 md:py-32 border-t border-b border-gray-100"
    >
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-[#8b7260]/5 rounded-full filter blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-[#bca695]/5 rounded-full filter blur-3xl -z-10" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div
          className={`text-center mb-16 transition-all duration-1000 transform ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
         
          <h2 className="text-3xl md:text-5xl font-light text-gray-900 leading-tight tracking-tight">
            La destination n° 1 au Maroc pour le{" "}
            <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-[#8b7260] to-gray-900">
              bien-être et la beauté.
            </span>
          </h2>
          <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto mt-6 leading-relaxed font-light">
            Une plateforme unique. Les meilleurs professionnels de la beauté au Maroc nous font confiance pour gérer leurs rendez-vous, leurs équipes et leur croissance.
          </p>
        </div>

        {/* Highlight Main Counter */}
        <div
          className={`max-w-3xl mx-auto mb-20 transition-all duration-1000 delay-200 transform ${
            visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 md:p-12 text-center shadow-sm border border-gray-100 relative group hover:shadow-md transition-all duration-500">
            {/* Top Accent line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-[3px] bg-gradient-to-r from-[#8b7260] to-[#bca695] rounded-b-full" />
            
            <span className="text-6xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-[#8b7260] to-[#bca695] bg-clip-text text-transparent select-none">
              + de 10 000
            </span>
            <p className="text-lg md:text-xl font-medium text-gray-800 mt-4 tracking-wide">
              rendez-vous pris sur REZA
            </p>
            <p className="text-sm text-gray-400 mt-2 font-light max-w-md mx-auto">
              Rejoignez des milliers d'utilisateurs satisfaits qui réservent en un clic.
            </p>
          </div>
        </div>

        {/* Supporting Stats Grid */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-24 transition-all duration-1000 delay-300 transform ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {[
            {
              value: "+ de 500",
              label: "Salons partenaires",
              desc: "Des salons de coiffure, instituts de beauté et spas de confiance.",
            },
            {
              value: "98%",
              label: "Clients satisfaits",
              desc: "Une note moyenne exceptionnelle pour nos établissements partenaires.",
            },
            {
              value: "N°1",
              label: "Au Maroc",
              desc: "La référence incontournable pour la gestion et la réservation beauté.",
            },
          ].map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center md:items-start text-center md:text-left bg-[#faf9f8]/60 backdrop-blur-sm rounded-xl p-6 border border-gray-50/50 hover:bg-[#faf9f8] transition-colors duration-300"
            >
              <div className="w-8 h-[2px] bg-[#8b7260] mb-4" />
              <p className="text-3xl font-light text-gray-900 tracking-tight">
                {s.value}
              </p>
              <p className="text-base text-gray-800 font-medium mt-1">
                {s.label}
              </p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed font-light">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-gray-200/80 w-full mb-12" />

        {/* Accepted Payment Methods Section */}
        <div
          className={`transition-all duration-1000 delay-400 transform ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-8 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> RÈGLEMENTS ACCÉPTÉS PAR NOS PARTENAIRES
            </span>
            
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              {/* Visa (Direct Wikimedia Link to Modern All-Blue Logo) */}
              <div className="h-10 flex items-center" title="Visa">
  <img
    src="https://cdn.simpleicons.org/visa/1A1F71"
    alt="Visa"
    className="h-10 w-auto object-contain hover:brightness-110 transition-all duration-300"
  />
</div>

              {/* Mastercard */}
              <div className="h-8 flex items-center" title="Mastercard">
                <img 
                  src="/payment/Mastercard.png" 
                  alt="Mastercard" 
                  className="h-7 w-auto object-contain filter hover:brightness-110 transition-all duration-300" 
                />
              </div>

              {/* Apple Pay */}
              <div className="h-8 flex items-center" title="Apple Pay">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Apple_Pay_logo.svg" 
                  alt="Apple Pay" 
                  className="h-6 w-auto object-contain filter hover:brightness-110 transition-all duration-300" 
                />
              </div>

              {/* Google Pay */}
              <div className="h-8 flex items-center" title="Google Pay">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" 
                  alt="Google Pay" 
                  className="h-6 w-auto object-contain filter hover:brightness-110 transition-all duration-300" 
                />
              </div>

              {/* Cash / Espèces */}
              <div className="h-8 flex items-center gap-2 px-3 py-1 rounded bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors duration-300 cursor-default" title="Cash / Espèces">
                <span className="text-lg">💵</span>
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Espèces</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
