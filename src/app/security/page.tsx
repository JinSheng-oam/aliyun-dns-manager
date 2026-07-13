import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getSecurityConfigItems, type SecurityConfigStatus } from '@/lib/security-config';
import { BackupManager } from './BackupManager';

export const dynamic = 'force-dynamic';

const statusMeta: Record<SecurityConfigStatus, { label: string; iconColor: string; bg: string; borderColor: string }> = {
  ok: {
    label: '正常',
    iconColor: 'var(--success)',
    bg: 'var(--success-light)',
    borderColor: 'oklch(62% 0.18 145 / 0.2)',
  },
  warning: {
    label: '建议配置',
    iconColor: 'var(--warning)',
    bg: 'var(--warning-light)',
    borderColor: 'oklch(70% 0.16 80 / 0.25)',
  },
  danger: {
    label: '需要处理',
    iconColor: 'var(--danger)',
    bg: 'var(--danger-light)',
    borderColor: 'oklch(55% 0.2 20 / 0.2)',
  },
};

export default function SecurityPage() {
  const items = getSecurityConfigItems();
  const issueCount = items.filter((item) => item.status !== 'ok').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>安全检查</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          这里只检查关键环境变量的配置状态，不会显示密码、密钥或任何敏感值。
        </p>
      </div>

      {/* Summary card */}
      <div className="surface rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}>
            <ShieldCheck className="h-3.5 w-3.5" />
            部署前检查
          </div>
          <h2 className="text-lg font-semibold mt-2" style={{ color: 'var(--fg)' }}>安全配置检查</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>检查部署环境的安全配置状态</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg px-5 py-3" style={{ backgroundColor: 'var(--surface-hover)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>待优化</span>
          <span className="text-3xl font-bold" style={{ color: issueCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {issueCount}
          </span>
        </div>
      </div>

      {/* Checklist */}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const meta = statusMeta[item.status];
          const Icon = item.status === 'ok' ? CheckCircle2 : AlertTriangle;

          return (
            <section key={item.key} className="surface rounded-xl p-5" style={{ borderColor: meta.borderColor }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{item.title}</h3>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted)' }}>{item.key}</p>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shrink-0"
                  style={{ borderColor: meta.borderColor, backgroundColor: meta.bg, color: meta.iconColor }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>{item.summary}</p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{item.advice}</p>
            </section>
          );
        })}
      </div>

      <BackupManager />

      <div className="rounded-lg px-4 py-3 text-xs leading-relaxed" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--muted)' }}>
        修改配置后请重启应用，让新的环境变量生效。若已部署到公网，建议同时使用 HTTPS、反向代理和额外访问控制。
      </div>
    </div>
  );
}
