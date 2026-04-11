import { useMemo } from 'react';
import { CRMLead } from '@/lib/admin/types';
import { getSetterColor } from '@/lib/admin/setterColors';
import {
  Users, Wifi, WifiOff, AlertCircle, UserCheck,
  Phone, Sparkles, UserX, DollarSign, BarChart3,
  TrendingUp, Clock, ArrowRight,
} from 'lucide-react';

// ============================================
// Cockpit — Vue d'ensemble operationnelle
// Metriques DIFFERENTES du pipeline:
//   - Statut connexion (en ligne / hors ligne / jamais)
//   - Taux de closing + outcomes
//   - Performance setters
//   - Revenue
// Le funnel est dans l'onglet Conversions.
// ============================================

interface CockpitTabProps {
  leads: CRMLead[];
}

export default function CockpitTab({ leads }: CockpitTabProps) {

  // ── KPIs top row (miroir de l'EA existant) ──
  const topKpis = useMemo(() => {
    const pipeline = leads.length;
    const online = leads.filter(l => l.is_online).length;
    const offline = leads.filter(l => !l.is_online && (l.session_count || 0) > 0).length;
    const neverConnected = leads.filter(l => !l.is_online && (l.session_count || 0) === 0).length;
    const contacted = leads.filter(l => l.contacted).length;
    return { pipeline, online, offline, neverConnected, contacted };
  }, [leads]);

  // ── Call outcomes ──
  const callStats = useMemo(() => {
    const callDone = leads.filter(l => l.call_done).length;
    const contracted = leads.filter(l => l.call_outcome === 'contracted').length;
    const closing = leads.filter(l => l.call_outcome === 'closing_in_progress').length;
    const notClosed = leads.filter(l => l.call_outcome === 'not_closed').length;
    const noShows = leads.filter(l => l.call_no_show).length;
    const pending = leads.filter(l => (l.call_booked || l.call_done) && !l.call_outcome && !l.call_no_show).length;
    const closeRate = callDone > 0 ? Math.round((contracted / callDone) * 100) : 0;
    return { callDone, contracted, closing, notClosed, noShows, pending, closeRate };
  }, [leads]);

  // ── Revenue ──
  const revenue = useMemo(() => {
    const paid = leads.filter(l => l.paid_at);
    const total = paid.reduce((s, l) => s + (l.paid_amount || 0), 0);
    const avg = paid.length > 0 ? Math.round(total / paid.length) : 0;
    return { count: paid.length, total, avg };
  }, [leads]);

  // ── Setter performance ──
  const setterStats = useMemo(() => {
    const map = new Map<string, { leads: number; contacted: number; calls: number; contracted: number; paid: number }>();
    leads.forEach(l => {
      const name = l.setter_name || 'Non assigne';
      const s = map.get(name) || { leads: 0, contacted: 0, calls: 0, contracted: 0, paid: 0 };
      s.leads++;
      if (l.contacted) s.contacted++;
      if (l.call_booked || l.call_done) s.calls++;
      if (l.call_outcome === 'contracted') s.contracted++;
      if (l.paid_at) s.paid++;
      map.set(name, s);
    });
    return [...map.entries()].sort((a, b) => b[1].leads - a[1].leads);
  }, [leads]);

  return (
    <div className="p-6 space-y-5 animate-fade-in max-w-6xl">

      {/* ── Row 1: KPI Cards (like EA existing: Pipeline / En Ligne / Hors Ligne / Jamais / Contactes) ── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Pipeline', value: topKpis.pipeline, icon: Users, color: 'white', active: true },
          { label: 'En ligne', value: topKpis.online, icon: Wifi, color: 'emerald', active: topKpis.online > 0 },
          { label: 'Hors ligne', value: topKpis.offline, icon: WifiOff, color: 'white', active: false },
          { label: 'Jamais connecte', value: topKpis.neverConnected, icon: AlertCircle, color: 'red', active: topKpis.neverConnected > 0 },
          { label: 'Contactes', value: topKpis.contacted, icon: UserCheck, color: 'violet', active: topKpis.contacted > 0 },
        ].map(kpi => {
          const textColor = kpi.color === 'emerald' ? 'text-emerald-400' : kpi.color === 'red' ? 'text-red-400' : kpi.color === 'violet' ? 'text-violet-400' : 'text-white';
          const iconColor = kpi.color === 'emerald' ? 'text-emerald-400/60' : kpi.color === 'red' ? 'text-red-400/60' : kpi.color === 'violet' ? 'text-violet-400/60' : 'text-white/30';
          return (
            <div key={kpi.label} className={`rounded-xl border p-4 transition-all ${kpi.active ? 'bg-white/[0.03] border-white/[0.10]' : 'bg-white/[0.01] border-white/[0.05]'}`}>
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`w-4 h-4 ${iconColor}`} />
                <span className="text-[10px] font-display uppercase tracking-widest text-white/40">{kpi.label}</span>
              </div>
              <span className={`text-3xl font-display font-bold tabular-nums ${textColor}`}>{kpi.value}</span>
            </div>
          );
        })}
      </div>

      {/* ── Row 2: Closing + Revenue side by side ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Call outcomes */}
        <div className="rounded-xl border border-white/[0.10] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-display uppercase tracking-widest text-white/30">Issues des calls</span>
            {callStats.closeRate > 0 && (
              <span className="text-sm font-display font-bold text-violet-400">{callStats.closeRate}% close rate</span>
            )}
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Contractes', count: callStats.contracted, dot: 'bg-violet-500', text: 'text-violet-400' },
              { label: 'En cours de closing', count: callStats.closing, dot: 'bg-amber-500', text: 'text-amber-400' },
              { label: 'Non closes', count: callStats.notClosed, dot: 'bg-red-500', text: 'text-red-400' },
              { label: 'No-shows', count: callStats.noShows, dot: 'bg-red-500', text: 'text-red-400' },
              { label: 'En attente issue', count: callStats.pending, dot: 'bg-white/20', text: 'text-white/50' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${item.dot}`} />
                  <span className="text-sm text-white/60 font-display">{item.label}</span>
                </div>
                <span className={`text-sm font-display font-bold tabular-nums ${item.text}`}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
          <span className="text-[10px] font-display uppercase tracking-widest text-emerald-400/50">Revenue</span>
          <div className="mt-3 space-y-4">
            <div>
              <span className="text-4xl font-display font-bold text-emerald-400 tabular-nums">{revenue.total.toLocaleString()}€</span>
              <p className="text-[11px] text-emerald-400/50 mt-1">{revenue.count} client{revenue.count > 1 ? 's' : ''} paye{revenue.count > 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-6 pt-3 border-t border-emerald-500/15">
              <div>
                <span className="text-[10px] text-white/30 font-display uppercase">Panier moyen</span>
                <p className="text-lg font-display font-bold text-emerald-400 tabular-nums">{revenue.avg.toLocaleString()}€</p>
              </div>
              <div>
                <span className="text-[10px] text-white/30 font-display uppercase">Taux conversion</span>
                <p className="text-lg font-display font-bold text-white tabular-nums">
                  {leads.length > 0 ? Math.round((revenue.count / leads.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Setter performance ── */}
      <div className="rounded-xl border border-white/[0.10] bg-white/[0.02] p-5">
        <span className="text-[10px] font-display uppercase tracking-widest text-white/30">Performance par setter</span>
        <div className="mt-4">
          {/* Header */}
          <div className="grid grid-cols-6 gap-2 pb-2 border-b border-white/[0.10] text-[10px] font-display uppercase tracking-widest text-white/25">
            <span className="col-span-1">Setter</span>
            <span className="text-center">Leads</span>
            <span className="text-center">Contactes</span>
            <span className="text-center">Calls</span>
            <span className="text-center">Contractes</span>
            <span className="text-center">Payes</span>
          </div>
          {/* Rows */}
          {setterStats.map(([name, data]) => {
            const sc = name !== 'Non assigne' ? getSetterColor(name) : null;
            return (
              <div key={name} className="grid grid-cols-6 gap-2 py-2.5 border-b border-white/[0.03] items-center">
                <span className={`text-sm font-display font-medium ${sc ? sc.text : 'text-white/35'}`}>{name}</span>
                <span className="text-sm font-mono text-white/60 text-center tabular-nums">{data.leads}</span>
                <span className="text-sm font-mono text-violet-400/70 text-center tabular-nums">{data.contacted}</span>
                <span className="text-sm font-mono text-blue-400/70 text-center tabular-nums">{data.calls}</span>
                <span className="text-sm font-mono text-violet-400 text-center tabular-nums font-medium">{data.contracted}</span>
                <span className="text-sm font-mono text-emerald-400 text-center tabular-nums font-medium">{data.paid}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
