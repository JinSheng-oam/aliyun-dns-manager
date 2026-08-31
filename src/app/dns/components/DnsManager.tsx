'use client';

import { useState, useEffect, useCallback, useRef, useEffectEvent } from 'react';
import { AccessKey, DnsRecord, Domain } from '@/lib/types';
import {
  listDomainsAction,
  listDnsRecordsAction,
  addDnsRecordAction,
  updateDnsRecordAction,
  deleteDnsRecordAction,
  setDnsRecordStatusAction,
  batchDeleteDnsRecordsAction,
  batchSetDnsRecordsStatusAction,
  batchAddDnsRecordsAction,
  checkDomainHealthOverviewAction,
} from '@/app/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  Plus, Trash2, ArrowUpDown, ChevronUp, ChevronDown,
  Filter, Globe, ArrowLeft, Loader2, Edit2,
  PlayCircle, PauseCircle, X, Copy, History,
  Download, UploadCloud, AlertTriangle, CheckCircle2,
  FileSpreadsheet, Archive, Search, Stethoscope, RotateCcw,
  LayoutGrid, List, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowRight
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { LogsViewer } from '@/components/LogsViewer';
import { DnsHistoryViewer } from '@/components/DnsHistoryViewer';
import { createDnsImportPreview, createDomainBackup, type DnsImportPreview } from '@/lib/dns-import';
import type { DnsChangeRecord } from '@/lib/logger';
import { filterDnsRecords, filterDomains, type DnsStatusFilter } from '@/lib/dns-filter';
import { DnsSnapshotsPanel } from '@/components/DnsSnapshotsPanel';
import { DnsHealthPanel } from '@/components/DnsHealthPanel';
import type { DnsHealthStatus } from '@/lib/dns-health';
import { copyTextToClipboard } from '@/lib/clipboard';

function getPaginationRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', total];
  }
  if (current >= total - 3) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

interface DnsManagerProps {
  initialKeys: AccessKey[];
  readOnly?: boolean;
}

type SortKey = 'RR' | 'Type' | 'Value' | 'TTL' | 'Status';

interface BatchActionResponse {
  success: boolean;
  error?: string;
  summary?: { total: number; succeeded: number; failed: number };
  failures?: { label: string; error: string }[];
}

interface BatchFeedback {
  title: string;
  total: number;
  succeeded: number;
  failed: number;
  failures: { label: string; error: string }[];
}

const isRecordEnabled = (status: string | undefined) => {
  if (!status) return true;
  return status.toUpperCase() === 'ENABLE';
};

/* ---- Badge color helper ---- */
const typeBadgeStyle = (t: string): React.CSSProperties => {
  switch (t) {
    case 'A': return { backgroundColor: 'oklch(96% 0.04 145)', color: 'oklch(42% 0.12 145)' };
    case 'CNAME': return { backgroundColor: 'oklch(96% 0.03 280)', color: 'oklch(45% 0.12 280)' };
    case 'TXT': return { backgroundColor: 'oklch(96% 0.02 200)', color: 'oklch(42% 0.08 200)' };
    case 'MX': return { backgroundColor: 'oklch(96% 0.03 80)', color: 'oklch(45% 0.1 80)' };
    case 'AAAA': return { backgroundColor: 'oklch(96% 0.03 255)', color: 'oklch(42% 0.12 255)' };
    default: return { backgroundColor: 'var(--surface-hover)', color: 'var(--muted)' };
  }
};

const healthBadgeStyle = (status: DnsHealthStatus): React.CSSProperties => {
  if (status === 'error') return { backgroundColor: 'var(--danger-light)', color: 'var(--danger)' };
  if (status === 'warning') return { backgroundColor: 'var(--warning-light)', color: 'var(--warning)' };
  return { backgroundColor: 'var(--success-light)', color: 'var(--success)' };
};

/* ---- Resolved accent from table header ---- */
const thStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--muted)',
  userSelect: 'none',
};

