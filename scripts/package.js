/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 阿里云 DNS 管理器 打包脚本
 * 功能：执行构建并提取独立运行所需的最小文件集到 release 目录
 */

const projectRoot = path.join(__dirname, '..');
const releaseDir = path.join(projectRoot, 'release');
const excludedReleaseSources = new Set();

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyRecursiveSync(src, dest) {
    if (excludedReleaseSources.has(src)) {
        return;
    }

    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        ensureDir(dest);
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

function removeRuntimeData() {
    const envFile = path.join(releaseDir, '.env');
    if (fs.existsSync(envFile)) {
        fs.unlinkSync(envFile);
    }

    const dataDir = path.join(releaseDir, 'data');
    if (fs.existsSync(dataDir)) {
        removeDirectory(dataDir);
    }
}

function removeDirectory(dir) {
    for (const fileName of fs.readdirSync(dir)) {
        const target = path.join(dir, fileName);
        if (fs.statSync(target).isDirectory()) {
            removeDirectory(target);
        } else {
            fs.unlinkSync(target);
        }
    }
    fs.rmdirSync(dir);
}

async function main() {
    console.log('🚀 开始打包流程...');

    try {
        // 1. 执行 Next.js 构建
        console.log('📦 正在执行 next build...');
        execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });

        // 2. 清理并创建 release 目录
        console.log('🧹 清理旧的 release 目录...');
        if (fs.existsSync(releaseDir)) {
            fs.rmSync(releaseDir, { recursive: true, force: true });
        }
        ensureDir(releaseDir);

        // 3. 复制 standalone 输出
        // 只有开启了 next.config.ts 中的 output: 'standalone' 才会生成此目录
        const standaloneDir = path.join(projectRoot, '.next', 'standalone');
        if (!fs.existsSync(standaloneDir)) {
            throw new Error('未发现 standalone 目录，请确保 next.config.ts 已配置 output: "standalone"');
        }
        excludedReleaseSources.add(path.join(standaloneDir, '.env'));
        excludedReleaseSources.add(path.join(standaloneDir, 'data'));

        console.log('🚚 复制核心运行文件...');
        copyRecursiveSync(standaloneDir, releaseDir);
        removeRuntimeData();

        // 4. 复制静态资源 (Standalone 不内置静态资源)
        console.log('🖼️ 复制静态资源...');
        const publicSrc = path.join(projectRoot, 'public');
        const publicDest = path.join(releaseDir, 'public');
        copyRecursiveSync(publicSrc, publicDest);

        const staticSrc = path.join(projectRoot, '.next', 'static');
        const staticDest = path.join(releaseDir, '.next', 'static');
        ensureDir(staticDest);
        copyRecursiveSync(staticSrc, staticDest);

        // 5. 复制启动辅助脚本和配置模板
        console.log('📄 复制辅助文件...');
        fs.copyFileSync(path.join(projectRoot, '.env.example'), path.join(releaseDir, '.env.example'));
        
        // 复制原有的端口辅助脚本
        const releaseScriptsDir = path.join(releaseDir, 'scripts');
        ensureDir(releaseScriptsDir);
        fs.copyFileSync(path.join(projectRoot, 'scripts', 'run-with-port.js'), path.join(releaseScriptsDir, 'run-with-port.js'));

        const startBat = `@echo off
if not exist .env (
    echo [!] .env file not found. Copying from .env.example...
    copy .env.example .env
    echo.
    echo Please edit .env first, then run start.bat again.
    echo Required: ADMIN_PASSWORD, SESSION_SECRET, ENCRYPTION_KEY
    pause
    exit /b 1
)
echo Starting Aliyun DNS Manager via port helper...
node scripts/run-with-port.js start
pause`;
        fs.writeFileSync(path.join(releaseDir, 'start.bat'), startBat);

        const startSh = `#!/bin/bash
if [ ! -f .env ]; then
    echo "[!] .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo
    echo "Please edit .env first, then run ./start.sh again."
    echo "Required: ADMIN_PASSWORD, SESSION_SECRET, ENCRYPTION_KEY"
    exit 1
fi
echo "Starting Aliyun DNS Manager via port helper..."
node scripts/run-with-port.js start`;
        fs.writeFileSync(path.join(releaseDir, 'start.sh'), startSh);
        fs.chmodSync(path.join(releaseDir, 'start.sh'), '755');

        const releaseReadme = `阿里云 DNS 管理器 - 发行包使用说明

1. 首次使用

- Windows: 双击 start.bat
- macOS / Linux: 执行 ./start.sh

如果当前目录没有 .env，启动脚本会自动从 .env.example 复制一份 .env，并提示你先修改配置。

2. 必须配置

请至少修改以下配置：

- ADMIN_PASSWORD: 后台登录密码
- SESSION_SECRET: 登录会话签名密钥
- ENCRYPTION_KEY: 本地 AccessKey 加密密钥

注意：ENCRYPTION_KEY 用于读取已保存的 AccessKey。升级版本时请保留原来的 ENCRYPTION_KEY。

3. 手动启动

配置 .env 后，也可以执行：

node scripts/run-with-port.js start

4. 升级版本

- 停止旧版本
- 备份旧版本目录中的 .env 和 data 目录
- 解压新版本发行包
- 将备份的 .env 和 data 复制到新版本目录
- 重新启动

5. 访问地址

默认端口来自 .env 中的 PORT 配置。浏览器访问：

http://服务器IP:端口
`;
        fs.writeFileSync(path.join(releaseDir, '使用说明.txt'), releaseReadme, 'utf8');

        console.log('🔒 移除本地运行数据...');
        removeRuntimeData();

        console.log('\n✅ 打包完成！');
        console.log('📍 发布包路径: ' + releaseDir);
        console.log('💡 运行建议: 将 release 目录上传到服务器，配置 .env 后执行 `node scripts/run-with-port.js start` 即可启动。');

    } catch (error) {
        console.error('\n❌ 打包失败:');
        console.error(error.message);
        process.exit(1);
    }
}

main();
