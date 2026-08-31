import Link from 'next/link';
import { ArrowRight, ShieldCheck, Globe, Key, ClipboardCheck } from 'lucide-react';

const cards = [
  {
    href: '/keys',
    icon: Key,
    title: '密钥管理',
    desc: '安全存储和管理 AccessKey，AES-256-GCM 加密，多账户自由切换。',
  },
  {
    href: '/dns',
    icon: Globe,
    title: 'DNS 解析',
    desc: '查询、添加、编辑域名解析记录，支持批量操作和 CSV 导入导出。',
  },
  {
    href: '/security',
    icon: ShieldCheck,
    title: '安全检查',
    desc: '环境变量安全审计、备份恢复、操作日志，确保部署安全无虞。',
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero */}
      <header className="text-center space-y-4 max-w-2xl flex flex-col items-center">
        <div
          className="h-16 w-16 mb-1 rounded-2xl p-2.5 flex items-center justify-center surface shadow-sm"
          style={{ border: '1px solid var(--border)' }}
        >
          <img src="/icon.png" alt="Aliyun DNS Manager Logo" className="h-full w-full object-contain" />
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-medium"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--muted)' }}
        >
          <div
            className="h-2 w-2 rounded-full animate-pulse-subtle"
            style={{ backgroundColor: 'var(--success)' }}
          />
          本地部署 · 数据可控
        </div>
        <h1
          className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight"
          style={{ color: 'var(--fg)' }}
        >
          Aliyun DNS Manager
        </h1>
        <p className="text-base leading-relaxed" style={{ color: 'var(--muted)' }}>
          阿里云 DNS 在线管理工具。本地密钥存储，直连阿里云 API，
          提供极简流畅的域名解析运维体验。
        </p>
      </header>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="surface surface-hover p-6 flex flex-col gap-4 group transition-all duration-200"
            style={{ borderRadius: 'var(--r-xl)' }}
          >
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
              style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
            >
              <card.icon className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>
                {card.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                {card.desc}
              </p>
            </div>
            <div
              className="flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2"
              style={{ color: 'var(--accent)' }}
            >
              进入
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>

      {/* Footer stats */}
      <div
        className="flex flex-wrap items-center justify-center gap-6 text-xs"
        style={{ color: 'var(--muted)' }}
      >
        <span className="flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
          AES-256-GCM 加密存储
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
          HMAC-SHA256 会话认证
        </span>
        <span>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      </div>
    </div>
  );
}
