import { getAccessKeysAction } from '@/app/actions';
import { DnsManager } from './components/DnsManager';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DnsPage() {
    const result = await getAccessKeysAction();
    const keys = result.data || [];

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    DNS 解析管理
                </h1>
                <p className="text-gray-400 mt-2">
                    查询、添加和删除域名的 DNS 解析记录。
                </p>
            </div>

            {!result.success && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                        <div>
                            <h2 className="font-semibold">无法加载 AccessKey</h2>
                            <p className="mt-1 text-sm leading-6 text-red-100/80">{result.error}</p>
                        </div>
                    </div>
                </div>
            )}

            {result.success && <DnsManager initialKeys={keys} />}
        </div>
    );
}
