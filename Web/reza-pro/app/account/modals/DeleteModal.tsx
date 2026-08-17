import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DeleteModal = ({ 
  open, 
  onClose, 
  onConfirm, 
  title = "Supprimer", 
  description = "Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.",
  confirmText = "Supprimer",
  loading = false,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div 
            className="absolute inset-0 bg-gray-900/20"
            onClick={onClose}
            style={{ backdropFilter: 'blur(0px)' }}
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ opacity: { duration: 0.18 }, backdropFilter: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } }}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all group"
            >
              <X className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
            </button>

            {/* Content */}
            <div className="p-10">
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>

              {/* Title */}
              <h3 className="text-2xl font-extralight text-gray-900 tracking-tight mb-3">
                {title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-500 font-light leading-relaxed mb-8">
                {description}
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-6 py-3 text-sm font-light text-gray-600 hover:bg-gray-50 transition-all rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Annuler
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-light transition-all rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Suppression...
                    </span>
                  ) : (
                    confirmText
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeleteModal;