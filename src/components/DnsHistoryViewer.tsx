'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock3, Loader2, RotateCw, X } from 'lucide-react';
import { getDnsHistoryAction } from '@/app/actions';
import { Button } from '@/components/ui/Button';
import type { DnsChangeOperation, LogEntry } from '@/lib/logger';

interface DnsHistoryViewerProps {
  domain: string;
  isOpen: boolean;
  onClose: () => void;
}

const operationLabels: Record<DnsChangeOperation, string> = {
  add: '新增记录',
  update: '修改记录',
  delete: '删除记录',
  status: '变更状态',
  'batch-add': '批量新增',
  'batch-delete': '批量删除',
  'batch-status': '批量变更状态',
  restore: '快照恢复',
};

function getHistorySummary(log: LogEntry): string {
  const context = log.context;
  if (!context) return log.details;
  if (context.operation === 'update' && context.before && context.after) {
    return `${context.before.rr} ${context.before.type} → ${context.after.rr} ${context.after.type}，${context.before.value} → ${context.after.value}，TTL ${context.before.ttl} → ${context.after.ttl}`;
  }
  const first = context.records[0];
  if (context.records.length === 1 && first) {
    const status = first.status ? `，${first.status === 'Enable' ? '启用' : '暂停'}` : '';
    return `${first.rr} ${first.type} → ${first.value}，TTL ${first.ttl}${status}`;
  }
  return `共 ${context.records.length} 条记录`;
}

export function DnsHistoryViewer({ domain, isOpen, onClose }: DnsHistoryViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    const result = await getDnsHistoryAction(domain);
    if (result.success) setLogs(result.data || []);
    setIsLoading(false);
  }, [domain]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => void fetchHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchHistory, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Center wrapper */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6 text-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-viewer-title"
          className="relative w-full max-w-4xl h-[85vh] max-h-[750px] min-h-[420px] flex flex-col rounded-xl border shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden text-left pointer-events-auto"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >

        {/* Header */}
        <div className="flex items-center justify-between p-4 shrink-0 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
          <div>
            <h3 id="history-viewer-title" className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
              <Clock3 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              DNS 变更历史
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{domain} · {logs.length} 条记录</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => void fetchHistory()} title="刷新">
              <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} title="关闭">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4">
          {isLoading && logs.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs" style={{ color: 'var(--muted)' }}>
              暂无结构化变更历史，升级前的旧操作日志仍可在“操作日志”中查看。
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => {
                const operation = log.context?.operation;
                return (
                  <article key={log.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                            {operation ? operationLabels[operation] : log.action}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: log.status === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                              color: log.status === 'success' ? 'var(--success)' : 'var(--danger)',
                            }}
                          >
                            {log.status === 'success' ? '成功' : '失败'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed break-all" style={{ color: 'var(--fg)' }}>
                          {getHistorySummary(log)}
                        </p>
                        {log.error && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{log.error}</p>}
                      </div>
                      <time className="shrink-0 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </time>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
