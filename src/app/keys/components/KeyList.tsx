'use client';

import { useState } from 'react';
import { AccessKey } from '@/lib/types';
import { addAccessKeyAction, deleteAccessKeyAction, updateAccessKeyAction } from '@/app/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Trash2, Plus, Eye, EyeOff, Copy, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

interface KeyListProps {
    initialKeys: AccessKey[];
}

export function KeyList({ initialKeys }: KeyListProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const router = useRouter();
    const toast = useToast();

    // Form State
    const [name, setName] = useState('');
    const [ak, setAk] = useState('');
    const [sk, setSk] = useState('');

    const resetForm = () => {
        setIsAdding(false);
        setEditingKeyId(null);
        setName('');
        setAk('');
        setSk('');
    };

    const handleStartAdd = () => {
        if (isAdding) {
            resetForm();
            return;
        }

        setEditingKeyId(null);
        setIsAdding(true);
        setName('');
        setAk('');
        setSk('');
    };

    const handleStartEdit = (key: AccessKey) => {
        setEditingKeyId(key.id);
        setIsAdding(true);
        setName(key.name);
        setAk(key.accessKeyId);
        setSk(key.accessKeySecret);
    };

    const toggleSecret = (id: string) => {
        setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCopy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`已复制 ${label}`);
        } catch (err) {
            toast.error('复制失败');
            console.error('Failed to copy', err);
        }
    };

    const handleAddKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const res = editingKeyId
            ? await updateAccessKeyAction(editingKeyId, name, ak, sk)
            : await addAccessKeyAction(name, ak, sk);

        if (res.success) {
            toast.success(editingKeyId ? 'AccessKey 修改成功' : 'AccessKey 添加成功');
            resetForm();
            router.refresh(); // Refresh server data
        } else {
            toast.error(res.error || (editingKeyId ? '修改失败' : '添加失败'));
        }
        setIsLoading(false);
    };

    const handleDeleteKey = async (id: string) => {
        if (!confirm('确定要删除这个密钥吗？')) return;
        const res = await deleteAccessKeyAction(id);
        if (res.success) {
            toast.success('AccessKey 删除成功');
            router.refresh();
        } else {
            toast.error(res.error || '删除失败');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Access Keys</h2>
                <Button onClick={handleStartAdd} variant="primary">
                    <Plus className="mr-2 h-4 w-4" /> {isAdding && !editingKeyId ? '收起表单' : '添加密钥'}
                </Button>
            </div>

            {isAdding && (
                <form onSubmit={handleAddKey} className="glass p-6 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-4">
                    <Input
                        placeholder="备注名称 (e.g. Test Key)"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        label="备注"
                    />
                    <Input
                        placeholder="LTAI..."
                        value={ak}
                        onChange={e => setAk(e.target.value)}
                        required
                        label="AccessKey ID"
                    />
                    <Input
                        placeholder="Secret..."
                        value={sk}
                        onChange={e => setSk(e.target.value)}
                        required
                        label="AccessKey Secret"
                        type="password"
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={resetForm}>取消</Button>
                        <Button type="submit" isLoading={isLoading}>{editingKeyId ? '保存修改' : '保存'}</Button>
                    </div>
                </form>
            )}

            <div className="grid gap-4">
                {initialKeys.length === 0 && !isAdding && (
                    <div className="text-center py-10 text-gray-500">
                        暂无密钥，请点击上方按钮添加。
                    </div>
                )}
                {initialKeys.map((key) => (
                    <div key={key.id} className="glass p-4 rounded-xl flex items-center justify-between group hover:bg-white/5 transition-colors">
                        <div className="space-y-1">
                            <div className="font-medium text-white flex items-center gap-2">
                                {key.name}
                                <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full font-mono flex items-center gap-1 group/key">
                                    {key.accessKeyId}
                                    <button onClick={() => handleCopy(key.accessKeyId, 'Key ID')} className="opacity-0 group-hover/key:opacity-100 hover:text-white transition-opacity">
                                        <Copy className="h-3 w-3" />
                                    </button>
                                </span>
                            </div>
                            <div className="text-sm text-gray-400 font-mono flex items-center gap-2">
                                {showSecrets[key.id] ? key.accessKeySecret : '•'.repeat(24)}
                                <button type="button" onClick={() => toggleSecret(key.id)} className="hover:text-white transition-colors" title={showSecrets[key.id] ? "隐藏" : "显示"}>
                                    {showSecrets[key.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                                {showSecrets[key.id] && (
                                    <button type="button" onClick={() => handleCopy(key.accessKeySecret, 'Key Secret')} className="hover:text-white transition-colors" title="复制 Secret">
                                        <Copy className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => handleStartEdit(key)}
                                className="transition-opacity"
                            >
                                <Pencil className="mr-2 h-4 w-4" />
                                修改
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => handleDeleteKey(key.id)}
                                className="transition-opacity"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
