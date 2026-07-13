# 阿里云 DNS 管理器代码说明

> 内部维护用：这份文档面向接手项目的人和后续 AI 助手，用来快速理解代码结构、认证模型、数据流和发布流程。面向普通用户的说明以根目录 `README.md` 为准。

## 当前状态

- 当前代码版本：`0.4.0`
- 最新已发布版本：`v0.3.2`
- 默认 README：中文 `README.md`
- 英文 README：`README.en.md`
- 中文镜像 README：`README.zh-CN.md`
- 待发布版本：`v0.4.0`
- 默认分支：`master`
- CI：GitHub Actions `CI`
- 自动发版：GitHub Actions `Release`

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Server Actions
- 本地 JSON 文件存储
- 阿里云 Alidns SDK

## 目录结构

```text
aliyun-dns-manager/
├── .github/workflows/
│   ├── ci.yml                 # push / PR 自动检查
│   └── release.yml            # v* 标签自动打包并发布 Release
├── docs/
│   ├── code-wiki.md           # 当前文件，内部代码说明
│   └── update-plan.zh-CN.md   # 内部版本计划和更新说明
├── e2e/                       # Playwright 浏览器回归测试
├── public/                    # 静态资源
├── scripts/
│   ├── ci-tests.js            # CI 安全和数据恢复回归测试
│   ├── package.js             # standalone 发行包构建脚本
│   └── run-with-port.js       # 读取 .env 后启动 dev / start
├── src/
│   ├── app/                   # App Router 页面和 Server Actions
│   ├── components/            # 页面布局、日志弹窗、基础 UI
│   ├── lib/                   # 认证、存储、阿里云 API、日志、限流
│   └── proxy.ts               # Next.js 16 认证入口
├── .env.example               # 环境变量模板
├── Dockerfile                 # 生产镜像构建
├── docker-compose.yml         # 容器启动和 data 持久化
├── playwright.config.ts       # 浏览器测试配置
├── README.md                  # 默认中文用户文档
├── README.en.md               # 英文用户文档
├── README.zh-CN.md            # 中文用户文档镜像
├── package.json
└── next.config.ts
```

## 页面和路由

| 路由 | 文件 | 说明 |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | 首页仪表盘 |
| `/login` | `src/app/login/page.tsx` | 管理员登录页 |
| `/keys` | `src/app/keys/page.tsx` + `KeyList.tsx` | AccessKey 管理，支持新增、修改、删除、复制和显示密钥 |
| `/dns` | `src/app/dns/page.tsx` + `DnsManager.tsx` | DNS 管理，支持查询、新增、编辑、删除、批量操作、CSV 导入导出 |
| `/security` | `src/app/security/page.tsx` + `BackupManager.tsx` | 安全配置检查、数据备份和恢复 |
| `/api/health` | `src/app/api/health/route.ts` | 无需登录的容器健康检查，返回状态和版本 |

安全配置检查逻辑位于 `src/lib/security-config.ts`：

- 检查 `ADMIN_PASSWORD`、`SESSION_SECRET`、`ENCRYPTION_KEY` 和 `FORCE_HTTPS_COOKIE`
- 示例值或长度不足的敏感配置标记为“需要处理”
- 未配置的推荐项标记为“建议配置”
- 页面强制动态渲染，每次访问读取当前服务器环境变量

## 认证模型

认证入口是 `src/proxy.ts`，不是旧的 `src/middleware.ts`。Next.js 16 中 `middleware.ts` 文件约定已迁移为 `proxy.ts`。

认证流程：

1. `/_next`、`/api/auth`、`/favicon.ico`、`/login`、`/icon.png` 放行。
2. 如果没有配置 `ADMIN_PASSWORD`，重定向到 `/login`，不会放行后台页面。
3. 读取 `admin_auth` Cookie。
4. 调用 `verifyAdminSessionToken()` 校验签名和过期时间。
5. 校验失败则重定向到 `/login`。

