'use client';

import { Facebook, Instagram, Twitter, Mail, MapPin, Phone, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const LoadingOverlay = dynamic(() => import('@/components/UI/LoadingOverlay'), { ssr: false });

export default function Footer() {
  const [navLoading, setNavLoading] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [categories, setCategories] = useState<Array<{ title: string; apiName: string; displayName: string }>>([]);
  const router = useRouter();

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesResponse = await api.getCategories();
        const fetchedCategories = categoriesResponse.categories || [];
        
        // Map main categories to navigation items
        const mainCategories = ['Coiffeur', 'Barbier', 'Manucure', 'Institut de beauté'];
        const formattedCategories = mainCategories.map(catName => {
          const cat = fetchedCategories.find((c: any) => 
            c.name?.toLowerCase().includes(catName.toLowerCase()) ||
            catName.toLowerCase().includes(c.name?.toLowerCase() || '')
          );
          
          // Map display names for navigation
          let displayName = catName;
          if (catName === 'Institut de beauté') {
            displayName = 'Etablissement';
          }
          
          return {
            title: catName,
            apiName: catName,
            displayName: displayName
          };
        });
        
        setCategories(formattedCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Fallback to default categories
        setCategories([
          { title: 'Coiffeur', apiName: 'Coiffeur', displayName: 'Coiffeur' },
          { title: 'Barbier', apiName: 'Barbier', displayName: 'Barbier' },
          { title: 'Manucure', apiName: 'Manucure', displayName: 'Manucure' },
          { title: 'Institut de beauté', apiName: 'Institut de beauté', displayName: 'Etablissement' }
        ]);
      }
    };

    fetchCategories();
  }, []);

  return (
    <footer className="w-full bg-white text-[#2F2E2C] pt-16 pb-20 px-6 relative overflow-x-hidden z-50">
      {/* Decorative Elements */}
       <div className="max-w-7xl mx-auto relative z-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12 relative z-50">
          {/* Brand Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center mb-4">
              <span className="font-extrabold text-[32px] tracking-wide text-[#0a0f2c]">REZA</span>
            </div>
           
            <p className="text-sm text-[#2F2E2C]/70 font-light max-w-xs">
              Votre destination premium pour la beauté et le bien-être. Découvrez l'excellence, l'élégance et l'innovation dans chaque expérience.
            </p>
            <div className="flex gap-3 mt-2">
              <a href="#" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2f2e2c11] transition-colors">
                <Instagram className="w-5 h-5 text-[#8b7260]" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2f2e2c11] transition-colors">
                <Facebook className="w-5 h-5 text-[#8b7260]" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2f2e2c11] transition-colors">
                <Twitter className="w-5 h-5 text-[#8b7260]" />
              </a>
            </div>
          </div>

          {/* Navigation Section */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Navigation</h4>
            <ul className="space-y-2 text-sm">
              {categories.map((category, index) => (
                <li key={index}>
                  <a
                    href={`/search-results?query=${encodeURIComponent(category.title)}&category=${encodeURIComponent(category.apiName)}`}
                    className="hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      setNavLoading(true);
                      router.push(`/search-results?query=${encodeURIComponent(category.title)}&category=${encodeURIComponent(category.apiName)}`);
                      setTimeout(() => {
                        setNavLoading(false);
                      }, 100);
                    }}
                  >
                    {category.displayName}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="/pro-info"
                  className="hover:underline"
                  onClick={e => {
                    e.preventDefault();
                    setNavLoading(true);
                    setTimeout(() => {
                      window.location.href = "/pro-info";
                    }, 2200);
                  }}
                >
                  Espace Pro
                </a>
              </li>
              <li>
                <a
                  href="/login"
                  className="hover:underline"
                  onClick={e => {
                    e.preventDefault();
                    setNavLoading(true);
                    setTimeout(() => {
                      window.location.href = "/login";
                    }, 2200);
                  }}
                >
                  Mon Compte
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div className="relative z-50">
            <h4 className="font-semibold text-lg mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> contact@reza.com</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> +212 6 00 00 00 00</li>
            </ul>
          </div>

          {/* Newsletter Section */}
          <div className="w-full min-w-0 max-w-sm relative z-50">
            <h4 className="font-semibold text-lg mb-4">Newsletter</h4>
            <p className="text-sm text-[#2F2E2C]/70 mb-4">Recevez nos offres exclusives et conseils beauté.</p>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                
                // Reset previous messages
                setNewsletterMessage(null);

                // Client-side validation
                const trimmedEmail = newsletterEmail.trim();
                
                if (!trimmedEmail) {
                  setNewsletterMessage({ type: 'error', text: 'L\'adresse email est requise.' });
                  return;
                }

                // Check email length
                if (trimmedEmail.length > 255) {
                  setNewsletterMessage({ type: 'error', text: 'L\'adresse email est trop longue (maximum 255 caractères).' });
                  return;
                }

                // Validate email format with RFC 5322 compliant regex
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(trimmedEmail)) {
                  setNewsletterMessage({ type: 'error', text: 'Veuillez fournir une adresse email valide.' });
                  return;
                }

                // Additional validation: check for disposable email domains
                const disposableDomains = [
                  'tempmail.com', '10minutemail.com', 'guerrillamail.com',
                  'mailinator.com', 'throwaway.email', 'temp-mail.org'
                ];
                const domain = trimmedEmail.split('@')[1]?.toLowerCase();
                if (domain && disposableDomains.includes(domain)) {
                  setNewsletterMessage({ type: 'error', text: 'Les adresses email temporaires ne sont pas acceptées.' });
                  return;
                }

                // Additional validation: check for common spam patterns
                const spamPatterns = [
                  /test@test/i,
                  /noreply/i,
                  /no-reply/i,
                  /donotreply/i,
                  /postmaster/i
                ];
                if (spamPatterns.some(pattern => pattern.test(trimmedEmail))) {
                  setNewsletterMessage({ type: 'error', text: 'Cette adresse email n\'est pas valide.' });
                  return;
                }

                setNewsletterLoading(true);

                try {
                  const result = await api.subscribeToNewsletter(trimmedEmail);
                  setNewsletterMessage({ type: 'success', text: result.message || 'Inscription réussie !' });
                  setNewsletterEmail('');
                  
                  // Clear success message after 5 seconds
                  setTimeout(() => {
                    setNewsletterMessage(null);
                  }, 5000);
                } catch (error: any) {
                  // Handle validation errors from server
                  let errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
                  
                  if (error.message) {
                    errorMessage = error.message;
                  } else if (error.data) {
                    // Validation error from server (Zod)
                    if (error.data.message) {
                      errorMessage = error.data.message;
                    } else if (error.data.errors && error.data.errors.length > 0) {
                      errorMessage = error.data.errors[0].message;
                    }
                  }
                  
                  setNewsletterMessage({ 
                    type: 'error', 
                    text: errorMessage
                  });
                  
                  // Clear error message after 5 seconds
                  setTimeout(() => {
                    setNewsletterMessage(null);
                  }, 5000);
                } finally {
                  setNewsletterLoading(false);
                }
              }}
              className="flex flex-col gap-2 w-full"
            >
              <div className="flex flex-col sm:flex-row gap-2 w-full relative z-50">
                <input 
                  type="email" 
                  placeholder="Votre email" 
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  disabled={newsletterLoading}
                  className="flex-1 w-full sm:min-w-0 px-4 py-2.5 h-11 rounded-full border border-[#8b7260]/30 focus:border-[#8b7260] focus:outline-none text-[#2F2E2C] bg-white disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-[#2F2E2C]/50 relative z-50 shadow-sm"
                />
                <button 
                  type="submit" 
                  disabled={newsletterLoading}
                  className="w-11 h-11 flex-shrink-0 rounded-full bg-[#8b7260] text-white flex items-center justify-center hover:bg-[#2F2E2C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md relative z-50"
                  title="S'inscrire à la newsletter"
                >
                  {newsletterLoading ? (
                    <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
                  ) : (
                    <ArrowRight className="w-5 h-5 flex-shrink-0" />
                  )}
                </button>
              </div>
              
              {newsletterMessage && (
                <div 
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm mt-1 transition-all duration-200 ${
                    newsletterMessage.type === 'success' 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                  style={{
                    animation: 'fadeIn 0.2s ease-in-out'
                  }}
                >
                  {newsletterMessage.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1 leading-relaxed">{newsletterMessage.text}</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Legal & Copyright */}
        <div className="border-t border-[#8b7260]/20 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-[#2F2E2C]/60 gap-2">
          <div>
            &copy; {new Date().getFullYear()} REZA. Tous droits réservés.
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
            <a href="#" className="hover:underline">Mentions légales</a>
            <a href="#" className="hover:underline">Politique de confidentialité</a>
            <a href="#" className="hover:underline">Cookies</a>
            <a href="#" className="hover:underline">Conditions d'utilisation</a>
          </div>
        </div>
      </div>
      {navLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f5f7f3]">
          <LoadingOverlay />
        </div>
      )}
      
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Ensure footer content is above any map attribution */
        footer {
          position: relative;
          z-index: 50;
        }
        
        /* Hide or reposition Google Maps attribution if it appears */
        footer :global(.gm-style-cc),
        footer :global([class*="gm-"]),
        footer :global(a[href*="google.com/maps"]) {
          display: none !important;
        }
      `}</style>
    </footer>
  );
}