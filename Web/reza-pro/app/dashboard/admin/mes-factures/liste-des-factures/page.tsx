'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ListeDesFacturesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/admin/mes-factures');
  }, [router]);

  return null;
}
