import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { readAccessKeyBackupData, validateAccessKeyBackupData } from './key-manager';
import type { LogEntry } from './logger';
import { readDnsSnapshotsForBackup, validateDnsSnapshots, type DomainSnapshot } from './dns-snapshots';

const DATA_DIR = process.env.APP_DATA_DIR?.trim()
    ? path.resolve(/* turbopackIgnore: true */ process.env.APP_DATA_DIR.trim())
    : path.join(process.cwd(), 'data');
const ACCESS_KEY_FILE = path.join(DATA_DIR, 'access_keys.json');
const LOG_FILE = path.join(DATA_DIR, 'logs.json');
const DNS_SNAPSHOT_FILE = path.join(DATA_DIR, 'dns_snapshots.json');
const BACKUP_FORMAT = 'aliyun-dns-manager-backup';
const BACKUP_VERSION = 2;
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_LOG_ENTRIES = 1000;

export interface AppDataBackup {
    format: typeof BACKUP_FORMAT;
    version: typeof BACKUP_VERSION;
    createdAt: string;
    data: {
        accessKeys: string | null;
        logs: LogEntry[];
        dnsSnapshots: DomainSnapshot[];
    };
}

function isLogEntry(value: unknown): value is LogEntry {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const log = value as Record<string, unknown>;
    return (
        typeof log.id === 'string' &&
        typeof log.timestamp === 'string' &&
        typeof log.action === 'string' &&
        typeof log.details === 'string' &&
        (log.status === 'success' || log.status === 'failure') &&
        (log.ip === undefined || typeof log.ip === 'string') &&
        (log.error === undefined || typeof log.error === 'string')
    );
}

async function readLogsForBackup(): Promise<LogEntry[]> {
    try {
        const content = await fs.readFile(LOG_FILE, 'utf-8');
        const logs = JSON.parse(content) as unknown;

        if (!Array.isArray(logs) || !logs.every(isLogEntry)) {
            throw new Error('操作日志文件格式无效');
        }

        return logs.slice(0, MAX_LOG_ENTRIES);
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }

        throw error;
    }
}

export async function createAppDataBackup(): Promise<AppDataBackup> {
    const [accessKeys, logs, dnsSnapshots] = await Promise.all([
        readAccessKeyBackupData(),
        readLogsForBackup(),
        readDnsSnapshotsForBackup(),
    ]);

    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        data: {
            accessKeys,
            logs,
            dnsSnapshots,
        },
    };
}

export function parseAndValidateBackup(content: string): AppDataBackup {
    if (Buffer.byteLength(content, 'utf8') > MAX_BACKUP_BYTES) {
        throw new Error('备份文件超过 5 MB，已拒绝恢复');
    }

    const parsed = JSON.parse(content) as {
        format?: unknown;
        version?: unknown;
        createdAt?: unknown;
        data?: { accessKeys?: unknown; logs?: unknown; dnsSnapshots?: unknown };
    };

    if (
        parsed.format !== BACKUP_FORMAT ||
        (parsed.version !== 1 && parsed.version !== BACKUP_VERSION) ||
        typeof parsed.createdAt !== 'string' ||
        Number.isNaN(Date.parse(parsed.createdAt)) ||
        !parsed.data
    ) {
        throw new Error('备份文件格式或版本不受支持');
    }

    const data = parsed.data;
    if (
        (data.accessKeys !== null && typeof data.accessKeys !== 'string') ||
        !Array.isArray(data.logs) ||
        data.logs.length > MAX_LOG_ENTRIES ||
        !data.logs.every(isLogEntry) ||
        (parsed.version === BACKUP_VERSION && !Array.isArray(data.dnsSnapshots))
    ) {
        throw new Error('备份文件格式或版本不受支持');
    }

    if (data.accessKeys !== null) {
        try {
            validateAccessKeyBackupData(data.accessKeys);
        } catch {
            throw new Error('备份中的 AccessKey 无法使用当前 ENCRYPTION_KEY 解密');
        }
    }

    const dnsSnapshots = parsed.version === 1
        ? []
        : validateDnsSnapshots(data.dnsSnapshots);

    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        createdAt: parsed.createdAt,
        data: {
            accessKeys: data.accessKeys,
            logs: data.logs,
            dnsSnapshots,
        },
    };
}

async function readExistingFile(filePath: string): Promise<string | null> {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }

        throw error;
    }
}

async function replaceFile(filePath: string, content: string | null): Promise<void> {
    const tempPath = `${filePath}.restore-${randomUUID()}.tmp`;

    if (content === null) {
        await fs.rm(filePath, { force: true });
        return;
    }

    await fs.writeFile(tempPath, content, 'utf-8');
    try {
        await fs.rename(tempPath, filePath);
    } finally {
        await fs.rm(tempPath, { force: true });
    }
}

export async function restoreAppDataBackup(backup: AppDataBackup): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const [previousAccessKeys, previousLogs, previousDnsSnapshots] = await Promise.all([
        readExistingFile(ACCESS_KEY_FILE),
        readExistingFile(LOG_FILE),
        readExistingFile(DNS_SNAPSHOT_FILE),
    ]);

    try {
        await replaceFile(ACCESS_KEY_FILE, backup.data.accessKeys);
        await replaceFile(LOG_FILE, JSON.stringify(backup.data.logs, null, 2));
        await replaceFile(DNS_SNAPSHOT_FILE, JSON.stringify(backup.data.dnsSnapshots, null, 2));
    } catch (error) {
        await replaceFile(ACCESS_KEY_FILE, previousAccessKeys);
        await replaceFile(LOG_FILE, previousLogs);
        await replaceFile(DNS_SNAPSHOT_FILE, previousDnsSnapshots);
        throw error;
    }
}
