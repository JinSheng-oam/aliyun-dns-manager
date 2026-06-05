import Alidns20150109, * as $Alidns20150109 from '@alicloud/alidns20150109';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';
import { getErrorMessage } from './errors';

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
        const client = AliyunDnsClient.createClient(accessKeyId, accessKeySecret);
        const describeDomainsRequest = new $Alidns20150109.DescribeDomainsRequest({
            pageSize: 100,
        });
        const runtime = new $Util.RuntimeOptions({});
        try {
            const resp = await client.describeDomainsWithOptions(describeDomainsRequest, runtime);
            const domains = (resp.body?.domains?.domain || []) as AliyunDomainLike[];
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
        const client = AliyunDnsClient.createClient(accessKeyId, accessKeySecret);
        const describeDomainRecordsRequest = new $Alidns20150109.DescribeDomainRecordsRequest({
            domainName: domainName,
            pageSize: 500,
        });
        const runtime = new $Util.RuntimeOptions({});
        try {
            const resp = await client.describeDomainRecordsWithOptions(describeDomainRecordsRequest, runtime);
            const records = (resp.body?.domainRecords?.record || []) as AliyunRecordLike[];
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
            await client.addDomainRecordWithOptions(addDomainRecordRequest, runtime);
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
