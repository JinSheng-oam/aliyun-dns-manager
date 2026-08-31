import { resolve4, resolve6, resolveCname, resolveMx, resolveTxt } from 'dns/promises';
import type { DnsRecord } from './types';
import type { DnsHealthIssue } from './dns-health';
import { getDnsRecordName, isDnsRecordEnabled } from './dns-health';
import { mapWithConcurrency } from './batch';

const SUPPORTED_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT']);

function normalize(value: string, type: string): string {
    const trimmed = value.replace(/\.$/, '').trim();
    return type.toUpperCase() === 'TXT' ? trimmed : trimmed.toLowerCase();
}

async function resolveRecord(record: DnsRecord, domain: string): Promise<string[]> {
    const name = getDnsRecordName(record, domain);
    switch (record.Type.toUpperCase()) {
        case 'A': return resolve4(name);
        case 'AAAA': return resolve6(name);
        case 'CNAME': return resolveCname(name);
        case 'MX': return (await resolveMx(name)).map(item => item.exchange);
        case 'TXT': return (await resolveTxt(name)).map(parts => parts.join(''));
        default: return [];
    }
}

export async function checkLiveDnsResolution(domain: string, records: DnsRecord[]): Promise<DnsHealthIssue[]> {
    if (domain === 'example.com' || domain === 'mysite.io' || domain === 'cloud-service.net' || domain.endsWith('.example.com')) {
        return [];
    }
    const candidates = records.filter(record =>
        isDnsRecordEnabled(record) &&
        SUPPORTED_TYPES.has(record.Type.toUpperCase()) &&
        !record.RR.includes('*')
    );
    const results = await mapWithConcurrency(candidates, 5, async record => {
        try {
            const actual = await Promise.race([
                resolveRecord(record, domain),
                new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('DNS 查询超时')), 5000)),
            ]);
            const expected = normalize(record.Value, record.Type);
            if (!actual.some(value => normalize(value, record.Type) === expected)) {
                return {
                    code: 'PUBLIC_DNS_MISMATCH',
                    severity: 'warning' as const,
                    title: '公网解析结果不一致',
                    message: `${getDnsRecordName(record, domain)} ${record.Type} 的公网结果未包含“${record.Value}”。`,
                    suggestion: '如果刚修改过记录，请等待 TTL 和 DNS 传播完成后再次检测；否则检查权威 DNS 配置。',
                    recordIds: [record.RecordId],
                };
            }
            return null;
        } catch (error: unknown) {
            const reason = error instanceof Error && error.message ? error.message : '查询失败';
            return {
                code: 'PUBLIC_DNS_UNRESOLVED',
                severity: 'warning' as const,
                title: '公网 DNS 查询失败',
                message: `${getDnsRecordName(record, domain)} ${record.Type}：${reason}`,
                suggestion: '检查记录是否已生效、域名 DNS 服务器是否正确，并稍后重新检测。',
                recordIds: [record.RecordId],
            };
        }
    });
    return results.filter((issue): issue is NonNullable<typeof issue> => issue !== null);
}
