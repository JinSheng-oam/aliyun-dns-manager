const AUTH_COOKIE_NAME = 'admin_auth';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface SessionPayload {
    exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
    let binary = '';

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + padding);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

async function signValue(value: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
    return toBase64Url(new Uint8Array(signature));
}

function getSessionSecret(): string | null {
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();

    if (!adminPassword) {
        return null;
    }

    return process.env.SESSION_SECRET?.trim() || adminPassword;
}

export function getAuthCookieName(): string {
    return AUTH_COOKIE_NAME;
}

export function getSessionMaxAgeSeconds(): number {
    return SESSION_MAX_AGE_SECONDS;
}

export function isAdminAuthConfigured(): boolean {
    return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export async function createAdminSessionToken(): Promise<string | null> {
    const secret = getSessionSecret();

    if (!secret) {
        return null;
    }

    const payload: SessionPayload = {
        exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    };
    const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
    const signature = await signValue(encodedPayload, secret);

    return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<boolean> {
    if (!token) {
        return false;
    }

    const secret = getSessionSecret();

    if (!secret) {
        return false;
    }

    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
        return false;
    }

    const expectedSignature = await signValue(encodedPayload, secret);

    if (signature !== expectedSignature) {
        return false;
    }

    try {
        const payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload))) as SessionPayload;
        return typeof payload.exp === 'number' && payload.exp > Date.now();
    } catch {
        return false;
    }
}
