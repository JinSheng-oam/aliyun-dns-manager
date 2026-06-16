'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Key, Globe, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import { logoutAction } from '@/app/actions';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const navItems = [
    { name: '仪表盘', href: '/', icon: LayoutDashboard },
    { name: '密钥管理', href: '/keys', icon: Key },
    { name: 'DNS 管理', href: '/dns', icon: Globe },
    { name: '安全检查', href: '/security', icon: ShieldCheck },
];

export function Sidebar() {
    const pathname = usePathname();
    const confirm = useConfirm();

    const handleLogout = async () => {
        const confirmed = await confirm({
            title: '退出登录',
            description: '确定要退出当前管理会话吗？退出后需要重新登录才能继续管理 DNS。',
            confirmText: '退出登录',
            variant: 'danger',
        });

        if (!confirmed) return;

        await logoutAction();
        window.location.href = '/login';
    };

    if (pathname === '/login') return null;

    return (
        <div className="w-64 h-screen border-r border-white/10 glass flex flex-col p-4 fixed left-0 top-0 z-50 hidden lg:flex">
            <div className="mb-8 flex items-center gap-2 px-2">
                <Globe className="h-6 w-6 text-blue-400" />
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Aliyun DNS
                </h1>
            </div>
            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={twMerge(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden',
                                isActive
                                    ? 'bg-blue-500/20 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            )}
                        >
                            <item.icon
                                className={clsx(
                                    'h-5 w-5 transition-colors',
                                    isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'
                                )}
                            />
                            <span className="relative z-10">{item.name}</span>
                            {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-50" />
                            )}
                        </Link>
                    );
                })}
            </nav>
            <div className="mt-auto space-y-4">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all duration-200"
                >
                    <LogOut className="h-5 w-5" />
                    <span>退出登录</span>
                </button>
                <div className="text-[10px] text-gray-600 px-4 text-center uppercase tracking-widest">
                    V0.3.2 • SECURED
                </div>
            </div>
        </div>
    );
}
