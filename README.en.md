# Aliyun DNS Manager

[简体中文](./README.md) | English

A self-hosted web console for managing Alibaba Cloud DNS records with local credential storage, multi-account support, and a simple browser-based workflow.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)
![React](https://img.shields.io/badge/React-19-149eca.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC.svg)

## What It Does

Aliyun DNS Manager helps you manage Alibaba Cloud DNS in a cleaner way than working directly in the cloud console.

You can use it to:

- store and manage multiple Aliyun AccessKeys locally
- browse all domains under a selected account
- view, search, filter, and sort DNS records
- add, edit, enable, disable, and delete DNS records
- batch delete or batch change record status
- import and export DNS records as CSV
- protect the admin panel with password login
- check password, session signing, local encryption, and HTTPS cookie configuration
- search, filter, and export operation logs
- back up and restore local AccessKey data and operation logs

## Who It Is For

This tool is suitable for:

- individual operators
- small teams
- internal operations environments
- self-hosted server management

It is best used as an internal admin tool rather than a public-facing internet service.

## Download

You can either download the source code or use the ready-made release package.

- Latest release: [GitHub Releases](https://github.com/JinSheng-oam/aliyun-dns-manager/releases/latest)
- Source code: [JinSheng-oam/aliyun-dns-manager](https://github.com/JinSheng-oam/aliyun-dns-manager)

After downloading the release package, unzip it, copy `.env.example` to `.env`, update the required settings, and run:

```bash
node scripts/run-with-port.js start
```

On Windows, you can also double-click `start.bat` after configuring `.env`.

## Quick Start

### Requirements

- Node.js 18 or later
- npm

### Install

```bash
git clone https://github.com/JinSheng-oam/aliyun-dns-manager.git
cd aliyun-dns-manager
npm install
copy .env.example .env
```

Edit `.env` and set at least:

```env
ADMIN_PASSWORD=your_dashboard_password
SESSION_SECRET=your_random_session_secret
ENCRYPTION_KEY=your_random_encryption_key_string
```

Then start the application:

```bash
npm run dev
```

Open the address shown in the terminal, for example:

```text
http://localhost:3000
```

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Yes | Password required to enter the admin panel. |
| `SESSION_SECRET` | Recommended | Secret used to sign login session cookies. |
| `ENCRYPTION_KEY` | Recommended | Encrypts locally stored AccessKeys. |
| `PORT` | No | Application port. Default is `3000`. |
| `HOST` | No | Listening address. Default is `0.0.0.0`. |
| `FORCE_HTTPS_COOKIE` | No | Set to `true` when deploying behind HTTPS. |
| `LOGIN_WINDOW_SECONDS` | No | Login rate-limit window in seconds. |
| `LOGIN_MAX_ATTEMPTS` | No | Maximum failed logins allowed in the window. |

## How Data Is Stored

This application stores its runtime data locally on your own machine or server.

- AccessKeys are stored in local JSON files
- operation logs are stored locally
- when `ENCRYPTION_KEY` is configured, AccessKeys are encrypted before being written to disk

No DNS credentials are uploaded to any third-party service by this project.

## Operation Logs

Open **Operation Logs** from the DNS management page to:

- search by action, IP address, details, or error message
- filter successful or failed operations
- export the current filtered results as CSV

Exported CSV files use UTF-8 encoding and can be opened in common spreadsheet applications.

## Data Backup and Restore

Use the **Security Check** page to export or restore application data.

The backup file contains:

- encrypted AccessKey data
- operation logs

It does not contain `.env`, `ADMIN_PASSWORD`, `SESSION_SECRET`, or `ENCRYPTION_KEY`.

Before restoring:

1. Restore replaces the current AccessKeys and operation logs.
2. You must use the same `ENCRYPTION_KEY` that was active when the backup was created.
3. The application validates the format and decrypts the AccessKey data before writing anything.
4. Export the current data first if you need an additional rollback copy.

## Security Recommendations

Before real use, especially on a server:

- always set `ADMIN_PASSWORD`
- set a dedicated `SESSION_SECRET`
- set `ENCRYPTION_KEY`
- use HTTPS when exposed over a network
- place it behind a reverse proxy if possible
- avoid exposing it directly to the public internet without additional protections
- use a RAM user AccessKey instead of an Alibaba Cloud root account AccessKey
- grant only the domains and DNS record actions that this tool needs

### Minimum AccessKey Permission Example

The following policy is a reference example that only allows DNS record management for one domain. Replace `account-id` and `example.com` with your own Alibaba Cloud account ID and domain name.

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "alidns:DescribeDomains",
        "alidns:DescribeDomainRecords",
        "alidns:AddDomainRecord",
        "alidns:UpdateDomainRecord",
        "alidns:SetDomainRecordStatus",
        "alidns:DeleteDomainRecord"
      ],
      "Resource": [
        "acs:alidns:*:account-id:domain/example.com"
      ]
    }
  ]
}
```

If you need to manage multiple domains, add them to `Resource`. Avoid granting broad permissions such as `alidns:*` or `*:*`.

## Deployment

### Run as a Normal Node.js App

```bash
npm install
npm run build
npm run start
```

### Run with PM2

```bash
npm install -g pm2
pm2 start npm --name "aliyun-dns-manager" -- start
pm2 save
pm2 startup
```

### Build a Standalone Release Package

```bash
npm run package
```

This generates a deployable `release/` directory.

## Upgrade

### If You Use the Release Package

1. Stop the old version.
2. Back up the old `.env` file and `data/` directory.
3. Download and unzip the latest release package.
4. Copy the backed-up `.env` and `data/` into the new version directory.
5. Start the new version with `node scripts/run-with-port.js start` or `start.bat` on Windows.

Keep the same `ENCRYPTION_KEY` when upgrading. If it changes, previously saved AccessKeys may no longer be readable.

After upgrading to a version with the new session validation, existing sessions may be invalidated once. Log in again with the current `ADMIN_PASSWORD`. Later changes to `ADMIN_PASSWORD` or `SESSION_SECRET` will also invalidate old sessions automatically.

### If You Run from Source

```bash
git pull
npm install
npm run build
npm run start
```

Before upgrading from source, make sure your `.env` file and local `data/` directory are backed up.

## Typical Usage Flow

1. Log in with the admin password.
2. Add one or more Aliyun AccessKeys.
3. Open the DNS page.
4. Select an account and domain.
5. Manage records from the web interface.

## FAQ

### Why can I not log in?

Check the following:

- `ADMIN_PASSWORD` is configured
- the entered password is correct
- too many failed attempts have not triggered rate limiting
- `FORCE_HTTPS_COOKIE` is not enabled on a plain HTTP deployment

### Why are previous AccessKeys no longer readable?

In most cases, `ENCRYPTION_KEY` changed. Previously encrypted data can only be read with the same effective encryption key.

The key and DNS pages show a read error and stop AccessKey writes so the existing data file is not overwritten. When this happens:

1. Do not delete or overwrite `data/access_keys.json`.
2. Back up the entire `data/` directory.
3. Restore the original `ENCRYPTION_KEY` used when the AccessKeys were saved.
4. If the key did not change, check whether `data/access_keys.json` is damaged.

### Can I use it over the public internet?

Yes, but it is safer to use it behind HTTPS, a reverse proxy, and access controls.

## License

MIT
