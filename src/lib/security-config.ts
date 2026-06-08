export type SecurityConfigStatus = 'ok' | 'warning' | 'danger';

export interface SecurityConfigItem {
    key: string;
    title: string;
    status: SecurityConfigStatus;
    summary: string;
    advice: string;
}

function getTrimmedEnv(name: string): string {
    return process.env[name]?.trim() || '';
}

function isPlaceholderValue(value: string): boolean {
    return (
        value.startsWith('your_') ||
        value === 'changeme' ||
        value === 'password' ||
        value === '123' ||
        value === '123456'
    );
}

function getSecretCheck(
    name: string,
    required: boolean,
    configuredSummary: string,
    missingSummary: string,
    minLength: number
): Pick<SecurityConfigItem, 'status' | 'summary'> {
    const value = getTrimmedEnv(name);

    if (!value) {
        return {
            status: required ? 'danger' : 'warning',
            summary: missingSummary,
        };
    }

    if (isPlaceholderValue(value) || value.length < minLength) {
        return {
            status: 'danger',
            summary: '当前值过短或仍为示例值',
        };
    }

    return {
        status: 'ok',
        summary: configuredSummary,
    };
}

export function getSecurityConfigItems(): SecurityConfigItem[] {
    const useSecureCookie = getTrimmedEnv('FORCE_HTTPS_COOKIE') === 'true';
    const adminPassword = getSecretCheck(
        'ADMIN_PASSWORD',
        true,
        '已配置强度合适的登录密码',
        '未配置登录密码',
        12
    );
    const sessionSecret = getSecretCheck(
        'SESSION_SECRET',
        false,
        '已配置独立会话密钥',
        '未配置独立会话密钥',
        32
    );
    const encryptionKey = getSecretCheck(
        'ENCRYPTION_KEY',
        false,
        '已配置本地数据加密',
        '未配置本地数据加密',
        16
    );

    return [
        {
            key: 'ADMIN_PASSWORD',
            title: '管理员密码',
            ...adminPassword,
            advice: '正式使用前请设置强密码，避免使用示例值或弱密码。',
        },
        {
            key: 'SESSION_SECRET',
            title: '会话签名密钥',
            ...sessionSecret,
            advice: '建议设置独立随机字符串，避免会话签名依赖管理员密码。',
        },
        {
            key: 'ENCRYPTION_KEY',
            title: '本地数据加密密钥',
            ...encryptionKey,
            advice: '建议设置后妥善保存；变更此值会导致旧 AccessKey 数据无法读取。',
        },
        {
            key: 'FORCE_HTTPS_COOKIE',
            title: 'HTTPS Cookie',
            status: useSecureCookie ? 'ok' : 'warning',
            summary: useSecureCookie ? '已启用 HTTPS Cookie' : '未强制 HTTPS Cookie',
            advice: '通过 HTTPS 和反向代理公开访问时建议设为 true；纯 HTTP 本地访问请保持关闭。',
        },
    ];
}
