'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar />
      <main
        className={isLoginPage ? 'min-h-screen flex-1' : 'min-h-screen flex-1 lg:pl-[240px] flex flex-col'}
        style={{ backgroundColor: 'var(--bg)' }}
      >
        {isLoginPage ? (
          children
        ) : (
          <div key={pathname} className="page-transition mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 flex-1 flex flex-col">
            {children}
          </div>
        )}
      </main>
    </div>
  );
}
