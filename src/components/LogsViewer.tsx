'use client';

import { useState, useEffect, useCallback, useDeferredValue } from 'react';
import type { LogEntry } from '@/lib/logger';
import { getLogsAction } from '@/app/actions';
import { X, Loader2, RotateCw, Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
        if (res.success && res.data) {
            setLogs(res.data);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            const timer = window.setTimeout(() => {
                void fetchLogs();
            }, 0);

            return () => window.clearTimeout(timer);
        }
    }, [isOpen, fetchLogs]);

    const filteredLogs = logs.filter((log) => {
        if (statusFilter !== 'all' && log.status !== statusFilter) {
            return false;
        }

        if (!deferredSearchTerm) {
            return true;
        }

        return [log.action, log.ip, log.details, log.error]
            .some((value) => value?.toLowerCase().includes(deferredSearchTerm));
    });

    const exportLogs = () => {
        const blob = new Blob([createLogsCsv(filteredLogs)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        link.href = url;
        link.download = `aliyun-dns-logs-${timestamp}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1a1f2e] border border-white/10 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        操作日志
                        <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                            {filteredLogs.length} / {logs.length} 条记录
                        </span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={exportLogs}
                            disabled={filteredLogs.length === 0}
                            title="导出当前筛选结果"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            导出 CSV
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void fetchLogs()} title="刷新">
                            <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose} title="关闭">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="border-b border-white/10 p-4 flex flex-col gap-3 sm:flex-row">
                    <label className="relative flex-1">
                        <span className="sr-only">搜索操作日志</span>
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="搜索操作、IP、详情或错误"
                            className="h-10 w-full rounded-lg border border-white/10 bg-black/20 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </label>
                    <label>
                        <span className="sr-only">筛选日志状态</span>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                            className="h-10 w-full rounded-lg border border-white/10 bg-[#151927] px-3 text-sm text-white focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 sm:w-36"
                        >
                            <option value="all">全部状态</option>
                            <option value="success">仅成功</option>
                            <option value="failure">仅失败</option>
                        </select>
                    </label>
                </div>

                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                    {isLoading && logs.length === 0 ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="text-gray-400 text-xs uppercase tracking-wider sticky top-0 bg-[#1a1f2e] z-10">
                                <tr>
                                    <th className="px-4 py-2 bg-[#1a1f2e]">时间</th>
                                    <th className="px-4 py-2 bg-[#1a1f2e]">操作</th>
                                    <th className="px-4 py-2 bg-[#1a1f2e]">IP</th>
                                    <th className="px-4 py-2 bg-[#1a1f2e]">详情</th>
                                    <th className="px-4 py-2 bg-[#1a1f2e] text-right">状态</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                            {logs.length === 0 ? '暂无日志记录' : '未找到符合条件的日志'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-white">
                                                {log.action}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono text-gray-400">
                                                {log.ip}
                                            </td>
                                            <td className="px-4 py-3 max-w-xs truncate text-xs" title={log.details}>
                                                {log.details}
                                                {log.error && (
                                                    <div className="text-red-400 mt-1">{log.error}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${log.status === 'success'
                                                        ? 'bg-green-500/10 text-green-400'
                                                        : 'bg-red-500/10 text-red-400'
                                                    }`}>
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
    );
}
