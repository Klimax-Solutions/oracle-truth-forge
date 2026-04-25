import { Shield, AlertTriangle, Info, Lock, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TRADE_ENTRY_RULE_DOCS,
  OracleCycleWindow,
  formatDateShort,
  USER_CYCLE_THRESHOLDS,
} from "@/lib/oracle-cycle-windows";

interface TradeRulesDocProps {
  /** Fenêtres Oracle dérivées des trades réels — facultatif, affiche les dates si fourni */
  oracleCycleWindows?: OracleCycleWindow[];
  className?: string;
}

/**
 * TradeRulesDoc — Panneau de documentation des règles de saisie des trades.
 * À embarquer dans l'interface admin (ConfigPanel, onglet dédié, etc.).
 *
 * Affiche :
 *  - Les 4 règles (R1–R4) avec enforcement et type (hard/soft)
 *  - Les fenêtres temporelles Oracle par cycle (si oracleCycleWindows fourni)
 */
export function TradeRulesDoc({ oracleCycleWindows, className }: TradeRulesDocProps) {
  return (
    <div className={cn("space-y-6", className)}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Règles de saisie des trades
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Règles appliquées dans le formulaire de saisie Oracle.
            Source de vérité : <code className="text-[11px] bg-white/[.06] px-1 py-0.5 rounded font-mono">src/lib/oracle-cycle-windows.ts</code>
          </p>
        </div>
      </div>

      {/* Règles */}
      <div className="space-y-3">
        {TRADE_ENTRY_RULE_DOCS.map((rule) => (
          <div
            key={rule.id}
            className={cn(
              "rounded-lg border p-4",
              rule.type === "hard"
                ? "border-red-500/20 bg-red-500/[.04]"
                : "border-amber-500/20 bg-amber-500/[.04]"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5",
                rule.type === "hard"
                  ? "bg-red-500/15 text-red-400"
                  : "bg-amber-500/15 text-amber-400"
              )}>
                {rule.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">{rule.title}</span>
                  <span className={cn(
                    "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                    rule.type === "hard"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-amber-500/15 text-amber-400"
                  )}>
                    {rule.type === "hard" ? "strict" : "guidage"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {rule.description}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Lock className="w-3 h-3 text-muted-foreground/50" />
                  <span className="text-[11px] text-muted-foreground/70 italic">
                    {rule.enforcement}
                  </span>
                </div>
                {"tolerancePercent" in rule && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Info className="w-3 h-3 text-amber-400/60" />
                    <span className="text-[11px] text-amber-400/80">
                      Tolérance : ±{rule.tolerancePercent}% de la durée du cycle
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fenêtres Oracle par cycle */}
      {oracleCycleWindows && oracleCycleWindows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Fenêtres temporelles Oracle par cycle
            </h4>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Cycle</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Trades Oracle</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Période Oracle</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Durée</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Débloqué quand</th>
                </tr>
              </thead>
              <tbody>
                {oracleCycleWindows.map((w, i) => {
                  const threshold = USER_CYCLE_THRESHOLDS[i] ?? "—";
                  return (
                    <tr key={w.cycleNum} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-mono font-bold text-foreground">
                        {w.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {/* Afficher les trade numbers Oracle pour ce cycle */}
                        {[1, 16, 41, 66, 91, 116, 166, 216, 266][i]}–{[15, 40, 65, 90, 115, 165, 215, 265, 314][i]}
                      </td>
                      <td className="px-3 py-2">
                        {w.oracleStart && w.oracleEnd ? (
                          <span className="flex items-center gap-1.5 text-foreground">
                            <span className="font-mono">{formatDateShort(w.oracleStart)}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                            <span className="font-mono">{formatDateShort(w.oracleEnd)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {w.durationDays > 0 ? `${w.durationDays}j` : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="font-mono">{threshold} trades</span>
                        <span className="text-muted-foreground/50 ml-1">utilisateur</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Note de bas de page */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[.02] border border-white/[.06]">
        <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          Les fenêtres temporelles sont dérivées dynamiquement des dates réelles des trades Oracle.
          L'offset personnel de chaque utilisateur est calculé cycle par cycle à partir de ses trades saisis.
          Toute modification des règles doit se faire dans <code className="font-mono text-[10px]">src/lib/oracle-cycle-windows.ts</code>.
        </p>
      </div>
    </div>
  );
}
