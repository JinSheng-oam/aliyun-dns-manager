'use client';

import { useState } from 'react';
import { loginAction } from '@/app/actions';
import { Button } from '@/components/ui/Button';
import { Lock, Globe } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await loginAction(password);
      if (res.success) {
        window.location.href = '/';
      } else {
        setError(res.error || '密码错误，请重试');
      }
    } catch {
      setError('网络错误，请检查连接后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="login-page"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand header */}
        <div className="text-center space-y-3">
          <div
            className="inline-flex items-center justify-center h-14 w-14 rounded-2xl shadow-sm p-2"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <img src="/icon.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>
            Aliyun DNS Manager
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            请输入管理员密码以继续
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div
            className="surface p-1 rounded-xl"
            style={{ borderRadius: 'var(--r-xl)' }}
          >
            <div className="relative">
              <Lock
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-4 my-auto h-4 w-4"
                style={{ color: 'var(--muted)' }}
              />
              <input
                type="password"
                placeholder="管理员密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="field-control w-full pl-12 pr-4"
                style={{
                  border: 'none',
                  boxShadow: 'none',
                  backgroundColor: 'transparent',
                  height: '48px',
                  fontSize: '15px',
                  paddingLeft: '3rem',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.form?.requestSubmit();
                }}
              />
            </div>
          </div>

          {error && (
            <p
              className="text-center text-sm animate-shake rounded-lg px-4 py-2"
              style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-[15px]"
            isLoading={isLoading}
          >
            验证并进入
          </Button>
        </form>

        <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
          公网部署时请务必配置 HTTPS 和强密码
        </p>
      </div>
    </div>
  );
}
