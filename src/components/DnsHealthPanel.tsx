'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, RefreshCw, Stethoscope, X } from 'lucide-react';
import { checkDnsHealthAction } from '@/app/actions';
import type { DnsHealthReport, DnsHealthSeverity } from '@/lib/dns-health';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

const severityMeta: Record<DnsHealthSeverity, { label: string; color: string; icon: typeof AlertTriangle }> = {
  error: { label: '错误', color: 'var(--danger)', icon: CircleAlert },
  warning: { label: '提醒', color: 'var(--warning)', icon: AlertTriangle },
  info: { label: '信息', color: 'var(--accent)', icon: Stethoscope },
};

export function DnsHealthPanel({ keyId, domain, onClose }: { keyId: string; domain: string; onClose: () => void }) {
  const toast = useToast();
  const [report, setReport] = useState<DnsHealthReport | null>(null);
  const [loading, setLoading] = useState(true);

  const runCheck = async () => {
    setLoading(true);
    const result = await checkDnsHealthAction(keyId, domain);
    if (result.success && result.data) setReport(result.data);
    else toast.error(result.error || 'DNS 健康检查失败');
    setLoading(false);
  };
  const runCheckEvent = useEffectEvent(runCheck);

  useEffect(() => {
    const timer = window.setTimeout(() => { void runCheckEvent(); }, 0);
    return () => window.clearTimeout(timer);
  }, [domain, keyId]);

  const statusColor = report?.status === 'error'
    ? 'var(--danger)'
    : report?.status === 'warning' ? 'var(--warning)' : 'var(--success)';

  return (
    <section className="surface rounded-xl overflow-hidden" aria-label="DNS 健康检查">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2" style={{ backgroundColor: 'var(--success-light)', color: statusColor }}>
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>DNS 健康检查</h4>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>只读检查配置格式、冲突、TTL 和公网解析结果</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void runCheck()} isLoading={loading}>
            <RefreshCw className="h-4 w-4" /> 重新检测
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} title="关闭健康检查">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading && !report ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm" style={{ color: 'var(--muted)' }}>
          <Loader2 className="h-4 w-4 animate-spin" /> 正在检查 DNS 配置和公网解析
        </div>
      ) : report && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="总体状态" value={{ healthy: '健康', warning: '需关注', error: '异常' }[report.status]} color={statusColor} />
            <Metric label="记录总数" value={String(report.recordCount)} color="var(--fg)" />
            <Metric label="错误" value={String(report.summary.errors)} color="var(--danger)" />
            <Metric label="提醒" value={String(report.summary.warnings)} color="var(--warning)" />
          </div>

          {report.issues.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg p-4" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <div className="text-sm font-semibold">未发现明显问题</div>
                <div className="mt-1 text-xs">配置格式和当前公网解析结果均通过检查。</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {report.issues.map((issue, index) => {
                const meta = severityMeta[issue.severity];
                const Icon = meta.icon;
                return (
                  <article key={`${issue.code}-${index}`} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-hover)' }}>
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{issue.title}</h5>
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.color, backgroundColor: 'var(--surface)' }}>{meta.label}</span>
                        </div>
                        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{issue.message}</p>
                        <p className="mt-1.5 text-xs" style={{ color: 'var(--fg)' }}>建议：{issue.suggestion}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="text-right text-[11px]" style={{ color: 'var(--muted)' }}>检测时间：{new Date(report.checkedAt).toLocaleString()}</div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-hover)' }}>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}
