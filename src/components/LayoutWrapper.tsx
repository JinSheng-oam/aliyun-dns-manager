'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <>
      <Sidebar />
      <main
        className={isLoginPage ? 'min-h-screen' : 'min-h-screen lg:pl-[240px]'}
      >
        {isLoginPage ? (
          children
        ) : (
          <div key={pathname} className="page-transition mx-auto max-w-7xl px-4 sm:px-6 py-6">
            {children}
          </div>
        )}
      </main>
    </>
  );
}
