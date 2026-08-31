import Alidns20150109, * as $Alidns20150109 from '@alicloud/alidns20150109';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';
import { getErrorMessage } from './errors';
import { collectAllPages } from './pagination';

type AliyunDomainLike = {
    domainId?: string;
    DomainId?: string;
    domainName?: string;
    DomainName?: string;
    recordCount?: number;
    RecordCount?: number;
    versionName?: string;
    VersionName?: string;
    createTime?: string;
    CreateTime?: string;
};

type AliyunRecordLike = {
    RecordId?: string;
    recordId?: string;
    RR?: string;
    rr?: string;
    Type?: string;
    type?: string;
    Value?: string;
    value?: string;
    TTL?: number;
    ttl?: number;
    DomainName?: string;
    domainName?: string;
    Status?: string;
    status?: string;
};

export class AliyunDnsClient {
    static createClient(accessKeyId: string, accessKeySecret: string): Alidns20150109 {
        const config = new $OpenApi.Config({
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
        });
        // 访问的域名
        config.endpoint = `alidns.cn-hangzhou.aliyuncs.com`;
        return new Alidns20150109(config);
    }

    /**
     * 获取该 AccessKey 下的所有域名列表
     */
    static async listDomains(accessKeyId: string, accessKeySecret: string) {
        if (accessKeyId.startsWith('LTAI_DEMO_')) {
            return [
                { domainId: 'd-001', domainName: 'example.com', recordCount: 16, versionName: '企业旗舰版', createTime: '2023-01-15' },
                { domainId: 'd-002', domainName: 'mysite.io', recordCount: 8, versionName: '免费版', createTime: '2023-03-20' },
                { domainId: 'd-003', domainName: 'cloud-service.net', recordCount: 24, versionName: '个人专业版', createTime: '2023-05-10' },
                { domainId: 'd-004', domainName: 'api-cluster.org', recordCount: 12, versionName: '企业标准版', createTime: '2023-08-01' },
                { domainId: 'd-005', domainName: 'dev-staging.cn', recordCount: 6, versionName: '免费版', createTime: '2023-11-12' },
                { domainId: 'd-006', domainName: 'global-cdn.vip', recordCount: 18, versionName: '企业高级版', createTime: '2024-02-18' },
            ];
        }

        const client = AliyunDnsClient.createClient(accessKeyId, accessKeySecret);
        const runtime = new $Util.RuntimeOptions({});
        try {
            const domains = await collectAllPages<AliyunDomainLike>(100, async (pageNumber, pageSize) => {
                const request = new $Alidns20150109.DescribeDomainsRequest({ pageNumber, pageSize });
                const response = await client.describeDomainsWithOptions(request, runtime);
                return {
                    items: (response.body?.domains?.domain || []) as AliyunDomainLike[],
                    totalCount: response.body?.totalCount,
                };
            });
            return domains.map(d => ({
                domainId: d.domainId || d.DomainId || '',
                domainName: d.domainName || d.DomainName || '',
                recordCount: d.recordCount ?? d.RecordCount ?? 0,
                versionName: d.versionName || d.VersionName || '免费版',
                createTime: d.createTime || d.CreateTime || '',
            }));
        } catch (error: unknown) {
            console.error("List Domains Error:", error);
            throw new Error(getErrorMessage(error, "获取域名列表失败"));
        }
    }

