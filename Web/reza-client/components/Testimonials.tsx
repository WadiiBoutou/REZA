'use client';

import React, { useState } from 'react';
import { Star, Calendar, ArrowRight, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

const TestimonialsAndBlogs = () => {
  const [hoveredTestimonial, setHoveredTestimonial] = useState<string | null>(null);
  const [hoveredBlog, setHoveredBlog] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'testimonials' | 'blog'>('testimonials');

  // Static testimonials — curated showcase content, not live DB reviews.
  const testimonials = [
    {
      id: 't1',
      name: 'Salma Bennani',
      role: 'Institut de beauté',
      city: 'Casablanca',
      rating: 5,
      text: 'J\'ai réservé un soin du visage en deux minutes depuis mon téléphone. Le salon m\'a confirmé immédiatement, c\'est simple et fiable.',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      initials: 'SB',
      date: 'Il y a 3 jours',
    },
    {
      id: 't2',
      name: 'Yassine El Amrani',
      role: 'Barbier',
      city: 'Rabat',
      rating: 5,
      text: 'Fini l\'attente au salon. Je choisis mon barbier, mon créneau, et je suis sûr d\'être pris à l\'heure. Je recommande à 100%.',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      initials: 'YE',
      date: 'Il y a 1 semaine',
    },
    {
      id: 't3',
      name: 'Nadia Tazi',
      role: 'Coiffure',
      city: 'Marrakech',
      rating: 5,
      text: 'Enfin une plateforme qui regroupe les meilleurs salons de la ville. Les avis des autres clients m\'ont vraiment aidée à choisir.',
      avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
      initials: 'NT',
      date: 'Il y a 2 semaines',
    },
    {
      id: 't4',
      name: 'Karim Idrissi',
      role: 'Massage & Spa',
      city: 'Tanger',
      rating: 4,
      text: 'Très pratique pour réserver un hammam en groupe. La confirmation arrive vite et on peut tout gérer depuis le site.',
      avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
      initials: 'KI',
      date: 'Il y a 2 semaines',
    },
    {
      id: 't5',
      name: 'Imane Cherkaoui',
      role: 'Manucure',
      city: 'Casablanca',
      rating: 5,
      text: 'Je réserve toutes mes séances manucure ici. Le rappel avant le rendez-vous est un vrai plus, je n\'oublie plus jamais.',
      avatar: 'https://randomuser.me/api/portraits/women/26.jpg',
      initials: 'IC',
      date: 'Il y a 3 semaines',
    },
    {
      id: 't6',
      name: 'Mehdi Benjelloun',
      role: 'Coiffure homme',
      city: 'Fès',
      rating: 5,
      text: 'Mon salon habituel est sur la plateforme, je peux même payer en ligne. Le professionnalisme est au rendez-vous à chaque visite.',
      avatar: 'https://randomuser.me/api/portraits/men/85.jpg',
      initials: 'MB',
      date: 'Le mois dernier',
    },
  ];


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
            <div className="inline-block w-full max-w-[340px]">
              <div className="relative flex items-center border-black/10 border justify-center w-full h-12 bg-white rounded-full mx-auto">
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