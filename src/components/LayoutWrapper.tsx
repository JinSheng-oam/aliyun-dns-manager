'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { twMerge } from 'tailwind-merge';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    return (
        <>
            <Sidebar />
            <main className={twMerge(
                "min-h-screen transition-all duration-300",
                isLoginPage ? "pl-0" : "lg:pl-64 pl-0"
            )}>
                <div key={pathname} className="page-transition container mx-auto p-8">
                    {children}
                </div>
            </main>
        </>
    );
}
