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
    error?: string
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
            error
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
