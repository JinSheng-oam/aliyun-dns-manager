'use server';

import {
    getAccessKeys,
    saveAccessKey,
    updateAccessKey,
    deleteAccessKey,
    getAccessKeyById,
    AccessKeyReadError,
} from '@/lib/key-manager';
import { AliyunDnsClient } from '@/lib/aliyun-dns';
import { AccessKey } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { filterDnsChangeLogs, logOperation, getLogs, type DnsChangeContext, type DnsChangeRecord } from '@/lib/logger';
import { isRateLimited, recordLoginFailure, clearLoginFailures } from '@/lib/rate-limit';
import {
    createAdminSessionToken,
    getAuthCookieName,
    getSessionMaxAgeSeconds,
    isAdminAuthConfigured,
    verifyAdminSessionToken,
} from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { createAppDataBackup, parseAndValidateBackup, restoreAppDataBackup } from '@/lib/backup-manager';
import { mapWithConcurrency } from '@/lib/batch';
import {
    createDnsRestorePlan,
    createDomainSnapshot,
    getDomainSnapshot,
    listDomainSnapshots,
    type DnsRestorePlan,
} from '@/lib/dns-snapshots';
import { analyzeDnsRecords, appendDnsResolutionIssues } from '@/lib/dns-health';
import { checkLiveDnsResolution } from '@/lib/dns-health-live';
import { isReadOnlyModeEnabled } from '@/lib/security-config';

const DNS_BATCH_CONCURRENCY = 5;

type BatchOperationError = {
    error: string;
    id?: string;
    label: string;
    record?: { rr: string; type: string; value: string; ttl: number; status?: 'Enable' | 'Disable' };
};

type BatchOperationSummary = {
    total: number;
    succeeded: number;
    failed: number;
};

function getRequestIp(forwardedFor: string | null): string {
    return forwardedFor?.split(',')[0]?.trim() || 'unknown';
}

function isBatchOperationError(result: BatchOperationError | undefined): result is BatchOperationError {
    return Boolean(result && result.error);
}

function summarizeBatch(total: number, failures: BatchOperationError[]): BatchOperationSummary {
    return { total, succeeded: total - failures.length, failed: failures.length };
}

function dnsChangeContext(
    domain: string,
    operation: DnsChangeContext['operation'],
    records: DnsChangeRecord[],
    extra?: Pick<DnsChangeContext, 'before' | 'after'>
): DnsChangeContext {
    return { category: 'dns-change', domain, operation, records, ...extra };
}

async function createAutomaticDnsSnapshot(
    keyId: string,
    domain: string,
    key: AccessKey,
    label: string
): Promise<void> {
    const records = await AliyunDnsClient.listRecords(key.accessKeyId, key.accessKeySecret, domain);
    await createDomainSnapshot(keyId, domain, records, label);
}

async function applyDnsRestorePlan(key: AccessKey, domain: string, plan: DnsRestorePlan): Promise<void> {
    // Remove conflicting records first; the caller always creates a rollback snapshot before applying the plan.
    for (const record of plan.delete) {
        await AliyunDnsClient.deleteRecord(key.accessKeyId, key.accessKeySecret, record.recordId);
    }

    for (const change of plan.update) {
        if (change.current.ttl !== change.target.ttl) {
            await AliyunDnsClient.updateRecord(
                key.accessKeyId, key.accessKeySecret, change.current.recordId,
                change.target.rr, change.target.type, change.target.value, change.target.ttl
            );
        }
        if (change.current.status !== change.target.status) {
            await AliyunDnsClient.setRecordStatus(
                key.accessKeyId, key.accessKeySecret, change.current.recordId, change.target.status
            );
        }
    }

    for (const record of plan.add) {
        const recordId = await AliyunDnsClient.addRecord(
            key.accessKeyId, key.accessKeySecret, domain,
            record.rr, record.type, record.value, record.ttl
        );
        if (record.status === 'Disable') {
            await AliyunDnsClient.setRecordStatus(key.accessKeyId, key.accessKeySecret, recordId, 'Disable');
        }
    }
}

async function isCurrentAdminSessionValid(): Promise<boolean> {
    const cookieStore = await cookies();
    return verifyAdminSessionToken(cookieStore.get(getAuthCookieName())?.value);
}

