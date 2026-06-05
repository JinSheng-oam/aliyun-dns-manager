export interface AccessKey {
  id: string;
  name: string;
  accessKeyId: string;
  accessKeySecret: string;
  createdAt: string;
}

export interface DnsRecord {
  RecordId: string;
  RR: string;
  Type: string;
  Value: string;
  TTL: number;
  DomainName: string;
  Status: string;
}

export interface Domain {
  domainId: string;
  domainName: string;
  recordCount: number;
  versionName: string;
  createTime: string;
}
