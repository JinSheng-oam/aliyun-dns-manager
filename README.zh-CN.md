# 阿里云 DNS 管理器

[English](./README.en.md) | 简体中文

一个适合自托管使用的阿里云 DNS 在线管理后台，支持本地保存凭据、多账号切换，以及通过浏览器完成常见 DNS 管理操作。

![授权](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)
![React](https://img.shields.io/badge/React-19-149eca.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC.svg)

## 功能说明

阿里云 DNS 管理器适合用来替代繁琐的云控制台操作，让日常解析维护更直观。

你可以用它来：

- 在本地保存并管理多个阿里云 AccessKey
- 自动翻页并查看某个账号下的全部域名和解析记录
- 查询、搜索，并按类型、状态、TTL 范围筛选和排序 DNS 记录
- 新增、编辑、启用、暂停、删除 DNS 记录
- 批量删除或批量修改记录状态，并查看成功、失败数量和失败明细
- 通过 CSV 导入和导出解析记录，导入前预览新增、跳过和错误项
- 按域名导出可重新导入的完整 JSON 备份
- 按当前域名查看新增、修改、删除和状态变更历史
- 在每次 DNS 写操作前自动创建快照，支持恢复预览和失败自动回滚
- 检查 DNS 记录格式、冲突、TTL、暂停状态和当前公网解析结果
- 在域名列表查看批量健康概览
- 使用只读模式开放查询、检测和导出，同时在服务器端阻止写操作
- 使用管理员密码保护后台入口
- 检查密码、会话签名、本地加密和 HTTPS Cookie 配置状态
- 搜索、筛选并导出操作日志，高风险操作会单独标记
- 备份和恢复本地 AccessKey、操作日志及 DNS 快照

## 适用场景

这个工具适合：

- 个人运维
- 小团队内部使用
- 内网运维环境
- 自托管服务器管理

更推荐把它作为内部管理工具使用，而不是直接裸露在公网。

## 下载

你可以下载源码运行，也可以直接下载已经打包好的发行版。

- 最新发行版：[GitHub Releases](https://github.com/JinSheng-oam/aliyun-dns-manager/releases/latest)
- 源码仓库：[JinSheng-oam/aliyun-dns-manager](https://github.com/JinSheng-oam/aliyun-dns-manager)

下载发行版压缩包后，解压，复制 `.env.example` 为 `.env`，按需修改配置，然后运行：

```bash
node scripts/run-with-port.js start
```

在 Windows 上，配置好 `.env` 后也可以双击 `start.bat` 启动。

## 快速开始

### 环境要求

- Node.js 20.9 或更高版本（推荐 Node.js 22）
- npm

### 安装

```bash
git clone https://github.com/JinSheng-oam/aliyun-dns-manager.git
cd aliyun-dns-manager
npm install
copy .env.example .env
```

编辑 `.env`，至少配置以下内容：

```env
ADMIN_PASSWORD=your_dashboard_password
SESSION_SECRET=your_random_session_secret
ENCRYPTION_KEY=your_random_encryption_key_string
```

然后启动：

```bash
npm run dev
```

打开终端输出的网址，例如：

```text
http://localhost:3999
```

## 配置项

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 是 | 进入后台所需的管理员密码。 |
| `SESSION_SECRET` | 推荐 | 用于签名登录会话 Cookie。 |
| `ENCRYPTION_KEY` | 推荐 | 用于加密本地保存的 AccessKey。 |
| `APP_DATA_DIR` | 否 | 自定义数据保存目录，默认使用项目目录下的 `data/`。 |
| `READONLY_MODE` | 否 | 设为 `true` 后只允许查询、健康检查、导出和创建快照，服务器会拒绝写操作。 |
| `PORT` | 否 | 应用默认端口为 `3000`；`.env.example` 模板设置为 `3999`。 |
| `HOST` | 否 | 监听地址，默认 `0.0.0.0`。 |
| `FORCE_HTTPS_COOKIE` | 否 | 在 HTTPS 部署时建议设为 `true`。 |
| `LOGIN_WINDOW_SECONDS` | 否 | 登录失败限流窗口，单位秒。 |
| `LOGIN_MAX_ATTEMPTS` | 否 | 限流窗口内允许的最大失败次数。 |

## 数据存储方式

本应用会把运行数据保存在你自己的机器或服务器本地。

- AccessKey 保存在本地 JSON 文件中
- 操作日志保存在本地
- DNS 快照保存在本地，单个 AccessKey 的每个域名最多保留最新 20 个
- 配置 `ENCRYPTION_KEY` 后，AccessKey 会在写入磁盘前加密

本项目不会把 DNS 凭据上传到第三方服务。

## 操作日志

在 DNS 管理页面打开“操作日志”，可以：

- 按操作、IP、详情或错误信息搜索
- 按成功或失败状态筛选
- 仅查看删除、暂停、恢复等高风险操作
- 将当前筛选结果导出为 CSV

导出的 CSV 使用 UTF-8 编码，可直接使用常见表格软件打开。

## CSV 导入预览

在 DNS 管理页面选择域名后，可以上传 CSV 文件。系统会先显示逐行预览和变更摘要：

- “将新增”表示确认后会创建的记录
- “将跳过”表示与当前域名或文件内其他行完全重复的记录
- “格式错误”表示缺少必填字段或 TTL 无效的记录

只有“将新增”的记录会在你点击确认后提交到阿里云，取消预览不会修改任何 DNS 记录。

## DNS 快照与恢复

进入某个域名后，点击“快照与恢复”可以查看自动快照、创建手动快照，或预览恢复计划。

- 新增、修改、删除、启停和批量导入前都会自动保存当前记录
- 恢复前会显示将新增、更新、删除和保持不变的记录数量
- 快照只能恢复到原来的 AccessKey 和域名
- 执行恢复前会再保存一个安全快照；恢复中途失败时系统会尝试自动回滚

## DNS 健康检查

点击域名内的“健康检查”可以运行只读检测，检查内容包括：

- A、AAAA、CNAME、MX、NS 等常见记录值格式
- CNAME 与其他记录冲突、重复记录和 CNAME 自循环
- 异常 TTL 和已暂停记录
- A、AAAA、CNAME、MX、TXT 的当前公网解析结果

刚修改过的记录可能仍处于 DNS 传播期，此时公网结果不一致会显示为提醒，而不会修改任何 DNS 数据。域名列表中的“检查全部域名”使用本地配置检查快速显示健康概览。

## 只读模式

在 `.env` 中设置 `READONLY_MODE=true` 并重启后，仍可查看域名和记录、导出数据、创建快照、查看日志以及运行健康检查。AccessKey 增删改、DNS 写操作、导入、快照恢复和应用数据恢复会同时在界面和服务器端被阻止。

## 域名完整备份

在 DNS 管理页面选择域名后，点击“导出域名完整备份”可下载 JSON 备份。备份包含：

- 域名名称和导出时间
- 主机记录、记录类型、记录值和 TTL
- 每条记录的启用或暂停状态

需要恢复时，使用同一个“导入”按钮选择 JSON 备份。系统会先检查备份所属域名并显示导入预览，确认后新增记录并还原暂停状态。为避免误操作，备份不能导入到其他域名。

## DNS 变更历史

选择域名后，点击记录列表上方的“查看 DNS 变更历史”，可以查看该域名的新增、修改、删除、启用、暂停和批量操作记录。

变更历史从升级到支持结构化日志的版本后开始记录。更早的操作仍可在“操作日志”中查看，但不会按域名自动归类。

## DNS 记录筛选

记录列表支持组合使用以下筛选条件：

- 主机记录或记录值关键词
- 记录类型
- 正常或已暂停状态
- TTL 最小值和最大值，包含输入的边界值

TTL 留空表示不限制。点击“重置筛选”可以一次清空全部条件。

## 数据备份与恢复

在“安全检查”页面可以导出或恢复应用数据。

备份文件包含：

- 加密后的 AccessKey 数据
- 操作日志
- DNS 快照

备份文件不包含 `.env`、`ADMIN_PASSWORD`、`SESSION_SECRET` 或 `ENCRYPTION_KEY`。

恢复前请注意：

1. 恢复会覆盖当前 AccessKey、操作日志和 DNS 快照。
2. 必须使用创建备份时的同一个 `ENCRYPTION_KEY`。
3. 系统会先验证备份格式并尝试解密 AccessKey，验证失败不会写入数据。
4. 建议恢复前先导出当前数据作为额外备份。

## 安全建议

正式使用时，尤其是部署到服务器上时，建议至少做到：

- 一定设置 `ADMIN_PASSWORD`
- 设置独立的 `SESSION_SECRET`
- 设置 `ENCRYPTION_KEY`
- 通过 HTTPS 提供访问
- 尽量放在反向代理之后
- 不要在没有额外保护的情况下直接暴露到公网
- 使用 RAM 子账号 AccessKey，不要使用阿里云主账号 AccessKey
- 尽量只授予需要管理的域名和解析记录操作权限

### AccessKey 最小权限示例

下面是一个参考策略，仅允许管理指定域名的解析记录。使用前请把 `账号ID` 和 `example.com` 替换成你自己的阿里云账号 ID 和域名。

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
        "acs:alidns:*:账号ID:domain/example.com"
      ]
    }
  ]
}
```

如果需要管理多个域名，可以在 `Resource` 中继续添加域名。不要为了省事直接授予 `alidns:*` 或 `*:*`。

## 部署方式

### 使用 Docker Compose

先复制并修改环境变量：

```bash
copy .env.example .env
```

在 Linux 或 macOS 上可使用：

```bash
cp .env.example .env
```

确认已经修改 `.env` 中的 `ADMIN_PASSWORD`、`SESSION_SECRET` 和 `ENCRYPTION_KEY`，然后启动：

```bash
docker compose up -d --build
```

Docker Compose 会把本地 `data/` 挂载到容器中。更新或重建容器不会删除 AccessKey 和操作日志，但仍建议升级前使用“安全检查”页面导出备份。

查看运行状态：

```bash
docker compose ps
```

停止服务：

```bash
docker compose down
```

健康检查地址为 `/api/health`，例如 `http://localhost:3999/api/health`。实际端口以 `.env` 中的 `PORT` 为准。