async function getSessionRejection(): Promise<{ success: false; error: string } | null> {
    return (await isCurrentAdminSessionValid())
        ? null
        : { success: false, error: '登录会话已失效，请重新登录' };
}

async function getMutationRejection(): Promise<{ success: false; error: string } | null> {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;
    return isReadOnlyModeEnabled()
        ? { success: false, error: '当前运行在只读模式，写操作已被服务器阻止' }
        : null;
}

export async function getAccessKeysAction() {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const keys = await getAccessKeys();
        return { success: true, data: keys };
    } catch (error: unknown) {
        return {
            success: false,
            error: error instanceof AccessKeyReadError
                ? error.message
                : '读取 AccessKey 数据失败，请检查服务器日志。',
        };
    }
}

export async function addAccessKeyAction(name: string, accessKeyId: string, accessKeySecret: string) {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const newKey: AccessKey = {
            id: Math.random().toString(36).substring(7),
            name,
            accessKeyId,
            accessKeySecret,
            createdAt: new Date().toISOString(),
        };
        await saveAccessKey(newKey);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Add AccessKey', `Added key: ${name} (${accessKeyId})`, 'success', ip);

        revalidatePath('/keys');
        revalidatePath('/dns');
        revalidatePath('/');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Add AccessKey', `Failed to add key: ${name}`, 'failure', ip, getErrorMessage(error));
        return {
            success: false,
            error: error instanceof AccessKeyReadError ? error.message : '添加 AccessKey 失败',
        };
    }
}

export async function deleteAccessKeyAction(id: string) {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        await deleteAccessKey(id);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Delete AccessKey', `Deleted key ID: ${id}`, 'success', ip);

        revalidatePath('/keys');
        revalidatePath('/dns');
        revalidatePath('/');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Delete AccessKey', `Failed to delete key ID: ${id}`, 'failure', ip, getErrorMessage(error));
        return {
            success: false,
            error: error instanceof AccessKeyReadError ? error.message : '删除 AccessKey 失败',
        };
    }
}

export async function updateAccessKeyAction(id: string, name: string, accessKeyId: string, accessKeySecret: string) {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const existingKey = await getAccessKeyById(id);
        if (!existingKey) {
            return { success: false, error: 'Access key not found' };
        }

        await updateAccessKey({
            ...existingKey,
            name,
            accessKeyId,
            accessKeySecret,
        });

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Update AccessKey', `Updated key: ${name} (${accessKeyId})`, 'success', ip);

        revalidatePath('/keys');
        revalidatePath('/dns');
        revalidatePath('/');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Update AccessKey', `Failed to update key ID: ${id}`, 'failure', ip, getErrorMessage(error));
        return {
            success: false,
            error: error instanceof AccessKeyReadError ? error.message : '修改 AccessKey 失败',
        };
    }
}

// DNS Actions

export async function listDomainsAction(keyId: string) {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        const domains = await AliyunDnsClient.listDomains(key.accessKeyId, key.accessKeySecret);
        return { success: true, data: domains };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error, 'Failed to fetch domains') };
    }
}

export async function listDnsRecordsAction(keyId: string, domain: string) {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        const records = await AliyunDnsClient.listRecords(key.accessKeyId, key.accessKeySecret, domain);
        return { success: true, data: records };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error, 'Failed to fetch DNS records') };
    }
}

export async function addDnsRecordAction(keyId: string, domain: string, rr: string, type: string, value: string, ttl: number = 600) {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await createAutomaticDnsSnapshot(keyId, domain, key, '添加记录前自动快照');
        await AliyunDnsClient.addRecord(key.accessKeyId, key.accessKeySecret, domain, rr, type, value, ttl);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const record = { rr, type, value, ttl, status: 'Enable' as const };
        await logOperation('Add DNS Record', `Domain: ${domain}, RR: ${rr}, Type: ${type}, Value: ${value}`, 'success', ip, undefined, dnsChangeContext(domain, 'add', [record]));

        revalidatePath('/dns');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to add DNS record');
        const record = { rr, type, value, ttl, status: 'Enable' as const };
        await logOperation('Add DNS Record', `Failed - Domain: ${domain}, RR: ${rr}`, 'failure', ip, message, dnsChangeContext(domain, 'add', [record]));
        return { success: false, error: message };
    }
}

