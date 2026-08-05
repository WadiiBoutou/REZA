'use client';

import React, { useState, useRef, use, useEffect } from 'react';
import { Upload, Image, Trash2, Edit3, Grid, List, Search, Filter, Download, Eye, X, Check, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MoreVertical, FolderOpen, Star, Calendar, Tag, Crop } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import SalonScopeNotice from '@/components/SalonScopeNotice';
import toast from 'react-hot-toast';

const PhotoManagement = () => {
  const { isSalonFilterMulti } = useAuth();
  const [viewMode, setViewMode] = useState('grid');
  const [selectedTab, setSelectedTab] = useState('validated'); // validated or rejected
  const [selectedPhotos, setSelectedPhotos] = useState<(number | string)[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<typeof photos[0] | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  type Photo = {
    id: number | string;
    url: string;
    title: string;
    status: string;
    date: Date | string;
    category: string;
    tags: string[];
    size: string;
    dimensions: string;
    rejectionReason?: string;
  };
  const [photoCrop, setPhotoCrop] = useState<Photo | null>(null);
  const [cropArea, setCropArea] = useState({ x: 10, y: 10, width: 80, height: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; cropX?: number; cropY?: number; cropWidth?: number; cropHeight?: number }>({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropImageRef = useRef(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Photos data from API
  const [photos, setPhotos] = useState<Photo[]>([]);

  // Transform API photo to frontend format
  const transformApiPhoto = (apiPhoto: any): Photo => {
    // Handle date conversion - can be Date, string, or ISO string
    let photoDate: Date | string;
    if (apiPhoto.date instanceof Date) {
      photoDate = apiPhoto.date;
    } else if (typeof apiPhoto.date === 'string') {
      photoDate = new Date(apiPhoto.date);
    } else {
      photoDate = new Date();
    }

    return {
      id: apiPhoto.id || String(Date.now() + Math.random()),
      url: apiPhoto.url || '',
      title: apiPhoto.title || 'Sans titre',
      status: apiPhoto.status || 'validated',
      date: photoDate,
      category: apiPhoto.category || 'Autre',
      tags: Array.isArray(apiPhoto.tags) ? apiPhoto.tags : [],
      size: apiPhoto.size || '0 MB',
      dimensions: apiPhoto.dimensions || '0x0',
      rejectionReason: apiPhoto.rejectionReason
    };
  };

  // Fetch photos from API
  useEffect(() => {
    setMounted(true);
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getPhotos();
      const apiPhotos = response.photos || [];
      
      // Ensure we have an array
      if (!Array.isArray(apiPhotos)) {
        console.warn('Photos response is not an array:', apiPhotos);
        setPhotos([]);
        return;
      }
      
      const transformedPhotos = apiPhotos.map(transformApiPhoto);
      setPhotos(transformedPhotos);
    } catch (err: any) {
      console.error('Error fetching photos:', err);
      const errorMessage = err.message || 'Erreur lors du chargement des photos';
      setError(errorMessage);
      toast.error(errorMessage);
      setPhotos([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const filteredPhotos = photos.filter(photo => {
    const matchesTab = photo.status === selectedTab;
    const matchesSearch = photo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         photo.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         photo.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const handleSelectPhoto = (photoId: number | string) => {
    setSelectedPhotos(prev => 
      prev.includes(photoId) 
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPhotos.length === filteredPhotos.length) {
      setSelectedPhotos([]);
    } else {
      setSelectedPhotos(filteredPhotos.map(p => p.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPhotos.length === 0) return;
    
    if (confirm(`Supprimer ${selectedPhotos.length} photo(s) sélectionnée(s) ?`)) {
      try {
        const loadingToast = toast.loading('Suppression des photos...');
        const photoIds = selectedPhotos.map(id => String(id));
        await api.deletePhotos(photoIds);
        await fetchPhotos();
        toast.dismiss(loadingToast);
        toast.success(`${selectedPhotos.length} photo(s) supprimée(s) avec succès`);
        setSelectedPhotos([]);
      } catch (err: any) {
        toast.dismiss();
        toast.error(err.message || 'Erreur lors de la suppression des photos');
      }
    }
  };

  const handleDownloadSelected = () => {
    toast.loading(`Téléchargement de ${selectedPhotos.length} photo(s)...`);
  };

  const handleDeletePhoto = async (photoId: number | string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) {
      try {
        const loadingToast = toast.loading('Suppression de la photo...');
        await api.deletePhoto(String(photoId));
        toast.dismiss(loadingToast);
        await fetchPhotos(); // Recharger après suppression
        toast.success('Photo supprimée avec succès');
      } catch (err: any) {
        toast.dismiss();
        toast.error(err.message || 'Erreur lors de la suppression de la photo');
      }
    }
  };

  // Compress image before upload
  const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const loadingToast = toast.loading(`Import de ${files.length} photo(s)...`);
      
      // Compress and convert files to base64
      const newPhotos = await Promise.all(
        Array.from(files).map(async (file, index) => {
          try {
            const compressedUrl = await compressImage(file);
            return {
              id: Date.now() + index,
              url: compressedUrl,
              title: file.name.replace(/\.[^/.]+$/, '') || `Photo ${index + 1}`,
              status: 'validated',
              date: new Date(),
              category: 'Autre',
              tags: [],
              size: `${(compressedUrl.length * 3 / 4 / 1024 / 1024).toFixed(2)} MB`, // Approximate size from base64
              dimensions: '1920x1080' // Will be updated if we can get actual dimensions
            };
          } catch (err) {
            console.error('Error compressing image:', err);
            // Fallback to original file if compression fails
            const reader = new FileReader();
            return new Promise<Photo>((resolve) => {
              reader.onload = (e) => {
                resolve({
                  id: Date.now() + index,
                  url: e.target?.result as string,
                  title: file.name.replace(/\.[^/.]+$/, '') || `Photo ${index + 1}`,
                  status: 'validated',
                  date: new Date(),
                  category: 'Autre',
                  tags: [],
                  size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                  dimensions: '0x0'
                });
              };
              reader.readAsDataURL(file);
            });
          }
        })
      );

      const response = await api.uploadPhotos(newPhotos.map(p => ({
        url: p.url,
        title: p.title,
        status: p.status,
        date: p.date instanceof Date ? p.date.toISOString() : (typeof p.date === 'string' ? p.date : new Date().toISOString()),
        category: p.category,
        tags: p.tags,
        size: p.size,
        dimensions: p.dimensions
      })));

      // Recharger les photos après l'upload
      await fetchPhotos();
      
      toast.dismiss(loadingToast);
      toast.success(`${files.length} photo(s) importée(s) avec succès`);
      setShowUploadModal(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      toast.dismiss();
      const errorMessage = err.message || 'Erreur lors de l\'import des photos';
      toast.error(errorMessage, { duration: 5000 });
      console.error('Upload error:', err);
      // Recharger quand même pour voir l'état actuel
      await fetchPhotos();
    }
  };

  const openPhotoViewer = (photo: typeof photos[0]) => {
    setCurrentPhoto(photo);
    setShowPhotoViewer(true);
  };

  const navigatePhoto = (direction: 'next' | 'prev') => {
    if (!currentPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === currentPhoto.id);
    if (currentIndex === -1) return;
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % filteredPhotos.length
      : (currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length;
    setCurrentPhoto(filteredPhotos[newIndex]);
  };

  const openCropModal = (photo: typeof photos[0]) => {
    setPhotoCrop(photo);
    setShowCropModal(true);
    setCropArea({ x: 10, y: 10, width: 80, height: 80 });
  };

  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!cropContainerRef.current) return;
    setIsDragging(true);
    const container = cropContainerRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - (cropArea.x / 100) * container.width,
      y: e.clientY - (cropArea.y / 100) * container.height
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, corner: string) => {
    e.stopPropagation();
    if (!cropContainerRef.current) return;
    setIsResizing(corner);
    const container = cropContainerRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cropX: cropArea.x,
      cropY: cropArea.y,
      cropWidth: cropArea.width,
      cropHeight: cropArea.height
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!cropContainerRef.current) return;
    const container = cropContainerRef.current.getBoundingClientRect();

    if (isDragging) {
      const newX = ((e.clientX - dragStart.x) / container.width) * 100;
      const newY = ((e.clientY - dragStart.y) / container.height) * 100;
      
      const constrainedX = Math.max(0, Math.min(newX, 100 - cropArea.width));
      const constrainedY = Math.max(0, Math.min(newY, 100 - cropArea.height));
      
      setCropArea(prev => ({
        ...prev,
        x: constrainedX,
        y: constrainedY
      }));
    } else if (isResizing) {
      const deltaX = ((e.clientX - dragStart.x) / container.width) * 100;
      const deltaY = ((e.clientY - dragStart.y) / container.height) * 100;
      
      const newCrop = { ...cropArea };

      switch (isResizing) {
        case 'se': // Bottom-right
          newCrop.width = Math.max(
            10,
            Math.min(
              100 - (dragStart.cropX ?? 0),
              (dragStart.cropWidth ?? 0) + deltaX
            )
          );
          newCrop.height = Math.max(10, Math.min(100 - (dragStart.cropY ?? 0), (dragStart.cropHeight ?? 0) + deltaY));
          break;
        case 'sw': // Bottom-left
          newCrop.width = Math.max(10, (dragStart.cropWidth ?? 0) - deltaX);
          newCrop.height = Math.max(10, Math.min(100 - (dragStart.cropY ?? 0), (dragStart.cropHeight ?? 0) + deltaY));
          newCrop.x = Math.min((dragStart.cropX ?? 0) + deltaX, (dragStart.cropX ?? 0) + (dragStart.cropWidth ?? 0) - 10);
          break;
        case 'ne': // Top-right
          newCrop.width = Math.max(
            10,
            Math.min(
              100 - (dragStart.cropX ?? 0),
              (dragStart.cropWidth ?? 0) + deltaX
            )
          );
          newCrop.height = Math.max(10, (dragStart.cropHeight ?? 0) - deltaY);
          newCrop.y = Math.min(
            (dragStart.cropY ?? 0) + deltaY,
            (dragStart.cropY ?? 0) + (dragStart.cropHeight ?? 0) - 10
          );
          break;
        case 'nw': // Top-left
          newCrop.width = Math.max(10, (dragStart.cropWidth ?? 0) - deltaX);
          newCrop.height = Math.max(10, (dragStart.cropHeight ?? 0) - deltaY);
          newCrop.x = Math.min(
            (dragStart.cropX ?? 0) + deltaX,
            (dragStart.cropX ?? 0) + (dragStart.cropWidth ?? 0) - 10
          );
          newCrop.y = Math.min(
            (dragStart.cropY ?? 0) + deltaY,
            (dragStart.cropY ?? 0) + (dragStart.cropHeight ?? 0) - 10
          );
          break;
        case 'e': // Right
          newCrop.width = Math.max(
            10,
            Math.min(
              100 - (dragStart.cropX ?? 0),
              (dragStart.cropWidth ?? 0) + deltaX
            )
          );
          break;
        case 'w': // Left
          newCrop.width = Math.max(10, (dragStart.cropWidth ?? 0) - deltaX);
          newCrop.x = Math.min(
            (dragStart.cropX ?? 0) + deltaX,
            (dragStart.cropX ?? 0) + (dragStart.cropWidth ?? 0) - 10
          );
          break;
        case 's': // Bottom
          newCrop.height = Math.max(
            10,
            Math.min(
              100 - (dragStart.cropY ?? 0),
              (dragStart.cropHeight ?? 0) + deltaY
            )
          );
          break;
        case 'n': // Top
          newCrop.height = Math.max(10, (dragStart.cropHeight ?? 0) - deltaY);
          newCrop.y = Math.min(
            (dragStart.cropY ?? 0) + deltaY,
            (dragStart.cropY ?? 0) + (dragStart.cropHeight ?? 0) - 10
          );
          break;
      }

      setCropArea(newCrop);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(null);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, cropArea, dragStart]);

  const applyCrop = () => {
    if (!photoCrop) return;
    // Simulate cropping by replacing with a placeholder image of the crop size
    const width = Math.round((cropArea.width / 100) * 400);
    const height = Math.round((cropArea.height / 100) * 300);
    const placeholderUrl = `https://via.placeholder.com/${width}x${height}?text=Cropped+${width}x${height}`;
    setPhotos(prev => prev.map(p =>
      p.id === photoCrop.id
        ? { ...p, url: placeholderUrl, dimensions: `${width}x${height}` }
        : p
    ));
    setShowCropModal(false);
  };

  useEffect(() => {
    if (showPhotoViewer && currentPhoto) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowPhotoViewer(false);
        } else if (e.key === 'ArrowLeft') {
          navigatePhoto('prev');
        } else if (e.key === 'ArrowRight') {
          navigatePhoto('next');
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showPhotoViewer, currentPhoto, filteredPhotos]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen p-0">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-12 rounded-xl w-1/3"></div>
          <div className="bg-gray-200 h-96 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Photos are salon-scoped: require a single salon selection.
  if (isSalonFilterMulti) {
    return <SalonScopeNotice title="Gestion photos" subtitle="Gérez les photos de votre établissement" />;
  }

  if (error && photos.length === 0) {
    return (
      <div className="min-h-screen p-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchPhotos();
            }}
            className="px-4 py-2 bg-[#002366] text-white rounded-full hover:bg-gray-800"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
        .photo-card {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .photo-card:hover {
          transform: translateY(-4px);
        }
        .photo-card img {
          transition: transform 0.3s ease;
        }
        .photo-card:hover img {
          transform: scale(1.05);
        }
        .checkbox-overlay {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 10;
        }
      `}</style>

      <div className="p-0 md:p-0 max-w-[2000px] mx-auto">
        {/* Header */}
        <div className="mb-8 animate-slideDown">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-2">
                Gestion des photos
              </h1>
              <p className="text-sm text-gray-500">
                Organisez et gérez vos photos de manière professionnelle
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-3 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-all flex items-center gap-2"
            >
              <Upload size={18} />
              Importer des photos
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200">
            <button
              onClick={() => setSelectedTab('validated')}
              className={`px-6 py-3 text-sm font-medium transition-all relative ${
                selectedTab === 'validated'
                  ? 'text-[#002366]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Photos validées et en validation
              <span className={`absolute bottom-0 left-0 right-0 h-0.5 bg-[#002366] transition-all ${
                selectedTab === 'validated' ? 'opacity-100' : 'opacity-0'
              }`} />
            </button>
            <button
              onClick={() => setSelectedTab('rejected')}
              className={`px-6 py-3 text-sm font-medium transition-all relative ${
                selectedTab === 'rejected'
                  ? 'text-[#002366]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Photos refusées
              <span className={`absolute bottom-0 left-0 right-0 h-0.5 bg-[#002366] transition-all ${
                selectedTab === 'rejected' ? 'opacity-100' : 'opacity-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-slideUp">
          {/* Left: Search & Filter */}
          <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher des photos..."
                className="w-full pl-11 pr-4 py-2.5 rounded-full border border-gray-200 focus:border-[#002366] focus:ring-2 focus:ring-[#002366]/20 outline-none transition-all text-sm"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="px-4 py-2.5 rounded-full border border-gray-200 hover:border-gray-300 transition-all flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                <Filter size={16} />
                Filtrer
              </button>
              {filterOpen && (
                <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-30 animate-slideDown">
                  <h3 className="font-medium text-sm text-gray-900 mb-3">Filtres</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-2 block">Catégorie</label>
                      <Select>
                        <SelectTrigger className="w-full px-3 py-2 rounded-full border border-gray-200 text-sm">
                          <SelectValue placeholder="Toutes les catégories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes les catégories</SelectItem>
                          <SelectItem value="Manucure">Manucure</SelectItem>
                          <SelectItem value="Coiffure">Coiffure</SelectItem>
                          <SelectItem value="Spa">Spa</SelectItem>
                          <SelectItem value="Massage">Massage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-2 block">Date</label>
                      <Select>
                        <SelectTrigger className="w-full px-3 py-2 rounded-full border border-gray-200 text-sm">
                          <SelectValue placeholder="Toutes les dates" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes les dates</SelectItem>
                          <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                          <SelectItem value="week">Cette semaine</SelectItem>
                          <SelectItem value="month">Ce mois</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: View Toggle & Actions */}
          <div className="flex items-center gap-3">
            {selectedPhotos.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full animate-slideUp">
                <span className="text-sm font-medium text-gray-700">
                  {selectedPhotos.length} sélectionnée(s)
                </span>
                <button
                  onClick={handleDownloadSelected}
                  className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                  title="Télécharger"
                >
                  <Download size={16} className="text-gray-600" />
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="p-1.5 hover:bg-red-100 rounded-full transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={16} className="text-red-600" />
                </button>
                <button
                  onClick={() => setSelectedPhotos([])}
                  className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                  title="Désélectionner tout"
                >
                  <X size={16} className="text-gray-600" />
                </button>
              </div>
            )}

            {/* View Toggle */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'grid' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Grille
              </button>
              <span className="text-gray-300">/</span>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'list' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Liste
              </button>
            </div>
          </div>
        </div>

        {/* Photos Display */}
        {filteredPhotos.length === 0 ? (
          <div className="text-center py-20 animate-fadeIn">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center">
              <Image size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-light text-gray-900 mb-2">Aucune photo trouvée</h3>
            <p className="text-sm text-gray-500 mb-6">
              {searchQuery ? 'Essayez une autre recherche' : 'Commencez par importer des photos'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-all inline-flex items-center gap-2"
              >
                <Upload size={18} />
                Importer des photos
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fadeIn">
            {filteredPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="photo-card rounded-xl overflow-hidden border border-gray-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Photo */}
                <div className="relative aspect-[4/3] overflow-hidden group">
                  {photo.url ? (
                  <img
                    src={photo.url}
                    alt={photo.title}
                    className="w-full h-full object-cover"
                  />
                  ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    Image non disponible
                  </div>
                  )}
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    {photo.status === 'validated' ? (
                      <span className="px-2.5 py-1 bg-white text-black text-xs font-medium rounded-full">
                        Validée
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-white text-black text-xs font-medium rounded-full">
                        Refusée
                      </span>
                    )}
                  </div>
                </div>
                {/* Info */}
                <div className="p-4 pb-2">
                  <h3 className="font-medium text-gray-900 mb-1 truncate">{photo.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <Calendar size={12} />
                    <span>{photo.date instanceof Date ? photo.date.toLocaleDateString('fr-FR') : new Date(photo.date).toLocaleDateString('fr-FR')}</span>
                    <span>•</span>
                    <span>{photo.size}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3 justify-between">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                      {photo.category}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openPhotoViewer(photo)}
                        className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition-all"
                        title="Voir"
                      >
                        <Eye size={14} className="text-gray-700" />
                      </button>
                      <button
                        onClick={() => openCropModal(photo)}
                        className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition-all"
                        title="Recadrer"
                      >
                        <Crop size={14} className="text-gray-700" />
                      </button>
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="p-1.5 bg-gray-100 rounded-full hover:bg-red-50 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={14} className="text-red-600" />
                      </button>
                    </div>
                  </div>
                  {photo.rejectionReason && (
                    <p className="text-xs text-red-600 mt-2 flex items-start gap-1">
                      <X size={12} className="mt-0.5 shrink-0" />
                      <span>{photo.rejectionReason}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 animate-fadeIn">
            {filteredPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="rounded-xl border border-gray-200 p-4 hover:transition-all"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-center gap-4">
                  {/* Removed Checkbox */}
                  {/* Thumbnail */}
                  <div className="w-24 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    <img
                      src={photo.url}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-1 truncate">{photo.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {photo.date instanceof Date ? photo.date.toLocaleDateString('fr-FR') : new Date(photo.date).toLocaleDateString('fr-FR')}
                      </span>
                      <span>•</span>
                      <span>{photo.dimensions}</span>
                      <span>•</span>
                      <span>{photo.size}</span>
                      <span>•</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
                        {photo.category}
                      </span>
                    </div>
                    {photo.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <X size={12} />
                        {photo.rejectionReason}
                      </p>
                    )}
                  </div>
                  {/* Status */}
                  <div className="shrink-0">
                    {photo.status === 'validated' ? (
                      <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                        Validée
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-200">
                        Refusée
                      </span>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openPhotoViewer(photo)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Voir"
                    >
                      <Eye size={18} className="text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Éditer"
                    >
                      <Edit3 size={18} className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={18} className="text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Footer */}
        {filteredPhotos.length > 0 && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-fadeIn">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                <span className="font-medium text-gray-900">{filteredPhotos.length}</span> photo(s) affichée(s)
              </span>
              <button className="text-[#002366] hover:underline font-medium flex items-center gap-1">
                <Download size={16} />
                Télécharger mes photos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            {/* Header */}
            <div className="sticky top-0 border-b border-gray-100 px-8 py-6 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-light text-gray-900">Importer des photos</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-[#002366] hover:bg-gray-50 transition-all cursor-pointer"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Upload size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Glissez-déposez vos photos ici
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  ou cliquez pour parcourir vos fichiers
                </p>
                <p className="text-xs text-gray-400">
                  Formats acceptés : JPG, PNG, WEBP • Taille max : 10 MB par fichier
                </p>
              </div>

              {/* Tips */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Conseils pour de meilleures photos :</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Utilisez un bon éclairage naturel</li>
                  <li>• Assurez-vous que les photos sont nettes et de haute qualité</li>
                  <li>• Évitez les photos floues ou pixellisées</li>
                  <li>• Mettez en valeur votre travail professionnel</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t border-gray-100 px-8 py-4 flex gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
              >
                Sélectionner des fichiers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {showPhotoViewer && currentPhoto && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center animate-fadeIn">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <h3 className="text-white font-medium">{currentPhoto.title}</h3>
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                currentPhoto.status === 'validated'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {currentPhoto.status === 'validated' ? 'Validée' : 'Refusée'}
              </span>
            </div>
            <button
              onClick={() => setShowPhotoViewer(false)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={24} className="text-white" />
            </button>
          </div>

          {/* Navigation */}
          <button
            onClick={() => navigatePhoto('prev')}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm z-10"
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
          <button
            onClick={() => navigatePhoto('next')}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm z-10"
          >
            <ChevronRight size={24} className="text-white" />
          </button>

          {/* Image */}
          <div className="max-w-7xl max-h-[80vh] flex items-center justify-center">
            <img
              src={currentPhoto.url}
              alt={currentPhoto.title}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>

          {/* Bottom Info */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-6 text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar size={16} />
                    {(currentPhoto.date instanceof Date ? currentPhoto.date : new Date(currentPhoto.date)).toLocaleDateString('fr-FR', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </span>
                  <span>{currentPhoto.dimensions}</span>
                  <span>{currentPhoto.size}</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                    {currentPhoto.category}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Télécharger">
                    <Download size={20} />
                  </button>
                  <button className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Éditer">
                    <Edit3 size={20} />
                  </button>
                  <button className="p-2 hover:bg-red-500/20 rounded-full transition-colors" title="Supprimer">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              {currentPhoto.rejectionReason && (
                <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300 flex items-start gap-2">
                    <X size={16} className="mt-0.5 shrink-0" />
                    <span><strong>Raison du refus :</strong> {currentPhoto.rejectionReason}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Keyboard hint */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/60 text-xs">
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20">←</kbd>
              <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20">→</kbd>
              Naviguer
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20">Esc</kbd>
              Fermer
            </span>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {showCropModal && photoCrop && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 animate-fadeIn">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <h3 className="text-white font-medium">Recadrer : {photoCrop.title}</h3>
            </div>
            <button
              onClick={() => setShowCropModal(false)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={24} className="text-white" />
            </button>
          </div>

          {/* Crop Container */}
          <div className="max-w-4xl w-full">
            <div
              ref={cropContainerRef}
              className="relative w-full aspect-video bg-black rounded-lg overflow-hidden"
              style={{ maxHeight: '70vh' }}
            >
              {/* Image */}
              <img
                ref={cropImageRef}
                src={photoCrop.url}
                alt={photoCrop.title}
                className="w-full h-full object-contain select-none"
                draggable={false}
              />

              {/* Crop Overlay - Dark areas */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Top */}
                <div
                  className="absolute top-0 left-0 right-0 bg-black/60"
                  style={{ height: `${cropArea.y}%` }}
                />
                {/* Bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-black/60"
                  style={{ height: `${100 - cropArea.y - cropArea.height}%` }}
                />
                {/* Left */}
                <div
                  className="absolute left-0 bg-black/60"
                  style={{
                    top: `${cropArea.y}%`,
                    width: `${cropArea.x}%`,
                    height: `${cropArea.height}%`
                  }}
                />
                {/* Right */}
                <div
                  className="absolute right-0 bg-black/60"
                  style={{
                    top: `${cropArea.y}%`,
                    width: `${100 - cropArea.x - cropArea.width}%`,
                    height: `${cropArea.height}%`
                  }}
                />
              </div>

              {/* Crop Selection Box */}
              <div
                className="absolute border-2 border-white cursor-move"
                style={{
                  left: `${cropArea.x}%`,
                  top: `${cropArea.y}%`,
                  width: `${cropArea.width}%`,
                  height: `${cropArea.height}%`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                }}
                onMouseDown={handleCropMouseDown}
              >
                {/* Grid lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/30" />
                  ))}
                </div>

                {/* Resize handles */}
                <div 
                  className="absolute -top-1 -left-1 w-3 h-3 bg-white rounded-full cursor-nw-resize z-10" 
                  onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
                />
                <div 
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full cursor-n-resize z-10" 
                  onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
                />
                <div 
                  className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full cursor-ne-resize z-10" 
                  onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -left-1 w-3 h-3 bg-white rounded-full cursor-w-resize z-10" 
                  onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -right-1 w-3 h-3 bg-white rounded-full cursor-e-resize z-10" 
                  onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
                />
                <div 
                  className="absolute -bottom-1 -left-1 w-3 h-3 bg-white rounded-full cursor-sw-resize z-10" 
                  onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
                />
                <div 
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full cursor-s-resize z-10" 
                  onMouseDown={(e) => handleResizeMouseDown(e, 's')}
                />
                <div 
                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full cursor-se-resize z-10" 
                  onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-white text-sm">
                <p>Déplacez et redimensionnez la zone de recadrage</p>
                <p className="text-white/60 text-xs mt-1">
                  Zone: {Math.round(cropArea.width)}% × {Math.round(cropArea.height)}%
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCropModal(false)}
                  className="px-6 py-2.5 text-white border border-white/20 rounded-full hover:bg-white/10 transition-all text-sm font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={applyCrop}
                  className="px-6 py-2.5 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-all text-sm font-medium"
                >
                  Appliquer le recadrage
                </button>
              </div>
            </div>
          </div>

          {/* Keyboard hint */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/60 text-xs">
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20">Esc</kbd>
              Annuler
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoManagement;