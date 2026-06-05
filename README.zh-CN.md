# 阿里云 DNS 管理器

English | [简体中文](./README.zh-CN.md)

一个适合自托管使用的阿里云 DNS 在线管理后台，支持本地保存凭据、多账号切换，以及通过浏览器完成常见 DNS 管理操作。

![授权](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)
![React](https://img.shields.io/badge/React-19-149eca.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC.svg)

## 功能说明

阿里云 DNS 管理器适合用来替代繁琐的云控制台操作，让日常解析维护更直观。

你可以用它来：

- 在本地保存并管理多个阿里云 AccessKey
- 查看某个账号下的全部域名
- 查询、搜索、筛选、排序 DNS 记录
- 新增、编辑、启用、暂停、删除 DNS 记录
- 批量删除或批量修改记录状态
- 通过 CSV 导入和导出解析记录
- 使用管理员密码保护后台入口

## 适用场景

这个工具适合：

- 个人运维
- 小团队内部使用
- 内网运维环境
- 自托管服务器管理

更推荐把它作为内部管理工具使用，而不是直接裸露在公网。

## 快速开始

### 环境要求

- Node.js 18 或更高版本
- npm

### 安装

```bash
git clone https://github.com/your-name/aliyun-dns-manager.git
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
http://localhost:3000
```

## 配置项

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 是 | 进入后台所需的管理员密码。 |
| `SESSION_SECRET` | 推荐 | 用于签名登录会话 Cookie。 |
| `ENCRYPTION_KEY` | 推荐 | 用于加密本地保存的 AccessKey。 |
| `PORT` | 否 | 应用端口，默认 `3000`。 |
| `HOST` | 否 | 监听地址，默认 `0.0.0.0`。 |
| `FORCE_HTTPS_COOKIE` | 否 | 在 HTTPS 部署时建议设为 `true`。 |
| `LOGIN_WINDOW_SECONDS` | 否 | 登录失败限流窗口，单位秒。 |
| `LOGIN_MAX_ATTEMPTS` | 否 | 限流窗口内允许的最大失败次数。 |

## 数据存储方式

本应用会把运行数据保存在你自己的机器或服务器本地。

- AccessKey 保存在本地 JSON 文件中
- 操作日志保存在本地
- 配置 `ENCRYPTION_KEY` 后，AccessKey 会在写入磁盘前加密

本项目不会把 DNS 凭据上传到第三方服务。

## 安全建议

正式使用时，尤其是部署到服务器上时，建议至少做到：

- 一定设置 `ADMIN_PASSWORD`
- 设置独立的 `SESSION_SECRET`
- 设置 `ENCRYPTION_KEY`
- 通过 HTTPS 提供访问
- 尽量放在反向代理之后
- 不要在没有额外保护的情况下直接暴露到公网

## 部署方式

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

### 可以直接暴露到公网使用吗？

可以，但更推荐放在 HTTPS、反向代理和访问控制之后使用。

## 开源协议

MIT
