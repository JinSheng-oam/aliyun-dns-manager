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
import { logOperation, getLogs } from '@/lib/logger';
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

type BatchOperationError = {
    error: string;
    id?: string;
    record?: { rr: string; type: string; value: string; ttl: number };
};

function getRequestIp(forwardedFor: string | null): string {
    return forwardedFor?.split(',')[0]?.trim() || 'unknown';
}

function isBatchOperationError(result: void | BatchOperationError): result is BatchOperationError {
    return Boolean(result && result.error);
}

async function isCurrentAdminSessionValid(): Promise<boolean> {
    const cookieStore = await cookies();
    return verifyAdminSessionToken(cookieStore.get(getAuthCookieName())?.value);
}

export async function getAccessKeysAction() {
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
    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await AliyunDnsClient.addRecord(key.accessKeyId, key.accessKeySecret, domain, rr, type, value, ttl);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Add DNS Record', `Domain: ${domain}, RR: ${rr}, Type: ${type}, Value: ${value}`, 'success', ip);

        revalidatePath('/dns');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to add DNS record');
        await logOperation('Add DNS Record', `Failed - Domain: ${domain}, RR: ${rr}`, 'failure', ip, message);
        return { success: false, error: message };
    }
}

export async function updateDnsRecordAction(keyId: string, recordId: string, rr: string, type: string, value: string, ttl: number = 600) {
    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await AliyunDnsClient.updateRecord(key.accessKeyId, key.accessKeySecret, recordId, rr, type, value, ttl);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Update DNS Record', `RecordId: ${recordId}, RR: ${rr}, Type: ${type}, Value: ${value}`, 'success', ip);

        revalidatePath('/dns');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to update DNS record');
        await logOperation('Update DNS Record', `Failed - RecordId: ${recordId}`, 'failure', ip, message);
        return { success: false, error: message };
    }
}

export async function deleteDnsRecordAction(keyId: string, recordId: string) {
    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await AliyunDnsClient.deleteRecord(key.accessKeyId, key.accessKeySecret, recordId);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Delete DNS Record', `RecordId: ${recordId}`, 'success', ip);

        revalidatePath('/dns');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to delete DNS record');
        await logOperation('Delete DNS Record', `Failed - RecordId: ${recordId}`, 'failure', ip, message);
        return { success: false, error: message };
    }
}

export async function setDnsRecordStatusAction(keyId: string, recordId: string, status: 'Enable' | 'Disable') {
    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        await AliyunDnsClient.setRecordStatus(key.accessKeyId, key.accessKeySecret, recordId, status);

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Set DNS Status', `RecordId: ${recordId}, Status: ${status}`, 'success', ip);

        revalidatePath('/dns');
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to set DNS record status');
        await logOperation('Set DNS Status', `Failed - RecordId: ${recordId}`, 'failure', ip, message);
        return { success: false, error: message };
    }
}

export async function batchDeleteDnsRecordsAction(keyId: string, recordIds: string[]) {
    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        const promises = recordIds.map(id =>
            AliyunDnsClient.deleteRecord(key.accessKeyId, key.accessKeySecret, id)
                .catch(error => ({ error: getErrorMessage(error, 'Failed to delete DNS record'), id }))
        );

        const results = await Promise.all(promises);
        const errors = results.filter(isBatchOperationError);

        revalidatePath('/dns');

        if (errors.length > 0) {
            const ip = getRequestIp((await headers()).get('x-forwarded-for'));
            await logOperation('Batch Delete DNS', `Failed to delete ${errors.length}/${recordIds.length} records`, 'failure', ip, JSON.stringify(errors));
            return { success: false, error: `部分删除失败: ${errors.length} 条记录未删除` };
        }

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Batch Delete DNS', `Deleted ${recordIds.length} records`, 'success', ip);
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to delete records');
        await logOperation('Batch Delete DNS', `Failed to delete records`, 'failure', ip, message);
        return { success: false, error: message };
    }
}

export async function batchSetDnsRecordsStatusAction(keyId: string, recordIds: string[], status: 'Enable' | 'Disable') {
    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        const promises = recordIds.map(id =>
            AliyunDnsClient.setRecordStatus(key.accessKeyId, key.accessKeySecret, id, status)
                .catch(error => ({ error: getErrorMessage(error, 'Failed to set DNS record status'), id }))
        );

        const results = await Promise.all(promises);
        const errors = results.filter(isBatchOperationError);

        revalidatePath('/dns');

        if (errors.length > 0) {
            const ip = getRequestIp((await headers()).get('x-forwarded-for'));
            await logOperation('Batch Set Status', `Failed to set status ${status} for ${errors.length}/${recordIds.length} records`, 'failure', ip, JSON.stringify(errors));
            return { success: false, error: `部分状态更新失败: ${errors.length} 条记录未更新` };
        }

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Batch Set Status', `Set status ${status} for ${recordIds.length} records`, 'success', ip);
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to set status');
        await logOperation('Batch Set Status', `Failed to set status`, 'failure', ip, message);
        return { success: false, error: message };
    }
}

export async function batchAddDnsRecordsAction(keyId: string, domain: string, records: { rr: string, type: string, value: string, ttl: number }[]) {
    try {
        const key = await getAccessKeyById(keyId);
        if (!key) throw new Error('Access Key not found');

        const promises = records.map(record =>
            AliyunDnsClient.addRecord(key.accessKeyId, key.accessKeySecret, domain, record.rr, record.type, record.value, record.ttl)
                .catch(error => ({ error: getErrorMessage(error, 'Failed to add DNS record'), record }))
        );

        const results = await Promise.all(promises);
        const errors = results.filter(isBatchOperationError);

        revalidatePath('/dns');

        if (errors.length > 0) {
            const ip = getRequestIp((await headers()).get('x-forwarded-for'));
            await logOperation('Batch Add DNS', `Failed to add ${errors.length}/${records.length} records`, 'failure', ip, JSON.stringify(errors));
            return { success: false, error: `部分添加失败: ${errors.length} 条记录未添加`, errors };
        }

        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        await logOperation('Batch Add DNS', `Added ${records.length} records`, 'success', ip);
        return { success: true };
    } catch (error: unknown) {
        const ip = getRequestIp((await headers()).get('x-forwarded-for'));
        const message = getErrorMessage(error, 'Failed to add records');
        await logOperation('Batch Add DNS', `Failed to add records`, 'failure', ip, message);
        return { success: false, error: message };
    }
}

// Logs Actions

export async function getLogsAction() {
    try {
        const logs = await getLogs();
        return { success: true, data: logs };
    } catch {
        return { success: false, error: 'Failed to fetch logs' };
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
    if (!(await isCurrentAdminSessionValid())) {
        return { success: false, error: '登录会话已失效，请重新登录' };
    }

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