export async function updateDnsRecordAction(keyId: string, domain: string, previous: DnsChangeRecord, rr: string, type: string, value: string, ttl: number = 600) {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await createAutomaticDnsSnapshot(keyId, domain, key, '修改记录前自动快照');
        await AliyunDnsClient.updateRecord(key.accessKeyId, key.accessKeySecret, previous.recordId!, rr, type, value, ttl);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const after = { ...previous, rr, type, value, ttl };
        await logOperation('Update DNS Record', `RecordId: ${previous.recordId}, RR: ${rr}, Type: ${type}, Value: ${value}`, 'success', ip, undefined, dnsChangeContext(domain, 'update', [after], { before: previous, after }));

        revalidatePath('/dns');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to update DNS record');
        const after = { ...previous, rr, type, value, ttl };
        await logOperation('Update DNS Record', `Failed - RecordId: ${previous.recordId}`, 'failure', ip, message, dnsChangeContext(domain, 'update', [after], { before: previous, after }));
        return { success: false, error: message };
    }
}

export async function deleteDnsRecordAction(keyId: string, domain: string, record: DnsChangeRecord) {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await createAutomaticDnsSnapshot(keyId, domain, key, '删除记录前自动快照');
        await AliyunDnsClient.deleteRecord(key.accessKeyId, key.accessKeySecret, record.recordId!);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Delete DNS Record', `RecordId: ${record.recordId}`, 'success', ip, undefined, dnsChangeContext(domain, 'delete', [record]));

        revalidatePath('/dns');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to delete DNS record');
        await logOperation('Delete DNS Record', `Failed - RecordId: ${record.recordId}`, 'failure', ip, message, dnsChangeContext(domain, 'delete', [record]));
        return { success: false, error: message };
    }
}

export async function setDnsRecordStatusAction(keyId: string, domain: string, record: DnsChangeRecord, status: 'Enable' | 'Disable') {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await createAutomaticDnsSnapshot(keyId, domain, key, '修改记录状态前自动快照');
        await AliyunDnsClient.setRecordStatus(key.accessKeyId, key.accessKeySecret, record.recordId!, status);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const changedRecord = { ...record, status };
        await logOperation('Set DNS Status', `RecordId: ${record.recordId}, Status: ${status}`, 'success', ip, undefined, dnsChangeContext(domain, 'status', [changedRecord]));

        revalidatePath('/dns');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to set DNS record status');
        const changedRecord = { ...record, status };
        await logOperation('Set DNS Status', `Failed - RecordId: ${record.recordId}`, 'failure', ip, message, dnsChangeContext(domain, 'status', [changedRecord]));
        return { success: false, error: message };
    }
}

export async function batchDeleteDnsRecordsAction(keyId: string, domain: string, records: DnsChangeRecord[]) {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await createAutomaticDnsSnapshot(keyId, domain, key, '批量删除前自动快照');
        const results = await mapWithConcurrency<DnsChangeRecord, BatchOperationError | undefined>(records, DNS_BATCH_CONCURRENCY, async record => {
            try {
                await AliyunDnsClient.deleteRecord(key.accessKeyId, key.accessKeySecret, record.recordId!);
                return undefined;
            } catch (error) {
                return {
                    error: getErrorMessage(error, 'Failed to delete DNS record'),
                    id: record.recordId,
                    label: `${record.rr} ${record.type} ${record.value}`,
                };
            }
        });
        const errors = results.filter(isBatchOperationError);
        const summary = summarizeBatch(records.length, errors);

        revalidatePath('/dns');

        if (errors.length > 0) {
            const ip = getRequestIp((await headers()).get('x-forwarded-for'));
            await logOperation('Batch Delete DNS', `Failed to delete ${errors.length}/${records.length} records`, 'failure', ip, JSON.stringify(errors), dnsChangeContext(domain, 'batch-delete', records));
            return { success: false, error: `批量删除完成，${errors.length} 条记录删除失败`, summary, failures: errors };
        }

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Batch Delete DNS', `Deleted ${records.length} records`, 'success', ip, undefined, dnsChangeContext(domain, 'batch-delete', records));
        return { success: true, summary, failures: [] as BatchOperationError[] };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to delete records');
        await logOperation('Batch Delete DNS', `Failed to delete records`, 'failure', ip, message, dnsChangeContext(domain, 'batch-delete', records));
        return { success: false, error: message };
    }
}

