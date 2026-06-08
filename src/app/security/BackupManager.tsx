'use client';

import { startTransition, useRef, useState } from 'react';
import { Download, FileUp, HardDriveDownload, ShieldAlert } from 'lucide-react';
import { createDataBackupAction, restoreDataBackupAction } from '@/app/actions';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface BackupPreview {
    content: string;
    createdAt: string;
    logCount: number;
    hasAccessKeys: boolean;
}

export function BackupManager() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [preview, setPreview] = useState<BackupPreview | null>(null);
    const toast = useToast();

    const handleExport = async () => {
        setIsExporting(true);
        const result = await createDataBackupAction();

        if (!result.success || !result.data) {
            toast.error(result.error || '创建备份失败');
            setIsExporting(false);
            return;
        }

        const blob = new Blob([result.data], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        link.href = url;
        link.download = `aliyun-dns-backup-${timestamp}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('备份文件已生成');
        setIsExporting(false);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('备份文件不能超过 5 MB');
            return;
        }

        try {
            const content = await file.text();
            const parsed = JSON.parse(content) as {
                format?: string;
                version?: number;
                createdAt?: string;
                data?: { accessKeys?: string | null; logs?: unknown[] };
            };

            if (
                parsed.format !== 'aliyun-dns-manager-backup' ||
                parsed.version !== 1 ||
                typeof parsed.createdAt !== 'string' ||
                !parsed.data ||
                !Array.isArray(parsed.data.logs)
            ) {
                throw new Error('unsupported');
            }

            setPreview({
                content,
                createdAt: parsed.createdAt,
                logCount: parsed.data.logs.length,
                hasAccessKeys: typeof parsed.data.accessKeys === 'string',
            });
        } catch {
            toast.error('无法识别此备份文件');
        }
    };

    const handleRestore = async () => {
        if (!preview) {
            return;
        }

        const confirmed = window.confirm(
            '恢复会覆盖当前 AccessKey 和操作日志。请确认已经另外保存当前数据，并且当前 ENCRYPTION_KEY 与备份一致。是否继续？'
        );

        if (!confirmed) {
            return;
        }

        setIsRestoring(true);
        const result = await restoreDataBackupAction(preview.content);

        if (result.success) {
            toast.success('数据恢复成功');
            setPreview(null);
            startTransition(() => window.location.reload());
        } else {
            toast.error(result.error || '恢复备份失败');
        }

        setIsRestoring(false);
    };

    return (
        <section className="glass rounded-3xl p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-300">
                            <HardDriveDownload className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">数据备份与恢复</h2>
                            <p className="mt-1 text-sm text-gray-400">
                                备份加密后的 AccessKey 数据和操作日志，不包含环境变量。
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-100/80">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        恢复备份时必须使用创建备份时的同一个 ENCRYPTION_KEY，否则系统会拒绝恢复。
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
                    <Button variant="secondary" onClick={handleExport} isLoading={isExporting}>
                        <Download className="mr-2 h-4 w-4" />
                        导出备份
                    </Button>
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                        <FileUp className="mr-2 h-4 w-4" />
                        选择备份文件
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>
            </div>

            {preview && (
                <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-500/5 p-5">
                    <div className="grid gap-4 text-sm sm:grid-cols-3">
                        <div>
                            <div className="text-gray-500">备份时间</div>
                            <div className="mt-1 text-gray-200">{new Date(preview.createdAt).toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">AccessKey 数据</div>
                            <div className="mt-1 text-gray-200">{preview.hasAccessKeys ? '包含' : '空'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500">操作日志</div>
                            <div className="mt-1 text-gray-200">{preview.logCount} 条</div>
                        </div>
                    </div>
                    <div className="mt-5 flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setPreview(null)} disabled={isRestoring}>
                            取消
                        </Button>
                        <Button variant="danger" onClick={handleRestore} isLoading={isRestoring}>
                            确认覆盖并恢复
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
