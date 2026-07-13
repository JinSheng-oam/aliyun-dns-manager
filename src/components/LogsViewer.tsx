'use client';

import { useState, useEffect, useCallback, useDeferredValue } from 'react';
import type { LogEntry } from '@/lib/logger';
import { getLogsAction } from '@/app/actions';
import { X, Loader2, RotateCw, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { createLogsCsv } from '@/lib/log-export';

interface LogsViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

type StatusFilter = 'all' | LogEntry['status'];

export function LogsViewer({ isOpen, onClose }: LogsViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const deferredSearchTerm = useDeferredValue(searchTerm.trim().toLowerCase());

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    const res = await getLogsAction();
    if (res.success && res.data) setLogs(res.data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => { void fetchLogs(); }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (statusFilter !== 'all' && log.status !== statusFilter) return false;
    if (!deferredSearchTerm) return true;
    return [log.action, log.ip, log.details, log.error]
      .some((value) => value?.toLowerCase().includes(deferredSearchTerm));
  });

  const exportLogs = () => {
    const blob = new Blob([createLogsCsv(filteredLogs)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aliyun-dns-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — pure overlay, no overflow */}
      <div
        className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal — centered, scrolled internally */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logs-viewer-title"
          className="pointer-events-auto w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >

        {/* Header */}
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 id="logs-viewer-title" className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--fg)' }}>
            操作日志
            <span className="text-xs font-normal rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--muted)' }}>
              {filteredLogs.length} / {logs.length} 条记录
            </span>
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={exportLogs} disabled={filteredLogs.length === 0}>
              <Download className="h-4 w-4" /> 导出 CSV
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void fetchLogs()} title="刷新">
              <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} title="关闭">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 flex flex-col sm:flex-row gap-2 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--muted)' }} />
            <input
              type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索操作、IP、详情或错误"
              className="field-control h-9 text-sm" style={{ border: '1px solid var(--border)', boxShadow: 'none', paddingLeft: '2.25rem' }}
            />
          </div>
          <Select
            ariaLabel="筛选日志状态"
            className="sm:w-32"
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'success', label: '仅成功' },
              { value: 'failure', label: '仅失败' },
            ]}
          />
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          {isLoading && logs.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead style={{ borderBottom: '1px solid var(--border)' }}>
                <tr>
                  {['时间', '操作', 'IP', '详情', '状态'].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium text-left sticky top-0"
                      style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--surface)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center" style={{ color: 'var(--muted)' }}>
                      {logs.length === 0 ? '暂无日志记录' : '未找到符合条件的日志'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="group transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--fg)' }}>{log.action}</td>
                      <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--muted)' }}>{log.ip}</td>
                      <td className="px-4 py-2.5 max-w-xs truncate" title={log.details}>
                        <span style={{ color: 'var(--fg)' }}>{log.details}</span>
                        {log.error && <div className="mt-0.5" style={{ color: 'var(--danger)' }}>{log.error}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: log.status === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                            color: log.status === 'success' ? 'var(--success)' : 'var(--danger)',
                          }}>
                          {log.status === 'success' ? '成功' : '失败'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
