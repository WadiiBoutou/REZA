import React from 'react';
import { X, Check } from 'lucide-react';

type Service = {
  name: string;
  duration: string;
  price?: number;
  priceType?: string;
};

type Category = {
  category: string;
  items: Service[];
  description?: string;
};

type AddServiceModalProps = {
  selectedServices: Service[];
  onSelectServices: (services: Service[]) => void;
  onClose: () => void;
  salonServices: Category[];
};

const AddServiceModal: React.FC<AddServiceModalProps> = ({
  selectedServices,
  onSelectServices,
  onClose,
  salonServices,
}) => {
  // Always use a fallback to an empty array
  const categorizedServices = Array.isArray(salonServices) ? salonServices : [];

  // Helper to get the full service object from salonServices by name
  const getFullService = (serviceName: string): Service | undefined => {
    for (const category of categorizedServices) {
      const found = category.items.find((item: Service) => item.name === serviceName);
      if (found) return found;
    }
    return undefined;
  };

  // Add a local state to track selection before confirming
  const [localSelected, setLocalSelected] = React.useState<Service[]>(selectedServices);

  React.useEffect(() => {
    setLocalSelected(selectedServices);
  }, [selectedServices]);

  const isSelected = (service: Service) =>
    localSelected.some((s) => s.name === service.name);

  const handleToggle = (service: Service) => {
    const fullService = getFullService(service.name);
    if (!fullService) return;
    setLocalSelected(prev => {
      if (prev.some((s) => s.name === service.name)) {
        return prev.filter((s) => s.name !== service.name);
      } else {
        return [...prev, fullService];
      }
    });
  };

  const handleFinish = () => {
    onSelectServices(localSelected);
    onClose();
  };

  return (
    <>
      <style jsx>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        .modal-overlay {
          animation: modalFadeIn 0.2s ease-out;
        }
        .modal-content {
          animation: modalSlideUp 0.3s ease-out;
        }
        .service-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .service-item:hover:not(.selected) {
          transform: translateX(4px);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        .check-icon {
          transition: all 0.2s ease-out;
        }
      `}</style>
      
      <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
        <div className="bg-[#f5f7f3] rounded-3xl max-w-2xl w-full overflow-hidden modal-content" onClick={(e) => e.stopPropagation()}>
          
          {/* Header */}
          <div className="relative px-8 pt-8 pb-6 border-b border-gray-200">
            <button
              className="absolute top-6 right-6 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors group"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>
            
            <h3 className="text-3xl font-light text-gray-900 tracking-tight mb-2">
              Ajouter des services
            </h3>
            <p className="text-sm text-gray-500">
              Sélectionnez les services que vous souhaitez réserver
            </p>
            
            {/* Selected count indicator */}
            {selectedServices.length > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#101828] text-white text-sm">
                <Check className="w-4 h-4" />
                <span className="font-medium">{selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} sélectionné{selectedServices.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Services List */}
          <div className="px-8 py-6 max-h-[420px] overflow-y-auto custom-scrollbar">
            {categorizedServices.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                Aucun service disponible pour ce salon.
              </div>
            ) : (
              categorizedServices.map((category: any, catIdx: number) => (
                <div key={catIdx} className="mb-8 last:mb-0">
                  <h4 className="text-xs uppercase tracking-wider font-medium text-gray-500 mb-4 px-2">
                    {category.category}
                  </h4>
                  <div className="space-y-2">
                    {category.items.map((service: Service, idx: number) => {
                      const selected = isSelected(service);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggle(service)}
                          className={`service-item ${selected ? 'selected' : ''} w-full flex items-center justify-between px-5 py-4 rounded-xl transition-all text-left ${
                            selected
                              ? 'bg-[#101828] text-white border border-[#101828]'
                              : 'bg-[#f5f7f3] hover:bg-gray-50 text-gray-900 border border-gray-300'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <div className={`font-medium text-base mb-1 truncate ${
                              selected ? 'text-white' : 'text-gray-900'
                            }`}>
                              {service.name}
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${
                              selected ? 'text-white/80' : 'text-gray-500'
                            }`}>
                              <span className="font-mono">{service.duration}</span>
                              <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                              <span className="font-mono font-semibold">{service.price} MAD</span>
                            </div>
                          </div>
                          
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            selected 
                              ? 'bg-white text-[#101828]' 
                              : 'border-2 border-gray-300'
                          }`}>
                            {selected && (
                              <Check className="w-4 h-4 check-icon" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-gray-200 flex items-center justify-between bg-[#f5f7f3]">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleFinish}
              className="px-8 py-2 rounded-full bg-[#101828] text-white font-medium hover:bg-[#1d2939] transition-all"
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddServiceModal;