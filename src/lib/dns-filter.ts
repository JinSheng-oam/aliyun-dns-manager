import type { DnsRecord } from './types';

export type DnsStatusFilter = 'All' | 'Enable' | 'Disable';

export type DnsRecordFilters = {
    searchTerm: string;
    type: string;
    status: DnsStatusFilter;
    minTtl: string;
    maxTtl: string;
};

function parseTtlBoundary(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isRecordEnabled(status: string | undefined): boolean {
    return !status || status.toUpperCase() === 'ENABLE';
}

export function filterDnsRecords(records: DnsRecord[], filters: DnsRecordFilters): DnsRecord[] {
    const searchTerm = filters.searchTerm.trim().toLowerCase();
    const minTtl = parseTtlBoundary(filters.minTtl);
    const maxTtl = parseTtlBoundary(filters.maxTtl);

    return records.filter(record => {
        const matchesSearch = !searchTerm ||
            record.RR.toLowerCase().includes(searchTerm) ||
            record.Value.toLowerCase().includes(searchTerm);
        const matchesType = filters.type === 'All' || record.Type === filters.type;
        const enabled = isRecordEnabled(record.Status);
        const matchesStatus = filters.status === 'All' ||
            (filters.status === 'Enable' ? enabled : !enabled);
        const matchesMinTtl = minTtl === null || record.TTL >= minTtl;
        const matchesMaxTtl = maxTtl === null || record.TTL <= maxTtl;

        return matchesSearch && matchesType && matchesStatus && matchesMinTtl && matchesMaxTtl;
    });
}
