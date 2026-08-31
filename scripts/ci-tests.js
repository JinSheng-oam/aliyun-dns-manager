/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createJiti } = require('jiti');

const projectRoot = path.join(__dirname, '..');
const jiti = createJiti(__filename, { interopDefault: true });

async function testSessionInvalidation() {
    process.env.ADMIN_PASSWORD = 'strong-admin-password';
    process.env.SESSION_SECRET = 'first-dedicated-session-secret-123456';

    const auth = await jiti.import(path.join(projectRoot, 'src/lib/auth.ts'));
    const token = await auth.createAdminSessionToken();

    assert.ok(token, 'A configured server should create a session token');
    assert.equal(await auth.verifyAdminSessionToken(token), true);

    process.env.ADMIN_PASSWORD = 'changed-admin-password';
    assert.equal(
        await auth.verifyAdminSessionToken(token),
        false,
        'Changing ADMIN_PASSWORD must invalidate existing sessions'
    );

    process.env.ADMIN_PASSWORD = 'strong-admin-password';
    process.env.SESSION_SECRET = 'second-dedicated-session-secret-12345';
    assert.equal(
        await auth.verifyAdminSessionToken(token),
        false,
        'Changing SESSION_SECRET must invalidate existing sessions'
    );
}

async function testReadOnlyModeConfig() {
    const securityConfig = await jiti.import(path.join(projectRoot, 'src/lib/security-config.ts'));
    process.env.READONLY_MODE = 'true';
    assert.equal(securityConfig.isReadOnlyModeEnabled(), true, 'READONLY_MODE=true must enable server read-only checks');
    process.env.READONLY_MODE = 'false';
    assert.equal(securityConfig.isReadOnlyModeEnabled(), false, 'READONLY_MODE=false must keep writes available');
    delete process.env.READONLY_MODE;
}

async function testLogCsvExport() {
    const { createLogsCsv } = await jiti.import(path.join(projectRoot, 'src/lib/log-export.ts'));
    const csv = createLogsCsv([
        {
            id: '1',
            timestamp: '2026-06-08T02:00:00.000Z',
            action: '=DANGEROUS()',
            ip: '127.0.0.1',
            details: 'value,with,"quotes"',
            status: 'failure',
            error: '+formula',
        },
    ]);

    assert.equal(csv.charCodeAt(0), 0xFEFF, 'CSV must include a UTF-8 BOM');
    assert.match(csv, /"'=DANGEROUS\(\)"/, 'Formula-like actions must be neutralized');
    assert.match(csv, /"'\+formula"/, 'Formula-like errors must be neutralized');
    assert.ok(csv.includes('"value,with,""quotes"""'), 'CSV quotes must be escaped');
    assert.equal(csv.split('\r\n').length, 2, 'CSV must contain one header and one data row');
}

async function testDnsHistoryFiltering() {
    const { filterDnsChangeLogs } = await jiti.import(path.join(projectRoot, 'src/lib/logger.ts'));
    const { isHighRiskLog } = await jiti.import(path.join(projectRoot, 'src/lib/log-risk.ts'));
    const logs = [
        {
            id: '1',
            timestamp: '2026-06-15T00:00:00.000Z',
            action: 'Add DNS Record',
            details: 'new structured log',
            status: 'success',
            context: {
                category: 'dns-change',
                domain: 'Example.com',
                operation: 'add',
                records: [],
            },
        },
        {
            id: '2',
            timestamp: '2026-06-15T00:01:00.000Z',
            action: 'Add DNS Record',
            details: 'other domain',
            status: 'success',
            context: {
                category: 'dns-change',
                domain: 'other.example.com',
                operation: 'add',
                records: [],
            },
        },
        {
            id: '3',
            timestamp: '2026-06-15T00:02:00.000Z',
            action: 'Add DNS Record',
            details: 'Domain: example.com',
            status: 'success',
        },
    ];

    const history = filterDnsChangeLogs(logs, 'example.com');
    assert.equal(history.length, 1, 'History must use structured domain metadata only');
    assert.equal(history[0].id, '1', 'Domain matching must be case-insensitive');
    assert.equal(isHighRiskLog({ action: 'Restore DNS Snapshot' }), true, 'Snapshot restore logs must be marked high risk');
    assert.equal(isHighRiskLog({ action: 'Login' }), false, 'Read-only login events must not be marked high risk');
}

