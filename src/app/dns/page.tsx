import { getAccessKeysAction } from '@/app/actions';
import { DnsManager } from './components/DnsManager';

export default async function DnsPage() {
    const { data: keys = [] } = await getAccessKeysAction();

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

            <DnsManager initialKeys={keys || []} />
        </div>
    );
}
