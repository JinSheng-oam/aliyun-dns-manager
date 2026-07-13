'use client';

import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { Archive, CheckCircle2, Loader2, RefreshCw, RotateCcw, ShieldCheck, X } from 'lucide-react';
import {
  createDnsSnapshotAction,
  listDnsSnapshotsAction,
  previewDnsSnapshotRestoreAction,
  restoreDnsSnapshotAction,
} from '@/app/actions';
import type { DnsRestorePlan, DomainSnapshot } from '@/lib/dns-snapshots';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

type RestorePreview = { snapshot: DomainSnapshot; plan: DnsRestorePlan };

export function DnsSnapshotsPanel({
  keyId,
  domain,
  onClose,
  onRestored,
  readOnly = false,
}: {
  keyId: string;
  domain: string;
  onClose: () => void;
  onRestored: () => Promise<void>;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [snapshots, setSnapshots] = useState<DomainSnapshot[]>([]);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    const result = await listDnsSnapshotsAction(keyId, domain);
    if (result.success) setSnapshots(result.data || []);
    else toast.error(result.error || '读取快照失败');
    setLoading(false);
  }, [domain, keyId, toast]);
  const loadSnapshotsEvent = useEffectEvent(loadSnapshots);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSnapshotsEvent(); }, 0);
    return () => window.clearTimeout(timer);
  }, [domain, keyId]);

  const handleCreate = async () => {
    setCreating(true);
    const result = await createDnsSnapshotAction(keyId, domain, '手动快照');
    if (result.success && result.data) {
      toast.success(`已保存 ${result.data.records.length} 条记录的快照`);
      await loadSnapshots();
    } else {
      toast.error(result.error || '创建快照失败');
    }
    setCreating(false);
  };

  const handlePreview = async (snapshotId: string) => {
    const result = await previewDnsSnapshotRestoreAction(keyId, domain, snapshotId);
    if (result.success && result.data) setPreview(result.data);
    else toast.error(result.error || '生成恢复预览失败');
  };

  const handleRestore = async () => {
    if (!preview) return;
    const { plan, snapshot } = preview;
    const changed = plan.add.length + plan.update.length + plan.delete.length;
    if (changed === 0) {
      toast.success('当前记录已经与该快照一致');
      return;
    }
    const confirmed = await confirm({
      title: '恢复 DNS 快照',
      description: `将恢复 ${domain} 到 ${new Date(snapshot.createdAt).toLocaleString()} 的状态。\n新增 ${plan.add.length} 条，更新 ${plan.update.length} 条，删除 ${plan.delete.length} 条。\n系统会先保存当前状态，失败时自动回滚。`,
      confirmText: '确认恢复',
      variant: 'danger',
    });
    if (!confirmed) return;
    setRestoring(true);
    const result = await restoreDnsSnapshotAction(keyId, domain, snapshot.id);
    if (result.success && result.summary) {
      toast.success(`快照恢复完成：新增 ${result.summary.add}，更新 ${result.summary.update}，删除 ${result.summary.delete}`);
      setPreview(null);
      await Promise.all([loadSnapshots(), onRestored()]);
    } else {
      toast.error(result.error || '恢复快照失败');
    }
    setRestoring(false);
  };

  return (
    <section className="surface rounded-xl overflow-hidden" aria-label="DNS 快照与恢复">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>快照与安全恢复</h4>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>写操作前自动保存，最多保留当前域名最近 20 个快照</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleCreate} isLoading={creating}>
            <Archive className="h-4 w-4" /> 创建快照
          </Button>
          <Button size="icon" variant="ghost" onClick={() => void loadSnapshots()} title="刷新快照">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} title="关闭快照面板">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>恢复预览：{preview.snapshot.label}</div>
              <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{new Date(preview.snapshot.createdAt).toLocaleString()}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>返回列表</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['新增', preview.plan.add.length, 'var(--success)'],
              ['更新', preview.plan.update.length, 'var(--warning)'],
              ['删除', preview.plan.delete.length, 'var(--danger)'],
              ['不变', preview.plan.unchanged, 'var(--muted)'],
            ].map(([label, count, color]) => (
              <div key={String(label)} className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-hover)' }}>
                <div className="text-xl font-bold" style={{ color: String(color) }}>{String(count)}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{String(label)}</div>
              </div>
            ))}
          </div>
          <div className="max-h-56 overflow-auto rounded-lg" style={{ backgroundColor: 'var(--surface-hover)' }}>
            {preview.plan.add.map(record => <PlanRow key={`add-${record.rr}-${record.type}-${record.value}`} action="新增" record={record} color="var(--success)" />)}
            {preview.plan.update.map(({ current, target }) => (
              <PlanRow key={`update-${current.recordId}`} action="更新" record={target} detail={`TTL ${current.ttl} → ${target.ttl}，状态 ${current.status} → ${target.status}`} color="var(--warning)" />
            ))}
            {preview.plan.delete.map(record => <PlanRow key={`delete-${record.recordId}`} action="删除" record={record} color="var(--danger)" />)}
            {preview.plan.add.length + preview.plan.update.length + preview.plan.delete.length === 0 && (
              <div className="flex items-center gap-2 p-4 text-sm" style={{ color: 'var(--success)' }}>
                <CheckCircle2 className="h-4 w-4" /> 当前状态与快照一致
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg p-3" style={{ backgroundColor: 'var(--danger-light)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
              <ShieldCheck className="h-4 w-4 shrink-0" /> 恢复前会自动创建安全快照；执行失败将自动回滚
            </div>
            <Button size="sm" variant="danger" onClick={handleRestore} isLoading={restoring} disabled={readOnly}>
              <RotateCcw className="h-4 w-4" /> 执行恢复
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--muted)' }}>
          <Loader2 className="h-4 w-4 animate-spin" /> 正在读取快照
        </div>
      ) : snapshots.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>暂无快照，修改 DNS 前系统也会自动创建</div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {snapshots.map(snapshot => (
            <div key={snapshot.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium" style={{ color: 'var(--fg)' }}>{snapshot.label}</div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{new Date(snapshot.createdAt).toLocaleString()} · {snapshot.records.length} 条记录</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void handlePreview(snapshot.id)}>预览恢复</Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PlanRow({
  action,
  record,
  detail,
  color,
}: {
  action: string;
  record: { rr: string; type: string; value: string; ttl: number; status: string };
  detail?: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="w-8 shrink-0 font-semibold" style={{ color }}>{action}</span>
      <div className="min-w-0">
        <div className="font-mono break-all" style={{ color: 'var(--fg)' }}>{record.rr} {record.type} {record.value}</div>
        <div className="mt-0.5" style={{ color: 'var(--muted)' }}>{detail || `TTL ${record.ttl} · ${record.status}`}</div>
      </div>
    </div>
  );
}
