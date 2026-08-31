'use client';

import { useState, useEffect, useCallback, useDeferredValue } from 'react';
import type { LogEntry } from '@/lib/logger';
import { isHighRiskLog } from '@/lib/log-risk';
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
type RiskFilter = 'all' | 'high';

const ACTION_LABELS: Record<string, string> = {
  'Login': '管理员登录',
  'Add AccessKey': '添加密钥',
  'Update AccessKey': '修改密钥',
  'Delete AccessKey': '删除密钥',
  'Add DNS Record': '添加解析记录',
  'Update DNS Record': '修改解析记录',
  'Delete DNS Record': '删除解析记录',
  'Set DNS Status': '切换解析状态',
  'Batch Set Status': '批量修改状态',
  'Batch Delete DNS': '批量删除记录',
  'Batch Add DNS': '批量导入记录',
  'Create DNS Snapshot': '创建 DNS 快照',
  'Restore DNS Snapshot': '恢复 DNS 快照',
  'Export Data Backup': '导出数据备份',
  'Restore Data Backup': '恢复数据备份',
};

function formatLogTime(timestamp: string | number | Date): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function LogsViewer({ isOpen, onClose }: LogsViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
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
    if (riskFilter === 'high' && !isHighRiskLog(log)) return false;
    if (!deferredSearchTerm) return true;
    return [log.action, log.ip, log.details, log.error, ACTION_LABELS[log.action]]
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logs-viewer-title"
        className="relative z-10 w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden text-left pointer-events-auto"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
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
        <div className="p-3 flex flex-col sm:flex-row gap-2 shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--muted)' }} />
            <input
              type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索操作、IP、详情或错误"
              className="field-control field-control-search h-9 text-sm" style={{ border: '1px solid var(--border)', boxShadow: 'none', paddingLeft: '2.25rem', paddingRight: '2rem' }}
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
          <Select
            ariaLabel="筛选日志风险"
            className="sm:w-32"
            value={riskFilter}
            onValueChange={(v) => setRiskFilter(v as RiskFilter)}
            options={[
              { value: 'all', label: '全部风险' },
              { value: 'high', label: '仅高风险' },
            ]}
          />
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          {isLoading && logs.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : (
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 font-medium text-left sticky top-0 border-b z-10 whitespace-nowrap"
                    style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    时间
                  </th>
                  <th className="px-4 py-2.5 font-medium text-left sticky top-0 border-b z-10 whitespace-nowrap"
                    style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    操作
                  </th>
                  <th className="px-4 py-2.5 font-medium text-left sticky top-0 border-b z-10 whitespace-nowrap"
                    style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    IP 地址
                  </th>
                  <th className="px-4 py-2.5 font-medium text-left sticky top-0 border-b z-10"
                    style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    操作详情
                  </th>
                  <th className="px-4 py-2.5 font-medium text-right sticky top-0 border-b z-10 whitespace-nowrap"
                    style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
                      {logs.length === 0 ? '暂无日志记录' : '未找到符合条件的日志'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => {
                    const isLast = index === filteredLogs.length - 1;
                    const actionName = ACTION_LABELS[log.action] || log.action;
                    return (
                    <tr key={log.id} className="group transition-colors"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: 'var(--muted)', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                        {formatLogTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--fg)', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                        <div className="flex items-center gap-1.5">
                          <span title={log.action}>{actionName}</span>
                          {isHighRiskLog(log) && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>高风险</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: 'var(--muted)', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                        <span className="px-1.5 py-0.5 rounded text-[11px]" style={{ backgroundColor: 'var(--surface-hover)' }}>{log.ip}</span>
                      </td>
                      <td className="px-4 py-2.5 max-w-sm" style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                        <div className="truncate" title={log.details}>
                          <span style={{ color: 'var(--fg)' }}>{log.details}</span>
                          {log.error && <div className="mt-0.5 text-xs truncate" style={{ color: 'var(--danger)' }}>{log.error}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap" style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: log.status === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                            color: log.status === 'success' ? 'var(--success)' : 'var(--danger)',
                          }}>
                          {log.status === 'success' ? '成功' : '失败'}
                        </span>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