export async function batchSetDnsRecordsStatusAction(keyId: string, domain: string, records: DnsChangeRecord[], status: 'Enable' | 'Disable') {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await createAutomaticDnsSnapshot(keyId, domain, key, `批量${status === 'Enable' ? '启用' : '暂停'}前自动快照`);
        const results = await mapWithConcurrency<DnsChangeRecord, BatchOperationError | undefined>(records, DNS_BATCH_CONCURRENCY, async record => {
            try {
                await AliyunDnsClient.setRecordStatus(key.accessKeyId, key.accessKeySecret, record.recordId!, status);
                return undefined;
            } catch (error) {
                return {
                    error: getErrorMessage(error, 'Failed to set DNS record status'),
                    id: record.recordId,
                    label: `${record.rr} ${record.type} ${record.value}`,
                };
            }
        });
        const errors = results.filter(isBatchOperationError);
        const summary = summarizeBatch(records.length, errors);

        revalidatePath('/dns');

        if (errors.length > 0) {
            const ip = getRequestIp((await headers()).get('x-forwarded-for'));
            const changedRecords = records.map(record => ({ ...record, status }));
            await logOperation('Batch Set Status', `Failed to set status ${status} for ${errors.length}/${records.length} records`, 'failure', ip, JSON.stringify(errors), dnsChangeContext(domain, 'batch-status', changedRecords));
            return { success: false, error: `批量状态更新完成，${errors.length} 条记录更新失败`, summary, failures: errors };
        }

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const changedRecords = records.map(record => ({ ...record, status }));
        await logOperation('Batch Set Status', `Set status ${status} for ${records.length} records`, 'success', ip, undefined, dnsChangeContext(domain, 'batch-status', changedRecords));
        return { success: true, summary, failures: [] as BatchOperationError[] };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to set status');
        const changedRecords = records.map(record => ({ ...record, status }));
        await logOperation('Batch Set Status', `Failed to set status`, 'failure', ip, message, dnsChangeContext(domain, 'batch-status', changedRecords));
        return { success: false, error: message };
    }
}

export async function batchAddDnsRecordsAction(
    keyId: string,
    domain: string,
    records: { rr: string; type: string; value: string; ttl: number; status?: 'Enable' | 'Disable' }[]
) {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await createAutomaticDnsSnapshot(keyId, domain, key, '批量导入前自动快照');
        const results = await mapWithConcurrency<typeof records[number], BatchOperationError | undefined>(records, DNS_BATCH_CONCURRENCY, async record => {
            try {
                const recordId = await AliyunDnsClient.addRecord(
                    key.accessKeyId,
                    key.accessKeySecret,
                    domain,
                    record.rr,
                    record.type,
                    record.value,
                    record.ttl
                );
                if (record.status === 'Disable') {
                    try {
                        await AliyunDnsClient.setRecordStatus(
                            key.accessKeyId,
                            key.accessKeySecret,
                            recordId,
                            'Disable'
                        );
                    } catch (error) {
                        await AliyunDnsClient.deleteRecord(
                            key.accessKeyId,
                            key.accessKeySecret,
                            recordId
                        ).catch(() => undefined);
                        throw error;
                    }
                }
            } catch (error) {
                return {
                    error: getErrorMessage(error, 'Failed to add DNS record'),
                    label: `${record.rr} ${record.type} ${record.value}`,
                    record,
                };
            }
        });
        const errors = results.filter(isBatchOperationError);
        const summary = summarizeBatch(records.length, errors);

        revalidatePath('/dns');

        if (errors.length > 0) {
            const ip = getRequestIp((await headers()).get('x-forwarded-for'));
            await logOperation('Batch Add DNS', `Failed to add ${errors.length}/${records.length} records`, 'failure', ip, JSON.stringify(errors), dnsChangeContext(domain, 'batch-add', records));
            return { success: false, error: `批量导入完成，${errors.length} 条记录添加失败`, summary, failures: errors };
        }

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Batch Add DNS', `Added ${records.length} records`, 'success', ip, undefined, dnsChangeContext(domain, 'batch-add', records));
        return { success: true, summary, failures: [] as BatchOperationError[] };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to add records');
        await logOperation('Batch Add DNS', `Failed to add records`, 'failure', ip, message, dnsChangeContext(domain, 'batch-add', records));
        return { success: false, error: message };
    }
}

