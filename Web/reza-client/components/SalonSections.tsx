'use client';

import React, { useState } from 'react';
import RecommendedSection from './RecommendedSection';
import NewSalonsSection from './NewSalonsSection';

/**
 * Renders both salon carousels together so NewSalonsSection can exclude
 * whatever IDs are already shown in RecommendedSection.
 */
export default function SalonSections() {
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());

  return (
    <>
      <RecommendedSection onRenderedIds={setRecommendedIds} />
      <NewSalonsSection excludeIds={recommendedIds} />
    </>
  );
}
