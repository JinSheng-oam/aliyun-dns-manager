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

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyRecursiveSync(src, dest) {
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

        console.log('🚚 复制核心运行文件...');
        copyRecursiveSync(standaloneDir, releaseDir);

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

        // 更新 run-with-port.js 的逻辑以在 release 目录运行
        // release 目录下的 server.js 是 next 生成的 entry
        const startBat = `@echo off
if not exist .env (
    echo [!] Warning: .env file not found. Copying from .env.example...
    copy .env.example .env
)
echo Starting Aliyun DNS Manager via port helper...
node scripts/run-with-port.js start
pause`;
        fs.writeFileSync(path.join(releaseDir, 'start.bat'), startBat);

        const startSh = `#!/bin/bash
if [ ! -f .env ]; then
    echo "[!] Warning: .env file not found. Copying from .env.example..."
    cp .env.example .env
fi
echo "Starting Aliyun DNS Manager via port helper..."
node scripts/run-with-port.js start`;
        fs.writeFileSync(path.join(releaseDir, 'start.sh'), startSh);
        fs.chmodSync(path.join(releaseDir, 'start.sh'), '755');

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