### 普通 Node.js 运行

```bash
npm install
npm run build
npm run start
```

### 使用 PM2 运行

```bash
npm install -g pm2
pm2 start npm --name "aliyun-dns-manager" -- start
pm2 save
pm2 startup
```

### 打包独立部署目录

```bash
npm run package
```

执行后会生成可部署的 `release/` 目录。

## 升级版本

### 使用 Docker Compose 时

```bash
git pull
docker compose up -d --build
```

升级前请备份 `.env` 和 `data/`，并始终保留原来的 `ENCRYPTION_KEY`。容器更新后可通过 `docker compose ps` 检查健康状态。

### 使用发行包时

1. 停止旧版本。
2. 备份旧版本目录中的 `.env` 文件和 `data/` 目录。
3. 下载并解压最新发行包。
4. 把备份的 `.env` 和 `data/` 复制到新版本目录。
5. 使用 `node scripts/run-with-port.js start` 启动，Windows 也可以双击 `start.bat`。

升级时请保留原来的 `ENCRYPTION_KEY`。如果它发生变化，之前保存的 AccessKey 可能无法读取。

升级到包含新版会话校验的版本后，已有登录会话可能会失效一次，请使用当前 `ADMIN_PASSWORD` 重新登录。之后修改 `ADMIN_PASSWORD` 或 `SESSION_SECRET` 也会自动使旧会话失效。