// DNS snapshots and restore

export async function createDnsSnapshotAction(keyId: string, domain: string, label?: string) {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');
        const records = await AliyunDnsClient.listRecords(key.accessKeyId, key.accessKeySecret, domain);
        const snapshot = await createDomainSnapshot(keyId, domain, records, label || '手动快照');
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Create DNS Snapshot', `Domain: ${domain}, Records: ${records.length}`, 'success', ip);
        return { success: true, data: snapshot };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error, '创建 DNS 快照失败') };
    }
}

export async function listDnsSnapshotsAction(keyId: string, domain: string) {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        return { success: true, data: await listDomainSnapshots(keyId, domain) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error, '读取 DNS 快照失败') };
    }
}

export async function previewDnsSnapshotRestoreAction(keyId: string, domain: string, snapshotId: string) {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');
        const snapshot = await getDomainSnapshot(snapshotId);
        if (!snapshot || snapshot.keyId !== keyId || snapshot.domain !== domain.trim().toLowerCase()) {
            throw new Error('快照不存在或不属于当前域名和 AccessKey');
        }
        const current = await AliyunDnsClient.listRecords(key.accessKeyId, key.accessKeySecret, domain);
        return { success: true, data: { snapshot, plan: createDnsRestorePlan(current, snapshot.records) } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error, '生成恢复预览失败') };
    }
}

export async function restoreDnsSnapshotAction(keyId: string, domain: string, snapshotId: string) {
    const sessionRejection = await getMutationRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');
        const snapshot = await getDomainSnapshot(snapshotId);
        if (!snapshot || snapshot.keyId !== keyId || snapshot.domain !== domain.trim().toLowerCase()) {
            throw new Error('快照不存在或不属于当前域名和 AccessKey');
        }

        const current = await AliyunDnsClient.listRecords(key.accessKeyId, key.accessKeySecret, domain);
        const safetySnapshot = await createDomainSnapshot(keyId, domain, current, '恢复前自动快照');
        const plan = createDnsRestorePlan(current, snapshot.records);
        const summary = {
            add: plan.add.length,
            update: plan.update.length,
            delete: plan.delete.length,
            unchanged: plan.unchanged,
        };

        try {
            await applyDnsRestorePlan(key, domain, plan);
        } catch (restoreError: unknown) {
            try {
                const partialRecords = await AliyunDnsClient.listRecords(key.accessKeyId, key.accessKeySecret, domain);
                await applyDnsRestorePlan(key, domain, createDnsRestorePlan(partialRecords, safetySnapshot.records));
            } catch (rollbackError: unknown) {
                throw new Error(`恢复失败且自动回滚未完成：${getErrorMessage(rollbackError)}`);
            }
            throw new Error(`恢复失败，已自动回滚到操作前状态：${getErrorMessage(restoreError)}`);
        }

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const restoredRecords: DnsChangeRecord[] = snapshot.records.map(record => ({ ...record }));
        await logOperation(
            'Restore DNS Snapshot',
            `Domain: ${domain}, Snapshot: ${snapshot.id}, Add: ${summary.add}, Update: ${summary.update}, Delete: ${summary.delete}`,
            'success', ip, undefined, dnsChangeContext(domain, 'restore', restoredRecords)
        );
        revalidatePath('/dns');
        return { success: true, summary, safetySnapshotId: safetySnapshot.id };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, '恢复 DNS 快照失败');
        await logOperation('Restore DNS Snapshot', `Domain: ${domain}`, 'failure', ip, message);
        return { success: false, error: message };
    }
}

// DNS health checks are read-only and never mutate DNS data.

export async function checkDnsHealthAction(keyId: string, domain: string) {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');
        const records = await AliyunDnsClient.listRecords(key.accessKeyId, key.accessKeySecret, domain);
        const report = analyzeDnsRecords(domain, records);
        const liveIssues = await checkLiveDnsResolution(domain, records);
        return { success: true, data: appendDnsResolutionIssues(report, liveIssues) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error, 'DNS 健康检查失败') };
    }
}

