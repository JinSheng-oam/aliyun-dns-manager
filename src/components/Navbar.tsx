'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Key, Globe, LayoutDashboard, LogOut, ShieldCheck, Menu, X } from 'lucide-react';
import { logoutAction } from '@/app/actions';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useState } from 'react';

const navItems = [
  { name: '仪表盘', href: '/', icon: LayoutDashboard },
  { name: '密钥管理', href: '/keys', icon: Key },
  { name: 'DNS 管理', href: '/dns', icon: Globe },
  { name: '安全检查', href: '/security', icon: ShieldCheck },
];

export function Navbar() {
  const pathname = usePathname();
  const confirm = useConfirm();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-[var(--navbar-height)] border-b backdrop-blur-xl"
      style={{ borderColor: 'var(--border)', backgroundColor: 'oklch(100% 0 0 / 0.8)' }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
          >
            <Globe className="h-4.5 w-4.5" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--fg)' }}>
            Aliyun DNS
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
                style={{
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  backgroundColor: active ? 'var(--accent-light)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                    e.currentTarget.style.color = 'var(--fg)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--muted)';
                  }
                }}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Desktop logout + mobile hamburger */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--danger-light)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--muted)';
            }}
          >
            <LogOut className="h-4 w-4" />
            退出
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg transition-colors"
            style={{ color: 'var(--muted)' }}
            aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="md:hidden border-b backdrop-blur-xl shadow-lg animate-in slide-in-from-top-2 duration-150"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--fg)',
                    backgroundColor: active ? 'var(--accent-light)' : 'transparent',
                  }}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  {item.name}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full text-left"
              style={{ color: 'var(--danger)' }}
            >
              <LogOut className="h-4.5 w-4.5" />
              退出登录
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
