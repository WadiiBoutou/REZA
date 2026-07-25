'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MesFacturesRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/dashboard/admin/mes-factures/liste-des-factures');
  }, [router]);

  return null;
}
