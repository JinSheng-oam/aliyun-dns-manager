import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { AccessKey } from './types';
import { getErrorMessage } from './errors';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'access_keys.json');

// Encryption Config
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
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
        console.error('获取 AccessKeys 失败，可能是加密密钥 (ENCRYPTION_KEY) 不匹配或文件损坏:', getErrorMessage(error));
        return [];
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