async function testDnsRecordFiltering() {
    const { filterDnsRecords } = await jiti.import(path.join(projectRoot, 'src/lib/dns-filter.ts'));
    const records = [
        {
            RecordId: '1',
            RR: 'www',
            Type: 'A',
            Value: '1.1.1.1',
            TTL: 600,
            DomainName: 'example.com',
            Status: 'Enable',
        },
        {
            RecordId: '2',
            RR: 'api',
            Type: 'CNAME',
            Value: 'target.example.com',
            TTL: 3600,
            DomainName: 'example.com',
            Status: 'Disable',
        },
        {
            RecordId: '3',
            RR: 'mail',
            Type: 'A',
            Value: '2.2.2.2',
            TTL: 86400,
            DomainName: 'example.com',
            Status: 'Enable',
        },
    ];

    assert.deepEqual(
        filterDnsRecords(records, {
            searchTerm: '',
            type: 'All',
            status: 'Disable',
            minTtl: '600',
            maxTtl: '3600',
        }).map(record => record.RecordId),
        ['2'],
        'Status and inclusive TTL boundaries must be combined'
    );
    assert.deepEqual(
        filterDnsRecords(records, {
            searchTerm: 'MAIL',
            type: 'A',
            status: 'All',
            minTtl: '',
            maxTtl: '',
        }).map(record => record.RecordId),
        ['3'],
        'Search must remain case-insensitive and combine with record type'
    );
    assert.equal(
        filterDnsRecords(records, {
            searchTerm: '',
            type: 'All',
            status: 'All',
            minTtl: '4000',
            maxTtl: '1000',
        }).length,
        0,
        'An inverted TTL range must not be silently swapped'
    );
}

async function testDomainFiltering() {
    const { filterDomains } = await jiti.import(path.join(projectRoot, 'src/lib/dns-filter.ts'));
    const domains = [
        { domainId: '1', domainName: 'example.com', recordCount: 10, versionName: '企业版', createTime: '2026-01-01' },
        { domainId: '2', domainName: 'test-api.org', recordCount: 5, versionName: '免费版', createTime: '2026-01-02' },
        { domainId: '3', domainName: 'my-shop.cn', recordCount: 20, versionName: '高级版', createTime: '2026-01-03' },
    ];

    assert.equal(filterDomains(domains, '').length, 3, 'Empty search must return all domains');
    assert.deepEqual(
        filterDomains(domains, 'API').map(d => d.domainId),
        ['2'],
        'Domain name search must be case-insensitive'
    );
    assert.deepEqual(
        filterDomains(domains, '企业版').map(d => d.domainId),
        ['1'],
        'Version name search should match'
    );
    assert.equal(
        filterDomains(domains, 'nonexistent').length,
        0,
        'Non-matching search must return empty list'
    );
}

async function testClipboardFallback() {
    const { copyTextToClipboard } = await jiti.import(path.join(projectRoot, 'src/lib/clipboard.ts'));
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    let fallbackText = '';
    let removed = false;
    let appended = 0;

    const textarea = {
        value: '',
        style: {},
        setAttribute() {},
        focus() {},
        select() {},
        setSelectionRange() {},
        remove() { removed = true; },
    };

    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { clipboard: { writeText: async () => { throw new Error('permission denied'); } } },
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            body: {
                appendChild(node) {
                    appended += 1;
                    fallbackText = node.value;
                },
            },
            createElement(tagName) {
                assert.equal(tagName, 'textarea');
                return textarea;
            },
            execCommand(command) {
                assert.equal(command, 'copy');
                return true;
            },
        },
    });

    try {
        await copyTextToClipboard('record-value.example.com');
        assert.equal(fallbackText, 'record-value.example.com', 'Clipboard fallback must copy the requested text');
        assert.equal(appended, 1, 'Clipboard fallback must create one temporary textarea');
        assert.equal(removed, true, 'Clipboard fallback must remove the temporary textarea');
    } finally {
        if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
        else delete globalThis.navigator;
        if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
        else delete globalThis.document;
    }
}

