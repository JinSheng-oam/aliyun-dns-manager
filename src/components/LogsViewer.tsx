'use client';

import { useState, useEffect, useCallback } from 'react';
import { LogEntry } from '@/lib/logger';
import { getLogsAction } from '@/app/actions';
import { X, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface LogsViewerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LogsViewer({ isOpen, onClose }: LogsViewerProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1a1f2e] border border-white/10 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        操作日志
                        <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                            {logs.length} 条记录
                        </span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => void fetchLogs()} title="刷新">
                            <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
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
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                            暂无日志记录
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
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
