import type { LogEntry } from '@/lib/logger';

function escapeCsvCell(value: string | undefined): string {
    const safeValue = value || '';
    const formulaSafeValue = /^[=+\-@]/.test(safeValue) ? `'${safeValue}` : safeValue;
    return `"${formulaSafeValue.replace(/"/g, '""')}"`;
}

export function createLogsCsv(logs: LogEntry[]): string {
    const header = ['时间', '操作', 'IP', '详情', '状态', '错误'];
    const rows = logs.map((log) => [
        new Date(log.timestamp).toLocaleString(),
        log.action,
        log.ip,
        log.details,
        log.status === 'success' ? '成功' : '失败',
        log.error,
    ]);

    return `\uFEFF${[
        header.map(escapeCsvCell).join(','),
        ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ].join('\r\n')}`;
}