async function testPaginationAndBatchConcurrency() {
    const { collectAllPages } = await jiti.import(path.join(projectRoot, 'src/lib/pagination.ts'));
    const { mapWithConcurrency } = await jiti.import(path.join(projectRoot, 'src/lib/batch.ts'));

    const requestedPages = [];
    const items = await collectAllPages(2, async (pageNumber) => {
        requestedPages.push(pageNumber);
        const pages = [[1, 2], [3, 4], [5]];
        return { items: pages[pageNumber - 1] || [], totalCount: 5 };
    });

    assert.deepEqual(items, [1, 2, 3, 4, 5], 'Pagination must collect every page');
    assert.deepEqual(requestedPages, [1, 2, 3], 'Pagination must stop after reaching totalCount');

    let activeTasks = 0;
    let maxActiveTasks = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
        activeTasks += 1;
        maxActiveTasks = Math.max(maxActiveTasks, activeTasks);
        await new Promise(resolve => setTimeout(resolve, 5));
        activeTasks -= 1;
        return value * 2;
    });

    assert.deepEqual(results, [2, 4, 6, 8, 10, 12, 14], 'Batch results must preserve input order');
    assert.ok(maxActiveTasks <= 3, 'Batch execution must respect the concurrency limit');
    await assert.rejects(
        () => mapWithConcurrency([1], 0, async value => value),
        /positive integer/,
        'Invalid concurrency must be rejected'
    );
}

async function testDnsImportPreview() {
    const { createDnsImportPreview, createDomainBackup } = await jiti.import(
        path.join(projectRoot, 'src/lib/dns-import.ts')
    );
    const preview = createDnsImportPreview(
        '\uFEFF主机记录,记录类型,记录值,TTL,状态\r\n' +
        'www,A,1.1.1.1,600,Enable\r\n' +
        'api,CNAME,"target,with-comma.example.com",600,Enable\r\n' +
        'api,CNAME,"target,with-comma.example.com",600,Enable\r\n' +
        'bad,A,2.2.2.2,not-a-number,Enable\r\n' +
        ',TXT,missing.example.com,600,Enable\r\n' +
        'invalid-status,A,3.3.3.3,600,Unknown',
        [{
            RecordId: '1',
            RR: 'www',
            Type: 'A',
            Value: '1.1.1.1',
            TTL: 600,
            DomainName: 'example.com',
            Status: 'Enable',
        }]
    );

    assert.deepEqual(preview.summary, { add: 1, skip: 2, error: 3 });
    assert.equal(preview.rows[0].status, 'skip', 'Existing records must be skipped');
    assert.equal(preview.rows[1].record.value, 'target,with-comma.example.com');
    assert.equal(preview.rows[2].reason, '与文件中前面的记录重复');
    assert.equal(preview.rows[3].status, 'error', 'Invalid TTL values must be rejected');
    assert.equal(preview.rows[4].status, 'error', 'Required fields must be validated');
    assert.equal(preview.rows[5].status, 'error', 'Invalid record status must be rejected');

    const domainRecords = [{
        RecordId: '2',
        RR: 'paused',
        Type: 'TXT',
        Value: 'backup-value',
        TTL: 3600,
        DomainName: 'example.com',
        Status: 'Disable',
    }];
    const backup = createDomainBackup('example.com', domainRecords);
    const backupPreview = createDnsImportPreview(JSON.stringify(backup), [], 'example.com');

    assert.equal(backup.format, 'aliyun-dns-manager-domain-backup');
    assert.equal(backup.records[0].status, 'Disable', 'Backups must preserve paused record status');
    assert.equal(backupPreview.rows[0].record.status, 'Disable', 'Backup imports must restore record status');
    assert.throws(
        () => createDnsImportPreview(JSON.stringify(backup), [], 'other.example.com'),
        /不能导入/,
        'Backups must not be imported into a different domain'
    );
}

