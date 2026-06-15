import type { DnsRecord } from './types';

export type DnsImportRecord = {
    rr: string;
    type: string;
    value: string;
    ttl: number;
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

function hasHeader(values: string[]): boolean {
    const first = values[0]?.replace(/^\uFEFF/, '').trim().toLowerCase();
    return first === '主机记录' || first === 'rr';
}

export function createDnsImportPreview(content: string, existingRecords: DnsRecord[]): DnsImportPreview {
    const rows = parseCsvRows(content);
    const previewRows: DnsImportPreviewRow[] = [];
    const existingKeys = new Set(existingRecords.map(record => recordKey({
        rr: record.RR,
        type: record.Type,
        value: record.Value,
        ttl: record.TTL,
    })));
    const fileKeys = new Set<string>();
    const startIndex = rows[0] && hasHeader(rows[0].values) ? 1 : 0;

    for (const row of rows.slice(startIndex)) {
        const [rawRr = '', rawType = '', rawValue = '', rawTtl = ''] = row.values;
        const rr = rawRr.replace(/^\uFEFF/, '').trim();
        const type = rawType.trim().toUpperCase();
        const value = rawValue.trim();
        const ttlText = rawTtl.trim();
        const ttl = ttlText === '' ? 600 : Number(ttlText);

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

        const record = { rr, type, value, ttl };
        const key = recordKey(record);

        if (existingKeys.has(key)) {
            previewRows.push({
                line: row.line,
                status: 'skip',
                reason: '与当前域名中的记录完全相同',
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
