import { isIP } from 'net';
import type { DnsRecord } from './types';

export type DnsHealthSeverity = 'error' | 'warning' | 'info';
export type DnsHealthStatus = 'healthy' | 'warning' | 'error';

export type DnsHealthIssue = {
    code: string;
    severity: DnsHealthSeverity;
    title: string;
    message: string;
    suggestion: string;
    recordIds: string[];
};

export type DnsHealthReport = {
    domain: string;
    checkedAt: string;
    status: DnsHealthStatus;
    recordCount: number;
    enabledCount: number;
    issues: DnsHealthIssue[];
    summary: { errors: number; warnings: number; infos: number };
};

function enabled(record: DnsRecord): boolean {
    return record.Status?.toUpperCase() !== 'DISABLE';
}

function recordName(record: DnsRecord, domain: string): string {
    const rr = record.RR.trim();
    return rr === '@' || rr === '' ? domain : `${rr}.${domain}`;
}

function looksLikeHostname(value: string): boolean {
    const normalized = value.replace(/\.$/, '');
    return normalized.length <= 253 && normalized.split('.').every(label =>
        label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
    );
}

function reportStatus(issues: DnsHealthIssue[]): DnsHealthStatus {
    if (issues.some(issue => issue.severity === 'error')) return 'error';
    if (issues.some(issue => issue.severity === 'warning')) return 'warning';
    return 'healthy';
}

export function analyzeDnsRecords(domain: string, records: DnsRecord[]): DnsHealthReport {
    const issues: DnsHealthIssue[] = [];
    const activeRecords = records.filter(enabled);
    const groups = new Map<string, DnsRecord[]>();
    const exactRecords = new Map<string, DnsRecord[]>();

    if (records.length === 0) {
        issues.push({
            code: 'NO_RECORDS', severity: 'warning', title: '没有解析记录',
            message: `${domain} 当前没有任何 DNS 记录。`,
            suggestion: '确认域名是否刚添加，或至少配置网站、邮件等业务需要的记录。', recordIds: [],
        });
    }

    for (const record of records) {
        const name = recordName(record, domain).toLowerCase();
        const group = groups.get(name) || [];
        group.push(record);
        groups.set(name, group);
        const exactKey = `${name}\u0000${record.Type.toUpperCase()}\u0000${record.Value.trim().toLowerCase()}`;
        const duplicates = exactRecords.get(exactKey) || [];
        duplicates.push(record);
        exactRecords.set(exactKey, duplicates);

        if (!enabled(record)) {
            issues.push({
                code: 'DISABLED_RECORD', severity: 'warning', title: '记录已暂停',
                message: `${record.RR} ${record.Type} 不会参与公网解析。`,
                suggestion: '如果业务仍需要该记录，请确认后重新启用。', recordIds: [record.RecordId],
            });
        }
        if (record.TTL < 60) {
            issues.push({
                code: 'TTL_TOO_LOW', severity: 'error', title: 'TTL 过低',
                message: `${record.RR} ${record.Type} 的 TTL 为 ${record.TTL} 秒。`,
                suggestion: '建议将 TTL 调整到至少 60 秒；常规业务可使用 600 秒。', recordIds: [record.RecordId],
            });
        } else if (record.TTL < 600 || record.TTL > 86400) {
            issues.push({
                code: 'TTL_UNUSUAL', severity: 'warning', title: 'TTL 值异常',
                message: `${record.RR} ${record.Type} 的 TTL 为 ${record.TTL} 秒。`,
                suggestion: '除非有明确的切换或缓存策略，建议使用 600 至 86400 秒。', recordIds: [record.RecordId],
            });
        }
        const type = record.Type.toUpperCase();
        const value = record.Value.trim();
        if ((type === 'A' && isIP(value) !== 4) || (type === 'AAAA' && isIP(value) !== 6)) {
            issues.push({
                code: 'INVALID_IP', severity: 'error', title: `${type} 记录值无效`,
                message: `${record.RR} 的值“${value || '(空)'}”不是有效的 ${type === 'A' ? 'IPv4' : 'IPv6'} 地址。`,
                suggestion: `填写有效的 ${type === 'A' ? 'IPv4' : 'IPv6'} 地址。`, recordIds: [record.RecordId],
            });
        }
        if ((type === 'CNAME' || type === 'MX' || type === 'NS') && !looksLikeHostname(value)) {
            issues.push({
                code: 'INVALID_HOSTNAME', severity: 'error', title: `${type} 目标格式无效`,
                message: `${record.RR} 的目标“${value || '(空)'}”不是有效的主机名。`,
                suggestion: '检查目标域名拼写，不要包含协议、端口或路径。', recordIds: [record.RecordId],
            });
        }
        if (type === 'CNAME' && value.replace(/\.$/, '').toLowerCase() === name.replace(/\.$/, '')) {
            issues.push({
                code: 'CNAME_LOOP', severity: 'error', title: 'CNAME 指向自身',
                message: `${record.RR} 的 CNAME 目标与记录名称相同。`,
                suggestion: '将 CNAME 指向另一个有效主机名，避免解析循环。', recordIds: [record.RecordId],
            });
        }
        if (type === 'TXT' && value.length > 255) {
            issues.push({
                code: 'TXT_TOO_LONG', severity: 'warning', title: 'TXT 单段内容过长',
                message: `${record.RR} 的 TXT 内容超过 255 个字符。`,
                suggestion: '确认服务商是否要求拆分 TXT 字符串，避免解析结果与预期不一致。', recordIds: [record.RecordId],
            });
        }
    }

    for (const [name, group] of groups) {
        const active = group.filter(enabled);
        if (active.some(record => record.Type.toUpperCase() === 'CNAME') && active.some(record => record.Type.toUpperCase() !== 'CNAME')) {
            issues.push({
                code: 'CNAME_CONFLICT', severity: 'error', title: 'CNAME 与其他记录冲突',
                message: `${name} 同时配置了 CNAME 和其他类型记录。`,
                suggestion: '同一主机名使用 CNAME 时应移除其他类型记录。', recordIds: active.map(record => record.RecordId),
            });
        }
    }

    for (const duplicates of exactRecords.values()) {
        if (duplicates.length > 1) {
            const record = duplicates[0];
            issues.push({
                code: 'DUPLICATE_RECORD', severity: 'warning', title: '存在重复记录',
                message: `${record.RR} ${record.Type} ${record.Value} 重复 ${duplicates.length} 次。`,
                suggestion: '保留一条需要的记录并删除重复项。', recordIds: duplicates.map(item => item.RecordId),
            });
        }
    }

    const summary = {
        errors: issues.filter(issue => issue.severity === 'error').length,
        warnings: issues.filter(issue => issue.severity === 'warning').length,
        infos: issues.filter(issue => issue.severity === 'info').length,
    };
    return {
        domain,
        checkedAt: new Date().toISOString(),
        status: reportStatus(issues),
        recordCount: records.length,
        enabledCount: activeRecords.length,
        issues,
        summary,
    };
}

export function appendDnsResolutionIssues(report: DnsHealthReport, issues: DnsHealthIssue[]): DnsHealthReport {
    const combined = [...report.issues, ...issues];
    return {
        ...report,
        issues: combined,
        status: reportStatus(combined),
        summary: {
            errors: combined.filter(issue => issue.severity === 'error').length,
            warnings: combined.filter(issue => issue.severity === 'warning').length,
            infos: combined.filter(issue => issue.severity === 'info').length,
        },
    };
}

export { enabled as isDnsRecordEnabled, recordName as getDnsRecordName };
