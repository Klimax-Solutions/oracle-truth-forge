/**
 * src/components/dashboard/TradeExpandCard.tsx
 *
 * Composant partagé Trade UI — Phase 2.
 * Layout identique Oracle Saisie et Personal Trades.
 * Seul le contexte change — injecté via props, jamais hardcodé.
 *
 * Rules :
 *  - R1 : Aucune logique de vérification/cycle ici (injectée par le parent)
 *  - R2 : Aucune perte de champ (discriminated union — kind guard)
 *  - R3 : Composant controlled — l'état (isExpanded) est géré par le parent
 *
 * Spec : docs/trade-ui-components-2026-04-30.md §5 Phase 2
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  Lock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { SignedImageCard } from "./SignedImageCard";
import {
  TradeCardData,
  isOracleTrade,
  isPersonalTrade,
  getCommonFields,
} from "@/lib/trade/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TradeExpandCardProps {
  /** Trade à afficher (discriminated union — préserve tous les champs) */
  trade: TradeCardData;

  /** Contrôle l'état expand — géré par le parent (R3) */
  isExpanded: boolean;

  /** Callback clic sur la row principale */
  onToggle: () => void;

  /** Callback bouton Éditer */
  onEdit: (trade: TradeCardData) => void;

  /** Callback bouton Supprimer (optionnel — toujours visible en mode personal) */
  onDelete?: (id: string, tradeNumber: number) => void;

  /**
   * Trades du scope courant pour les mini-charts.
   * Oracle → trades du cycle actif.
   * Personal → trades de la session courante.
   * Si absent ou vide → charts masqués.
   */
  scopeTrades?: TradeCardData[];

  /**
   * Oracle only — trade verrouillé (vérification en cours).
   * Remplace les boutons edit/delete par une icône 🔒.
   */
  isLocked?: boolean;

  /**
   * Oracle only — verdict admin (badge ✓ vert ou ✗ rouge sur la row).
   * null → aucun badge.
   */
  adminVerdict?: "approved" | "rejected" | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart helpers — pure functions, pas de dépendance externe
// ─────────────────────────────────────────────────────────────────────────────

interface ChartEntry {
  trade: number;
  tradeNum: number;
  rr: number;        // cumul isolé
  individual: number;
  current: boolean;
}

interface TradeContext {
  cumulativeRR: number;   // cumul total depuis le début du scope
  isolatedTotal: number;  // somme de la fenêtre de 10
  chartData: ChartEntry[];
}

