"use client";

import { useState } from 'react';
import { Search, MapPin, Star, Clock, ArrowRight, SlidersHorizontal, Heart } from 'lucide-react';
import ModalFilters from '../../components/ModalFilters';
import RezaNavbar from '../../components/Header';
import Footer from '../../components/Footer';
import { useRouter } from 'next/navigation';

const mockResults = [
	{
		id: 1,
		name: 'Salon Élégance',
		image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
		rating: 4.8,
		reviews: 156,
		category: 'Coiffeur',
		location: 'Maarif, Casablanca',
		distance: '1.2 km',
		price: '$$',
		services: ['Coupe', 'Coloration', 'Brushing'],
		nextAvailable: "Aujourd'hui à 15h",
	},
	{
		id: 2,
		name: 'Barber Studio',
		image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
		rating: 4.9,
		reviews: 203,
		category: 'Barbier',
		location: 'Racine, Casablanca',
		distance: '2.1 km',
		price: '$',
		services: ['Rasage', 'Taille barbe', 'Coupe'],
		nextAvailable: 'Demain à 10h',
	},
	{
		id: 3,
		name: 'Spa Royal Casablanca',
		image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
		rating: 4.7,
		reviews: 98,
		category: 'Spa',
		location: 'Oasis, Casablanca',
		distance: '3.5 km',
		price: '$$$',
		services: ['Hammam', 'Massage', 'Gommage'],
		nextAvailable: "Aujourd'hui à 18h",
	},
	{
		id: 4,
		name: 'Beauty Center Chic',
		// updated image URL (new photo)
		image: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=800&q=80',
		rating: 4.6,
		reviews: 124,
		category: 'Centre de beauté',
		location: 'Centre-ville, Casablanca',
		distance: '0.8 km',
		price: '$$',
		services: ['Manucure', 'Pédicure', 'Épilation'],
		nextAvailable: "Aujourd'hui à 14h",
	}
];

const sortOptions = [
	{ key: 'recommended', label: 'Recommandé' },
	{ key: 'rating', label: 'Meilleure note' },
	{ key: 'distance', label: 'Plus proche' },
	{ key: 'price', label: 'Prix' }
];

