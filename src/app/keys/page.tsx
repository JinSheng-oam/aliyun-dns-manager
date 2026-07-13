import { getAccessKeysAction } from '@/app/actions';
import { KeyList } from './components/KeyList';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function KeysPage() {
  const result = await getAccessKeysAction();
  const keys = result.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>密钥管理</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          管理您用于访问阿里云 API 的 AccessKey。所有密钥均严格保存在本地。
        </p>
      </div>

      {!result.success && (
        <div
          className="rounded-xl border p-4 flex items-start gap-3"
          style={{ borderColor: 'oklch(55% 0.2 20 / 0.2)', backgroundColor: 'var(--danger-light)' }}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--danger)' }} />
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--danger)' }}>AccessKey 数据读取失败</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--danger)', opacity: 0.8 }}>{result.error}</p>
          </div>
        </div>
      )}

      <KeyList initialKeys={keys} readError={result.success ? undefined : result.error} />
    </div>
  );
}