    static async listRecords(accessKeyId: string, accessKeySecret: string, domainName: string) {
        if (accessKeyId.startsWith('LTAI_DEMO_')) {
            return [
                { RecordId: 'rec-001', RR: '@', Type: 'A', Value: '104.21.58.102', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-002', RR: 'www', Type: 'CNAME', Value: 'example.com', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-003', RR: 'api', Type: 'A', Value: '104.21.58.103', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-004', RR: 'cdn', Type: 'CNAME', Value: 'cdn.cloudflare.net', TTL: 3600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-005', RR: 'mail', Type: 'MX', Value: 'mx.qiye.aliyun.com', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-006', RR: 'mail2', Type: 'MX', Value: 'mx2.qiye.aliyun.com', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-007', RR: '_acme-challenge', Type: 'TXT', Value: 'dGhpcyBpcyBhbiBhY21lIHZlcmlmaWNhdGlvbg', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-008', RR: 'default._domainkey', Type: 'TXT', Value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD...', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-009', RR: '@', Type: 'TXT', Value: 'v=spf1 include:spf.qiye.aliyun.com ~all', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-010', RR: 'ipv6', Type: 'AAAA', Value: '2400:3200::1', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-011', RR: 'staging', Type: 'A', Value: '192.168.1.100', TTL: 600, DomainName: domainName, Status: 'Disable' },
                { RecordId: 'rec-012', RR: 'portal', Type: 'CNAME', Value: 'portal-origin.example.com', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-013', RR: 'grafana', Type: 'A', Value: '10.0.0.88', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-014', RR: 'prometheus', Type: 'A', Value: '10.0.0.89', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-015', RR: 'webhook', Type: 'A', Value: '10.0.0.90', TTL: 600, DomainName: domainName, Status: 'Enable' },
                { RecordId: 'rec-016', RR: 'ns1', Type: 'NS', Value: 'ns1.alidns.com', TTL: 86400, DomainName: domainName, Status: 'Enable' },
            ];
        }
        const client = AliyunDnsClient.createClient(accessKeyId, accessKeySecret);
        const runtime = new $Util.RuntimeOptions({});
        try {
            const records = await collectAllPages<AliyunRecordLike>(500, async (pageNumber, pageSize) => {
                const request = new $Alidns20150109.DescribeDomainRecordsRequest({
                    domainName,
                    pageNumber,
                    pageSize,
                });
                const response = await client.describeDomainRecordsWithOptions(request, runtime);
                return {
                    items: (response.body?.domainRecords?.record || []) as AliyunRecordLike[],
                    totalCount: response.body?.totalCount,
                };
            });
            return records.map(r => ({
                RecordId: r.RecordId || r.recordId || '',
                RR: r.RR || r.rr || '',
                Type: r.Type || r.type || '',
                Value: r.Value || r.value || '',
                TTL: r.TTL ?? r.ttl ?? 600,
                DomainName: r.DomainName || r.domainName || '',
                Status: r.Status || r.status || 'Enable',
            }));
        } catch (error: unknown) {
            console.error("List Records Error:", error);
            throw new Error(getErrorMessage(error, "Failed to fetch DNS records"));
        }
    }

    static async addRecord(
        accessKeyId: string,
        accessKeySecret: string,
        domainName: string,
        rr: string,
        type: string,
        value: string,
        ttl?: number
    ) {
        const client = AliyunDnsClient.createClient(accessKeyId, accessKeySecret);
        const addDomainRecordRequest = new $Alidns20150109.AddDomainRecordRequest({
            domainName: domainName,
            RR: rr,
            type: type,
            value: value,
            TTL: ttl,
        });
        const runtime = new $Util.RuntimeOptions({});
        try {
            const response = await client.addDomainRecordWithOptions(addDomainRecordRequest, runtime);
            const recordId = response.body?.recordId;
            if (!recordId) {
                throw new Error('阿里云未返回新记录 ID');
            }
            return recordId;
        } catch (error: unknown) {
            console.error("Add Record Error:", error);
            throw new Error(getErrorMessage(error, "Failed to add DNS record"));
        }
    }

    static async updateRecord(
        accessKeyId: string,
        accessKeySecret: string,
        recordId: string,
        rr: string,
        type: string,
        value: string,
        ttl?: number
    ) {
        const client = AliyunDnsClient.createClient(accessKeyId, accessKeySecret);
        const updateDomainRecordRequest = new $Alidns20150109.UpdateDomainRecordRequest({
            recordId: recordId,
            RR: rr,
            type: type,
            value: value,
            TTL: ttl,
        });
        const runtime = new $Util.RuntimeOptions({});
        try {
            await client.updateDomainRecordWithOptions(updateDomainRecordRequest, runtime);
        } catch (error: unknown) {
            console.error("Update Record Error:", error);
            throw new Error(getErrorMessage(error, "Failed to update DNS record"));
        }
    }

    static async setRecordStatus(
        accessKeyId: string,
        accessKeySecret: string,
        recordId: string,
        status: 'Enable' | 'Disable'
    ) {
        const client = AliyunDnsClient.createClient(accessKeyId, accessKeySecret);
        const setDomainRecordStatusRequest = new $Alidns20150109.SetDomainRecordStatusRequest({
            recordId: recordId,
            status: status,
        });
        const runtime = new $Util.RuntimeOptions({});
        try {
            await client.setDomainRecordStatusWithOptions(setDomainRecordStatusRequest, runtime);
        } catch (error: unknown) {
            console.error("Set Record Status Error:", error);
            throw new Error(getErrorMessage(error, "Failed to set DNS record status"));
        }
    }

    static async deleteRecord(accessKeyId: string, accessKeySecret: string, recordId: string) {
        const client = AliyunDnsClient.createClient(accessKeyId, accessKeySecret);
        const deleteDomainRecordRequest = new $Alidns20150109.DeleteDomainRecordRequest({
            recordId: recordId,
        });
        const runtime = new $Util.RuntimeOptions({});
        try {
            await client.deleteDomainRecordWithOptions(deleteDomainRecordRequest, runtime);
        } catch (error: unknown) {
            console.error("Delete Record Error:", error);
            throw new Error(getErrorMessage(error, "Failed to delete DNS record"));
        }
    }
}
