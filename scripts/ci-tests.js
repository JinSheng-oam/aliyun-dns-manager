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

async function testDnsImportPreview() {
    const { createDnsImportPreview } = await jiti.import(path.join(projectRoot, 'src/lib/dns-import.ts'));
    const preview = createDnsImportPreview(
        '\uFEFF主机记录,记录类型,记录值,TTL,状态\r\n' +
        'www,A,1.1.1.1,600,Enable\r\n' +
        'api,CNAME,"target,with-comma.example.com",600,Enable\r\n' +
        'api,CNAME,"target,with-comma.example.com",600,Enable\r\n' +
        'bad,A,2.2.2.2,not-a-number,Enable\r\n' +
        ',TXT,missing.example.com,600,Enable',
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

    assert.deepEqual(preview.summary, { add: 1, skip: 2, error: 2 });
    assert.equal(preview.rows[0].status, 'skip', 'Existing records must be skipped');
    assert.equal(preview.rows[1].record.value, 'target,with-comma.example.com');
    assert.equal(preview.rows[2].reason, '与文件中前面的记录重复');
    assert.equal(preview.rows[3].status, 'error', 'Invalid TTL values must be rejected');
    assert.equal(preview.rows[4].status, 'error', 'Required fields must be validated');
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

        const backup = await backupManager.createAppDataBackup();
        assert.equal(backup.format, 'aliyun-dns-manager-backup');
        assert.ok(backup.data.accessKeys);
        assert.equal(backup.data.logs.length, 1);

        await keyManager.saveAccessKey({
            id: '2',
            name: 'temporary',
            accessKeyId: 'ak2',
            accessKeySecret: 'sk2',
            createdAt: '2026-06-08T01:00:00.000Z',
        });
        await backupManager.restoreAppDataBackup(
            backupManager.parseAndValidateBackup(JSON.stringify(backup))
        );

        const restoredKeys = await keyManager.getAccessKeys();
        assert.equal(restoredKeys.length, 1);
        assert.equal(restoredKeys[0].name, 'production');

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
        ['log CSV export', testLogCsvExport],
        ['DNS import preview', testDnsImportPreview],
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
