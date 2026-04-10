import { useMemo } from 'react';
import { CRMLead, getStage, CALL_OUTCOME_STYLES } from '@/lib/admin/types';
import { getSetterColor } from '@/lib/admin/setterColors';
import {
  Users, FileText, Phone, CheckCircle2, TrendingUp,
  UserX, Clock, Sparkles, ArrowRight, BarChart3,
} from 'lucide-react';

// ============================================
// Cockpit — KPIs & overview dashboard
// Uses same leads data as Pipeline (no extra queries)
// ============================================

interface CockpitTabProps {
  leads: CRMLead[];
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number | string; sub?: string; icon: any; color: string;
}) {
  const colors: Record<string, { bg: string; text: string; icon: string; border: string }> = {
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'text-amber-400/70', border: 'border-amber-500/20' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'text-blue-400/70', border: 'border-blue-500/20' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: 'text-cyan-400/70', border: 'border-cyan-500/20' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', icon: 'text-violet-400/70', border: 'border-violet-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'text-emerald-400/70', border: 'border-emerald-500/20' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'text-red-400/70', border: 'border-red-500/20' },
    white: { bg: 'bg-white/[0.04]', text: 'text-white', icon: 'text-white/40', border: 'border-white/[0.08]' },
  };
  const c = colors[color] || colors.white;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 flex items-start justify-between`}>
      <div>
        <p className="text-[10px] font-display uppercase tracking-widest text-white/40 mb-1">{label}</p>
        <p className={`text-2xl font-display font-bold tabular-nums ${c.text}`}>{value}</p>
        {sub && <p className="text-[11px] text-white/30 mt-1 font-mono">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
    </div>
  );
}

function FunnelStep({ label, count, total, color, isLast }: {
  label: string; count: number; total: number; color: string; isLast?: boolean;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const colors: Record<string, string> = {
    amber: 'bg-amber-500', blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500',
  };
  const textColors: Record<string, string> = {
    amber: 'text-amber-400', blue: 'text-blue-400', violet: 'text-violet-400', emerald: 'text-emerald-400',
  };
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-display uppercase tracking-wider text-white/50">{label}</span>
          <span className={`text-sm font-display font-bold tabular-nums ${textColors[color] || 'text-white'}`}>{count}</span>
        </div>
        <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${colors[color] || 'bg-white/20'}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-white/25 mt-1 font-mono">{pct}%</p>
      </div>
      {!isLast && <ArrowRight className="w-4 h-4 text-white/10 shrink-0" />}
    </div>
  );
}

export default function CockpitTab({ leads }: CockpitTabProps) {
  const stats = useMemo(() => {
    const total = leads.length;
    const approved = leads.filter(l => l.status === 'approuvée').length;
    const contacted = leads.filter(l => l.contacted).length;
    const callBooked = leads.filter(l => l.call_booked).length;
    const callDone = leads.filter(l => l.call_done).length;
    const contracted = leads.filter(l => l.call_outcome === 'contracted').length;
    const closing = leads.filter(l => l.call_outcome === 'closing_in_progress').length;
    const notClosed = leads.filter(l => l.call_outcome === 'not_closed').length;
    const noShows = leads.filter(l => l.call_no_show).length;
    const paid = leads.filter(l => l.paid_at).length;
    const totalRevenue = leads.reduce((sum, l) => sum + (l.paid_amount || 0), 0);

    // Conversion rates
    const formToCall = total > 0 ? Math.round((callBooked / total) * 100) : 0;
    const callToContracted = callDone > 0 ? Math.round((contracted / callDone) * 100) : 0;
    const contractedToPaid = contracted > 0 ? Math.round((paid / contracted) * 100) : 0;

    return { total, approved, contacted, callBooked, callDone, contracted, closing, notClosed, noShows, paid, totalRevenue, formToCall, callToContracted, contractedToPaid };
  }, [leads]);

  // Setter performance
  const setterStats = useMemo(() => {
    const map = new Map<string, { total: number; calls: number; paid: number }>();
    leads.forEach(l => {
      const name = l.setter_name || 'Non assigne';
      const s = map.get(name) || { total: 0, calls: 0, paid: 0 };
      s.total++;
      if (l.call_booked || l.call_done) s.calls++;
      if (l.paid_at) s.paid++;
      map.set(name, s);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [leads]);

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-5xl">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white/40" />
        </div>
        <div>
          <h2 className="text-lg font-display text-white font-semibold">Cockpit</h2>
          <p className="text-[11px] text-white/30 font-display">Vue d'ensemble du pipeline</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Forms" value={stats.total} icon={FileText} color="amber" />
        <StatCard label="Calls" value={stats.callBooked} sub={`${stats.formToCall}% des forms`} icon={Phone} color="blue" />
        <StatCard label="Contractes" value={stats.contracted} sub={`${stats.callToContracted}% des calls`} icon={Sparkles} color="violet" />
        <StatCard label="Payes" value={stats.paid} sub={`${stats.totalRevenue.toLocaleString()}€ CA`} icon={CheckCircle2} color="emerald" />
      </div>

      {/* Funnel */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
        <p className="text-[10px] font-display uppercase tracking-widest text-white/30 mb-4">Entonnoir de conversion</p>
        <div className="flex items-start gap-2">
          <FunnelStep label="Forms" count={stats.total} total={stats.total} color="amber" />
          <FunnelStep label="Calls" count={stats.callBooked} total={stats.total} color="blue" />
          <FunnelStep label="Contractes" count={stats.contracted} total={stats.total} color="violet" />
          <FunnelStep label="Payes" count={stats.paid} total={stats.total} color="emerald" isLast />
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Call outcomes */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <p className="text-[10px] font-display uppercase tracking-widest text-white/30 mb-4">Issues des calls</p>
          <div className="space-y-3">
            {[
              { label: 'Contractes', count: stats.contracted, color: 'text-violet-400', bg: 'bg-violet-500' },
              { label: 'En cours', count: stats.closing, color: 'text-amber-400', bg: 'bg-amber-500' },
              { label: 'Non closes', count: stats.notClosed, color: 'text-red-400', bg: 'bg-red-500' },
              { label: 'No-shows', count: stats.noShows, color: 'text-red-400', bg: 'bg-red-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${item.bg}`} />
                  <span className="text-sm text-white/60 font-display">{item.label}</span>
                </div>
                <span className={`text-sm font-display font-bold tabular-nums ${item.color}`}>{item.count}</span>
              </div>
            ))}
            {stats.callDone > 0 && (
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-white/30 font-display uppercase">Taux closing</span>
                <span className="text-sm font-display font-bold text-violet-400">{stats.callToContracted}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Setter performance */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <p className="text-[10px] font-display uppercase tracking-widest text-white/30 mb-4">Performance setters</p>
          <div className="space-y-2.5">
            {setterStats.map(([name, data]) => {
              const sc = name !== 'Non assigne' ? getSetterColor(name) : null;
              return (
                <div key={name} className="flex items-center justify-between">
                  <span className={`text-sm font-display ${sc ? sc.text : 'text-white/40'}`}>{name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-white/40 tabular-nums">{data.total} leads</span>
                    <span className="text-[11px] font-mono text-blue-400 tabular-nums">{data.calls} calls</span>
                    <span className="text-[11px] font-mono text-emerald-400 tabular-nums">{data.paid} payes</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
