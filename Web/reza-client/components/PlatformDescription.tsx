"use client";

import { useEffect, useRef, useState } from "react";

export default function PlatformDescription() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-white overflow-hidden py-24 md:py-32"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section label — matches About.tsx pattern */}
        <div
          className={`overflow-hidden mb-6 transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-black">
            À propos
          </h2>
        </div>

        {/* Divider line — matches About pattern */}
        <div
          className={`h-[1px] bg-gray-200 mb-10 transition-all duration-700 delay-100 ${
            visible ? "opacity-100 scale-x-100 origin-left" : "opacity-0 scale-x-0 origin-left"
          }`}
        />

        {/* Main headline + description — editorial split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 mb-20">
          <div
            className={`transition-all duration-700 delay-150 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <h3 className="text-3xl md:text-4xl lg:text-[2.75rem] font-light text-gray-900 leading-[1.15] tracking-tight">
              La plateforme de réservation beauté et bien-être{" "}
              <span className="font-semibold">n°1 au Maroc.</span>
            </h3>
          </div>

          <div
            className={`flex flex-col justify-end transition-all duration-700 delay-200 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <p className="text-base md:text-lg text-gray-500 leading-relaxed font-light">
              REZA connecte les clients aux meilleurs professionnels de beauté et bien-être du Maroc. 
              Gérez vos rendez-vous, vos équipes et vos clients — tout en un. 
              De la recherche au rendez-vous, chaque détail est pensé pour vous.
            </p>
          </div>
        </div>

        {/* Stats — clean horizontal row, no cards, just typography */}
        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8 transition-all duration-700 delay-300 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {[
            { value: "20 000+", label: "Rendez-vous pris" },
            { value: "500+", label: "Salons partenaires" },
            { value: "98%", label: "Clients satisfaits" },
            { value: "N°1", label: "Au Maroc" },
          ].map((s, i) => (
            <div key={s.label} className="relative">
              {/* Thin top accent line */}
              <div className="w-8 h-[2px] bg-black mb-5" />
              <p className="text-3xl md:text-4xl font-light text-gray-900 tabular-nums tracking-tight">
                {s.value}
              </p>
              <p className="text-sm text-gray-400 mt-2 font-medium">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