export async function checkDomainHealthOverviewAction(keyId: string, domains: string[]) {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');
        const uniqueDomains = [...new Set(domains.map(domain => domain.trim().toLowerCase()).filter(Boolean))].slice(0, 200);
        const results = await mapWithConcurrency(uniqueDomains, 3, async domain => {
            try {
                const records = await AliyunDnsClient.listRecords(key.accessKeyId, key.accessKeySecret, domain);
                const report = analyzeDnsRecords(domain, records);
                return { domain, success: true as const, status: report.status, summary: report.summary };
            } catch (error: unknown) {
                return { domain, success: false as const, status: 'error' as const, error: getErrorMessage(error) };
            }
        });
        return { success: true, data: results };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error, '域名健康概览检查失败') };
    }
}

// Logs Actions

export async function getLogsAction() {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        const logs = await getLogs();
        return { success: true, data: logs };
    } catch {
        return { success: false, error: 'Failed to fetch logs' };
    }
}

export async function getDnsHistoryAction(domain: string) {
    const sessionRejection = await getSessionRejection();
    if (sessionRejection) return sessionRejection;

    try {
        return { success: true, data: filterDnsChangeLogs(await getLogs(), domain) };
    } catch {
        return { success: false, error: '读取 DNS 变更历史失败' };
    }
}

export async function createDataBackupAction() {
    if (!(await isCurrentAdminSessionValid())) {
        return { success: false, error: '登录会话已失效，请重新登录' };
    }

    try {
        const backup = await createAppDataBackup();
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Export Data Backup', 'Exported encrypted AccessKey data and operation logs', 'success', ip);
        return { success: true, data: JSON.stringify(backup, null, 2) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error, '创建备份失败') };
    }
}

export async function restoreDataBackupAction(content: string) {
    const mutationRejection = await getMutationRejection();
    if (mutationRejection) return mutationRejection;

    try {
        const backup = parseAndValidateBackup(content);
        await restoreAppDataBackup(backup);
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Restore Data Backup', `Restored backup created at ${backup.createdAt}`, 'success', ip);
        revalidatePath('/keys');
        revalidatePath('/dns');
        revalidatePath('/security');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, '恢复备份失败');
        await logOperation('Restore Data Backup', 'Failed to restore data backup', 'failure', ip, message);
        return { success: false, error: message };
    }
}

export async function loginAction(password: string) {
    if (!isAdminAuthConfigured()) {
        return { success: false, error: '服务器未配置 ADMIN_PASSWORD，已拒绝登录' };
    }
    const adminPassword = process.env.ADMIN_PASSWORD!.trim();

    const ip = getRequestIp((await headers()).get('x-forwarded-for'));

    if (isRateLimited(ip)) {
        const windowSeconds = Number(process.env.LOGIN_WINDOW_SECONDS) || 60;
        return { success: false, error: `登录失败次数过多，请等待 ${windowSeconds} 秒后再试` };
    }

    if (password.trim() === adminPassword) {
        clearLoginFailures(ip);
        const cookieStore = await cookies();
        // 注意：secure: true 要求 HTTPS。如果您使用 HTTP 部署（未配置反向代理 HTTPS），
        // 必须设置为 false，否则浏览器会拒绝保存 Cookie 导致登录失败。
        // 如果您配置了 HTTPS（如 Nginx 反向代理 + SSL），可设置环境变量 FORCE_HTTPS_COOKIE=true
        const useSecureCookie = process.env.FORCE_HTTPS_COOKIE === 'true';
        const sessionToken = await createAdminSessionToken();

        if (!sessionToken) {
            return { success: false, error: '服务器未配置会话密钥，无法创建登录会话' };
        }

        cookieStore.set(getAuthCookieName(), sessionToken, {
            httpOnly: true,
            secure: useSecureCookie,
            sameSite: 'lax',
            maxAge: getSessionMaxAgeSeconds(),
            path: '/',
        });

        await logOperation('Login', 'User logged in successfully', 'success', ip);
        return { success: true };
    }

    recordLoginFailure(ip);
    await logOperation('Login', 'Failed login attempt', 'failure', ip);
    return { success: false, error: '密码错误' };
}

export async function logoutAction() {
    const cookieStore = await cookies();
    cookieStore.delete(getAuthCookieName());
    revalidatePath('/');
}