async function testDnsSnapshotRestorePlan() {
    const { createDnsRestorePlan } = await jiti.import(path.join(projectRoot, 'src/lib/dns-snapshots.ts'));
    const current = [
        { RecordId: '1', RR: 'www', Type: 'A', Value: '1.1.1.1', TTL: 600, DomainName: 'example.com', Status: 'Enable' },
        { RecordId: '2', RR: 'old', Type: 'CNAME', Value: 'legacy.example.com', TTL: 600, DomainName: 'example.com', Status: 'Enable' },
        { RecordId: '3', RR: 'same', Type: 'TXT', Value: 'unchanged', TTL: 3600, DomainName: 'example.com', Status: 'Enable' },
        { RecordId: '4', RR: 'case', Type: 'TXT', Value: 'CaseSensitive', TTL: 600, DomainName: 'example.com', Status: 'Enable' },
    ];
    const target = [
        { rr: 'www', type: 'A', value: '1.1.1.1', ttl: 3600, status: 'Disable' },
        { rr: 'new', type: 'TXT', value: 'added', ttl: 600, status: 'Enable' },
        { rr: 'same', type: 'TXT', value: 'unchanged', ttl: 3600, status: 'Enable' },
        { rr: 'case', type: 'TXT', value: 'casesensitive', ttl: 600, status: 'Enable' },
    ];
    const plan = createDnsRestorePlan(current, target);

    assert.equal(plan.add.length, 2, 'Snapshot restore must identify missing and case-sensitive TXT records');
    assert.equal(plan.update.length, 1, 'Snapshot restore must identify TTL and status changes');
    assert.equal(plan.delete.length, 2, 'Snapshot restore must replace case-sensitive TXT values and remove absent records');
    assert.equal(plan.unchanged, 1, 'Snapshot restore must preserve unchanged records');
    assert.equal(plan.update[0].current.recordId, '1');
}

async function testDnsHealthAnalysis() {
    const { analyzeDnsRecords } = await jiti.import(path.join(projectRoot, 'src/lib/dns-health.ts'));
    const report = analyzeDnsRecords('example.com', [
        { RecordId: '1', RR: 'www', Type: 'A', Value: 'not-an-ip', TTL: 30, DomainName: 'example.com', Status: 'Enable' },
        { RecordId: '2', RR: 'alias', Type: 'CNAME', Value: 'target.example.com', TTL: 600, DomainName: 'example.com', Status: 'Enable' },
        { RecordId: '3', RR: 'alias', Type: 'TXT', Value: 'conflict', TTL: 600, DomainName: 'example.com', Status: 'Enable' },
        { RecordId: '4', RR: 'paused', Type: 'A', Value: '1.1.1.1', TTL: 600, DomainName: 'example.com', Status: 'Disable' },
        { RecordId: '5', RR: 'dup', Type: 'A', Value: '2.2.2.2', TTL: 600, DomainName: 'example.com', Status: 'Enable' },
        { RecordId: '6', RR: 'dup', Type: 'A', Value: '2.2.2.2', TTL: 600, DomainName: 'example.com', Status: 'Enable' },
    ]);
    const codes = new Set(report.issues.map(issue => issue.code));

    assert.equal(report.status, 'error', 'Invalid DNS configuration must produce an error status');
    assert.ok(codes.has('INVALID_IP'), 'Invalid A values must be reported');
    assert.ok(codes.has('TTL_TOO_LOW'), 'Abnormally low TTL values must be reported');
    assert.ok(codes.has('CNAME_CONFLICT'), 'CNAME conflicts must be reported');
    assert.ok(codes.has('DISABLED_RECORD'), 'Paused records must be visible in health results');
    assert.ok(codes.has('DUPLICATE_RECORD'), 'Duplicate records must be reported');
}

async function silenceExpectedConsoleError(callback) {
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
        return await callback();
    } finally {
        console.error = originalConsoleError;
    }
}

