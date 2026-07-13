'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Key, Globe, LayoutDashboard, LogOut, ShieldCheck, X, Menu, Sun, Moon } from 'lucide-react';
import { logoutAction } from '@/app/actions';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useState, useEffect, useRef } from 'react';

const navItems = [
  { name: '仪表盘', href: '/', icon: LayoutDashboard },
  { name: '密钥管理', href: '/keys', icon: Key },
  { name: 'DNS 管理', href: '/dns', icon: Globe },
  { name: '安全检查', href: '/security', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const confirm = useConfirm();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const previousPathnameRef = useRef(pathname);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    const timer = window.setTimeout(() => setMobileOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // Sync theme from DOM and persist
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const el = document.documentElement;
    const next = el.getAttribute('data-theme') === 'dark' ? '' : 'dark';
    if (next) {
      el.setAttribute('data-theme', 'dark');
    } else {
      el.removeAttribute('data-theme');
    }
    setIsDark(next === 'dark');
    try { localStorage.setItem('aliyun-dns-theme', next || 'light'); } catch {}
  };

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

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: 'var(--surface)' }}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-5 h-14 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
          >
            <Globe className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--fg)' }}>
            Aliyun DNS
          </span>
        </Link>
        {/* Close on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ color: 'var(--muted)' }}
          aria-label="关闭菜单"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none"
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
              onFocus={(e) => {
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)';
                e.currentTarget.style.borderRadius = 'var(--r-md)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {item.name}
              {active && (
                <div
                  className="ml-auto h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150"
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
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          退出登录
        </button>
        <div className="mt-2 flex items-center justify-between px-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-150"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
              e.currentTarget.style.color = 'var(--fg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--muted)';
            }}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {isDark ? '浅色模式' : '深色模式'}
          </button>
          <span className="text-[10px] font-medium tracking-widest" style={{ color: 'var(--muted)', opacity: 0.5 }}>
            V{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 h-9 w-9 rounded-lg flex items-center justify-center shadow-sm"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        aria-label="打开菜单"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {/* Desktop sidebar — fixed, always visible */}
      <aside
        className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-[240px] flex-col"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="absolute left-0 top-0 bottom-0 w-[260px] animate-in slide-in-from-left duration-200 shadow-xl"
            style={{ borderRight: '1px solid var(--border)' }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
