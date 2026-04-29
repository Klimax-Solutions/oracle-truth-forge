import { useMemo } from "react";
import { ChevronLeft, Database, Sparkles, Users } from "lucide-react";
import { OracleDatabase } from "./OracleDatabase";

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure: string;
  entry_time: string;
  exit_time: string;
  trade_duration: string;
  rr: number;
  stop_loss_size: string;
  setup_type: string;
  entry_timing: string;
  entry_model: string;
  target_timing: string;
  speculation_hl_valid: boolean;
  target_hl_valid: boolean;
  news_day: boolean;
  news_label: string;
  screenshot_m15_m5: string | null;
  screenshot_m1: string | null;
  contributor?: string;
}

interface OracleMaxPageProps {
  trades: Trade[];
  isAdmin?: boolean;
  onBack?: () => void;
}

const AMBER = "#C8882A";
const TEAL = "#1AAFA0";
const EMERALD = "#10B981";

/**
 * Page dédiée Oracle Max — affiche les 314 trades Oracle + les trades complémentaires
 * validés par les élèves dans une liste élégante (réutilise OracleDatabase en mode data-générale).
 */
export const OracleMaxPage = ({ trades, isAdmin, onBack }: OracleMaxPageProps) => {
  const stats = useMemo(() => {
    const total = trades.length;
    const oracleCount = trades.filter(t => t.contributor === "John").length;
    const complementCount = total - oracleCount;
    const totalRR = trades.reduce((s, t) => s + (t.rr || 0), 0);
    return { total, oracleCount, complementCount, totalRR };
  }, [trades]);

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Header élégant ── */}
      <div
        className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm"
        style={{
          backgroundImage: `radial-gradient(120% 80% at 0% 0%, ${AMBER}14 0%, transparent 55%), radial-gradient(120% 80% at 100% 0%, ${TEAL}10 0%, transparent 55%)`,
        }}
      >
        <div className="px-4 md:px-8 py-5">
          <div className="flex items-start gap-4">
            {/* Back */}
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/8 transition-colors flex-shrink-0 mt-0.5"
                style={{ color: "rgba(255,255,255,0.55)" }}
                title="Retour"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            {/* Title block */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: AMBER }} />
                <span
                  className="text-[10px] font-semibold uppercase"
                  style={{ letterSpacing: "0.22em", color: AMBER }}
                >
                  Tier Premium · Dataset étendu
                </span>
              </div>
              <h1
                className="text-2xl md:text-[28px] font-bold tracking-tight"
                style={{ color: "rgba(255,255,255,0.96)" }}
              >
                Oracle <span style={{ color: AMBER }}>Max</span>
              </h1>
              <p className="text-[13px] mt-1.5" style={{ color: "rgba(255,255,255,0.50)", maxWidth: 620 }}>
                La base Oracle de référence enrichie des meilleurs trades complémentaires
                validés par la communauté — couvre les setups absents du dataset maître.
              </p>
            </div>

            {/* Stats inline (desktop) */}
            <div className="hidden md:flex items-stretch gap-3 flex-shrink-0">
              <StatPill
                icon={<Database className="w-3.5 h-3.5" />}
                label="Oracle"
                value={stats.oracleCount}
                color={TEAL}
              />
              <StatPill
                icon={<Users className="w-3.5 h-3.5" />}
                label="Complémentaires"
                value={stats.complementCount}
                color={EMERALD}
              />
              <StatPill
                icon={<Sparkles className="w-3.5 h-3.5" />}
                label="Total"
                value={stats.total}
                color={AMBER}
                emphasis
              />
            </div>
          </div>

          {/* Mobile stats row */}
          <div className="flex md:hidden flex-wrap items-center gap-2 mt-4">
            <StatPill icon={<Database className="w-3 h-3" />} label="Oracle" value={stats.oracleCount} color={TEAL} compact />
            <StatPill icon={<Users className="w-3 h-3" />} label="Compl." value={stats.complementCount} color={EMERALD} compact />
            <StatPill icon={<Sparkles className="w-3 h-3" />} label="Total" value={stats.total} color={AMBER} compact emphasis />
          </div>
        </div>
      </div>

      {/* ── Liste des trades (réutilise OracleDatabase) ── */}
      <div className="flex-1">
        <OracleDatabase
          trades={trades}
          isDataGenerale
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
};

// ── Stat pill ─────────────────────────────────────────────────────────────
interface StatPillProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  emphasis?: boolean;
  compact?: boolean;
}

const StatPill = ({ icon, label, value, color, emphasis, compact }: StatPillProps) => (
  <div
    className="flex items-center rounded-xl"
    style={{
      gap: compact ? "6px" : "10px",
      padding: compact ? "6px 10px" : "8px 14px",
      background: emphasis ? `${color}18` : "rgba(255,255,255,0.03)",
      border: `1px solid ${emphasis ? `${color}50` : "rgba(255,255,255,0.07)"}`,
      boxShadow: emphasis ? `0 0 24px ${color}22` : "none",
    }}
  >
    <span style={{ color }}>{icon}</span>
    <div className="flex items-baseline gap-1.5">
      <span
        className={compact ? "text-[14px] font-bold tabular-nums" : "text-[18px] font-bold tabular-nums"}
        style={{ color: "rgba(255,255,255,0.95)" }}
      >
        {value}
      </span>
      <span
        className="text-[10px] uppercase font-semibold"
        style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}
      >
        {label}
      </span>
    </div>
  </div>
);