async function testAccessKeyAndBackupSafety() {
    const originalCwd = process.cwd();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aliyun-dns-ci-'));
    const dataDir = path.join(tempDir, 'data');

    try {
        await fs.mkdir(dataDir);
        process.chdir(tempDir);
        process.env.ENCRYPTION_KEY = 'ci-backup-encryption-key';

        const keyManager = await jiti.import(path.join(projectRoot, 'src/lib/key-manager.ts'));
        const backupManager = await jiti.import(path.join(projectRoot, 'src/lib/backup-manager.ts'));
        const snapshotManager = await jiti.import(path.join(projectRoot, 'src/lib/dns-snapshots.ts'));

        assert.deepEqual(
            await keyManager.getAccessKeys(),
            [],
            'A fresh installation must return an empty AccessKey list'
        );

        await keyManager.saveAccessKey({
            id: '1',
            name: 'production',
            accessKeyId: 'ak',
            accessKeySecret: 'sk',
            createdAt: '2026-06-08T00:00:00.000Z',
        });
        await fs.writeFile(
            path.join(dataDir, 'logs.json'),
            JSON.stringify([
                {
                    id: 'log1',
                    timestamp: '2026-06-08T00:00:00.000Z',
                    action: 'Login',
                    details: 'ok',
                    status: 'success',
                },
            ], null, 2)
        );
        await snapshotManager.createDomainSnapshot('1', 'example.com', [{
            RecordId: 'record-1', RR: 'www', Type: 'A', Value: '1.1.1.1', TTL: 600,
            DomainName: 'example.com', Status: 'Enable',
        }], 'backup baseline');

        const backup = await backupManager.createAppDataBackup();
        assert.equal(backup.format, 'aliyun-dns-manager-backup');
        assert.equal(backup.version, 2, 'New backups must use the snapshot-aware format');
        assert.ok(backup.data.accessKeys);
        assert.equal(backup.data.logs.length, 1);
        assert.equal(backup.data.dnsSnapshots.length, 1, 'App backups must include DNS snapshots');

        await keyManager.saveAccessKey({
            id: '2',
            name: 'temporary',
            accessKeyId: 'ak2',
            accessKeySecret: 'sk2',
            createdAt: '2026-06-08T01:00:00.000Z',
        });
        await snapshotManager.createDomainSnapshot('1', 'example.com', [], 'temporary snapshot');
        await backupManager.restoreAppDataBackup(
            backupManager.parseAndValidateBackup(JSON.stringify(backup))
        );

        const restoredKeys = await keyManager.getAccessKeys();
        assert.equal(restoredKeys.length, 1);
        assert.equal(restoredKeys[0].name, 'production');
        assert.equal(
            (await snapshotManager.readDnsSnapshotsForBackup()).length,
            1,
            'Restoring an app backup must restore the DNS snapshot set'
        );

        const accessKeyFile = path.join(dataDir, 'access_keys.json');
        const beforeInvalidRestore = await fs.readFile(accessKeyFile, 'utf8');
        const invalidBackup = JSON.stringify({
            ...backup,
            data: { ...backup.data, accessKeys: 'invalid-ciphertext' },
        });

        assert.throws(
            () => backupManager.parseAndValidateBackup(invalidBackup),
            /ENCRYPTION_KEY/,
            'Invalid encrypted data must be rejected before restore'
        );
        assert.equal(
            await fs.readFile(accessKeyFile, 'utf8'),
            beforeInvalidRestore,
            'Rejected backups must not change current data'
        );

        const corruptedData = 'corrupted-encrypted-data';
        await fs.writeFile(accessKeyFile, corruptedData);

        await silenceExpectedConsoleError(() =>
            assert.rejects(
                () => keyManager.saveAccessKey({
                    id: '3',
                    name: 'blocked',
                    accessKeyId: 'ak3',
                    accessKeySecret: 'sk3',
                    createdAt: '2026-06-08T02:00:00.000Z',
                }),
                keyManager.AccessKeyReadError,
                'Writes must stop when AccessKey data cannot be read'
            )
        );
        assert.equal(
            await fs.readFile(accessKeyFile, 'utf8'),
            corruptedData,
            'Unreadable AccessKey data must not be overwritten'
        );
    } finally {
        process.chdir(originalCwd);
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

async function main() {
    const tests = [
        ['session invalidation', testSessionInvalidation],
        ['read-only mode config', testReadOnlyModeConfig],
        ['log CSV export', testLogCsvExport],
        ['DNS history filtering', testDnsHistoryFiltering],
        ['domain filtering', testDomainFiltering],
        ['DNS record filtering', testDnsRecordFiltering],
        ['clipboard fallback', testClipboardFallback],
        ['pagination and batch concurrency', testPaginationAndBatchConcurrency],
        ['DNS import preview', testDnsImportPreview],
        ['DNS snapshot restore plan', testDnsSnapshotRestorePlan],
        ['DNS health analysis', testDnsHealthAnalysis],
        ['AccessKey and backup safety', testAccessKeyAndBackupSafety],
    ];

    for (const [name, test] of tests) {
        await test();
        console.log(`PASS ${name}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
