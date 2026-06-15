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
        if (result.success) {
            setLogs(result.data || []);
        }
        setIsLoading(false);
    }, [domain]);

    useEffect(() => {
        if (!isOpen) return;
        const timer = window.setTimeout(() => void fetchHistory(), 0);
        return () => window.clearTimeout(timer);
    }, [fetchHistory, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex max-h-[80vh] w-full max-w-4xl flex-col rounded-xl border border-white/10 bg-[#1a1f2e] shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                            <Clock3 className="h-5 w-5 text-cyan-300" />
                            DNS 变更历史
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">{domain} · {logs.length} 条记录</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => void fetchHistory()} title="刷新">
                            <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose} title="关闭">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {isLoading && logs.length === 0 ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-12 text-center text-sm text-gray-500">
                            暂无结构化变更历史，升级前的旧操作日志仍可在“操作日志”中查看。
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map(log => {
                                const operation = log.context?.operation;
                                return (
                                    <article key={log.id} className="rounded-xl border border-white/8 bg-black/15 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-white">
                                                        {operation ? operationLabels[operation] : log.action}
                                                    </span>
                                                    <span className={`rounded-full px-2 py-0.5 text-xs ${log.status === 'success'
                                                        ? 'bg-green-500/10 text-green-300'
                                                        : 'bg-red-500/10 text-red-300'
                                                    }`}>
                                                        {log.status === 'success' ? '成功' : '失败'}
                                                    </span>
                                                </div>
                                                <p className="mt-2 break-all text-sm leading-6 text-gray-300">
                                                    {getHistorySummary(log)}
                                                </p>
                                                {log.error && <p className="mt-2 text-xs text-red-300">{log.error}</p>}
                                            </div>
                                            <time className="shrink-0 font-mono text-xs text-gray-500">
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
    );
}
