import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getSecurityConfigItems, type SecurityConfigStatus } from '@/lib/security-config';
import { BackupManager } from './BackupManager';

export const dynamic = 'force-dynamic';

const statusStyles: Record<SecurityConfigStatus, { label: string; card: string; icon: string }> = {
    ok: {
        label: '正常',
        card: 'border-emerald-400/20 bg-emerald-500/5',
        icon: 'text-emerald-300',
    },
    warning: {
        label: '建议配置',
        card: 'border-amber-400/20 bg-amber-500/5',
        icon: 'text-amber-300',
    },
    danger: {
        label: '需要处理',
        card: 'border-red-400/20 bg-red-500/5',
        icon: 'text-red-300',
    },
};

export default function SecurityPage() {
    const items = getSecurityConfigItems();
    const issueCount = items.filter((item) => item.status !== 'ok').length;

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass rounded-3xl p-8 overflow-hidden relative">
                <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
                <div className="absolute right-24 bottom-0 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
                <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-sm text-blue-200">
                            <ShieldCheck className="h-4 w-4" />
                            部署前检查
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">
                                安全配置检查
                            </h1>
                            <p className="text-gray-400 mt-2 max-w-2xl">
                                这里只检查关键环境变量的配置状态，不会显示密码、密钥或任何敏感值。
                            </p>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-left md:text-right">
                        <div className="text-sm text-gray-400">待优化项目</div>
                        <div className="mt-1 text-4xl font-bold text-white">{issueCount}</div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {items.map((item) => {
                    const style = statusStyles[item.status];
                    const Icon = item.status === 'ok' ? CheckCircle2 : AlertTriangle;

                    return (
                        <section key={item.key} className={`rounded-2xl border p-6 ${style.card}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">{item.title}</h2>
                                    <p className="mt-1 text-sm font-mono text-gray-500">{item.key}</p>
                                </div>
                                <div className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-sm ${style.icon}`}>
                                    <Icon className="h-4 w-4" />
                                    {style.label}
                                </div>
                            </div>
                            <p className="mt-5 text-gray-200">{item.summary}</p>
                            <p className="mt-3 text-sm leading-6 text-gray-400">{item.advice}</p>
                        </section>
                    );
                })}
            </div>

            <BackupManager />

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm leading-6 text-gray-400">
                修改配置后请重启应用，让新的环境变量生效。若已部署到公网，建议同时使用 HTTPS、反向代理和额外访问控制。
            </div>
        </div>
    );
}
