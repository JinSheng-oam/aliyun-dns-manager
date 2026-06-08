/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 这是一个辅助脚本，用于从 .env 文件中读取 PORT 变量
 * 并启动 Next.js 开发服务器或生产服务器。
 */

const envPath = path.join(__dirname, '..', '.env');
let port = '3000';
let host = '0.0.0.0';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    // 使用更稳健的逐行解析，处理空行、注释、Windows换行符等
    const lines = envContent.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        
        const [key, ...valueParts] = trimmed.split('=');
        const k = key.trim();
        const v = valueParts.join('=').trim().split('#')[0].trim(); // 移除行尾注释
        
        if (k === 'PORT' && v) port = v;
        if (k === 'HOST' && v) host = v;
    }
}

const command = process.argv[2] === 'start' ? 'start' : 'dev';

// 检查是否处于 Standalone 独立运行模式（Next.js 打包后生成 server.js）
const standaloneServerPath = path.join(__dirname, '..', 'server.js');
const isStandalone = fs.existsSync(standaloneServerPath);

if (isStandalone && command === 'start') {
    // Standalone 模式使用环境变量控制端口和监听 IP
    console.log(`🚀 生产环境启动 (Standalone)... 监听: ${host}:${port}`);
    spawn('node', ['server.js'], {
        stdio: 'inherit',
        env: { 
            ...process.env, 
            PORT: port, 
            HOSTNAME: host, // Next.js standalone 识别 HOSTNAME 环境变量
            NODE_ENV: 'production' 
        }
    }).on('exit', (code) => process.exit(code));
} else {
    // 开发模式或标准生产启动
    console.log(`正在启动... 监听: ${host}:${port}`);

    const args = [command, '-p', port];
    // 下面两行确保 HOST 配置能传给 next dev/start
    if (host !== '0.0.0.0' && host !== '::') {
        args.push('-H', host);
    } else if (host === '0.0.0.0' || host === '::') {
        args.push('-H', host); 
    }

    const nextCliPath = require.resolve('next/dist/bin/next');

    const nextProcess = spawn(process.execPath, [nextCliPath, ...args], {
        stdio: 'inherit',
        env: { ...process.env, PORT: port, HOSTNAME: host }
    });

    nextProcess.on('exit', (code) => {
        process.exit(code);
    });
}
