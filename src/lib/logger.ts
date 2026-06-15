import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOG_FILE_PATH = path.join(DATA_DIR, 'logs.json');

export interface LogEntry {
    id: string;
    timestamp: string;
    ip?: string;
    action: string;
    details: string;
    status: 'success' | 'failure';
    error?: string;
    context?: DnsChangeContext;
}

export type DnsChangeOperation = 'add' | 'update' | 'delete' | 'status' | 'batch-add' | 'batch-delete' | 'batch-status';

export interface DnsChangeRecord {
    recordId?: string;
    rr: string;
    type: string;
    value: string;
    ttl: number;
    status?: 'Enable' | 'Disable';
}

export interface DnsChangeContext {
    category: 'dns-change';
    domain: string;
    operation: DnsChangeOperation;
    records: DnsChangeRecord[];
    before?: DnsChangeRecord;
    after?: DnsChangeRecord;
}

async function ensureLogFile() {
    try {
        await fs.access(LOG_FILE_PATH);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(LOG_FILE_PATH, '[]');
    }
}

export async function logOperation(
    action: string,
    details: string,
    status: 'success' | 'failure',
    ip?: string,
    error?: string,
    context?: DnsChangeContext
) {
    try {
        await ensureLogFile();
        const content = await fs.readFile(LOG_FILE_PATH, 'utf-8');
        let logs: LogEntry[] = [];
        try {
            logs = JSON.parse(content);
        } catch {
            logs = [];
        }

        const newLog: LogEntry = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            ip,
            action,
            details,
            status,
            error,
            context,
        };

        // Add to beginning, keep last 1000 logs
        logs.unshift(newLog);
        if (logs.length > 1000) {
            logs = logs.slice(0, 1000);
        }

        await fs.writeFile(LOG_FILE_PATH, JSON.stringify(logs, null, 2));
    } catch (err) {
        console.error('Failed to write log:', err);
    }
}

export async function getLogs(): Promise<LogEntry[]> {
    try {
        await ensureLogFile();
        const content = await fs.readFile(LOG_FILE_PATH, 'utf-8');
        return JSON.parse(content);
    } catch {
        return [];
    }
}

export function filterDnsChangeLogs(logs: LogEntry[], domain: string): LogEntry[] {
    const normalizedDomain = domain.trim().toLowerCase();
    return logs.filter(log =>
        log.context?.category === 'dns-change' &&
        log.context.domain.trim().toLowerCase() === normalizedDomain
    );
}
