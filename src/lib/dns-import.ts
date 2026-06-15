import type { DnsRecord } from './types';

export type DnsImportRecord = {
    rr: string;
    type: string;
    value: string;
    ttl: number;
    status: 'Enable' | 'Disable';
};

export type DnsImportPreviewRow = {
    line: number;
    status: 'add' | 'skip' | 'error';
    reason: string;
    record?: DnsImportRecord;
};

export type DnsImportPreview = {
    rows: DnsImportPreviewRow[];
    summary: {
        add: number;
        skip: number;
        error: number;
    };
};

type CsvRow = {
    line: number;
    values: string[];
};

type DomainBackup = {
    format: 'aliyun-dns-manager-domain-backup';
    version: 1;
    domain: string;
    createdAt: string;
    records: Array<{
        rr: string;
        type: string;
        value: string;
        ttl: number;
        status: 'Enable' | 'Disable';
    }>;
};

function parseCsvRows(content: string): CsvRow[] {
    const rows: CsvRow[] = [];
    let values: string[] = [];
    let value = '';
    let quoted = false;
    let line = 1;
    let rowLine = 1;

    const pushRow = () => {
        values.push(value);
        if (values.some(item => item.trim() !== '')) {
            rows.push({ line: rowLine, values });
        }
        values = [];
        value = '';
        rowLine = line + 1;
    };

    for (let index = 0; index < content.length; index++) {
        const char = content[index];

        if (char === '"') {
            if (quoted && content[index + 1] === '"') {
                value += '"';
                index++;
            } else {
                quoted = !quoted;
            }
            continue;
        }

        if (char === ',' && !quoted) {
            values.push(value);
            value = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && content[index + 1] === '\n') {
                index++;
            }
            pushRow();
            line++;
            continue;
        }

        if (char === '\n') {
            line++;
        }
        value += char;
    }

    if (value || values.length > 0) {
        pushRow();
    }

    return rows;
}

function recordKey(record: DnsImportRecord): string {
    return [
        record.rr.trim().toLowerCase(),
        record.type.trim().toUpperCase(),
        record.value.trim().toLowerCase(),
        record.ttl,
    ].join('\u0000');
}

function normalizeStatus(value: string): 'Enable' | 'Disable' | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'enable' || normalized === 'enabled' || normalized === '正常') {
        return 'Enable';
    }
    if (normalized === 'disable' || normalized === 'disabled' || normalized === '已暂停') {
        return 'Disable';
    }
    return null;
}

function hasHeader(values: string[]): boolean {
    const first = values[0]?.replace(/^\uFEFF/, '').trim().toLowerCase();
    return first === '主机记录' || first === 'rr';
}

function parseDomainBackup(content: string, expectedDomain?: string): CsvRow[] | null {
    const trimmed = content.replace(/^\uFEFF/, '').trim();
    if (!trimmed.startsWith('{')) return null;

    const backup = JSON.parse(trimmed) as Partial<DomainBackup>;
    if (
        backup.format !== 'aliyun-dns-manager-domain-backup' ||
        backup.version !== 1 ||
        typeof backup.domain !== 'string' ||
        !Array.isArray(backup.records)
    ) {
        throw new Error('不是有效的阿里云 DNS 管理器域名备份');
    }

    if (expectedDomain && backup.domain.toLowerCase() !== expectedDomain.toLowerCase()) {
        throw new Error(`备份属于 ${backup.domain}，不能导入到 ${expectedDomain}`);
    }

    return backup.records.map((record, index) => ({
        line: index + 1,
        values: [
            String(record?.rr ?? ''),
            String(record?.type ?? ''),
            String(record?.value ?? ''),
            String(record?.ttl ?? ''),
            String(record?.status ?? ''),
        ],
    }));
}

export function createDomainBackup(domain: string, records: DnsRecord[]): DomainBackup {
    return {
        format: 'aliyun-dns-manager-domain-backup',
        version: 1,
        domain,
        createdAt: new Date().toISOString(),
        records: records.map(record => ({
            rr: record.RR,
            type: record.Type,
            value: record.Value,
            ttl: record.TTL,
            status: record.Status?.toUpperCase() === 'DISABLE' ? 'Disable' : 'Enable',
        })),
    };
}

export function createDnsImportPreview(
    content: string,
    existingRecords: DnsRecord[],
    expectedDomain?: string
): DnsImportPreview {
    const backupRows = parseDomainBackup(content, expectedDomain);
    const rows = backupRows || parseCsvRows(content);
    const previewRows: DnsImportPreviewRow[] = [];
    const existingKeys = new Set(existingRecords.map(record => recordKey({
        rr: record.RR,
        type: record.Type,
        value: record.Value,
        ttl: record.TTL,
        status: record.Status?.toUpperCase() === 'DISABLE' ? 'Disable' : 'Enable',
    })));
    const fileKeys = new Set<string>();
    const startIndex = !backupRows && rows[0] && hasHeader(rows[0].values) ? 1 : 0;

    for (const row of rows.slice(startIndex)) {
        const [rawRr = '', rawType = '', rawValue = '', rawTtl = '', rawStatus = ''] = row.values;
        const rr = rawRr.replace(/^\uFEFF/, '').trim();
        const type = rawType.trim().toUpperCase();
        const value = rawValue.trim();
        const ttlText = rawTtl.trim();
        const ttl = ttlText === '' ? 600 : Number(ttlText);
        const status = normalizeStatus(rawStatus);

        if (!rr || !type || !value) {
            previewRows.push({
                line: row.line,
                status: 'error',
                reason: '主机记录、记录类型和记录值不能为空',
            });
            continue;
        }

        if (!Number.isInteger(ttl) || ttl <= 0) {
            previewRows.push({
                line: row.line,
                status: 'error',
                reason: 'TTL 必须是大于 0 的整数',
            });
            continue;
        }

        if (!status) {
            previewRows.push({
                line: row.line,
                status: 'error',
                reason: '状态必须是 Enable 或 Disable',
            });
            continue;
        }

        const record = { rr, type, value, ttl, status };
        const key = recordKey(record);

        if (existingKeys.has(key)) {
            previewRows.push({
                line: row.line,
                status: 'skip',
                reason: '当前域名已存在相同的主机记录、类型、记录值和 TTL',
                record,
            });
            continue;
        }

        if (fileKeys.has(key)) {
            previewRows.push({
                line: row.line,
                status: 'skip',
                reason: '与文件中前面的记录重复',
                record,
            });
            continue;
        }

        fileKeys.add(key);
        previewRows.push({
            line: row.line,
            status: 'add',
            reason: '将新增',
            record,
        });
    }

    return {
        rows: previewRows,
        summary: {
            add: previewRows.filter(row => row.status === 'add').length,
            skip: previewRows.filter(row => row.status === 'skip').length,
            error: previewRows.filter(row => row.status === 'error').length,
        },
    };
}
