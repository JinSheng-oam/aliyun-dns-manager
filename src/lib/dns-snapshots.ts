import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { DnsRecord } from './types';

const MAX_SNAPSHOTS_PER_DOMAIN = 20;
const CASE_INSENSITIVE_VALUE_TYPES = new Set(['CNAME', 'MX', 'NS', 'PTR']);
let snapshotMutationQueue: Promise<void> = Promise.resolve();

function enqueueSnapshotMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const result = snapshotMutationQueue.then(mutation, mutation);
    snapshotMutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

function getDataDir(): string {
    return process.env.APP_DATA_DIR?.trim()
        ? path.resolve(/* turbopackIgnore: true */ process.env.APP_DATA_DIR.trim())
        : path.join(process.cwd(), 'data');
}

function getSnapshotFile(): string {
    return path.join(getDataDir(), 'dns_snapshots.json');
}

export type DnsSnapshotRecord = {
    rr: string;
    type: string;
    value: string;
    ttl: number;
    status: 'Enable' | 'Disable';
};

export type CurrentDnsSnapshotRecord = DnsSnapshotRecord & {
    recordId: string;
};

export type DomainSnapshot = {
    id: string;
    keyId: string;
    domain: string;
    label: string;
    createdAt: string;
    records: DnsSnapshotRecord[];
};

export type DnsRestorePlan = {
    add: DnsSnapshotRecord[];
    update: Array<{ current: CurrentDnsSnapshotRecord; target: DnsSnapshotRecord }>;
    delete: CurrentDnsSnapshotRecord[];
    unchanged: number;
};

function normalizeStatus(status: string | undefined): 'Enable' | 'Disable' {
    return status?.toUpperCase() === 'DISABLE' ? 'Disable' : 'Enable';
}

export function toSnapshotRecords(records: DnsRecord[]): CurrentDnsSnapshotRecord[] {
    return records.map(record => ({
        recordId: record.RecordId,
        rr: record.RR.trim(),
        type: record.Type.trim().toUpperCase(),
        value: record.Value.trim(),
        ttl: record.TTL,
        status: normalizeStatus(record.Status),
    }));
}

function identity(record: DnsSnapshotRecord): string {
    const type = record.type.trim().toUpperCase();
    const caseInsensitiveValue = CASE_INSENSITIVE_VALUE_TYPES.has(type);
    return [
        record.rr.trim().toLowerCase(),
        type,
        caseInsensitiveValue ? record.value.trim().toLowerCase() : record.value.trim(),
    ].join('\u0000');
}

function isSnapshotRecord(value: unknown): value is DnsSnapshotRecord {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return (
        typeof record.rr === 'string' &&
        typeof record.type === 'string' &&
        typeof record.value === 'string' &&
        Number.isInteger(record.ttl) &&
        Number(record.ttl) > 0 &&
        (record.status === 'Enable' || record.status === 'Disable')
    );
}

function isDomainSnapshot(value: unknown): value is DomainSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snapshot = value as Record<string, unknown>;
    return (
        typeof snapshot.id === 'string' &&
        typeof snapshot.keyId === 'string' &&
        typeof snapshot.domain === 'string' &&
        typeof snapshot.label === 'string' &&
        typeof snapshot.createdAt === 'string' &&
        !Number.isNaN(Date.parse(snapshot.createdAt)) &&
        Array.isArray(snapshot.records) &&
        snapshot.records.every(isSnapshotRecord)
    );
}

export function validateDnsSnapshots(value: unknown): DomainSnapshot[] {
    if (!Array.isArray(value) || !value.every(isDomainSnapshot)) {
        throw new Error('DNS 快照数据格式无效');
    }
    return value;
}

async function readSnapshots(): Promise<DomainSnapshot[]> {
    try {
        return validateDnsSnapshots(JSON.parse(await fs.readFile(getSnapshotFile(), 'utf8')));
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

async function writeSnapshots(snapshots: DomainSnapshot[]): Promise<void> {
    const dataDir = getDataDir();
    const snapshotFile = getSnapshotFile();
    await fs.mkdir(dataDir, { recursive: true });
    const tempFile = `${snapshotFile}.${randomUUID()}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(snapshots, null, 2), 'utf8');
    try {
        await fs.rename(tempFile, snapshotFile);
    } finally {
        await fs.rm(tempFile, { force: true });
    }
}

export async function createDomainSnapshot(
    keyId: string,
    domain: string,
    records: DnsRecord[],
    label = '手动快照'
): Promise<DomainSnapshot> {
    return enqueueSnapshotMutation(async () => {
        const snapshots = await readSnapshots();
        const snapshot: DomainSnapshot = {
            id: randomUUID(),
            keyId,
            domain: domain.trim().toLowerCase(),
            label: label.trim().slice(0, 80) || '手动快照',
            createdAt: new Date().toISOString(),
            records: toSnapshotRecords(records).map(record => ({
                rr: record.rr,
                type: record.type,
                value: record.value,
                ttl: record.ttl,
                status: record.status,
            })),
        };
        const sameDomain = snapshots.filter(item => item.keyId === keyId && item.domain === snapshot.domain);
        const retainedIds = new Set(sameDomain.slice(0, MAX_SNAPSHOTS_PER_DOMAIN - 1).map(item => item.id));
        const retained = snapshots.filter(item =>
            item.keyId !== keyId || item.domain !== snapshot.domain || retainedIds.has(item.id)
        );
        await writeSnapshots([snapshot, ...retained]);
        return snapshot;
    });
}

export async function listDomainSnapshots(keyId: string, domain: string): Promise<DomainSnapshot[]> {
    const normalizedDomain = domain.trim().toLowerCase();
    return (await readSnapshots()).filter(snapshot =>
        snapshot.keyId === keyId && snapshot.domain === normalizedDomain
    );
}

export async function getDomainSnapshot(id: string): Promise<DomainSnapshot | null> {
    return (await readSnapshots()).find(snapshot => snapshot.id === id) || null;
}

export function createDnsRestorePlan(
    currentRecords: DnsRecord[] | CurrentDnsSnapshotRecord[],
    targetRecords: DnsSnapshotRecord[]
): DnsRestorePlan {
    const current = currentRecords.length > 0 && 'RecordId' in currentRecords[0]
        ? toSnapshotRecords(currentRecords as DnsRecord[])
        : currentRecords as CurrentDnsSnapshotRecord[];
    const currentByIdentity = new Map(current.map(record => [identity(record), record]));
    const targetByIdentity = new Map(targetRecords.map(record => [identity(record), record]));
    const plan: DnsRestorePlan = { add: [], update: [], delete: [], unchanged: 0 };

    for (const target of targetRecords) {
        const existing = currentByIdentity.get(identity(target));
        if (!existing) {
            plan.add.push(target);
        } else if (existing.ttl !== target.ttl || existing.status !== target.status) {
            plan.update.push({ current: existing, target });
        } else {
            plan.unchanged += 1;
        }
    }

    for (const existing of current) {
        if (!targetByIdentity.has(identity(existing))) plan.delete.push(existing);
    }

    return plan;
}

export async function readDnsSnapshotsForBackup(): Promise<DomainSnapshot[]> {
    return readSnapshots();
}

export async function replaceDnsSnapshotsFromBackup(snapshots: DomainSnapshot[]): Promise<void> {
    await enqueueSnapshotMutation(() => writeSnapshots(validateDnsSnapshots(snapshots)));
}
