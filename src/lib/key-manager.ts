import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { AccessKey } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'access_keys.json');

// Encryption Config
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
export const ACCESS_KEY_READ_ERROR_MESSAGE =
    '无法读取本地 AccessKey 数据。请确认 ENCRYPTION_KEY 与保存数据时一致，并检查 data/access_keys.json 是否损坏。请勿继续写入，建议先备份 data 目录。';

export class AccessKeyReadError extends Error {
    constructor() {
        super(ACCESS_KEY_READ_ERROR_MESSAGE);
        this.name = 'AccessKeyReadError';
    }
}

// Use ENCRYPTION_KEY from env, or a fallback for development (NOT recommended for production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
    ? crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY.trim()).digest()
    : Buffer.from('884c7827829774574945417855b5550c605a96752718e27c9d92e59266e7f86d', 'hex');

function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(base64Data: string): string {
    const data = Buffer.from(base64Data, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function getSafeErrorMessage(error: unknown): string {
    return error instanceof Error && error.message.trim() ? error.message : 'Unknown error';
}

function isAccessKey(value: unknown): value is AccessKey {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const key = value as Record<string, unknown>;
    return (
        typeof key.id === 'string' &&
        typeof key.name === 'string' &&
        typeof key.accessKeyId === 'string' &&
        typeof key.accessKeySecret === 'string' &&
        typeof key.createdAt === 'string'
    );
}

export function validateAccessKeyBackupData(data: string): void {
    const parsed = data.trim().startsWith('[')
        ? JSON.parse(data)
        : JSON.parse(decrypt(data));

    if (!Array.isArray(parsed) || !parsed.every(isAccessKey)) {
        throw new AccessKeyReadError();
    }
}

export async function readAccessKeyBackupData(): Promise<string | null> {
    await ensureDataDir();

    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        validateAccessKeyBackupData(data);
        return data;
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }

        if (error instanceof AccessKeyReadError) {
            throw error;
        }

        console.error('读取 AccessKey 备份数据失败:', getSafeErrorMessage(error));
        throw new AccessKeyReadError();
    }
}

// Ensure data directory exists
const ensureDataDir = async () => {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
};

export async function getAccessKeys(): Promise<AccessKey[]> {
    await ensureDataDir();
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        if (!data) return [];
        // Detect if content is encrypted (simple check for JSON structure)
        if (data.trim().startsWith('[')) {
            // Migrating plain text to encrypted if first read happens
            const keys = JSON.parse(data);
            await saveAccessKeys(keys); // Re-save with encryption
            return keys;
        }
        return JSON.parse(decrypt(data));
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }

        console.error('获取 AccessKeys 失败，可能是加密密钥 (ENCRYPTION_KEY) 不匹配或文件损坏:', getSafeErrorMessage(error));
        throw new AccessKeyReadError();
    }
}

async function saveAccessKeys(keys: AccessKey[]): Promise<void> {
    const data = encrypt(JSON.stringify(keys));
    await fs.writeFile(DATA_FILE, data);
}

export async function saveAccessKey(key: AccessKey): Promise<void> {
    const keys = await getAccessKeys();
    keys.push(key);
    await saveAccessKeys(keys);
}

export async function updateAccessKey(updatedKey: AccessKey): Promise<void> {
    const keys = await getAccessKeys();
    const newKeys = keys.map((key) => (key.id === updatedKey.id ? updatedKey : key));
    await saveAccessKeys(newKeys);
}

export async function deleteAccessKey(id: string): Promise<void> {
    const keys = await getAccessKeys();
    const newKeys = keys.filter((k) => k.id !== id);
    await saveAccessKeys(newKeys);
}

export async function getAccessKeyById(id: string): Promise<AccessKey | undefined> {
    const keys = await getAccessKeys();
    return keys.find((k) => k.id === id);
}

