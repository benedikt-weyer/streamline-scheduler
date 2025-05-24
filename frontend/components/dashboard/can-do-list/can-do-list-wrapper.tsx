'use client';

import dynamic from 'next/dynamic';

// Dynamically import the CanDoListPage component with no SSR
const CanDoListPage = dynamic(
  () => import('@/app/dashboard/can-do-list/page'),
  { ssr: false }
);

export default function CanDoListWrapper() {
  return <CanDoListPage />;
}