function computeTradeContext(
  trade: TradeCardData,
  scopeTrades: TradeCardData[]
): TradeContext {
  const idx = scopeTrades.findIndex((t) => t.id === trade.id);
  if (idx === -1) {
    return { cumulativeRR: 0, isolatedTotal: 0, chartData: [] };
  }

  const tradesUpToNow = scopeTrades.slice(0, idx + 1);
  const cumulativeRR = tradesUpToNow.reduce((sum, t) => sum + (t.rr || 0), 0);

  const window = scopeTrades.slice(Math.max(0, idx - 9), idx + 1);
  let isolatedCumul = 0;
  const chartData: ChartEntry[] = window.map((t, i) => {
    isolatedCumul += t.rr || 0;
    return {
      trade: i + 1,
      tradeNum: t.trade_number,
      rr: parseFloat(isolatedCumul.toFixed(2)),
      individual: t.rr || 0,
      current: t.id === trade.id,
    };
  });

  const isolatedTotal = window.reduce((sum, t) => sum + (t.rr || 0), 0);
  return { cumulativeRR, chartData, isolatedTotal };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function TradeExpandCard({
  trade,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  scopeTrades = [],
  isLocked = false,
  adminVerdict = null,
}: TradeExpandCardProps) {
  const common = getCommonFields(trade);

  // Chart context — memoized, only recomputed when scopeTrades or trade changes
  const context = useMemo(
    () =>
      scopeTrades.length > 0
        ? computeTradeContext(trade, scopeTrades)
        : null,
    [trade, scopeTrades]
  );

  // ── Resolved fields (mode-specific) ──────────────────────────────────────
  const notes = isOracleTrade(trade) ? trade.notes : null;
  const comment = isPersonalTrade(trade) ? trade.comment : null;
  const screenshotContext = isPersonalTrade(trade)
    ? trade.screenshot_context_url
    : null;
  const isLong = common.direction === "Long";

  // ── Result color helper ───────────────────────────────────────────────────
  const resultColor =
    common.result === "Win"
      ? "text-emerald-400"
      : common.result === "Loss"
      ? "text-red-400"
      : "text-foreground";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "border transition-all rounded-md overflow-hidden",
        isExpanded
          ? "border-foreground/20 bg-accent/40"
          : "border-border hover:bg-accent/30 bg-transparent"
      )}
    >
      {/* ── Compact row (always visible) ────────────────────────────────── */}
      <div
        onClick={onToggle}
        className="px-3 md:px-5 py-2.5 md:py-3 flex items-center justify-between cursor-pointer"
      >
        {/* Left side */}
        <div className="flex items-center gap-3 md:gap-5">
          {/* Trade number */}
          <span className="text-sm md:text-lg font-bold text-muted-foreground/50 w-8 md:w-10">
            {String(common.trade_number).padStart(3, "0")}
          </span>

          {/* Direction */}
          <div
            className={cn(
              "flex items-center gap-1.5 md:gap-2",
              isLong ? "text-emerald-500" : "text-red-500"
            )}
          >
            {isLong ? (
              <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
            )}
            <span className="text-[10px] md:text-xs font-mono uppercase">
              {common.direction}
            </span>
          </div>

          {/* Date + time */}
          <div className="hidden md:block">
            <p className="text-sm text-foreground">
              {new Date(common.trade_date).toLocaleDateString("fr-FR")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {common.entry_time || "—"}
            </p>
          </div>

          {/* Setup type */}
          <div className="hidden lg:block">
            <p className="text-[10px] text-muted-foreground font-mono">
              {common.setup_type || "—"}
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Oracle: admin verdict badge */}
          {adminVerdict === "approved" && (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
          {adminVerdict === "rejected" && (
            <XCircle className="w-4 h-4 text-red-400" />
          )}

          {/* RR */}
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-bold",
                (common.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
              )}
            >
              {common.rr !== null
                ? `${common.rr >= 0 ? "+" : ""}${common.rr.toFixed(1)}`
                : "—"}
            </p>
            <p className="text-[9px] text-muted-foreground font-mono uppercase">
              RR
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {isLocked ? (
              // Oracle locked — vérification en cours
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:h-8 md:w-8 text-orange-400/70"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(trade);
                }}
                title="Vérification en cours — lecture seule"
              >
                <Lock className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 md:h-8 md:w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(trade);
                  }}
                >
                  <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Button>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 md:h-8 md:w-8 text-red-400 hover:text-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(trade.id, common.trade_number);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded details ─────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="border-t border-border p-3 md:p-4 space-y-3 md:space-y-4 bg-transparent">
          {/* Trade header block */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3 md:p-4 border border-border bg-transparent rounded-md">
            <div
              className={cn(
                "w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border rounded-md flex-shrink-0",
                isLong
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-red-500/50 bg-red-500/10"
              )}
            >
              {isLong ? (
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
              ) : (
                <TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base md:text-lg font-bold text-foreground">
                Trade #{common.trade_number}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground truncate">
                {common.setup_type || "Setup"} •{" "}
                {trade.entry_model || "Model"}
              </p>
            </div>
            <div className="text-left md:text-right">
              <p
                className={cn(
                  "text-lg md:text-xl font-bold",
                  (common.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                )}
              >
                {common.rr !== null
                  ? `${common.rr >= 0 ? "+" : ""}${common.rr.toFixed(2)} RR`
                  : "—"}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">
                {new Date(common.trade_date).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>

          {/* Stats grid — 2×2 mobile, 4-col desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <StatCard icon={<Clock className="w-3 h-3 md:w-4 md:h-4" />} label="Entrée">
              {trade.entry_time || "—"}
            </StatCard>
            <StatCard icon={<Clock className="w-3 h-3 md:w-4 md:h-4" />} label="Sortie">
              {trade.exit_time || "—"}
            </StatCard>
            <StatCard icon={<Target className="w-3 h-3 md:w-4 md:h-4" />} label="Résultat">
              <span className={resultColor}>{common.result || "—"}</span>
            </StatCard>
            <StatCard icon={<Calendar className="w-3 h-3 md:w-4 md:h-4" />} label="Date Sortie">
              {trade.exit_date
                ? new Date(trade.exit_date).toLocaleDateString("fr-FR")
                : "—"}
            </StatCard>
          </div>

          {/* Context grid — 3-col */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <InfoCard label="Contexte">{trade.direction_structure || "—"}</InfoCard>
            <InfoCard label="Entry">{trade.entry_timing || "—"}</InfoCard>
            <InfoCard label="Model">{trade.entry_model || "—"}</InfoCard>
          </div>

          {/* Mini-charts — only when scopeTrades provided */}
          {context && context.chartData.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {/* Bar chart — individual RR */}
                <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <h4 className="text-[9px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      RR par Trade
                    </h4>
                  </div>
                  <div className="h-28 md:h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={context.chartData}>
                        <XAxis
                          dataKey="trade"
                          tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                          axisLine={{ stroke: "var(--chart-axis-line)" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                          axisLine={{ stroke: "var(--chart-axis-line)" }}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "var(--chart-tooltip-bg)",
                            border: "1px solid var(--chart-tooltip-border)",
                            borderRadius: 4,
                            color: "var(--chart-tooltip-text)",
                          }}
                          itemStyle={{ color: "var(--chart-tooltip-text)" }}
                          labelStyle={{ color: "var(--chart-tooltip-text)" }}
                          formatter={(value: number, _name: string, props: any) => [
                            `${value.toFixed(2)} RR`,
                            `Trade #${props.payload.tradeNum}`,
                          ]}
                        />
                        <Bar dataKey="individual" radius={[3, 3, 0, 0]}>
                          {context.chartData.map((entry, i) => (
                            <Cell
                              key={`cell-${i}`}
                              fill={entry.current ? "var(--chart-bar)" : "#22c55e"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Area chart — isolated cumulative RR */}
                <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <h4 className="text-[9px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Cumul Isolé
                    </h4>
                    <span className="text-sm md:text-base font-bold text-emerald-500">
                      +{context.isolatedTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-28 md:h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={context.chartData}>
                        <defs>
                          <linearGradient
                            id={`colorIsolatedRR-${trade.id}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="trade"
                          tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                          axisLine={{ stroke: "var(--chart-axis-line)" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                          axisLine={{ stroke: "var(--chart-axis-line)" }}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "var(--chart-tooltip-bg)",
                            border: "1px solid var(--chart-tooltip-border)",
                            borderRadius: 4,
                            color: "var(--chart-tooltip-text)",
                          }}
                          itemStyle={{ color: "var(--chart-tooltip-text)" }}
                          labelStyle={{ color: "var(--chart-tooltip-text)" }}
                          formatter={(value: number, _name: string, props: any) => [
                            `${value.toFixed(2)} RR`,
                            `Trade #${props.payload.tradeNum}`,
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="rr"
                          stroke="#22c55e"
                          fillOpacity={1}
                          fill={`url(#colorIsolatedRR-${trade.id})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Cumul total */}
              <div className="flex items-center justify-between p-2 md:p-3 border border-border bg-card rounded-md">
                <span className="text-[9px] md:text-xs text-muted-foreground font-mono uppercase">
                  Cumul Total
                </span>
                <span
                  className={cn(
                    "text-sm md:text-base font-bold",
                    context.cumulativeRR >= 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {context.cumulativeRR >= 0 ? "+" : ""}
                  {context.cumulativeRR.toFixed(2)} RR
                </span>
              </div>
            </>
          )}

          {/* Screenshots */}
          {(trade.screenshot_url ||
            trade.screenshot_entry_url ||
            screenshotContext) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {trade.screenshot_url && (
                <SignedImageCard
                  storagePath={trade.screenshot_url}
                  alt={`Trade #${common.trade_number} Contexte`}
                  label={screenshotContext ? "M15 / Contexte" : "Contexte"}
                />
              )}
              {screenshotContext && (
                <SignedImageCard
                  storagePath={screenshotContext}
                  alt={`Trade #${common.trade_number} Contexte 2`}
                  label="Contexte 2"
                />
              )}
              {trade.screenshot_entry_url && (
                <SignedImageCard
                  storagePath={trade.screenshot_entry_url}
                  alt={`Trade #${common.trade_number} Entrée`}
                  label="M5 / Entrée"
                />
              )}
            </div>
          )}

          {/* Notes (Oracle) */}
          {notes && (
            <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
              <span className="text-[9px] md:text-xs text-muted-foreground font-mono uppercase block mb-2">
                Notes
              </span>
              <p className="text-xs md:text-sm text-foreground">{notes}</p>
            </div>
          )}

          {/* Comment (Personal) */}
          {comment && (
            <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
              <span className="text-[9px] md:text-xs text-muted-foreground font-mono uppercase block mb-2">
                Commentaire
              </span>
              <p className="text-xs md:text-sm text-foreground">{comment}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — presentational helpers
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
      <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2 text-muted-foreground">
        {icon}
        <span className="text-[8px] md:text-[10px] font-mono uppercase">
          {label}
        </span>
      </div>
      <div className="text-sm md:text-base font-bold text-foreground">
        {children}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
      <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">
        {label}
      </span>
      <p className="text-xs md:text-sm font-medium text-foreground mt-0.5 md:mt-1">
        {children}
      </p>
    </div>
  );
}
