'use client';

import { startTransition, useRef, useState } from 'react';
import { Download, FileUp, HardDriveDownload, ShieldAlert } from 'lucide-react';
import { createDataBackupAction, restoreDataBackupAction } from '@/app/actions';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

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
  const confirm = useConfirm();

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
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('备份文件不能超过 5 MB'); return; }
    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as {
        format?: string; version?: number; createdAt?: string;
        data?: { accessKeys?: string | null; logs?: unknown[] };
      };
      if (parsed.format !== 'aliyun-dns-manager-backup' || parsed.version !== 1 || typeof parsed.createdAt !== 'string' || !parsed.data || !Array.isArray(parsed.data.logs)) {
        throw new Error('unsupported');
      }
      setPreview({ content, createdAt: parsed.createdAt, logCount: parsed.data.logs.length, hasAccessKeys: typeof parsed.data.accessKeys === 'string' });
    } catch { toast.error('无法识别此备份文件'); }
  };

  const handleRestore = async () => {
    if (!preview) return;
    const confirmed = await confirm({
      title: '恢复数据备份',
      description: '恢复会覆盖当前 AccessKey 和操作日志。请确认已经另外保存当前数据，并且当前 ENCRYPTION_KEY 与备份一致。',
      confirmText: '继续恢复',
      variant: 'danger',
    });
    if (!confirmed) return;
    setIsRestoring(true);
    const result = await restoreDataBackupAction(preview.content);
    if (result.success) {
      toast.success('数据恢复成功');
      setPreview(null);
      startTransition(() => window.location.reload());
    } else { toast.error(result.error || '恢复备份失败'); }
    setIsRestoring(false);
  };

  return (
    <section className="surface rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
              <HardDriveDownload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>数据备份与恢复</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                备份加密后的 AccessKey 数据和操作日志，不包含环境变量。
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg p-3 text-xs leading-relaxed"
            style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            恢复备份时必须使用创建备份时的同一个 ENCRYPTION_KEY，否则系统会拒绝恢复。
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col shrink-0">
          <Button variant="secondary" size="sm" onClick={handleExport} isLoading={isExporting}>
            <Download className="h-4 w-4" /> 导出备份
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="h-4 w-4" /> 选择备份文件
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {preview && (
        <div className="mt-5 rounded-xl border p-4" style={{ borderColor: 'var(--accent)', borderWidth: '1.5px', backgroundColor: 'var(--accent-light)' }}>
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            {[
              { label: '备份时间', value: new Date(preview.createdAt).toLocaleString() },
              { label: 'AccessKey 数据', value: preview.hasAccessKeys ? '包含' : '空' },
              { label: '操作日志', value: `${preview.logCount} 条` },
            ].map((f) => (
              <div key={f.label}>
                <div style={{ color: 'var(--muted)' }}>{f.label}</div>
                <div className="mt-0.5 font-medium" style={{ color: 'var(--fg)' }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)} disabled={isRestoring}>取消</Button>
            <Button variant="danger" size="sm" onClick={handleRestore} isLoading={isRestoring}>确认覆盖并恢复</Button>
          </div>
        </div>
      )}
    </section>
  );
}