export function DnsManager({ initialKeys, readOnly = false }: DnsManagerProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- State ---
  const [selectedKeyId, setSelectedKeyId] = useState<string>(initialKeys[0]?.id || '');

  // Domains
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [domainSearchTerm, setDomainSearchTerm] = useState('');
  const [domainViewMode, setDomainViewMode] = useState<'grid' | 'table'>('grid');

  // Records
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [activeBatchAction, setActiveBatchAction] = useState<'delete' | 'enable' | 'disable' | null>(null);
  const [batchFeedback, setBatchFeedback] = useState<BatchFeedback | null>(null);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filter & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<DnsStatusFilter>('All');
  const [minTtlFilter, setMinTtlFilter] = useState('');
  const [maxTtlFilter, setMaxTtlFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  // Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DnsRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importPreview, setImportPreview] = useState<DnsImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [rr, setRr] = useState('');
  const [type, setType] = useState('A');
  const [value, setValue] = useState('');
  const [ttl, setTtl] = useState(600);

  // Modals
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSnapshotsOpen, setIsSnapshotsOpen] = useState(false);
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [checkingDomainOverview, setCheckingDomainOverview] = useState(false);
  const [domainHealth, setDomainHealth] = useState<Record<string, DnsHealthStatus>>({});

  const toChangeRecord = (record: DnsRecord): DnsChangeRecord => ({
    recordId: record.RecordId,
    rr: record.RR,
    type: record.Type,
    value: record.Value,
    ttl: record.TTL,
    status: isRecordEnabled(record.Status) ? 'Enable' : 'Disable',
  });

  const refreshRecords = useCallback(async () => {
    if (!selectedKeyId || !selectedDomain) return;
    setLoadingRecords(true);
    const res = await listDnsRecordsAction(selectedKeyId, selectedDomain.domainName);
    if (res.success) {
      setRecords(res.data || []);
    } else {
      toast.error(res.error || '获取解析记录失败');
      setRecords([]);
    }
    setLoadingRecords(false);
    setSelectedRecordIds(new Set());
  }, [selectedDomain, selectedKeyId, toast]);

  const fetchDomains = useCallback(async () => {
    if (!selectedKeyId) return;
    setLoadingDomains(true);
    setSelectedDomain(null);
    setRecords([]);
    setImportPreview(null);
    setImportFileName('');
    setIsHistoryOpen(false);
    setIsSnapshotsOpen(false);
    setIsHealthOpen(false);
    setBatchFeedback(null);

    const res = await listDomainsAction(selectedKeyId);
    if (res.success) {
      setDomains(res.data || []);
    } else {
      toast.error(res.error || '获取域名列表失败');
      setDomains([]);
    }
    setLoadingDomains(false);
  }, [selectedKeyId, toast]);
  const fetchDomainsEvent = useEffectEvent(fetchDomains);

  // --- Effects ---
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('domain_view_mode');
      if (savedMode === 'grid' || savedMode === 'table') {
        setDomainViewMode(savedMode);
      }
    } catch {}
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter, minTtlFilter, maxTtlFilter, sortConfig, selectedDomain, pageSize]);

  useEffect(() => {
    if (!selectedKeyId) return;
    const timer = window.setTimeout(() => { void fetchDomainsEvent(); }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedKeyId]);

  useEffect(() => {
    if (!selectedKeyId || !selectedDomain) return;
    const timer = window.setTimeout(() => { void refreshRecords(); }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedKeyId, selectedDomain, refreshRecords]);

  // --- Handlers ---
  const handleViewModeChange = (mode: 'grid' | 'table') => {
    setDomainViewMode(mode);
    try {
      localStorage.setItem('domain_view_mode', mode);
    } catch {}
  };

  const handleBackToDomains = () => {
    setSelectedDomain(null);
    setRecords([]);
    setSearchTerm('');
    setTypeFilter('All');
    setStatusFilter('All');
    setMinTtlFilter('');
    setMaxTtlFilter('');
    setImportPreview(null);
    setImportFileName('');
    setIsHistoryOpen(false);
    setBatchFeedback(null);
    setCurrentPage(1);
    resetForm();
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingRecord(null);
    setRr('');
    setType('A');
    setValue('');
    setTtl(600);
  };

  const handleInitAdd = () => { resetForm(); setIsFormOpen(true); };

  const handleInitEdit = (record: DnsRecord) => {
    setEditingRecord(record);
    setRr(record.RR);
    setType(record.Type);
    setValue(record.Value);
    setTtl(record.TTL);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomain) return;
    const description = editingRecord
      ? `将修改 ${editingRecord.RR}.${selectedDomain.domainName}：\n修改前：${editingRecord.Type} ${editingRecord.Value}，TTL ${editingRecord.TTL}\n修改后：${type} ${value}，TTL ${ttl}`
      : `将在 ${selectedDomain.domainName} 新增记录：\n${rr} ${type} ${value}，TTL ${ttl}\n确认后系统会先自动保存当前快照。`;
    const confirmed = await confirm({
      title: editingRecord ? '预览 DNS 记录修改' : '预览新增 DNS 记录',
      description,
      confirmText: editingRecord ? '确认修改' : '确认新增',
    });
    if (!confirmed) return;
    setIsSubmitting(true);
    let res;
    if (editingRecord) {
      res = await updateDnsRecordAction(selectedKeyId, selectedDomain.domainName, toChangeRecord(editingRecord), rr, type, value, ttl);
    } else {
      res = await addDnsRecordAction(selectedKeyId, selectedDomain.domainName, rr, type, value, ttl);
    }
    if (res.success) {
      toast.success(editingRecord ? '更新解析记录成功' : '添加解析记录成功');
      resetForm();
      await refreshRecords();
    } else {
      toast.error(res.error || '操作失败');
    }
    setIsSubmitting(false);
  };

  const handleDeleteRecord = async (record: DnsRecord) => {
    const confirmed = await confirm({
      title: '删除解析记录',
      description: `将删除 ${record.RR}.${selectedDomain?.domainName || ''}：\n类型：${record.Type}\n记录值：${record.Value}\nTTL：${record.TTL}\n系统会先自动保存当前快照。`,
      confirmText: '删除记录',
      variant: 'danger',
    });
    if (!confirmed || !selectedDomain) return;
    const res = await deleteDnsRecordAction(selectedKeyId, selectedDomain.domainName, toChangeRecord(record));
    if (res.success) {
      toast.success('删除解析记录成功');
      setTimeout(async () => { await refreshRecords(); }, 1000);
    } else {
      toast.error(res.error || '删除失败');
    }
  };

  const handleToggleStatus = async (record: DnsRecord) => {
    const currentlyEnabled = isRecordEnabled(record.Status);
    const newStatus = currentlyEnabled ? 'Disable' : 'Enable';
    const actionText = currentlyEnabled ? '暂停' : '启用';
    if (!selectedDomain) return;
    const confirmed = await confirm({
      title: `${actionText}解析记录`,
      description: `将${actionText} ${record.RR}.${selectedDomain.domainName} 的 ${record.Type} 记录：\n${record.Value}\n系统会先自动保存当前快照。`,
      confirmText: `确认${actionText}`,
      variant: currentlyEnabled ? 'danger' : 'default',
    });
    if (!confirmed) return;
    const res = await setDnsRecordStatusAction(selectedKeyId, selectedDomain.domainName, toChangeRecord(record), newStatus);
    if (res.success) {
      setRecords(prev => prev.map(r =>
        r.RecordId === record.RecordId ? { ...r, Status: newStatus } : r
      ));
      toast.success(`${actionText}成功`);
    } else {
      toast.error(`${actionText}失败: ${res.error}`);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await copyTextToClipboard(text);
      toast.success(`已复制 ${label}`);
    } catch { toast.error('复制失败'); }
  };

  const handleToggleSelect = (recordId: string) => {
    const newSelected = new Set(selectedRecordIds);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecordIds(newSelected);
  };

  const updateBatchFeedback = (title: string, response: BatchActionResponse) => {
    if (!response.summary) return;
    setBatchFeedback({
      title,
      ...response.summary,
      failures: response.failures || [],
    });
  };

  const handleSelectAll = () => {
    if (selectedRecordIds.size === filteredAndSortedRecords.length && filteredAndSortedRecords.length > 0) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(filteredAndSortedRecords.map(r => r.RecordId)));
    }
  };

  const handleBatchDelete = async () => {
    const confirmed = await confirm({
      title: '批量删除解析记录',
      description: `将在 ${selectedDomain?.domainName || '当前域名'} 中删除选中的 ${selectedRecordIds.size} 条解析记录。此操作不可撤销，请再次确认操作范围。`,
      confirmText: '批量删除',
      variant: 'danger',
    });
    if (!confirmed || !selectedDomain) return;
    setActiveBatchAction('delete');
    const sel = records.filter(r => selectedRecordIds.has(r.RecordId)).map(toChangeRecord);
    try {
      const res = await batchDeleteDnsRecordsAction(selectedKeyId, selectedDomain.domainName, sel);
      updateBatchFeedback('批量删除结果', res);
      if (res.success) {
        toast.success(`批量删除成功，共 ${res.summary?.succeeded ?? sel.length} 条`);
      } else {
        toast.error(res.error || '批量删除失败');
      }
      await refreshRecords();
    } finally {
      setActiveBatchAction(null);
    }
  };

  const handleBatchStatus = async (status: 'Enable' | 'Disable') => {
    const actionText = status === 'Enable' ? '启用' : '暂停';
    if (!selectedDomain) return;
    const confirmed = await confirm({
      title: `批量${actionText}解析记录`,
      description: `将在 ${selectedDomain.domainName} 中${actionText}选中的 ${selectedRecordIds.size} 条记录。系统会先自动保存当前快照。`,
      confirmText: `批量${actionText}`,
      variant: status === 'Disable' ? 'danger' : 'default',
    });
    if (!confirmed) return;
    setActiveBatchAction(status === 'Enable' ? 'enable' : 'disable');
    const sel = records.filter(r => selectedRecordIds.has(r.RecordId)).map(toChangeRecord);
    try {
      const res = await batchSetDnsRecordsStatusAction(selectedKeyId, selectedDomain.domainName, sel, status);
      updateBatchFeedback(`批量${actionText}结果`, res);
      if (res.success) {
        toast.success(`批量${actionText}成功，共 ${res.summary?.succeeded ?? sel.length} 条`);
      } else {
        toast.error(res.error || `批量${actionText}失败`);
      }
      await refreshRecords();
    } finally {
      setActiveBatchAction(null);
    }
  };

  // --- Import / Export ---
  const handleExport = () => {
    if (!records.length) { toast.error('暂无记录可导出'); return; }
    const headers = ['主机记录,记录类型,记录值,TTL,状态'];
    const csvContent = records.map(r =>
      `${r.RR},${r.Type},${r.Value},${r.TTL},${isRecordEnabled(r.Status) ? 'Enable' : 'Disable'}`
    ).join('\n');
    const blob = new Blob(['﻿' + headers + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dns_records_${selectedDomain?.domainName || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDomainBackup = () => {
    if (!selectedDomain || !records.length) { toast.error('暂无记录可备份'); return; }
    const backup = createDomainBackup(selectedDomain.domainName, records);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dns_backup_${selectedDomain.domainName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => { fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDomain) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const preview = createDnsImportPreview(text, records, selectedDomain.domainName);
        if (preview.rows.length === 0) { toast.error('未识别到有效记录'); return; }
        setImportPreview(preview);
        setImportFileName(file.name);
      } catch { toast.error('文件解析失败'); }
      finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!selectedDomain || !importPreview) return;
    const newRecords = importPreview.rows.filter(row => row.status === 'add' && row.record).map(row => row.record!);
    if (newRecords.length === 0) { toast.error('没有可新增的记录'); return; }
    setIsSubmitting(true);
    const res = await batchAddDnsRecordsAction(selectedKeyId, selectedDomain.domainName, newRecords);
    updateBatchFeedback('批量导入结果', res);
    if (res.success) {
      toast.success(`成功导入 ${res.summary?.succeeded ?? newRecords.length} 条记录`);
    } else { toast.error(res.error || '导入失败'); }
    setImportPreview(null); setImportFileName('');
    await refreshRecords();
    setIsSubmitting(false);
  };

  const handleCheckDomainOverview = async () => {
    if (!selectedKeyId || domains.length === 0) return;
    setCheckingDomainOverview(true);
    const result = await checkDomainHealthOverviewAction(selectedKeyId, domains.map(domain => domain.domainName));
    if (result.success) {
      setDomainHealth(Object.fromEntries((result.data || []).map(item => [item.domain, item.status])));
      const failed = (result.data || []).filter(item => !item.success).length;
      if (failed > 0) toast.error(`${failed} 个域名检查失败，其余结果已显示`);
      else toast.success(`已检查 ${result.data?.length || 0} 个域名`);
    } else {
      toast.error(result.error || '域名健康概览检查失败');
    }
    setCheckingDomainOverview(false);
  };

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // --- Derived ---
  const filteredDomains = filterDomains(domains, domainSearchTerm);

  const filteredAndSortedRecords = filterDnsRecords(records, {
    searchTerm, type: typeFilter, status: statusFilter,
    minTtl: minTtlFilter, maxTtl: maxTtlFilter,
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    let aVal: string | number | undefined = a[key];
    let bVal: string | number | undefined = b[key];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (key === 'TTL') { aVal = Number(a.TTL); bVal = Number(b.TTL); }
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalFilteredRecords = filteredAndSortedRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredRecords / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredRecords);
  const paginatedRecords = filteredAndSortedRecords.slice(startIndex, endIndex);

  const hasActiveFilters = searchTerm || typeFilter !== 'All' || statusFilter !== 'All' || minTtlFilter || maxTtlFilter;

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <div className="space-y-5">
      {readOnly && (
        <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--warning)', backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="text-sm font-semibold">当前为只读模式</div>
            <div className="mt-1 text-xs">可以查看、导出、创建快照和运行健康检查，但不能修改 DNS、导入或执行恢复。</div>
          </div>
        </div>
      )}
      {/* ---- Top bar: AccessKey selector ---- */}
      <div className="surface flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>DNS 管理面板</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>管理您的域名解析记录</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="ghost" size="sm" onClick={() => setIsLogsOpen(true)}>
            <History className="h-4 w-4" /> 操作日志
          </Button>
          <Select
            ariaLabel="选择 AccessKey"
            className="w-full sm:w-64"
            value={selectedKeyId}
            onValueChange={setSelectedKeyId}
            options={initialKeys.length === 0
              ? [{ value: '', label: '无可用 AccessKey', disabled: true }]
              : initialKeys.map((key) => ({ value: key.id, label: `${key.name} (${key.accessKeyId})` }))}
          />
        </div>
      </div>

      {/* ---- Content ---- */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {!selectedDomain ? (
          /* ======== Domain List ======== */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>域名列表</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {domainSearchTerm
                    ? `找到 ${filteredDomains.length} 个匹配域名（共 ${domains.length} 个）`
                    : `共 ${domains.length} 个域名`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--muted)' }} />
                  <input
                    type="text"
                    placeholder="搜索域名（如 example.com）..."
                    value={domainSearchTerm}
                    onChange={(e) => setDomainSearchTerm(e.target.value)}
                    className="field-control field-control-search h-8 text-xs w-full"
                    style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border)', boxShadow: 'none', paddingLeft: '2.25rem', paddingRight: '2rem' }}
                  />
                  {domainSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setDomainSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                      style={{ color: 'var(--muted)' }}
                      title="清空搜索"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center rounded-lg border p-0.5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('grid')}
                    className="p-1.5 rounded-md transition-all flex items-center gap-1 text-xs"
                    style={{
                      backgroundColor: domainViewMode === 'grid' ? 'var(--accent-light)' : 'transparent',
                      color: domainViewMode === 'grid' ? 'var(--accent)' : 'var(--muted)',
                      fontWeight: domainViewMode === 'grid' ? 600 : 400,
                    }}
                    title="卡片网格视图"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('table')}
                    className="p-1.5 rounded-md transition-all flex items-center gap-1 text-xs"
                    style={{
                      backgroundColor: domainViewMode === 'table' ? 'var(--accent-light)' : 'transparent',
                      color: domainViewMode === 'table' ? 'var(--accent)' : 'var(--muted)',
                      fontWeight: domainViewMode === 'table' ? 600 : 400,
                    }}
                    title="列表表格视图"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                {loadingDomains && <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent)' }} />}
                {domains.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={handleCheckDomainOverview} isLoading={checkingDomainOverview}>
                    <Stethoscope className="h-4 w-4" /> 检查全部域名
                  </Button>
                )}
              </div>
            </div>

            {loadingDomains ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="surface h-28 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--surface-hover)' }} />
                ))}
              </div>
            ) : domains.length === 0 ? (
              <div className="surface rounded-xl text-center py-16" style={{ color: 'var(--muted)' }}>
                <Globe className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">该 AccessKey 下暂无域名</p>
              </div>
            ) : filteredDomains.length === 0 ? (
              <div className="surface rounded-xl text-center py-12 space-y-3" style={{ color: 'var(--muted)' }}>
                <Search className="h-8 w-8 mx-auto opacity-40" />
                <p className="text-sm">未找到与 &quot;{domainSearchTerm}&quot; 匹配的域名</p>
                <Button size="sm" variant="secondary" onClick={() => setDomainSearchTerm('')}>
                  清空搜索
                </Button>
              </div>
            ) : domainViewMode === 'grid' ? (
              /* Grid View */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredDomains.map(domain => (
                  <button
                    key={domain.domainId}
                    onClick={() => setSelectedDomain(domain)}
                    className="surface surface-hover p-4 rounded-xl text-left flex flex-col justify-between h-28 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-[15px]" style={{ color: 'var(--fg)' }}>
                        {domain.domainName}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                        <span>{domain.versionName}</span>
                        {domainHealth[domain.domainName.toLowerCase()] && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold cursor-help"
                            style={healthBadgeStyle(domainHealth[domain.domainName.toLowerCase()])}
                            title={`健康状态：${{ healthy: '健康', warning: '需关注', error: '异常' }[domainHealth[domain.domainName.toLowerCase()]]}（点击进入域名后可在右上角使用“健康检查”查看诊断明细）`}
                          >
                            {{ healthy: '健康', warning: '需关注', error: '异常' }[domainHealth[domain.domainName.toLowerCase()]]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {new Date(domain.createTime).toLocaleDateString()}
                      </span>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--muted)' }}
                      >
                        {domain.recordCount} 条记录
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Table View */
              <div className="surface rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left border-b" style={{ ...thStyle, borderColor: 'var(--border)' }}>域名</th>
                        <th className="px-4 py-3 text-left border-b" style={{ ...thStyle, borderColor: 'var(--border)' }}>版本</th>
                        <th className="px-4 py-3 text-left border-b" style={{ ...thStyle, borderColor: 'var(--border)' }}>解析记录数</th>
                        <th className="px-4 py-3 text-left border-b" style={{ ...thStyle, borderColor: 'var(--border)' }}>创建时间</th>
                        <th className="px-4 py-3 text-right border-b" style={{ ...thStyle, borderColor: 'var(--border)' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDomains.map((domain, index) => {
                        const isLast = index === filteredDomains.length - 1;
                        return (
                          <tr
                            key={domain.domainId}
                            onClick={() => setSelectedDomain(domain)}
                            className="group cursor-pointer transition-colors outline-none focus:outline-none"
                            style={{
                              borderBottom: isLast ? 'none' : '1px solid var(--border)',
                              backgroundColor: 'transparent',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <td
                              className="px-4 py-3 font-semibold"
                              style={{
                                color: 'var(--fg)',
                                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                                <span>{domain.domainName}</span>
                                {domainHealth[domain.domainName.toLowerCase()] && (
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold cursor-help"
                                    style={healthBadgeStyle(domainHealth[domain.domainName.toLowerCase()])}
                                    title={`健康状态：${{ healthy: '健康', warning: '需关注', error: '异常' }[domainHealth[domain.domainName.toLowerCase()]]}（点击进入域名后可在右上角使用“健康检查”查看诊断明细）`}
                                  >
                                    {{ healthy: '健康', warning: '需关注', error: '异常' }[domainHealth[domain.domainName.toLowerCase()]]}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              className="px-4 py-3 text-xs"
                              style={{
                                color: 'var(--muted)',
                                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                              }}
                            >
                              {domain.versionName}
                            </td>
                            <td
                              className="px-4 py-3 text-xs"
                              style={{
                                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                              }}
                            >
                              <span
                                className="font-medium px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--fg)' }}
                              >
                                {domain.recordCount} 条记录
                              </span>
                            </td>
                            <td
                              className="px-4 py-3 text-xs font-mono"
                              style={{
                                color: 'var(--muted)',
                                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                              }}
                            >
                              {new Date(domain.createTime).toLocaleDateString()}
                            </td>
                            <td
                              className="px-4 py-3 text-right"
                              style={{
                                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                              }}
                            >
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDomain(domain);
                                }}
                              >
                                管理解析 <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ======== Records View ======== */
          <div className="space-y-4">
            {/* Domain breadcrumb header */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleBackToDomains}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>
                    {selectedDomain.domainName}
                  </h3>
                  {loadingRecords && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--accent)' }} />}
                </div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  DNS 管理 · {selectedDomain.domainName}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt,.json" onChange={handleFileChange} />
                <Button variant="ghost" size="icon" onClick={handleExport} title="导出 CSV"><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={handleDomainBackup} title="域名备份"><Archive className="h-4 w-4" /></Button>
                <Button variant={isSnapshotsOpen ? 'secondary' : 'ghost'} size="icon" onClick={() => { setIsSnapshotsOpen(value => !value); setIsHealthOpen(false); }} title="快照与恢复"><RotateCcw className="h-4 w-4" /></Button>
                <Button variant={isHealthOpen ? 'secondary' : 'ghost'} size="icon" onClick={() => { setIsHealthOpen(value => !value); setIsSnapshotsOpen(false); }} title="健康检查"><Stethoscope className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={handleImportClick} title="导入" disabled={readOnly}><UploadCloud className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setIsHistoryOpen(true)} title="变更历史"><History className="h-4 w-4" /></Button>
                {!isFormOpen && (
                  <Button variant="primary" size="sm" onClick={handleInitAdd} disabled={readOnly}>
                    <Plus className="h-4 w-4" /> 添加记录
                  </Button>
                )}
              </div>
            </div>

            {isSnapshotsOpen && (
              <DnsSnapshotsPanel
                keyId={selectedKeyId}
                domain={selectedDomain.domainName}
                onClose={() => setIsSnapshotsOpen(false)}
                onRestored={refreshRecords}
                readOnly={readOnly}
              />
            )}

            {isHealthOpen && (
              <DnsHealthPanel
                keyId={selectedKeyId}
                domain={selectedDomain.domainName}
                onClose={() => setIsHealthOpen(false)}
              />
            )}

            {/* Import preview */}
            {importPreview && (
              <div className="surface rounded-xl overflow-hidden border" style={{ borderColor: 'oklch(56% 0.18 255 / 0.25)', backgroundColor: 'var(--accent-light)' }}>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--accent-light)' }}>
                      <FileSpreadsheet className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>导入预览</h4>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{importFileName} · 确认前不会修改阿里云 DNS</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setImportPreview(null); setImportFileName(''); }} disabled={isSubmitting}>取消</Button>
                    <Button size="sm" onClick={handleConfirmImport} isLoading={isSubmitting} disabled={importPreview.summary.add === 0 || readOnly}>
                      确认新增 {importPreview.summary.add} 条
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  {[
                    { n: importPreview.summary.add, label: '将新增', color: 'var(--success)' },
                    { n: importPreview.summary.skip, label: '将跳过', color: 'var(--warning)' },
                    { n: importPreview.summary.error, label: '格式错误', color: 'var(--danger)' },
                  ].map((s) => (
                    <div key={s.label} className="px-4 py-3">
                      <div className="text-xl font-bold" style={{ color: s.color }}>{s.n}</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ backgroundColor: 'var(--surface)' }}>
                      <tr style={{ color: 'var(--muted)' }}>
                        <th className="px-3 py-2 font-medium text-left">行</th>
                        <th className="px-3 py-2 font-medium text-left">结果</th>
                        <th className="px-3 py-2 font-medium text-left">主机记录</th>
                        <th className="px-3 py-2 font-medium text-left">类型</th>
                        <th className="px-3 py-2 font-medium text-left">记录值</th>
                        <th className="px-3 py-2 font-medium text-left">TTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.map((row, i) => (
                        <tr key={`${row.line}-${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--muted)' }}>{row.line}</td>
                          <td className="px-3 py-2">
                            {row.status === 'add' && <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />}
                            {row.status === 'skip' && <span style={{ color: 'var(--warning)' }}>跳过</span>}
                            {row.status === 'error' && <AlertTriangle className="h-4 w-4" style={{ color: 'var(--danger)' }} />}
                          </td>
                          <td className="px-3 py-2 font-medium" style={{ color: 'var(--fg)' }}>{row.record?.rr || '-'}</td>
                          <td className="px-3 py-2">{row.record?.type || '-'}</td>
                          <td className="px-3 py-2 font-mono max-w-[200px] truncate">{row.record?.value || '-'}</td>
                          <td className="px-3 py-2">{row.record?.ttl || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Add/Edit form */}
            {isFormOpen && (
              <form
                onSubmit={handleSubmit}
                className="surface rounded-xl p-5 relative"
                style={{ borderColor: 'var(--accent)', borderWidth: '1.5px' }}
              >
                <Button type="button" variant="ghost" size="icon" onClick={resetForm}
                  className="absolute top-2 right-2 h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--accent)' }}>
                  {editingRecord ? '编辑解析记录' : '添加解析记录'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-3">
                    <Input label="主机记录 (RR)" placeholder="@ or www" value={rr} onChange={e => setRr(e.target.value)} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted)', paddingLeft: '2px' }}>记录类型</label>
                    <Select
                      ariaLabel="记录类型"
                      value={type}
                      onValueChange={setType}
                      options={['A', 'CNAME', 'TXT', 'MX', 'AAAA', 'NS'].map(t => ({ value: t, label: t }))}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Input label="记录值" placeholder="1.1.1.1" value={value} onChange={e => setValue(e.target.value)} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted)', paddingLeft: '2px' }}>TTL (秒)</label>
                    <Select
                      ariaLabel="TTL"
                      value={String(ttl)}
                      onValueChange={(v) => setTtl(Number(v))}
                      options={[
                        { value: '600', label: '10 分钟' },
                        { value: '3600', label: '1 小时' },
                        { value: '86400', label: '1 天' },
                      ]}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Button type="submit" isLoading={isSubmitting} className="w-full" disabled={readOnly}>
                      {editingRecord ? '保存' : '添加'}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Filters */}
            <div className="surface rounded-xl overflow-hidden">
              {/* Search row */}
              <div className="p-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--muted)' }} />
                  <input
                    type="text"
                    placeholder="搜索主机记录或记录值…"
                    className="field-control h-9 text-sm"
                    style={{ border: 'none', boxShadow: 'none', backgroundColor: 'var(--surface-hover)', paddingLeft: '2.25rem' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={() => { setSearchTerm(''); setTypeFilter('All'); setStatusFilter('All'); setMinTtlFilter(''); setMaxTtlFilter(''); }}
                    className="text-xs font-medium shrink-0 px-2 py-1 rounded-md transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    清除全部
                  </button>
                )}
              </div>

              {/* Chips row */}
              <div className="px-3 py-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider mr-1 shrink-0" style={{ color: 'var(--muted)' }}>
                  <Filter className="h-3 w-3 inline-block mr-0.5" />
                  筛选
                </span>

                {/* Type chips */}
                {['All', ...Array.from(new Set(records.map(r => r.Type))).sort()].slice(0, 6).map((t) => {
                  const isActive = typeFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      aria-pressed={isActive}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border transition-all duration-150"
                      style={{
                        color: isActive ? 'var(--accent)' : 'var(--muted)',
                        backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                        borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      {t === 'All' ? '全部类型' : t}
                    </button>
                  );
                })}

                <span className="w-px h-4 mx-0.5 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

                {/* Status chips */}
                {(['All', 'Enable', 'Disable'] as DnsStatusFilter[]).map((s) => {
                  const isActive = statusFilter === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      aria-pressed={isActive}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border transition-all duration-150"
                      style={{
                        color: isActive ? 'var(--accent)' : 'var(--muted)',
                        backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                        borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      {{ All: '全部状态', Enable: '正常', Disable: '已暂停' }[s]}
                    </button>
                  );
                })}

                <span className="w-px h-4 mx-0.5 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

                {/* TTL range — compact inline */}
                <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--muted)' }}>TTL</span>
                <input
                  type="number" min="0" inputMode="numeric" placeholder="≥"
                  value={minTtlFilter} onChange={(e) => setMinTtlFilter(e.target.value)}
                  className="w-16 h-7 text-xs rounded-md border px-2"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-hover)', boxShadow: 'none' }}
                />
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>–</span>
                <input
                  type="number" min="0" inputMode="numeric" placeholder="≤"
                  value={maxTtlFilter} onChange={(e) => setMaxTtlFilter(e.target.value)}
                  className="w-16 h-7 text-xs rounded-md border px-2"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-hover)', boxShadow: 'none' }}
                />
              </div>
            </div>

            {/* Batch actions */}
            {selectedRecordIds.size > 0 && (
              <div
                className="surface rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
                style={{ borderColor: 'var(--accent)', borderWidth: '1.5px', backgroundColor: 'var(--accent-light)' }}
              >
                <span className="text-sm font-medium ml-1" style={{ color: 'var(--accent)' }}>
                  已选择 {selectedRecordIds.size} 项
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" onClick={handleBatchDelete} disabled={activeBatchAction !== null || readOnly} isLoading={activeBatchAction === 'delete'}>
                    <Trash2 className="h-4 w-4" /> 批量删除
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleBatchStatus('Enable')} disabled={activeBatchAction !== null || readOnly} isLoading={activeBatchAction === 'enable'}>
                    <PlayCircle className="h-4 w-4" /> 批量启用
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleBatchStatus('Disable')} disabled={activeBatchAction !== null || readOnly} isLoading={activeBatchAction === 'disable'}>
                    <PauseCircle className="h-4 w-4" /> 批量暂停
                  </Button>
                </div>
              </div>
            )}

            {batchFeedback && (
              <section
                className="surface rounded-xl p-4"
                style={{ borderColor: batchFeedback.failed > 0 ? 'var(--warning)' : 'var(--success)' }}
                aria-live="polite"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {batchFeedback.failed > 0 ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--warning)' }} />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--success)' }} />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{batchFeedback.title}</h3>
                      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        共 {batchFeedback.total} 条，成功 {batchFeedback.succeeded} 条，失败 {batchFeedback.failed} 条
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBatchFeedback(null)}
                    className="rounded-md p-1"
                    style={{ color: 'var(--muted)' }}
                    aria-label="关闭批量操作结果"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {batchFeedback.failures.length > 0 && (
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-lg" style={{ backgroundColor: 'var(--surface-hover)' }}>
                    {batchFeedback.failures.map((failure, index) => (
                      <div key={`${failure.label}-${index}`} className="px-3 py-2 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="font-medium" style={{ color: 'var(--fg)' }}>{failure.label}</div>
                        <div className="mt-0.5" style={{ color: 'var(--danger)' }}>{failure.error}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Records table */}
            <div className="surface rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 w-10 cursor-pointer border-b" style={{ ...thStyle, borderColor: 'var(--border)' }} onClick={handleSelectAll}>
                        <input
                          type="checkbox" className="checkbox-control"
                          checked={selectedRecordIds.size === filteredAndSortedRecords.length && filteredAndSortedRecords.length > 0}
                          onChange={handleSelectAll} onClick={(e) => e.stopPropagation()}
                        />
                      </th>
                      {(['RR', 'Type', 'Value', 'TTL', 'Status'] as SortKey[]).map((key) => (
                        <th key={key} className="px-4 py-3 cursor-pointer group border-b" style={{ ...thStyle, borderColor: 'var(--border)' }} onClick={() => requestSort(key)}>
                          <div className="flex items-center gap-1">
                            {{ RR: '主机记录', Type: '类型', Value: '记录值', TTL: 'TTL', Status: '状态' }[key]}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {sortConfig?.key === key
                                ? (sortConfig.direction === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
                                : <ArrowUpDown className="h-3 w-3" />}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right border-b" style={{ ...thStyle, borderColor: 'var(--border)' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((record, index) => {
                      const isLast = index === paginatedRecords.length - 1;
                      return (
                      <tr
                        key={record.RecordId}
                        className="group transition-colors outline-none focus:outline-none"
                        style={{
                          borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          opacity: isRecordEnabled(record.Status) ? 1 : 0.5,
                          backgroundColor: selectedRecordIds.has(record.RecordId) ? 'var(--accent-light)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!selectedRecordIds.has(record.RecordId)) {
                            e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selectedRecordIds.has(record.RecordId)) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <td
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => handleToggleSelect(record.RecordId)}
                          style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
                        >
                          <input
                            type="checkbox" className="checkbox-control"
                            checked={selectedRecordIds.has(record.RecordId)}
                            onChange={() => handleToggleSelect(record.RecordId)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td
                          className="px-4 py-3 font-medium group/cell"
                          style={{
                            color: 'var(--fg)',
                            borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          }}
                        >
                          <div className="flex items-center gap-1.5 max-w-[140px]" title={record.RR}>
                            <span className="truncate">{record.RR}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleCopy(record.RR, '主机记录'); }}
                              className="opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0"
                              style={{ color: 'var(--muted)' }}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3"
                          style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
                        >
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold" style={typeBadgeStyle(record.Type)}>
                            {record.Type}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 font-mono text-xs group/cell"
                          style={{
                            color: 'var(--muted)',
                            borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          }}
                        >
                          <div className="flex items-center gap-1.5 max-w-[180px]" title={record.Value}>
                            <span className="truncate">{record.Value}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleCopy(record.Value, '记录值'); }}
                              className="opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0"
                              style={{ color: 'var(--muted)' }}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 font-mono text-xs"
                          style={{
                            color: 'var(--muted)',
                            borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          }}
                        >
                          {record.TTL}
                        </td>
                        <td
                          className="px-4 py-3"
                          style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
                        >
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: isRecordEnabled(record.Status) ? 'var(--success-light)' : 'var(--warning-light)',
                              color: isRecordEnabled(record.Status) ? 'var(--success)' : 'var(--warning)',
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: isRecordEnabled(record.Status) ? 'var(--success)' : 'var(--warning)' }}
                            />
                            {isRecordEnabled(record.Status) ? '正常' : '已暂停'}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-right whitespace-nowrap"
                          style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
                        >
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => handleToggleStatus(record)}
                              disabled={readOnly}
                              className="p-1.5 rounded-md transition-colors"
                              style={{ color: 'var(--muted)' }}
                              title={isRecordEnabled(record.Status) ? '暂停解析' : '启用解析'}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isRecordEnabled(record.Status) ? 'var(--warning-light)' : 'var(--success-light)';
                                e.currentTarget.style.color = isRecordEnabled(record.Status) ? 'var(--warning)' : 'var(--success)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--muted)';
                              }}
                            >
                              {isRecordEnabled(record.Status) ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleInitEdit(record)}
                              disabled={readOnly}
                              className="p-1.5 rounded-md transition-colors"
                              style={{ color: 'var(--muted)' }}
                              title="编辑"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--accent-light)';
                                e.currentTarget.style.color = 'var(--accent)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--muted)';
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(record)}
                              disabled={readOnly}
                              className="p-1.5 rounded-md transition-colors"
                              style={{ color: 'var(--muted)' }}
                              title="删除"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--danger-light)';
                                e.currentTarget.style.color = 'var(--danger)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--muted)';
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {filteredAndSortedRecords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
                          {records.length === 0 ? '暂无解析记录' : '未找到符合条件的记录'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination & Count Bar */}
            <div className="surface rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ border: '1px solid var(--border)' }}>
              {/* Left: Info range */}
              <div style={{ color: 'var(--muted)' }}>
                {totalFilteredRecords > 0 ? (
                  <>
                    显示第 <span className="font-semibold" style={{ color: 'var(--fg)' }}>{startIndex + 1}</span> - <span className="font-semibold" style={{ color: 'var(--fg)' }}>{endIndex}</span> 条，
                    共 <span className="font-semibold" style={{ color: 'var(--fg)' }}>{totalFilteredRecords}</span> 条记录
                    {records.length !== totalFilteredRecords && `（筛选自 ${records.length} 条）`}
                  </>
                ) : (
                  <>共 0 条记录{records.length > 0 && `（筛选自 ${records.length} 条）`}</>
                )}
              </div>

              {/* Right: Page size select & Navigation */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Page size selector */}
                <div className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                  <span className="shrink-0">每页显示：</span>
                  <Select
                    ariaLabel="每页显示条数"
                    className="w-28"
                    value={String(pageSize)}
                    onValueChange={(val) => setPageSize(Number(val))}
                    options={[
                      { value: '10', label: '10 条/页' },
                      { value: '20', label: '20 条/页' },
                      { value: '50', label: '50 条/页' },
                      { value: '100', label: '100 条/页' },
                    ]}
                  />
                </div>

                {/* Navigation buttons */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(1)}
                      disabled={safePage === 1}
                      title="首页"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      title="上一页"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Numeric page buttons */}
                    <div className="flex items-center gap-1">
                      {getPaginationRange(safePage, totalPages).map((item, index) =>
                        item === 'ellipsis' ? (
                          <span key={`ellipsis-${index}`} className="px-1 text-xs" style={{ color: 'var(--muted)' }}>
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setCurrentPage(item)}
                            className="h-8 min-w-[32px] px-2 rounded-md text-xs font-medium transition-all"
                            style={{
                              backgroundColor: safePage === item ? 'var(--accent)' : 'transparent',
                              color: safePage === item ? '#fff' : 'var(--muted)',
                              border: safePage === item ? 'none' : '1px solid var(--border)',
                            }}
                            onMouseEnter={(e) => {
                              if (safePage !== item) {
                                e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                                e.currentTarget.style.color = 'var(--fg)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (safePage !== item) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--muted)';
                              }
                            }}
                          >
                            {item}
                          </button>
                        )
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      title="下一页"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={safePage === totalPages}
                      title="末页"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <LogsViewer isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} />
      {selectedDomain && (
        <DnsHistoryViewer
          domain={selectedDomain.domainName}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </div>
  );
}
