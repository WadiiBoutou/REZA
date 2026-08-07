'use client';

/**
 * Multi-salon gate: establishment/operational settings are salon-scoped.
 * When "Tous les salons" (or several salons) is active, these pages must not
 * show ambiguous cross-salon data — render this notice instead.
 */
export default function SalonScopeNotice({
  title = 'Sélectionnez un salon',
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen p-0 md:p-0">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-2">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
        <p className="text-amber-800 font-medium mb-2">
          Ces paramètres sont propres à chaque salon.
        </p>
        <p className="text-sm text-amber-700">
          Utilisez le sélecteur de salon en haut à droite pour choisir un salon
          précis avant de configurer cette section.
        </p>
      </div>
    </div>
  );
}
