import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Clock, Crosshair, Timer } from "lucide-react";

interface Trade {
  rr: number;
  direction?: string;
  entry_time?: string;
  entry_model?: string;
  setup_type?: string;
  trade_duration?: string;
  direction_structure?: string;
}

interface DataRankingsProps {
  trades: Trade[];
}

// Normalize entry model names: group all "Englobante" variants together
const normalizeEntryModel = (model: string | undefined | null): string => {
  if (!model) return "Non défini";
  const lower = model.toLowerCase().trim();
  if (lower.includes("englobante")) return "Englobante";
  if (lower.includes("high low") || lower.includes("hl")) return "High Low Bougie";
  return model.trim();
};

// Parse duration string like "1h30", "45min", "2h" to minutes
const parseDurationToMinutes = (duration: string | undefined | null): number | null => {
  if (!duration) return null;
  const d = duration.toLowerCase().trim();
  let totalMin = 0;
  const hMatch = d.match(/(\d+)\s*h/);
  const mMatch = d.match(/(\d+)\s*m/);
  if (hMatch) totalMin += parseInt(hMatch[1]) * 60;
  if (mMatch) totalMin += parseInt(mMatch[1]);
  if (!hMatch && !mMatch) {
    const num = parseInt(d);
    if (!isNaN(num)) totalMin = num;
    else return null;
  }
  return totalMin;
};

const formatMinutes = (min: number): string => {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
  }
  return `${Math.round(min)}min`;
};

