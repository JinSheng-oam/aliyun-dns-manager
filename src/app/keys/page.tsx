import { getAccessKeysAction } from '@/app/actions';
import { KeyList } from './components/KeyList';

export default async function KeysPage() {
    const { data: keys = [] } = await getAccessKeysAction();

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    密钥管理
                </h1>
                <p className="text-gray-400 mt-2">
                    管理您用于访问阿里云 API 的 AccessKey。所有密钥均严格保存在本地。
                </p>
            </div>

            <KeyList initialKeys={keys || []} />
        </div>
    );
}
