# Aliyun DNS Manager

[简体中文](./README.zh-CN.md) | English

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

## Who It Is For

This tool is suitable for:

- individual operators
- small teams
- internal operations environments
- self-hosted server management

It is best used as an internal admin tool rather than a public-facing internet service.

## Quick Start

### Requirements

- Node.js 18 or later
- npm

### Install

```bash
git clone https://github.com/your-name/aliyun-dns-manager.git
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

## Security Recommendations

Before real use, especially on a server:

- always set `ADMIN_PASSWORD`
- set a dedicated `SESSION_SECRET`
- set `ENCRYPTION_KEY`
- use HTTPS when exposed over a network
- place it behind a reverse proxy if possible
- avoid exposing it directly to the public internet without additional protections

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

### Can I use it over the public internet?

Yes, but it is safer to use it behind HTTPS, a reverse proxy, and access controls.

## License

MIT