除登录和退出外，AccessKey、DNS、日志、备份和恢复 Server Action 也会独立校验当前签名会话，不能只依赖页面路由代理。

会话逻辑在 `src/lib/auth.ts`：

- Cookie 名称：`admin_auth`
- 会话有效期：7 天
- 签名算法：HMAC-SHA-256
- 签名密钥：优先 `SESSION_SECRET`，未配置时回退到 `ADMIN_PASSWORD`
- Cookie 内容不是管理员密码，而是 `payload.signature` 形式的签名会话令牌
- payload 包含由当前管理员密码和会话密钥生成的版本指纹
- 修改 `ADMIN_PASSWORD` 或 `SESSION_SECRET` 后，旧会话自动失效
- 旧格式 Cookie 不含版本指纹，升级后需要重新登录一次

登录逻辑在 `loginAction()`：

- 未配置 `ADMIN_PASSWORD` 时拒绝登录
- 登录失败按 IP 限流
- 登录成功后写入 httpOnly Cookie
- `FORCE_HTTPS_COOKIE=true` 时启用 Secure Cookie，适合 HTTPS 反向代理部署

## 环境变量

| 变量 | 作用 | 备注 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 管理后台登录密码 | 必填；未配置时拒绝登录 |
| `SESSION_SECRET` | 登录会话签名密钥 | 推荐独立配置 |
| `ENCRYPTION_KEY` | 本地 AccessKey 加密密钥 | 升级时必须保留，否则旧 AccessKey 可能无法读取 |
| `APP_DATA_DIR` | 自定义数据目录 | 可选；默认使用项目根目录下的 `data/` |
| `PORT` | 运行端口 | 默认 `3000`，模板中为 `3999` |
| `HOST` | 监听地址 | 默认 `0.0.0.0` |
| `FORCE_HTTPS_COOKIE` | 是否强制 Secure Cookie | HTTPS 部署时可设为 `true` |
| `LOGIN_WINDOW_SECONDS` | 登录失败限流窗口 | 默认 60 秒 |
| `LOGIN_MAX_ATTEMPTS` | 限流窗口内最大失败次数 | 默认 5 次 |

## 数据存储

运行数据默认保存在项目运行目录下的 `data/`，也可通过 `APP_DATA_DIR` 指定其他目录：

- `data/access_keys.json`：AccessKey 列表，加密保存
- `data/logs.json`：操作日志，最多保留最近 1000 条

AccessKey 加密逻辑在 `src/lib/key-manager.ts`：

- 算法：AES-256-GCM
- IV：12 字节
- Auth Tag：16 字节
- 密钥：`ENCRYPTION_KEY` 经 SHA-256 派生
- 存储格式：Base64(`IV` + `AuthTag` + `Ciphertext`)

注意事项：

- 发行包不能包含本地 `.env`。
- 发行包不能包含本地 `data/`。
- `scripts/package.js` 会主动排除和清理 `.env`、`data/`。
- CI 和 Release workflow 都会检查发行目录不含 `.env` / `data/`。
- 首次启动且 `access_keys.json` 不存在时返回空列表。
- 文件已存在但无法解密或解析时抛出 `AccessKeyReadError`。
- 读取失败后新增、修改和删除都会中止，避免覆盖原数据文件。
- 密钥页和 DNS 页会显示固定恢复指引，不向浏览器暴露底层异常。

## Server Actions

核心入口是 `src/app/actions.ts`。

AccessKey：

- `getAccessKeysAction()`
- `addAccessKeyAction(name, accessKeyId, accessKeySecret)`
- `updateAccessKeyAction(id, name, accessKeyId, accessKeySecret)`
- `deleteAccessKeyAction(id)`

DNS：

