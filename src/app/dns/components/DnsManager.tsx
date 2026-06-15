'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
    batchAddDnsRecordsAction
} from '@/app/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2, ArrowUpDown, ChevronUp, ChevronDown, Filter, Globe, ArrowLeft, Loader2, Edit2, PlayCircle, PauseCircle, X, Copy, History, Download, UploadCloud, AlertTriangle, CheckCircle2, FileSpreadsheet, Archive } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { LogsViewer } from '@/components/LogsViewer';
import { createDnsImportPreview, createDomainBackup, type DnsImportPreview } from '@/lib/dns-import';

interface DnsManagerProps {
    initialKeys: AccessKey[];
}

type SortKey = 'RR' | 'Type' | 'Value' | 'TTL' | 'Status';

const isRecordEnabled = (status: string | undefined) => {
    if (!status) return true;
    return status.toUpperCase() === 'ENABLE';
};

export function DnsManager({ initialKeys }: DnsManagerProps) {
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State ---
    const [selectedKeyId, setSelectedKeyId] = useState<string>(initialKeys[0]?.id || '');

    // Domains
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loadingDomains, setLoadingDomains] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

    // Records
    const [records, setRecords] = useState<DnsRecord[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

    // Filter & Sort
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
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

    // Logs
    const [isLogsOpen, setIsLogsOpen] = useState(false);

    const refreshRecords = useCallback(async () => {
        if (!selectedKeyId || !selectedDomain) return;
        setLoadingRecords(true);
        const res = await listDnsRecordsAction(selectedKeyId, selectedDomain.domainName);
        if (res.success) {
            setRecords(res.data || []);
        } else {
            console.error(res.error);
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

        const res = await listDomainsAction(selectedKeyId);
        if (res.success) {
            setDomains(res.data || []);
        } else {
            toast.error(res.error || '获取域名列表失败');
            setDomains([]);
        }
        setLoadingDomains(false);
    }, [selectedKeyId, toast]);

    // --- Effects ---

    useEffect(() => {
        if (!selectedKeyId) return;
        const timer = window.setTimeout(() => {
            void fetchDomains();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [selectedKeyId, fetchDomains]);

    useEffect(() => {
        if (!selectedKeyId || !selectedDomain) return;
        const timer = window.setTimeout(() => {
            void refreshRecords();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [selectedKeyId, selectedDomain, refreshRecords]);

    // --- Handlers ---

    const handleBackToDomains = () => {
        setSelectedDomain(null);
        setRecords([]);
        setSearchTerm('');
        setTypeFilter('All');
        setImportPreview(null);
        setImportFileName('');
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

    const handleInitAdd = () => {
        resetForm();
        setIsFormOpen(true);
    };

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

        setIsSubmitting(true);

        let res;
        if (editingRecord) {
            res = await updateDnsRecordAction(selectedKeyId, editingRecord.RecordId, rr, type, value, ttl);
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

    const handleDeleteRecord = async (recordId: string) => {
        if (!confirm('确定删除这条解析记录吗？此操作不可逆！')) return;
        const res = await deleteDnsRecordAction(selectedKeyId, recordId);
        if (res.success) {
            toast.success('删除解析记录成功');
            // 阿里云 API 删除后可能有极短延迟，等待 1 秒后再刷新以确保数据准确
            setTimeout(async () => {
                await refreshRecords();
            }, 1000);
        } else {
            toast.error(res.error || '删除失败');
        }
    };

    const handleToggleStatus = async (record: DnsRecord) => {
        const currentlyEnabled = isRecordEnabled(record.Status);
        const newStatus = currentlyEnabled ? 'Disable' : 'Enable';
        const actionText = currentlyEnabled ? '暂停' : '启用';

        const res = await setDnsRecordStatusAction(selectedKeyId, record.RecordId, newStatus);

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
            await navigator.clipboard.writeText(text);
            toast.success(`已复制 ${label}`);
        } catch (err) {
            toast.error('复制失败');
            console.error('Failed to copy', err);
        }
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

    const handleSelectAll = () => {
        if (selectedRecordIds.size === filteredAndSortedRecords.length && filteredAndSortedRecords.length > 0) {
            setSelectedRecordIds(new Set());
        } else {
            setSelectedRecordIds(new Set(filteredAndSortedRecords.map(r => r.RecordId)));
        }
    };

    const handleBatchDelete = async () => {
        if (!confirm(`确定删除选中的 ${selectedRecordIds.size} 条记录吗？`)) return;
        const res = await batchDeleteDnsRecordsAction(selectedKeyId, Array.from(selectedRecordIds));
        if (res.success) {
            toast.success('批量删除成功');
            setTimeout(async () => {
                await refreshRecords();
            }, 1200); // 批量操作稍微多等一点
        } else {
            toast.error(res.error || '批量删除失败');
        }
    };

    const handleBatchStatus = async (status: 'Enable' | 'Disable') => {
        const actionText = status === 'Enable' ? '启用' : '暂停';
        const res = await batchSetDnsRecordsStatusAction(selectedKeyId, Array.from(selectedRecordIds), status);
        if (res.success) {
            toast.success(`批量${actionText}成功`);
            setTimeout(async () => {
                await refreshRecords();
            }, 800);
        } else {
            toast.error(res.error || `批量${actionText}失败`);
        }
    };

    // --- Import / Export ---

    const handleExport = () => {
        if (!records.length) {
            toast.error('暂无记录可导出');
            return;
        }

        const headers = ['主机记录,记录类型,记录值,TTL,状态'];
        const csvContent = records.map(r =>
            `${r.RR},${r.Type},${r.Value},${r.TTL},${isRecordEnabled(r.Status) ? 'Enable' : 'Disable'}`
        ).join('\n');

        const blob = new Blob(['\uFEFF' + headers + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dns_records_${selectedDomain?.domainName || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDomainBackup = () => {
        if (!selectedDomain || !records.length) {
            toast.error('暂无记录可备份');
            return;
        }

        const backup = createDomainBackup(selectedDomain.domainName, records);
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dns_backup_${selectedDomain.domainName}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedDomain) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const preview = createDnsImportPreview(text, records, selectedDomain.domainName);

                if (preview.rows.length === 0) {
                    toast.error('未识别到有效记录');
                    return;
                }

                setImportPreview(preview);
                setImportFileName(file.name);
            } catch (err) {
                console.error('Import failed', err);
                toast.error('文件解析失败');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleConfirmImport = async () => {
        if (!selectedDomain || !importPreview) return;
        const newRecords = importPreview.rows
            .filter(row => row.status === 'add' && row.record)
            .map(row => row.record!);

        if (newRecords.length === 0) {
            toast.error('没有可新增的记录');
            return;
        }

        setIsSubmitting(true);
        const res = await batchAddDnsRecordsAction(selectedKeyId, selectedDomain.domainName, newRecords);
        if (res.success) {
            toast.success(`成功导入 ${newRecords.length} 条记录`);
            setImportPreview(null);
            setImportFileName('');
            await refreshRecords();
        } else {
            toast.error(res.error || '导入失败');
        }
        setIsSubmitting(false);
    };

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // --- Derived State ---
    const filteredAndSortedRecords = records
        .filter(record => {
            const matchesSearch =
                record.RR.toLowerCase().includes(searchTerm.toLowerCase()) ||
                record.Value.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === 'All' || record.Type === typeFilter;
            return matchesSearch && matchesType;
        })
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            let aVal = a[key];
            let bVal = b[key];
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();
            if (key === 'TTL') {
                aVal = Number(a.TTL);
                bVal = Number(b.TTL);
            }
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    return (
        <div className="space-y-6">
            {/* Top Bar: AccessKey Selector */}
            <div className="glass p-6 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                        <Globe className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">DNS 管理面板</h2>
                        <p className="text-sm text-gray-400">管理您的域名解析记录</p>
                    </div>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <Button variant="ghost" onClick={() => setIsLogsOpen(true)} className="text-gray-400 hover:text-white">
                        <History className="mr-2 h-4 w-4" /> 操作日志
                    </Button>
                    <div className="w-full md:w-64">
                        <select
                            className="flex h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:bg-black/30"
                            value={selectedKeyId}
                            onChange={(e) => setSelectedKeyId(e.target.value)}
                        >
                            {initialKeys.length === 0 && <option value="">无可用 AccessKey</option>}
                            {initialKeys.map(k => (
                                <option key={k.id} value={k.id} className="bg-gray-900">{k.name} ({k.accessKeyId})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {!selectedDomain ? (
                    // View 1: Domain List
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-200">域名列表</h3>
                            {loadingDomains && <Loader2 className="h-5 w-5 animate-spin text-blue-400" />}
                        </div>

                        {loadingDomains ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="glass h-32 rounded-xl animate-pulse bg-white/5" />
                                ))}
                            </div>
                        ) : domains.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {domains.map(domain => (
                                    <button
                                        key={domain.domainId}
                                        onClick={() => setSelectedDomain(domain)}
                                        className="glass p-5 rounded-xl text-left hover:bg-white/10 transition-all group border border-white/5 hover:border-blue-500/30 flex flex-col justify-between h-32"
                                    >
                                        <div>
                                            <div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                                                {domain.domainName}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {domain.versionName}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-xs text-gray-600">
                                                {new Date(domain.createTime).toLocaleDateString()}
                                            </div>
                                            <div className="text-sm font-medium bg-white/5 px-2 py-1 rounded text-gray-300">
                                                {domain.recordCount} 条记录
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-gray-500 glass rounded-xl">
                                <p>该 AccessKey 下暂无域名</p>
                            </div>
                        )}
                    </div>
                ) : (
                    // View 2: Records List
                    <div className="space-y-4">
                        {/* Domain Header */}
                        <div className="flex items-center gap-4 mb-6">
                            <Button variant="ghost" size="icon" onClick={handleBackToDomains} className="hover:bg-white/10">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    {selectedDomain.domainName}
                                    {loadingRecords && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                                </h3>
                                <p className="text-xs text-gray-500">DNS 管理 &gt; {selectedDomain.domainName}</p>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".csv,.txt,.json"
                                    onChange={handleFileChange}
                                />
                                <Button variant="ghost" size="icon" onClick={handleExport} title="导出 CSV">
                                    <Download className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleDomainBackup} title="导出域名完整备份">
                                    <Archive className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleImportClick} title="导入 CSV">
                                    <UploadCloud className="h-5 w-5" />
                                </Button>
                                {!isFormOpen && (
                                    <Button variant="secondary" onClick={handleInitAdd}>
                                        <Plus className="mr-2 h-4 w-4" /> 添加记录
                                    </Button>
                                )}
                            </div>
                        </div>

                        {importPreview && (
                            <section className="glass overflow-hidden rounded-xl border border-cyan-400/25 bg-cyan-500/5 animate-in fade-in slide-in-from-top-2">
                                <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300">
                                            <FileSpreadsheet className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white">导入预览</h4>
                                            <p className="mt-1 text-xs text-gray-400">
                                                {importFileName} · 确认前不会修改阿里云 DNS
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setImportPreview(null);
                                                setImportFileName('');
                                            }}
                                            disabled={isSubmitting}
                                        >
                                            取消
                                        </Button>
                                        <Button
                                            onClick={handleConfirmImport}
                                            isLoading={isSubmitting}
                                            disabled={importPreview.summary.add === 0}
                                        >
                                            确认新增 {importPreview.summary.add} 条
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-px bg-white/10">
                                    <div className="bg-gray-950/70 px-4 py-3">
                                        <div className="text-xl font-bold text-green-300">{importPreview.summary.add}</div>
                                        <div className="text-xs text-gray-500">将新增</div>
                                    </div>
                                    <div className="bg-gray-950/70 px-4 py-3">
                                        <div className="text-xl font-bold text-amber-300">{importPreview.summary.skip}</div>
                                        <div className="text-xs text-gray-500">将跳过</div>
                                    </div>
                                    <div className="bg-gray-950/70 px-4 py-3">
                                        <div className="text-xl font-bold text-red-300">{importPreview.summary.error}</div>
                                        <div className="text-xs text-gray-500">格式错误</div>
                                    </div>
                                </div>

                                <div className="max-h-72 overflow-auto">
                                    <table className="w-full min-w-[760px] text-left text-xs">
                                        <thead className="sticky top-0 bg-gray-950/95 text-gray-500">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">行</th>
                                                <th className="px-4 py-3 font-medium">结果</th>
                                                <th className="px-4 py-3 font-medium">主机记录</th>
                                                <th className="px-4 py-3 font-medium">类型</th>
                                                <th className="px-4 py-3 font-medium">记录值</th>
                                                <th className="px-4 py-3 font-medium">TTL</th>
                                                <th className="px-4 py-3 font-medium">状态</th>
                                                <th className="px-4 py-3 font-medium">说明</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {importPreview.rows.map((row, index) => (
                                                <tr key={`${row.line}-${index}`} className="text-gray-300">
                                                    <td className="px-4 py-3 text-gray-600">{row.line}</td>
                                                    <td className="px-4 py-3">
                                                        {row.status === 'add' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                                                        {row.status === 'skip' && <span className="text-amber-300">跳过</span>}
                                                        {row.status === 'error' && <AlertTriangle className="h-4 w-4 text-red-400" />}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-white">{row.record?.rr || '-'}</td>
                                                    <td className="px-4 py-3">{row.record?.type || '-'}</td>
                                                    <td className="max-w-[220px] truncate px-4 py-3 font-mono" title={row.record?.value}>
                                                        {row.record?.value || '-'}
                                                    </td>
                                                    <td className="px-4 py-3">{row.record?.ttl || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        {row.record?.status === 'Disable' ? '暂停' : row.record ? '启用' : '-'}
                                                    </td>
                                                    <td className={`px-4 py-3 ${row.status === 'error' ? 'text-red-300' : 'text-gray-500'}`}>
                                                        {row.reason}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {/* Add/Edit Form */}
                        {isFormOpen && (
                            <form onSubmit={handleSubmit} className="glass p-6 rounded-xl flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 border border-blue-500/30 bg-blue-500/5 relative">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={resetForm}
                                    className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-white"
                                >
                                    <X className="h-4 w-4" />
                                </Button>

                                <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2">
                                    {editingRecord ? '编辑解析记录' : '添加解析记录'}
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="md:col-span-3">
                                        <Input label="主机记录 (RR)" placeholder="@ or www" value={rr} onChange={e => setRr(e.target.value)} required />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-gray-300 ml-1 block mb-1">记录类型</label>
                                        <select
                                            className="flex h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            value={type}
                                            onChange={e => setType(e.target.value)}
                                        >
                                            {['A', 'CNAME', 'TXT', 'MX', 'AAAA', 'NS'].map(t => <option key={t} value={t} className="bg-gray-900">{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-4">
                                        <Input label="记录值" placeholder="1.1.1.1" value={value} onChange={e => setValue(e.target.value)} required />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-gray-300 ml-1 block mb-1">TTL (秒)</label>
                                        <select
                                            className="flex h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            value={ttl}
                                            onChange={e => setTtl(Number(e.target.value))}
                                        >
                                            <option value={600} className="bg-gray-900">10 分钟 (默认)</option>
                                            <option value={3600} className="bg-gray-900">1 小时</option>
                                            <option value={86400} className="bg-gray-900">1 天</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <Button type="submit" isLoading={isSubmitting} className="w-full">
                                            {editingRecord ? '保存' : '添加'}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Filters */}
                        <div className="glass p-4 rounded-xl flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2 text-gray-400 min-w-fit">
                                <Filter className="h-4 w-4" />
                                <span className="text-xs font-medium uppercase tracking-wider">筛选</span>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <input
                                    type="text"
                                    placeholder="搜索主机记录或记录值..."
                                    className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-gray-600"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="w-32">
                                <select
                                    className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                >
                                    <option value="All">全部类型</option>
                                    {Array.from(new Set(records.map(r => r.Type))).sort().map(t => (
                                        <option key={t} value={t} className="bg-gray-900">{t}</option>
                                    ))}
                                </select>
                            </div>
                            {(searchTerm || typeFilter !== 'All') && (
                                <button
                                    onClick={() => { setSearchTerm(''); setTypeFilter('All'); }}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    重置筛选
                                </button>
                            )}
                        </div>

                        {/* Batch Actions Bar */}
                        {selectedRecordIds.size > 0 && (
                            <div className="glass p-3 rounded-xl flex items-center justify-between bg-blue-500/10 border border-blue-500/30 animate-in fade-in slide-in-from-top-2">
                                <span className="text-sm font-medium text-blue-300 ml-2">
                                    已选择 {selectedRecordIds.size} 项
                                </span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="danger" onClick={handleBatchDelete}>
                                        <Trash2 className="mr-2 h-4 w-4" /> 批量删除
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => handleBatchStatus('Enable')}>
                                        <PlayCircle className="mr-2 h-4 w-4" /> 批量启用
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => handleBatchStatus('Disable')}>
                                        <PauseCircle className="mr-2 h-4 w-4" /> 批量暂停
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Records Table */}
                        <div className="glass rounded-xl overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3 w-10 cursor-pointer" onClick={handleSelectAll}>
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/50 h-5 w-5 cursor-pointer"
                                                    checked={selectedRecordIds.size === filteredAndSortedRecords.length && filteredAndSortedRecords.length > 0}
                                                    onChange={handleSelectAll}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors group" onClick={() => requestSort('RR')}>
                                            <div className="flex items-center gap-1">主机记录
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {sortConfig?.key === 'RR' ? (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3" />}
                                                </span>
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors group" onClick={() => requestSort('Type')}>
                                            <div className="flex items-center gap-1">类型
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {sortConfig?.key === 'Type' ? (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3" />}
                                                </span>
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors group" onClick={() => requestSort('Value')}>
                                            <div className="flex items-center gap-1">记录值
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {sortConfig?.key === 'Value' ? (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3" />}
                                                </span>
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors group" onClick={() => requestSort('TTL')}>
                                            <div className="flex items-center gap-1">TTL
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {sortConfig?.key === 'TTL' ? (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3" />}
                                                </span>
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors group" onClick={() => requestSort('Status')}>
                                            <div className="flex items-center gap-1">状态
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {sortConfig?.key === 'Status' ? (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-3 w-3" />}
                                                </span>
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-medium text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredAndSortedRecords.map((record) => (
                                        <tr key={record.RecordId} className={`hover:bg-white/5 transition-colors group ${!isRecordEnabled(record.Status) ? 'opacity-50 grayscale' : ''} ${selectedRecordIds.has(record.RecordId) ? 'bg-blue-500/10' : ''}`}>
                                            <td className="px-4 py-4 cursor-pointer" onClick={() => handleToggleSelect(record.RecordId)}>
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/50 h-5 w-5 cursor-pointer"
                                                        checked={selectedRecordIds.has(record.RecordId)}
                                                        onChange={() => handleToggleSelect(record.RecordId)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 font-medium text-white group/cell">
                                                <div className="flex items-center gap-2 max-w-[150px]" title={record.RR}>
                                                    <span className="truncate flex-1">{record.RR}</span>
                                                    <button
                                                        onClick={() => handleCopy(record.RR, '主机记录')}
                                                        className="opacity-0 group-hover/cell:opacity-100 text-gray-500 hover:text-blue-400 transition-all shrink-0"
                                                        title="复制主机记录"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${record.Type === 'A' ? 'bg-green-500/20 text-green-300' :
                                                    record.Type === 'CNAME' ? 'bg-purple-500/20 text-purple-300' :
                                                        'bg-gray-500/20 text-gray-300'
                                                    }`}>
                                                    {record.Type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-gray-300 font-mono text-xs group/cell">
                                                <div className="flex items-center gap-2 max-w-[200px]" title={record.Value}>
                                                    <span className="truncate flex-1">{record.Value}</span>
                                                    <button
                                                        onClick={() => handleCopy(record.Value, '记录值')}
                                                        className="opacity-0 group-hover/cell:opacity-100 text-gray-500 hover:text-blue-400 transition-all shrink-0"
                                                        title="复制记录值"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-gray-500 text-xs">{record.TTL}</td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs whitespace-nowrap border ${isRecordEnabled(record.Status)
                                                    ? 'border-green-500/30 text-green-400 bg-green-500/5'
                                                    : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRecordEnabled(record.Status) ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                                    {isRecordEnabled(record.Status) ? '正常' : '已暂停'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleToggleStatus(record)}
                                                        className={`p-2 rounded transition-colors ${isRecordEnabled(record.Status) ? 'text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10' : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10'}`}
                                                        title={isRecordEnabled(record.Status) ? '暂停解析' : '启用解析'}
                                                    >
                                                        {isRecordEnabled(record.Status) ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                                                    </button>

                                                    <button
                                                        onClick={() => handleInitEdit(record)}
                                                        className="p-2 rounded text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                        title="编辑"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteRecord(record.RecordId)}
                                                        className="p-2 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                        title="删除"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredAndSortedRecords.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                                                未找到符合条件的记录
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Logs Viewer */}
            <LogsViewer isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} />
        </div>
    );
}
