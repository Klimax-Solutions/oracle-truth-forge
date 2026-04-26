import { useMemo, useState } from 'react';
import { CRMLead } from '@/lib/admin/types';
import { format } from '@/lib/admin/dateFormatting';
import {
  TrendingUp, ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import { fr } from 'date-fns/locale';
import {
  startOfDay, subDays, isSameDay, eachDayOfInterval,
} from 'date-fns';

// ============================================
// Conversions — Funnel analytics
// ============================================

interface ConversionsTabProps {
  leads: CRMLead[];
}

function ConversionRate({ from, to, label }: { from: number; to: number; label: string }) {
  const rate = from > 0 ? Math.round((to / from) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-1 px-3">
      <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
        <ArrowRight className="w-3.5 h-3.5 text-white/30" />
      </div>
      <span className="text-lg font-display font-bold text-white tabular-nums">{rate}%</span>
      <span className="text-[9px] text-white/30 font-display uppercase tracking-wider">{label}</span>
    </div>
  );
}

function FunnelBar({ label, count, maxCount, color }: {
  label: string; count: number; maxCount: number; color: string;
}) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const colors: Record<string, { bar: string; text: string; bg: string }> = {
    amber: { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
    blue: { bar: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' },
    violet: { bar: 'bg-violet-500', text: 'text-violet-400', bg: 'bg-violet-500/10' },
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  };
  const c = colors[color] || colors.amber;
  return (
    <div className="flex-1">
      <div className="flex items-end justify-between mb-2">
        <span className="text-[11px] font-display uppercase tracking-wider text-white/50">{label}</span>
        <span className={`text-xl font-display font-bold tabular-nums ${c.text}`}>{count}</span>
      </div>
      <div className="h-12 bg-white/[0.03] rounded-lg overflow-hidden relative">
        <div
          className={`h-full ${c.bar} rounded-lg transition-all duration-700 ease-out`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

export default function ConversionsTab({ leads }: ConversionsTabProps) {
  const [showDaily, setShowDaily] = useState(false);

  const stats = useMemo(() => {
    const forms = leads.length;
    const calls = leads.filter(l => l.call_booked || l.call_done).length;
    const contracted = leads.filter(l => l.call_outcome === 'contracted').length;
    const paid = leads.filter(l => l.paid_at).length;
    const revenue = leads.reduce((s, l) => s + (l.paid_amount || 0), 0);
    return { forms, calls, contracted, paid, revenue };
  }, [leads]);

  // Daily breakdown (last 14 days)
  const dailyData = useMemo(() => {
    const today = startOfDay(new Date());
    const days = eachDayOfInterval({ start: subDays(today, 13), end: today });
    return days.map(day => {
      const dayLeads = leads.filter(l => isSameDay(new Date(l.created_at), day));
      return {
        date: day,
        forms: dayLeads.length,
        calls: dayLeads.filter(l => l.call_booked || l.call_done).length,
        contracted: dayLeads.filter(l => l.call_outcome === 'contracted').length,
        paid: dayLeads.filter(l => l.paid_at).length,
      };
    });
  }, [leads]);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 animate-fade-in max-w-5xl">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white/40" />
        </div>
        <div>
          <h2 className="text-lg font-display text-white font-semibold">Conversions</h2>
          <p className="text-[11px] text-white/30 font-display">Entonnoir de conversion du pipeline</p>
        </div>
      </div>

      {/* Main Funnel — horizontal bars */}
      <div className="bg-white/[0.02] border border-white/[0.10] rounded-xl p-3 md:p-6 overflow-x-auto">
        <div className="flex items-end gap-2 md:gap-4 min-w-[640px]">
          <FunnelBar label="Forms" count={stats.forms} maxCount={stats.forms} color="amber" />
          <ConversionRate from={stats.forms} to={stats.calls} label="→ Call" />
          <FunnelBar label="Calls" count={stats.calls} maxCount={stats.forms} color="blue" />
          <ConversionRate from={stats.calls} to={stats.contracted} label="→ Close" />
          <FunnelBar label="Contractes" count={stats.contracted} maxCount={stats.forms} color="violet" />
          <ConversionRate from={stats.contracted} to={stats.paid} label="→ Paye" />
          <FunnelBar label="Payes" count={stats.paid} maxCount={stats.forms} color="emerald" />
        </div>
      </div>

      {/* Revenue card */}
      <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl p-4 md:p-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-display uppercase tracking-widest text-emerald-400/60">Chiffre d'affaires total</p>
          <p className="text-2xl md:text-3xl font-display font-bold text-emerald-400 mt-1 tabular-nums">{stats.revenue.toLocaleString()}€</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/30 font-display">Panier moyen</p>
          <p className="text-lg font-display font-bold text-emerald-400 tabular-nums">
            {stats.paid > 0 ? Math.round(stats.revenue / stats.paid).toLocaleString() : 0}€
          </p>
        </div>
      </div>

      {/* Daily breakdown toggle */}
      <button
        onClick={() => setShowDaily(!showDaily)}
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 font-display transition-colors"
      >
        {showDaily ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Detail par jour (14 derniers jours)
      </button>

      {showDaily && (
        <div className="bg-white/[0.02] border border-white/[0.10] rounded-xl overflow-x-auto">
          <div className="grid grid-cols-5 gap-0 text-[10px] font-display uppercase tracking-widest text-white/30 border-b border-white/[0.10] bg-white/[0.02]">
            <div className="py-2.5 px-4">Jour</div>
            <div className="py-2.5 px-3 text-center text-amber-400/60">Forms</div>
            <div className="py-2.5 px-3 text-center text-blue-400/60">Calls</div>
            <div className="py-2.5 px-3 text-center text-violet-400/60">Contractes</div>
            <div className="py-2.5 px-3 text-center text-emerald-400/60">Payes</div>
          </div>
          {dailyData.slice().reverse().map(day => {
            const hasData = day.forms > 0 || day.calls > 0 || day.contracted > 0 || day.paid > 0;
            return (
              <div key={day.date.toISOString()} className={`grid grid-cols-5 gap-0 border-b border-white/[0.03] ${hasData ? '' : 'opacity-30'}`}>
                <div className="py-2.5 px-4 text-[11px] font-mono text-white/50 tabular-nums">
                  {format(day.date, 'EEE dd/MM', { locale: fr })}
                </div>
                <div className="py-2.5 px-3 text-center">
                  {day.forms > 0 ? <span className="text-sm font-display text-amber-400 font-medium">{day.forms}</span> : <span className="text-white/[0.08]">·</span>}
                </div>
                <div className="py-2.5 px-3 text-center">
                  {day.calls > 0 ? <span className="text-sm font-display text-blue-400 font-medium">{day.calls}</span> : <span className="text-white/[0.08]">·</span>}
                </div>
                <div className="py-2.5 px-3 text-center">
                  {day.contracted > 0 ? <span className="text-sm font-display text-violet-400 font-medium">{day.contracted}</span> : <span className="text-white/[0.08]">·</span>}
                </div>
                <div className="py-2.5 px-3 text-center">
                  {day.paid > 0 ? <span className="text-sm font-display text-emerald-400 font-medium">{day.paid}</span> : <span className="text-white/[0.08]">·</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