- `listDomainsAction(keyId)`
- `listDnsRecordsAction(keyId, domain)`
- `addDnsRecordAction(keyId, domain, rr, type, value, ttl?)`
- `updateDnsRecordAction(keyId, recordId, rr, type, value, ttl?)`
- `deleteDnsRecordAction(keyId, recordId)`
- `setDnsRecordStatusAction(keyId, recordId, status)`
- `batchDeleteDnsRecordsAction(keyId, recordIds)`
- `batchSetDnsRecordsStatusAction(keyId, recordIds, status)`
- `batchAddDnsRecordsAction(keyId, domain, records)`

认证和日志：

- `loginAction(password)`
- `logoutAction()`
- `getLogsAction()`

普通操作返回格式为：

```ts
{ success: boolean; data?: T; error?: string }
```

批量操作额外返回 `summary` 和 `failures`，包含总数、成功数、失败数及逐条失败原因。

## 阿里云 DNS 客户端

`src/lib/aliyun-dns.ts` 封装阿里云 Alidns SDK。

| 方法 | 作用 |
| --- | --- |
| `createClient(ak, sk)` | 创建 Alidns 客户端，endpoint 为 `alidns.cn-hangzhou.aliyuncs.com` |
| `listDomains(ak, sk)` | 自动翻页并查询全部域名 |
| `listRecords(ak, sk, domain)` | 自动翻页并查询全部解析记录 |
| `addRecord(...)` | 新增解析记录 |
| `updateRecord(...)` | 更新解析记录 |
| `setRecordStatus(...)` | 启用或暂停解析记录 |
| `deleteRecord(...)` | 删除解析记录 |

README 中的最小权限示例应覆盖当前代码实际调用的 API：

- `alidns:DescribeDomains`
- `alidns:DescribeDomainRecords`
- `alidns:AddDomainRecord`
- `alidns:UpdateDomainRecord`
- `alidns:SetDomainRecordStatus`
- `alidns:DeleteDomainRecord`

如果后续新增云解析 DNS API 调用，需要同步更新 README 的 RAM 权限示例。

分页逻辑位于 `src/lib/pagination.ts`。域名每页请求 100 条，解析记录每页请求 500 条，直到达到 API 返回的总数。

批量任务使用 `src/lib/batch.ts` 的受控并发执行器，当前并发数为 5。批量新增、删除和状态修改均保留输入顺序，并返回失败记录明细。

## 数据备份和恢复

服务端逻辑位于 `src/lib/backup-manager.ts`，界面位于 `src/app/security/BackupManager.tsx`。

备份格式：

- `format`：固定为 `aliyun-dns-manager-backup`
- `version`：当前为 `1`
- `createdAt`：备份生成时间
- `data.accessKeys`：`access_keys.json` 的原始加密内容，文件不存在时为 `null`
- `data.logs`：最多 1000 条操作日志

安全边界：

- 不导出 `.env` 或任何环境变量
- 导出和恢复 Server Action 都校验当前登录 Cookie
- 恢复文件限制为 5 MB
- 写入前校验备份结构、日志结构，并使用当前 `ENCRYPTION_KEY` 解密 AccessKey
- 使用临时文件替换，失败时恢复原文件
- 客户端恢复前显示备份时间和内容摘要，并要求二次确认

## 日志和限流

日志：

- 文件：`src/lib/logger.ts`
- 存储：`data/logs.json`
- 写入前会自动创建 `data/`
- 保留最近 1000 条
- 记录动作、时间、IP、状态和错误信息
- `src/components/LogsViewer.tsx` 支持关键词和状态筛选
- 导出范围为当前筛选结果
- `src/lib/log-export.ts` 生成带 UTF-8 BOM 的 CSV，并转义引号和潜在公式前缀

登录限流：

- 文件：`src/lib/rate-limit.ts`
- 存储在内存中的全局 Map
- 按 IP 统计失败次数
- 登录成功后清理该 IP 的失败记录

## 打包脚本

`scripts/package.js` 做 standalone 发行包：