export const DataRankings = ({ trades }: DataRankingsProps) => {
  const rankings = useMemo(() => {
    // ─── Entry Model Ranking ───
    const modelMap: Record<string, { count: number; totalRR: number }> = {};
    trades.forEach(t => {
      const model = normalizeEntryModel(t.entry_model);
      if (!modelMap[model]) modelMap[model] = { count: 0, totalRR: 0 };
      modelMap[model].count++;
      modelMap[model].totalRR += t.rr || 0;
    });
    const modelRanking = Object.entries(modelMap)
      .map(([name, data]) => ({ name, ...data, avgRR: data.totalRR / data.count }))
      .sort((a, b) => b.count - a.count);

    // ─── Timing Ranking (30-min slots) ───
    const timingMap: Record<string, { count: number; totalRR: number; durations: number[] }> = {};
    trades.forEach(t => {
      if (!t.entry_time) return;
      const [h, m] = t.entry_time.split(":").map(Number);
      const slotMin = Math.floor(m / 30) * 30;
      const key = `${h.toString().padStart(2, "0")}:${slotMin.toString().padStart(2, "0")}`;
      if (!timingMap[key]) timingMap[key] = { count: 0, totalRR: 0, durations: [] };
      timingMap[key].count++;
      timingMap[key].totalRR += t.rr || 0;
      const dur = parseDurationToMinutes(t.trade_duration);
      if (dur !== null) timingMap[key].durations.push(dur);
    });
    const timingRanking = Object.entries(timingMap)
      .map(([slot, data]) => {
        const endMin = parseInt(slot.split(":")[1]) + 30;
        const endH = endMin >= 60 ? parseInt(slot.split(":")[0]) + 1 : parseInt(slot.split(":")[0]);
        const endM = endMin >= 60 ? endMin - 60 : endMin;
        const label = `${slot} - ${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
        const avgDuration = data.durations.length > 0
          ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
          : null;
        return { slot, label, ...data, avgRR: data.totalRR / data.count, avgDuration };
      })
      .sort((a, b) => b.count - a.count);

    // ─── Direction Structure Ranking ───
    const structMap: Record<string, { count: number; totalRR: number }> = {};
    trades.forEach(t => {
      const struct = t.direction_structure?.trim() || "Non défini";
      if (!structMap[struct]) structMap[struct] = { count: 0, totalRR: 0 };
      structMap[struct].count++;
      structMap[struct].totalRR += t.rr || 0;
    });
    const structRanking = Object.entries(structMap)
      .filter(([name]) => name !== "Non défini")
      .map(([name, data]) => ({ name, ...data, avgRR: data.totalRR / data.count }))
      .sort((a, b) => b.count - a.count);

    // ─── Global avg duration ───
    const allDurations = trades
      .map(t => parseDurationToMinutes(t.trade_duration))
      .filter((d): d is number => d !== null);
    const avgDuration = allDurations.length > 0
      ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length
      : null;

    return { modelRanking, timingRanking, structRanking, avgDuration };
  }, [trades]);

  const topModel = rankings.modelRanking[0];
  const topTiming = rankings.timingRanking[0];
  const topStruct = rankings.structRanking[0];

  return (
    <div className="border border-border rounded-md p-4 md:p-5 bg-card chart-glow-container space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase">
          Classement Data
        </p>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Best entry model */}
        {topModel && (
          <div className="p-2.5 border border-amber-500/30 rounded-md bg-amber-500/5">
            <div className="flex items-center gap-1 mb-1">
              <Crosshair className="w-3 h-3 text-amber-500" />
              <p className="text-[8px] text-muted-foreground font-mono uppercase">Modèle #1</p>
            </div>
            <p className="text-sm font-bold text-foreground truncate">{topModel.name}</p>
            <p className="text-[9px] text-muted-foreground font-mono">
              {topModel.count}t · {topModel.avgRR >= 0 ? "+" : ""}{topModel.avgRR.toFixed(1)} moy
            </p>
          </div>
        )}

        {/* Best timing */}
        {topTiming && (
          <div className="p-2.5 border border-emerald-500/30 rounded-md bg-emerald-500/5">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-emerald-500" />
              <p className="text-[8px] text-muted-foreground font-mono uppercase">Timing #1</p>
            </div>
            <p className="text-sm font-bold text-foreground">{topTiming.slot}</p>
            <p className="text-[9px] text-muted-foreground font-mono">
              {topTiming.count}t · {topTiming.avgRR >= 0 ? "+" : ""}{topTiming.avgRR.toFixed(1)} moy
            </p>
          </div>
        )}

        {/* Best structure */}
        {topStruct && (
          <div className="p-2.5 border border-blue-500/30 rounded-md bg-blue-500/5">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-[8px] text-muted-foreground font-mono uppercase">Structure #1</p>
            </div>
            <p className="text-sm font-bold text-foreground truncate">{topStruct.name}</p>
            <p className="text-[9px] text-muted-foreground font-mono">
              {topStruct.count}t · {topStruct.avgRR >= 0 ? "+" : ""}{topStruct.avgRR.toFixed(1)} moy
            </p>
          </div>
        )}

        {/* Avg duration */}
        <div className="p-2.5 border border-border rounded-md">
          <div className="flex items-center gap-1 mb-1">
            <Timer className="w-3 h-3 text-muted-foreground" />
            <p className="text-[8px] text-muted-foreground font-mono uppercase">Durée Moy.</p>
          </div>
          <p className="text-sm font-bold text-foreground">
            {rankings.avgDuration ? formatMinutes(rankings.avgDuration) : "—"}
          </p>
        </div>
      </div>

      {/* Detailed rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Entry Model ranking */}
        <div className="space-y-1.5">
          <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">Modèles d'entrée</p>
          {rankings.modelRanking.slice(0, 4).map((m, i) => (
            <div key={m.name} className="flex items-center justify-between p-1.5 rounded border border-border/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  "text-[9px] font-mono font-bold w-4 text-center",
                  i === 0 ? "text-amber-500" : "text-muted-foreground"
                )}>
                  {i + 1}
                </span>
                <span className="text-xs text-foreground truncate">{m.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[9px] text-muted-foreground font-mono">{m.count}t</span>
                <span className={cn(
                  "text-[10px] font-mono font-bold",
                  m.avgRR >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {m.avgRR >= 0 ? "+" : ""}{m.avgRR.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Timing ranking */}
        <div className="space-y-1.5">
          <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">Timings d'entrée</p>
          {rankings.timingRanking.slice(0, 4).map((t, i) => (
            <div key={t.slot} className="flex items-center justify-between p-1.5 rounded border border-border/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  "text-[9px] font-mono font-bold w-4 text-center",
                  i === 0 ? "text-emerald-500" : "text-muted-foreground"
                )}>
                  {i + 1}
                </span>
                <span className="text-xs text-foreground font-mono">{t.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[9px] text-muted-foreground font-mono">
                  {t.count}t{t.avgDuration ? ` · ${formatMinutes(t.avgDuration)}` : ""}
                </span>
                <span className={cn(
                  "text-[10px] font-mono font-bold",
                  t.avgRR >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {t.avgRR >= 0 ? "+" : ""}{t.avgRR.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
