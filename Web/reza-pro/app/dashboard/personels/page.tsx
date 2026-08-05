'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PersonelsIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/personels/gestion');
  }, [router]);

  return null;
}