1. 执行 `npm run build`。
2. 清理并创建 `release/`。
3. 复制 `.next/standalone`。
4. 排除和清理 `.env`、`data/`。
5. 复制 `public/` 和 `.next/static/`。
6. 复制 `.env.example`。
7. 复制 `scripts/run-with-port.js`。
8. 生成 `start.bat`、`start.sh`。
9. 生成发行包内中文说明 `使用说明.txt`。

发行包启动方式：

```bash
node scripts/run-with-port.js start
```

Windows 用户可使用：

```text
start.bat
```

`scripts/run-with-port.js` 使用当前 Node.js 进程直接执行项目内的 Next.js CLI，不经过 `npx.cmd`，兼容 Windows 上的 Node.js 24。

## Docker 部署

- `Dockerfile` 使用 Node.js 22 Alpine 多阶段构建 Next.js standalone 镜像。
- `.dockerignore` 排除 `.env`、`data/`、构建产物和本地依赖。
- `docker-compose.yml` 把本地 `data/` 挂载到容器 `/app/data`。
- 容器通过 `/api/health` 执行健康检查。
- 容器内部固定监听 3000，宿主机端口使用 `.env` 中的 `PORT`。

## GitHub Actions

### CI

文件：`.github/workflows/ci.yml`

触发：

- push 到 `master` / `main`
- PR 到 `master` / `main`

基础 Actions 使用 `actions/checkout@v6` 和 `actions/setup-node@v6`。

任务：

- `quality`：Node.js 20 和 22 分别执行 lint、类型检查、数据测试和生产构建。
- `browser`：安装 Chromium 并执行 `npm run test:e2e`。
- `package`：执行生产依赖审计、standalone 打包和发行包内容检查。
- `docker`：构建生产 Docker 镜像。

`scripts/ci-tests.js` 覆盖：

- 管理员密码或会话密钥变化后旧会话失效
- 日志 CSV 的 UTF-8 BOM、转义和公式注入防护
- AccessKey 数据损坏时禁止写入和覆盖
- 备份恢复成功路径，以及无效备份写入前拒绝
- 阿里云列表分页收集完整性
- 批量任务并发上限和结果顺序

`e2e/` 覆盖：

- 管理员登录失败和成功流程
- 登录页、操作日志和确认弹窗保持在视口内
- AccessKey 新增后刷新仍立即显示，并可修改
- 移动端菜单和页面导航
- `/api/health` 返回当前版本

### Release

文件：`.github/workflows/release.yml`

触发：

- 推送 `v*` 标签

步骤：

- 校验标签版本和 `package.json` 版本一致
- 使用 Node.js 22 运行 lint、类型检查、数据测试、浏览器测试、依赖审计和 Docker 构建
- 生成 `aliyun-dns-manager-vX.Y.Z.zip`
- 生成 `.sha256`
- 创建或更新 GitHub Release

发行说明格式：

- Release 标题使用英文产品名：`Aliyun DNS Manager vX.Y.Z`
- Release 正文使用中文说明
- 正文不再额外生成 Markdown 标题，避免页面显示两个标题

## 发版流程

以后发版按这个顺序：

```bash
npm version <version> --no-git-tag-version
git add package.json package-lock.json
git commit -m "Release v<version>"
git push
git tag v<version>
git push origin v<version>
```

标签推送后，GitHub Actions 会自动构建发行包并上传 Release 附件。

## 维护注意事项

- 不要把 `.env`、`data/`、`.next/`、`node_modules/`、`release/` 提交到仓库。
- 不要手工把本地 zip 上传为正式发行包，优先使用 GitHub Actions 自动发版。
- 修改认证逻辑时同时检查 `src/proxy.ts`、`src/lib/auth.ts`、`src/app/actions.ts`。
- 修改环境变量时同步更新 `.env.example`、`README.md`、`README.en.md`、`README.zh-CN.md`。
- 修改发行包内容时同步检查 `scripts/package.js`、`ci.yml`、`release.yml`。
- 默认 README 是中文，英文内容放在 `README.en.md`。
