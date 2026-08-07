'use client';

import React, { useState, useEffect } from 'react';
import { Star, Calendar, User, ArrowRight, Quote } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { getRelativeDate, formatMoroccoDate, filterCompleteTenants, getImageUrl } from '../lib/utils';

const TestimonialsAndBlogs = () => {
  const [hoveredTestimonial, setHoveredTestimonial] = useState<number | null>(null);
  const [hoveredBlog, setHoveredBlog] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'testimonials' | 'blog'>('testimonials');
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch reviews from API
  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        setLoading(true);
        // Fetch tenants first
        const tenantsResponse = await api.searchTenants(undefined, undefined, undefined, 20);
        // Filter to only show tenants with complete information (all required fields from landing page)
        const completeTenants = filterCompleteTenants(tenantsResponse.tenants || []);
        
        // Fetch reviews for each tenant (limit to first 6 complete tenants for performance)
        const reviewPromises = completeTenants.slice(0, 6).map(async (tenant: any) => {
          try {
            const reviewsRes = await api.getTenantReviews(tenant.id, 1, 1);
            if (reviewsRes.reviews && reviewsRes.reviews.length > 0) {
              const review = reviewsRes.reviews[0];
              return {
                id: review.id,
                name: review.client ? `${review.client.firstName || ''} ${review.client.lastName || ''}`.trim() || 'Client' : 'Client',
                role: tenant.category || 'Client',
                city: tenant.city || '',
                rating: review.rating || 5,
                text: review.comment || '',
                // REAL client avatar from the review record (falls back to initials)
                avatar: getImageUrl(review.client?.avatar || null),
                initials: review.client
                  ? `${(review.client.firstName?.[0] || '').toUpperCase()}${(review.client.lastName?.[0] || '').toUpperCase()}` || 'C'
                  : 'C',
                date: review.createdAt ? getRelativeDate(review.createdAt) : 'Récemment',
                type: 'Client',
                tenantName: tenant.name,
                tenantCategory: tenant.category
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching reviews for tenant ${tenant.id}:`, error);
            return null;
          }
        });
        
        const fetchedTestimonials = (await Promise.all(reviewPromises))
          .filter((t): t is any => t !== null)
          .slice(0, 6); // Limit to 6 testimonials
        
        // Only real reviews — never pad with static/fake testimonials.
        setTestimonials(fetchedTestimonials.slice(0, 6));
      } catch (error) {
        console.error('Error fetching testimonials:', error);
        setTestimonials([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTestimonials();
  }, []);


  const blogPosts = [
    {
      id: 1,
      title: "Les tendances coiffure 2025 au Maroc",
      excerpt: "Découvrez les coupes et colorations qui feront sensation cette année dans les salons marocains. Du balayage naturel aux coupes structurées...",
      category: "Tendances",
      readTime: "5 min",
      date: "10 Nov 2025",
      image: "https://images.pexels.com/photos/7440052/pexels-photo-7440052.jpeg?_gl=1*h1012e*_ga*MTkyNzg5MTU2NC4xNzU5OTk3NzYy*_ga_8JE65Q40S6*czE3NjMwNTI5MjgkbzYkZzEkdDE3NjMwNTMwNTEkajQ3JGwwJGgw"
    },
    {
      id: 2,
      title: "Comment fidéliser vos clients en salon",
      excerpt: "Les meilleures stratégies pour transformer vos nouveaux clients en clients réguliers. Conseils pratiques et exemples concrets...",
      category: "Business",
      readTime: "7 min",
      date: "8 Nov 2025",
      image: "https://images.pexels.com/photos/4783289/pexels-photo-4783289.jpeg?_gl=1*o5a6la*_ga*MTkyNzg5MTU2NC4xNzU5OTk3NzYy*_ga_8JE65Q40S6*czE3NjMwNTI5MjgkbzYkZzEkdDE3NjMwNTMxMzAkajM5JGwwJGgw"
    },
    {
      id: 3,
      title: "Rituel beauté : préparer sa peau pour l'hiver",
      excerpt: "Les gestes essentiels pour garder une peau éclatante malgré le froid. Hydratation, nutrition et protection sont au programme...",
      category: "Bien-être",
      readTime: "4 min",
      date: "5 Nov 2025",
      image: "https://images.pexels.com/photos/260405/pexels-photo-260405.jpeg?_gl=1*rdfmy0*_ga*MTkyNzg5MTU2NC4xNzU5OTk3NzYy*_ga_8JE65Q40S6*czE3NjMwNTI5MjgkbzYkZzEkdDE3NjMwNTMyNTkkajQkbDAkaDA."
    },
    {
      id: 4,
      title: "Optimiser votre planning salon avec la technologie",
      excerpt: "Comment les outils digitaux peuvent révolutionner votre gestion quotidienne et augmenter votre chiffre d'affaires de 30%...",
      category: "Digital",
      readTime: "6 min",
      date: "2 Nov 2025",
      image: "https://images.pexels.com/photos/7428220/pexels-photo-7428220.jpeg?_gl=1*g1snqg*_ga*MTkyNzg5MTU2NC4xNzU5OTk3NzYy*_ga_8JE65Q40S6*czE3NjMwNTI5MjgkbzYkZzEkdDE3NjMwNTM0NzckajU0JGwwJGgw"
    },
    {
      id: 5,
      title: "Les soins capillaires naturels à la mode marocaine",
      excerpt: "Redécouvrez les secrets de beauté ancestraux : huile d'argan, rhassoul, et autres trésors naturels pour des cheveux sublimes...",
      category: "Soins",
      readTime: "5 min",
      date: "30 Oct 2025",
      image: "https://media.vogue.fr/photos/63624d63e7c5eddc1da288a2/master/w_1600%2Cc_limit/1662673_box-1920x1440.png"
    },
    {
      id: 6,
      title: "Marketing digital pour salons : guide complet",
      excerpt: "Instagram, Google, avis clients... Tous les leviers pour développer votre présence en ligne et attirer plus de clients...",
      category: "Marketing",
      readTime: "8 min",
      date: "28 Oct 2025",
      image: "https://images.pexels.com/photos/590016/pexels-photo-590016.jpeg?_gl=1*5y1fk8*_ga*MTkyNzg5MTU2NC4xNzU5OTk3NzYy*_ga_8JE65Q40S6*czE3NjMwNTI5MjgkbzYkZzEkdDE3NjMwNTM1NzgkajI3JGwwJGgw"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Tab Switcher */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <p className="text-sm font-semibold text-gray-600 tracking-wider uppercase mb-4">
              INSPIRATION & TÉMOIGNAGES
            </p>
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 mb-8">
              Découvrez les histoires qui nous inspirent
            </h1>
            {/* Tab Switcher - updated to match Rdv.tsx style */}
            <div className="inline-block">
              <div className="relative flex items-center border-black/10 border justify-center w-[340px] h-12 bg-white rounded-full mx-auto">
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-0 left-0 h-full rounded-full"
                  style={{
                    width: '50%',
                    left: activeTab === 'testimonials' ? 0 : '50%',
                    background: '#8b7260',
                    zIndex: 1,
                  }}
                  animate={{
                    left: activeTab === 'testimonials' ? 0 : '50%',
                    width: '50%',
                  }}
                />
                <button
                  className={`relative z-10 w-1/2 h-full rounded-full font-semibold text-sm transition-colors duration-300 focus:outline-none ${activeTab === 'testimonials' ? 'text-white' : 'text-gray-700'}`}
                  onClick={() => setActiveTab('testimonials')}
                  style={{ background: 'transparent' }}
                >
                  Témoignages
                </button>
                <button
                  className={`relative z-10 w-1/2 h-full rounded-full font-semibold text-sm transition-colors duration-300 focus:outline-none ${activeTab === 'blog' ? 'text-white' : 'text-gray-700'}`}
                  onClick={() => setActiveTab('blog')}
                  style={{ background: 'transparent' }}
                >
                  Blog
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {activeTab === 'testimonials' ? (
          <>
            {/* Testimonials Header */}
            <div className="text-center mb-12">
              <h2 className="text-3xl font-light text-gray-900 mb-4">
                Ce que nos utilisateurs disent de nous
              </h2>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                Des milliers de clients et professionnels nous font confiance chaque jour
              </p>
            </div>

            {/* Testimonials Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-gray-200 rounded-lg overflow-hidden">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div key={idx} className="bg-white p-8 min-h-[320px] animate-pulse">
                    <div className="h-12 w-12 bg-gray-200 rounded mb-6" />
                    <div className="h-20 bg-gray-200 rounded mb-6" />
                    <div className="h-6 w-24 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-gray-200 rounded-lg overflow-hidden">
                {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.id}
                  onMouseEnter={() => setHoveredTestimonial(testimonial.id)}
                  onMouseLeave={() => setHoveredTestimonial(null)}
                  className={`
                    relative bg-white overflow-hidden cursor-pointer
                    ${index % 3 !== 2 ? 'border-r border-gray-200' : ''}
                    ${index < 3 ? 'border-b border-gray-200' : ''}
                  `}
                  style={{
                    boxShadow: hoveredTestimonial === testimonial.id 
                      ? '0 0 32px 8px rgba(0,0,0,0.12)'
                      : 'none',
                    zIndex: hoveredTestimonial === testimonial.id ? 10 : 1
                  }}
                >
                  {/* Default State - Quote Only */}
                  <motion.div
                    className="p-8 min-h-[320px] flex flex-col justify-between"
                    animate={{
                      opacity: hoveredTestimonial === testimonial.id ? 0 : 1,
                      scale: hoveredTestimonial === testimonial.id ? 0.95 : 1
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Quote Icon */}
                    <div className="mb-6">
                      <Quote className="w-12 h-12 text-[#8b7260] opacity-20" />
                    </div>

                    {/* Testimonial Text */}
                    <p className="text-gray-700 leading-relaxed text-lg mb-6 flex-grow">
                      "{testimonial.text}"
                    </p>

                    {/* Rating */}
                    <div className="flex gap-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-[#8b7260]" style={{ color: '#8b7260' }} />
                      ))}
                    </div>
                  </motion.div>

                  {/* Hover State - User Profile Reveal */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-[#8b7260] to-[#6d5a4d] p-8 flex flex-col items-center justify-center text-white"
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{
                      opacity: hoveredTestimonial === testimonial.id ? 1 : 0,
                      scale: hoveredTestimonial === testimonial.id ? 1 : 1.1
                    }}
                    transition={{ duration: 0.3 }}
                    style={{ pointerEvents: hoveredTestimonial === testimonial.id ? 'auto' : 'none' }}
                  >
                    {/* Profile Image — REAL client avatar (falls back to initials) */}
                    <motion.div
                      className="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-white/30 bg-white/15 flex items-center justify-center"
                      initial={{ scale: 1, rotate: 0, opacity: 0 }}
                      animate={{
                        scale: hoveredTestimonial === testimonial.id ? 1.05 : 1,
                        rotate: hoveredTestimonial === testimonial.id ? 6 : 0,
                        opacity: hoveredTestimonial === testimonial.id ? 1 : 0
                      }}
                      transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
                    >
                      {testimonial.avatar ? (
                        <img
                          src={testimonial.avatar}
                          alt={testimonial.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-white">
                          {testimonial.initials || 'C'}
                        </span>
                      )}
                    </motion.div>

                    {/* User Info */}
                    <motion.div
                      className="text-center"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{
                        y: hoveredTestimonial === testimonial.id ? 0 : 20,
                        opacity: hoveredTestimonial === testimonial.id ? 1 : 0
                      }}
                      transition={{ delay: 0.2 }}
                    >
                      <h4 className="text-2xl font-semibold mb-2">{testimonial.name}</h4>
                      <p className="text-white/80 mb-1">{testimonial.role}</p>
                      <p className="text-white/60 text-sm mb-4">{testimonial.city}</p>
                      
                      {/* Decorative Line */}
                      <div className="w-16 h-0.5 bg-white/30 mx-auto mb-4"></div>
                      
                      {/* Date */}
                      <p className="text-white/50 text-xs">{testimonial.date}</p>
                    </motion.div>

                    
                    <motion.div
                      className="absolute bottom-4 left-4"
                      animate={{ rotate: hoveredTestimonial === testimonial.id ? -360 : 0 }}
                      transition={{ duration: 0.6 }}
                    >
                      <Quote className="w-8 h-8 text-white/20" />
                    </motion.div>
                  </motion.div>
                </motion.div>
              ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Blog Header */}
            <div className="text-center mb-12">
              <h2 className="text-3xl font-light text-gray-900 mb-4">
                Actualités, conseils & inspiration beauté
              </h2>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                Restez informé des dernières tendances et bonnes pratiques
              </p>
            </div>

            {/* Blog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-gray-200 rounded-lg overflow-hidden">
              {blogPosts.map((post, index) => (
                <div
                  key={post.id}
                  onMouseEnter={() => setHoveredBlog(post.id)}
                  onMouseLeave={() => setHoveredBlog(null)}
                  className={`
                    relative bg-white
                    transition-all duration-500 ease-out
                    ${index % 3 !== 2 ? 'border-r border-gray-200' : ''}
                    ${index < 3 ? 'border-b border-gray-200' : ''}
                    cursor-pointer group
                  `}
                  style={{
                    boxShadow: hoveredBlog === post.id 
                      ? '0 0 32px 8px rgba(0,0,0,0.12)'
                      : 'none',
                    zIndex: hoveredBlog === post.id ? 10 : 1
                  }}
                >
                  {/* Top accent line on hover */}
                  {hoveredBlog === post.id && (
                    <div 
                      className="absolute top-0 left-0 right-0 h-1 bg-[#8b7260] transition-opacity duration-500"
                    />
                  )}

                  {/* Image Section - now uses real photo */}
                  <div className="relative h-48 bg-gradient-to-br from-white to-[#e8ebe5] flex items-center justify-center overflow-hidden">
                    <img src={post.image} alt={post.title} className="object-cover w-full h-full" loading="lazy" />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-700">
                        {post.category}
                      </span>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="p-8">
                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.date}
                      </span>
                      <span>•</span>
                      <span>{post.readTime} de lecture</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-medium text-gray-900 mb-3 leading-snug min-h-[56px] group-hover:text-[#8b7260] transition-colors duration-300">
                      {post.title}
                    </h3>

                    {/* Excerpt */}
                    <p className="text-gray-600 text-sm leading-relaxed mb-4 min-h-[80px]">
                      {post.excerpt}
                    </p>

                    {/* Read More Link */}
                    <button className="flex items-center gap-2 text-sm font-medium text-[#8b7260] group-hover:gap-3 transition-all duration-300">
                      Lire l'article
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default TestimonialsAndBlogs;