### 使用源码运行时

```bash
git pull
npm install
npm run build
npm run start
```

从源码升级前，也建议先备份 `.env` 文件和本地 `data/` 目录。

## 典型使用流程

1. 使用管理员密码登录后台。
2. 添加一个或多个阿里云 AccessKey。
3. 进入 DNS 页面。
4. 选择账号和域名。
5. 在网页中完成解析记录管理。

## 常见问题

### 为什么无法登录？

请检查：

- 是否配置了 `ADMIN_PASSWORD`
- 输入密码是否正确
- 是否因连续失败过多触发了限流
- 在纯 HTTP 部署下是否错误开启了 `FORCE_HTTPS_COOKIE`

### 为什么之前保存的 AccessKey 读不出来？

通常是因为 `ENCRYPTION_KEY` 发生了变化。旧数据只能用相同的有效加密密钥读取。

应用会在密钥管理页和 DNS 管理页显示读取失败提示，并停止 AccessKey 写入，避免损坏的数据文件被覆盖。出现提示时：

1. 不要删除或覆盖 `data/access_keys.json`。
2. 先备份整个 `data/` 目录。
3. 恢复保存这些 AccessKey 时使用的原 `ENCRYPTION_KEY`。
4. 如果密钥没有变化，请检查 `data/access_keys.json` 是否损坏。

### 为什么升级后 AccessKey 一开始没显示，新增一个后才出现？

这通常是旧版本页面缓存导致的显示问题，数据本身没有丢失。请升级到已修复的版本，并重启应用。修复后密钥管理页和 DNS 管理页会在每次访问时读取当前本地数据。

### 可以直接暴露到公网使用吗？

可以，但更推荐放在 HTTPS、反向代理和访问控制之后使用。

## 开源协议

MIT