export default function LuxurySearchResults() {
	const [query, setQuery] = useState('');
	const [location, setLocation] = useState('');
	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState('recommended');
	const [likedSalons, setLikedSalons] = useState(new Set<number>());
	const [filterValues, setFilterValues] = useState({
		availability: '',
		selectedDate: null as Date | null,
		selectedTime: null as string | null,
		rating: null as number | null,
		priceRange: [0, 1000] as [number, number],
		categories: [] as string[],
		distance: 10,
		bestPro: false,
	});

	const router = useRouter();
	const toggleLike = (id: number) => {
		setLikedSalons(prev => {
			const newLiked = new Set(prev);
			if (newLiked.has(id)) {
				newLiked.delete(id);
			} else {
				newLiked.add(id);
			}
			return newLiked;
		});
	};

	return (
		<div className="min-h-screen bg-[#f5f7f3]">
			<style jsx global>{`
				* {
					-webkit-font-smoothing: antialiased;
					-moz-osx-font-smoothing: grayscale;
				}
				
				::-webkit-scrollbar {
					width: 6px;
				}
				
				::-webkit-scrollbar-track {
					background: transparent;
				}
				
				::-webkit-scrollbar-thumb {
					background: rgba(139, 114, 96, 0.2);
					border-radius: 3px;
				}
				
				::-webkit-scrollbar-thumb:hover {
					background: rgba(139, 114, 96, 0.4);
				}

				@keyframes fadeInUp {
					from {
						opacity: 0;
						transform: translateY(20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				.animate-fadeInUp {
					animation: fadeInUp 0.5s ease-out forwards;
				}
			`}</style>

			{/* Header - Fixed */}
			<RezaNavbar />

			{/* Main Content */}
			<div className="flex pt-20"> {/* restore padding for header-only layout */}
				{/* Left Side - Results */}
				<div className="w-full">
					<div className="max-w-4xl mx-auto px-6 py-8">
						{/* Header with search pills and sort pills on the right */}
						<div className="mb-10">
							<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
								<div>
									{/* Number on its own line, label below */}
									<h1 className="text-4xl font-light text-gray-900 leading-none">{mockResults.length}</h1>
									<span className="block text-lg mt-1" style={{ color: '#8b7260' }}>Salons</span>
									<p className="text-sm text-gray-400 mt-2">Casablanca et environs</p>
								</div>
								{/* Right: Pills (search/location/filter + sort) */}
								<div className="flex flex-col gap-3 items-end">
									<div className="flex items-center gap-3">
										<div className="flex items-center gap-3 bg-[#f5f7f3] rounded-full px-4 py-2 border border-gray-300 hover:border-gray-400 transition-all">
											<Search className="w-4 h-4 text-gray-400" />
											<input
												type="text"
												placeholder="Rechercher un salon ou service"
												className="w-44 outline-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400"
												value={query}
												onChange={(e) => setQuery(e.target.value)}
											/>
										</div>
										<div className="flex items-center gap-3 bg-[#f5f7f3] rounded-full px-4 py-2 border border-gray-300 hover:border-gray-400 transition-all">
											<MapPin className="w-4 h-4 text-gray-400" />
											<input
												type="text"
												placeholder="Casablanca"
												className="w-32 outline-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400"
												value={location}
												onChange={(e) => setLocation(e.target.value)}
											/>
										</div>
										<button
											onClick={() => setShowFilters(true)}
											className="px-4 py-2 rounded-full bg-[#f5f7f3] border border-gray-300 hover:border-gray-400 transition-all flex items-center gap-2 text-sm font-medium"
										>
											<SlidersHorizontal className="w-4 h-4 text-gray-700" />
											<span className="text-gray-700">Filtres</span>
										</button>
									</div>
									<div className="flex gap-2 mt-1 mb-0 overflow-x-auto pb-2 justify-end">
										{sortOptions.map((opt) => (
											<button
												key={opt.key}
												onClick={() => setSortBy(opt.key)}
												className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
													sortBy === opt.key
														? 'bg-[#8b7260] text-white border-[#8b7260]'
														: 'bg-[#f5f7f3] text-gray-600 border-gray-300 hover:border-gray-400'
												}`}
											>
												{opt.label}
											</button>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Results */}
						<div className="space-y-6">
							{mockResults.map((salon, index) => (
								<div
									key={salon.id}
									className="group cursor-pointer animate-fadeInUp"
									style={{ animationDelay: `${index * 100}ms` }}
								>
									<div className="flex gap-6 p-6 rounded-3xl bg-[#f5f7f3] border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-300">
										{/* Image */}
										<div className="relative w-56 h-56 flex-shrink-0 overflow-hidden rounded-2xl">
											<img
												src={salon.image}
												alt={salon.name}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
											/>
											<button
												onClick={(e) => {
													e.stopPropagation();
													toggleLike(salon.id);
												}}
												className="absolute top-4 right-4 w-9 h-9 rounded-full backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
											>
												<Heart
													className={`w-4 h-4 transition-all ${
														likedSalons.has(salon.id)
															? 'fill-red-500 text-red-500'
															: 'text-gray-600'
													}`}
												/>
											</button>
										</div>

										{/* Content */}
										<div className="flex-1 flex flex-col justify-between py-1">
											<div>
												<h3 className="text-2xl font-medium text-gray-900 mb-3 group-hover:text-[#8b7260] transition-colors">
													{salon.name}
												</h3>
												
												<div className="flex items-center gap-4 mb-4">
													<div className="flex items-center gap-1.5">
														<Star className="w-4 h-4 fill-[#8b7260] text-[#8b7260]" />
														<span className="text-sm font-semibold text-gray-900">{salon.rating}</span>
														<span className="text-sm text-gray-400">({salon.reviews})</span>
													</div>
													<div className="h-1 w-1 rounded-full bg-gray-300" />
													<span className="text-sm font-medium text-gray-600">{salon.price}</span>
												</div>

												<div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
													<MapPin className="w-4 h-4" />
													<span>{salon.location}</span>
													<div className="h-1 w-1 rounded-full bg-gray-300" />
													<span className="text-[#8b7260] font-medium">{salon.distance}</span>
												</div>

												<div className="flex flex-wrap gap-2">
													{salon.services.map((service, idx) => (
														<span
															key={idx}
															className="px-3 py-1.5 rounded-full bg-[#f5f7f3] border border-gray-300 text-xs font-medium text-gray-600"
														>
															{service}
														</span>
													))}
												</div>
											</div>

											<div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
												<div className="flex items-center gap-2">
													<Clock className="w-4 h-4 text-green-600" />
													<span className="text-sm font-medium text-green-600">{salon.nextAvailable}</span>
												</div>
												<button
													className="px-6 py-2.5 rounded-full bg-[#8b7260] text-white text-sm font-medium hover:bg-[#6d5a4d] transition-all flex items-center gap-2 group/btn"
													onClick={() => router.push(`/salon/${salon.id}`)}
												>
													<span>Réserver</span>
													<ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
												</button>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

			</div>

			{/* External Filter Modal */}
			<ModalFilters
				open={showFilters}
				filterValues={{
					availability: filterValues.availability,
					selectedDate: filterValues.selectedDate,
					selectedTime: filterValues.selectedTime,
					rating: filterValues.rating,
					bestPro: filterValues.bestPro,
				}}
				setFilterValues={(vals: any) => setFilterValues({ ...filterValues, ...vals })}
				onClose={() => setShowFilters(false)}
			/>

			{/* Added shared Footer component */}
			<Footer />
		</div>
	);
}