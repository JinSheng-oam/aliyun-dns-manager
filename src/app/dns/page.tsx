import { getAccessKeysAction } from '@/app/actions';
import { DnsManager } from './components/DnsManager';
import { AlertTriangle } from 'lucide-react';
import { isReadOnlyModeEnabled } from '@/lib/security-config';

export const dynamic = 'force-dynamic';

export default async function DnsPage() {
  const result = await getAccessKeysAction();
  const keys = result.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>
          DNS 解析管理
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          查询、添加和删除域名的 DNS 解析记录
        </p>
      </div>

      {!result.success && (
        <div
          className="rounded-xl border p-4 flex items-start gap-3"
          style={{ borderColor: 'oklch(55% 0.2 20 / 0.2)', backgroundColor: 'var(--danger-light)' }}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--danger)' }} />
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--danger)' }}>无法加载 AccessKey</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--danger)', opacity: 0.8 }}>{result.error}</p>
          </div>
        </div>
      )}

      {result.success && <DnsManager initialKeys={keys} readOnly={isReadOnlyModeEnabled()} />}
    </div>
  );
}
