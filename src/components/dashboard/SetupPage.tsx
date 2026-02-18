import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database, User, ArrowRight, TrendingUp, BarChart3, Clock, Target, AlertTriangle, CheckSquare, Globe, Play, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OraclePage } from "./OraclePage";
import { OracleDatabase } from "./OracleDatabase";
import { SetupPerso } from "./SetupPerso";
import { usePersonalTrades } from "@/hooks/usePersonalTrades";
import { useDataGenerale } from "@/hooks/useDataGenerale";
import { useSidebarRoles } from "./DashboardSidebar";

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
}

interface SetupPageProps {
  trades: Trade[];
  initialFilters?: any;
  analyzedTradeNumbers?: number[];
  onAnalysisToggle?: (tradeNumber: number, checked: boolean) => void;
  ebaucheComplete?: boolean;
}

type ActiveView = "overview" | "oracle" | "perso" | "data-generale";

// Asset class configuration
const ASSET_CLASSES: Record<string, string[]> = {
  "Indices US": ["NAS100", "US30", "US500", "SPX500", "NDX", "DJI"],
  "Forex": ["EUR/USD", "GBP/USD", "USD/JPY", "EUR/GBP", "AUD/USD", "USD/CHF", "USD/CAD", "NZD/USD"],
  "Matières Premières": ["GOLD", "XAUUSD", "SILVER", "XAGUSD", "OIL", "WTI", "BRENT"],
  "Crypto": ["BTC", "ETH", "BTC/USD", "ETH/USD", "BTCUSD", "ETHUSD"],
};

function getAssetClass(asset: string | null | undefined): string {
  if (!asset) return "Non classé";
  const upper = asset.toUpperCase().replace(/\s/g, "");
  for (const [className, assets] of Object.entries(ASSET_CLASSES)) {
    if (assets.some(a => upper.includes(a.replace("/", "")) || a.replace("/", "").includes(upper))) {
      return className;
    }
  }
  return "Autre";
}

export const SetupPage = ({ trades, initialFilters, analyzedTradeNumbers, onAnalysisToggle, ebaucheComplete }: SetupPageProps) => {
  const [activeView, setActiveView] = useState<ActiveView>(
    initialFilters && Object.values(initialFilters).some((arr: any) => arr?.length > 0) 
      ? "oracle" 
      : "overview"
  );
  const { trades: personalTrades } = usePersonalTrades();
  const { isAdmin, isSuperAdmin } = useSidebarRoles();
  const showDataGenerale = isAdmin || isSuperAdmin;
  const { dataGenerale, stats: dgStats, loading: dgLoading } = useDataGenerale(trades, showDataGenerale);

  useEffect(() => {
    if (initialFilters && Object.values(initialFilters).some((arr: any) => arr?.length > 0)) {
      setActiveView("oracle");
    }
  }, [initialFilters]);

  // Oracle stats
  const oracleStats = {
    totalTrades: trades.length,
    totalRR: trades.reduce((sum, t) => sum + (t.rr || 0), 0),
    winRate: trades.length > 0 
      ? (trades.filter(t => (t.rr || 0) > 0).length / trades.length * 100) 
      : 0,
    avgRR: trades.length > 0 
      ? trades.reduce((sum, t) => sum + (t.rr || 0), 0) / trades.length 
      : 0,
  };

  // Execution stats (personal harvest of Oracle)
  const [executionStats, setExecutionStats] = useState({ totalTrades: 0, totalRR: 0, winRate: 0, avgRR: 0 });
  useEffect(() => {
    const fetchExecutionStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_executions")
        .select("rr, result")
        .eq("user_id", user.id);
      if (data) {
        const total = data.length;
        const totalRR = data.reduce((sum: number, t: any) => sum + (t.rr || 0), 0);
        const wins = data.filter((t: any) => t.result === "Win").length;
        setExecutionStats({
          totalTrades: total,
          totalRR,
          winRate: total > 0 ? (wins / total) * 100 : 0,
          avgRR: total > 0 ? totalRR / total : 0,
        });
      }
    };
    fetchExecutionStats();
  }, []);

  // Perso stats
  const persoStats = {
    totalTrades: personalTrades.length,
    totalRR: personalTrades.reduce((sum, t) => sum + (t.rr || 0), 0),
    winRate: personalTrades.length > 0 
      ? (personalTrades.filter(t => (t.rr || 0) > 0).length / personalTrades.length * 100) 
      : 0,
    avgRR: personalTrades.length > 0 
      ? personalTrades.reduce((sum, t) => sum + (t.rr || 0), 0) / personalTrades.length 
      : 0,
  };

  // Last Oracle trade
  const lastOracleTrade = trades.length > 0 ? trades[trades.length - 1] : null;
  // Last personal trade
  const lastPersoTrade = personalTrades.length > 0 ? personalTrades[personalTrades.length - 1] : null;
  // Last Data Générale trade
  const lastDGTrade = dataGenerale.length > 0 ? dataGenerale[dataGenerale.length - 1] : null;

  // Group personal trades by asset class
  const persoByAssetClass = useMemo(() => {
    const groups: Record<string, typeof personalTrades> = {};
    for (const t of personalTrades) {
      const cls = getAssetClass((t as any).asset);
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(t);
    }
    return groups;
  }, [personalTrades]);

  // ──────────────── SUB VIEWS ────────────────
  if (activeView === "oracle") {
    return (
      <div className="h-full flex flex-col">
        <SubViewHeader 
          icon={<Database className="w-4 h-4 text-primary" />}
          label="Oracle"
          onBack={() => setActiveView("overview")}
        />
        {!ebaucheComplete && (
          <EbaucheWarning analyzedTradeNumbers={analyzedTradeNumbers} />
        )}
        <div className="flex-1 overflow-auto">
          <OraclePage trades={trades} initialFilters={initialFilters} analyzedTradeNumbers={analyzedTradeNumbers} onAnalysisToggle={onAnalysisToggle} />
        </div>
      </div>
    );
  }

  if (activeView === "data-generale") {
    return (
      <div className="h-full flex flex-col">
        <SubViewHeader
          icon={<Globe className="w-4 h-4 text-primary" />}
          label="Data Générale — Setup Indices US"
          onBack={() => setActiveView("overview")}
        />
        <div className="flex-1 overflow-auto">
          <OracleDatabase
            trades={dataGenerale}
            isDataGenerale={true}
            isAdmin={isAdmin || isSuperAdmin}
            onTradeUpdated={() => {
              // Force re-fetch by toggling a state or reloading trades
              window.location.reload();
            }}
          />
        </div>
      </div>
    );
  }

  if (activeView === "perso") {
    return (
      <div className="h-full flex flex-col">
        <SubViewHeader
          icon={<User className="w-4 h-4 text-emerald-500" />}
          label="Setup Perso"
          onBack={() => setActiveView("overview")}
        />
        <div className="flex-1 overflow-auto">
          <SetupPerso />
        </div>
      </div>
    );
  }

  // ──────────────── OVERVIEW ────────────────
  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-bold text-foreground mb-1">Setup</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Explorez et gérez vos données de trading</p>
        </div>

        {/* ─── 2x2 Grid: Oracle + Data Générale (admin) / Perso ─── */}
        <div className={cn(
          "grid gap-4 md:gap-5",
          showDataGenerale ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2"
        )}>
          {/* Oracle Card */}
          <SetupCard
            icon={<Database className="w-5 h-5 text-primary" />}
            title="Oracle"
            subtitle="Base de données de référence"
            accentColor="primary"
            stats={{
              trades: oracleStats.totalTrades,
              totalRR: oracleStats.totalRR,
              winRate: oracleStats.winRate,
              avgRR: oracleStats.avgRR,
            }}
            lastTrade={lastOracleTrade ? {
              date: lastOracleTrade.trade_date,
              direction: lastOracleTrade.direction,
              rr: lastOracleTrade.rr,
              setup: lastOracleTrade.setup_type,
            } : null}
            harvestStats={{
              label: "Récolte personnelle",
              trades: executionStats.totalTrades,
              totalRR: executionStats.totalRR,
              winRate: executionStats.winRate,
              avgRR: executionStats.avgRR,
            }}
            onClick={() => setActiveView("oracle")}
            actionLabel="Continuer ma récolte"
          />

          {/* Data Générale — Admin only */}
          {showDataGenerale && (
            <SetupCard
              icon={<Globe className="w-5 h-5 text-primary" />}
              title="Data Générale"
              subtitle="Oracle + trades complémentaires"
              accentColor="primary"
              stats={{
                trades: dgStats.total,
                totalRR: dgStats.totalRR,
                winRate: dgStats.winRate,
                avgRR: dgStats.avgRR,
              }}
              lastTrade={lastDGTrade ? {
                date: lastDGTrade.trade_date,
                direction: lastDGTrade.direction,
                rr: lastDGTrade.rr,
                setup: lastDGTrade.setup_type,
              } : null}
              badge={
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  <span className="px-1.5 py-0.5 bg-primary/10 rounded text-primary">{dgStats.oracleCount} Oracle</span>
                  <span>+</span>
                  <span className="px-1.5 py-0.5 bg-emerald-500/10 rounded text-emerald-500">{dgStats.complementCount} complémentaires</span>
                </div>
              }
              onClick={() => setActiveView("data-generale")}
              actionLabel="Explorer la data"
              actionIcon={<Eye className="w-3.5 h-3.5" />}
              loading={dgLoading}
            />
          )}

          {/* Setup Perso Card */}
          <SetupCard
            icon={<User className="w-5 h-5 text-emerald-500" />}
            title="Setup Perso"
            subtitle="Vos trades personnels"
            accentColor="emerald"
            stats={{
              trades: persoStats.totalTrades,
              totalRR: persoStats.totalRR,
              winRate: persoStats.winRate,
              avgRR: persoStats.avgRR,
            }}
            lastTrade={lastPersoTrade ? {
              date: lastPersoTrade.trade_date,
              direction: lastPersoTrade.direction,
              rr: lastPersoTrade.rr || 0,
              setup: lastPersoTrade.setup_type || "",
              asset: (lastPersoTrade as any).asset,
            } : null}
            onClick={() => setActiveView("perso")}
            actionLabel="Continuer ma récolte"
          />
        </div>

        {/* ─── Asset Class Sections (Personal Trades grouped) ─── */}
        {Object.keys(persoByAssetClass).length > 0 && (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Répartition par classe d'actif
            </h2>
            
            {Object.entries(persoByAssetClass).map(([className, classTrades]) => {
              // Group by asset within class
              const byAsset: Record<string, typeof classTrades> = {};
              for (const t of classTrades) {
                const asset = (t as any).asset || "Non défini";
                if (!byAsset[asset]) byAsset[asset] = [];
                byAsset[asset].push(t);
              }

              return (
                <div key={className} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2">{className}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(byAsset).map(([assetName, assetTrades]) => {
                      const lastTrade = assetTrades[assetTrades.length - 1];
                      const totalRR = assetTrades.reduce((s, t) => s + (t.rr || 0), 0);
                      const wins = assetTrades.filter(t => (t.rr || 0) > 0).length;
                      
                      return (
                        <div 
                          key={assetName}
                          onClick={() => setActiveView("perso")}
                          className="group cursor-pointer border border-border rounded-lg bg-card p-3 md:p-4 hover:border-emerald-500/40 hover:bg-card/80 transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-sm font-semibold text-foreground">{assetName}</span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">{assetTrades.length} trades</span>
                          </div>

                          {/* Mini stats */}
                          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mb-2">
                            <span className={cn(totalRR >= 0 ? "text-emerald-500" : "text-red-500")}>
                              {totalRR >= 0 ? "+" : ""}{totalRR.toFixed(1)} RR
                            </span>
                            <span>{assetTrades.length > 0 ? (wins / assetTrades.length * 100).toFixed(0) : 0}% WR</span>
                          </div>

                          {/* Last trade preview */}
                          {lastTrade && (
                            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{lastTrade.trade_date}</span>
                                <span className={cn(
                                  "px-1 py-0.5 rounded text-[9px] font-medium",
                                  lastTrade.direction?.toLowerCase().includes("buy") || lastTrade.direction?.toLowerCase().includes("long")
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : "bg-red-500/10 text-red-500"
                                )}>
                                  {lastTrade.direction}
                                </span>
                              </div>
                              <span className={cn(
                                "text-xs font-bold",
                                (lastTrade.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                              )}>
                                {(lastTrade.rr || 0) >= 0 ? "+" : ""}{(lastTrade.rr || 0).toFixed(1)}R
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ──────────────── Sub Components ────────────────

function SubViewHeader({ icon, label, onBack }: { icon: React.ReactNode; label: string; onBack: () => void }) {
  return (
    <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-3">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-sm">
        ← Retour
      </Button>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

function EbaucheWarning({ analyzedTradeNumbers }: { analyzedTradeNumbers?: number[] }) {
  return (
    <div className="mx-4 md:mx-6 mt-4 p-4 border border-amber-500/40 bg-amber-500/10 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">⚠️ Récolte obligatoire des 15 premières datas</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Les 15 premières datas doivent être <strong className="text-foreground">récoltées manuellement</strong> à l'aide de l'outil de saisie. 
            Appuyez-vous <strong className="text-foreground">uniquement sur la date du trade</strong>, sans regarder le modèle d'entrée exact.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Une fois la data saisie, <strong className="text-foreground">cochez la case correspondante</strong> pour confirmer que le trade a été récolté, analysé et compris.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-mono text-muted-foreground">
              {analyzedTradeNumbers?.filter(n => n >= 1 && n <= 15).length || 0}/15 datas récoltées
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SetupCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: "primary" | "emerald";
  stats: { trades: number; totalRR: number; winRate: number; avgRR: number };
  lastTrade: { date: string; direction: string; rr: number; setup: string; asset?: string | null } | null;
  harvestStats?: { label: string; trades: number; totalRR: number; winRate: number; avgRR: number };
  badge?: React.ReactNode;
  onClick: () => void;
  actionLabel: string;
  actionIcon?: React.ReactNode;
  loading?: boolean;
}

function SetupCard({ icon, title, subtitle, accentColor, stats, lastTrade, harvestStats, badge, onClick, actionLabel, actionIcon, loading }: SetupCardProps) {
  const accent = accentColor === "emerald" ? "emerald-500" : "primary";
  const accentBg = accentColor === "emerald" ? "bg-emerald-500/10" : "bg-primary/10";
  const accentBorder = accentColor === "emerald" ? "hover:border-emerald-500/40" : "hover:border-primary/50";

  return (
    <div 
      className={cn(
        "group border border-border rounded-xl bg-card overflow-hidden transition-all duration-200",
        accentBorder,
        "hover:shadow-lg hover:shadow-primary/5"
      )}
    >
      {/* Header */}
      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn("p-2 rounded-lg", accentBg)}>
              {icon}
            </div>
            <div>
              <h2 className="text-sm md:text-base font-semibold text-foreground">{title}</h2>
              <p className="text-[10px] md:text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <ArrowRight className={cn(
            "w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform cursor-pointer",
            accentColor === "emerald" ? "group-hover:text-emerald-500" : "group-hover:text-primary"
          )} onClick={onClick} />
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Chargement...</p>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
              <MiniStat icon={<BarChart3 className="w-3 h-3" />} label="Trades" value={String(stats.trades)} />
              <MiniStat 
                icon={<TrendingUp className="w-3 h-3" />} 
                label="RR" 
                value={`${stats.totalRR >= 0 ? "+" : ""}${stats.totalRR.toFixed(1)}`}
                color={stats.totalRR >= 0 ? "text-emerald-500" : "text-red-500"}
              />
              <MiniStat icon={<Target className="w-3 h-3" />} label="WR" value={`${stats.winRate.toFixed(0)}%`} />
              <MiniStat icon={<Clock className="w-3 h-3" />} label="Moy" value={stats.avgRR.toFixed(2)} />
            </div>

            {badge && <div className="mt-3">{badge}</div>}

            {/* Last trade preview */}
            {lastTrade && (
              <div className="mt-3 p-2.5 bg-muted/40 rounded-lg border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Dernière data</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{lastTrade.date}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-semibold",
                      lastTrade.direction?.toLowerCase().includes("buy") || lastTrade.direction?.toLowerCase().includes("long")
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-red-500/10 text-red-500"
                    )}>
                      {lastTrade.direction}
                    </span>
                    {lastTrade.setup && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{lastTrade.setup}</span>
                    )}
                    {lastTrade.asset && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 rounded text-primary font-medium">{lastTrade.asset}</span>
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-bold",
                    lastTrade.rr >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {lastTrade.rr >= 0 ? "+" : ""}{lastTrade.rr.toFixed(1)}R
                  </span>
                </div>
              </div>
            )}

            {/* Harvest sub-section */}
            {harvestStats && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{harvestStats.label}</p>
                <div className="grid grid-cols-4 gap-2">
                  <MiniStat icon={<BarChart3 className="w-3 h-3" />} label="Trades" value={String(harvestStats.trades)} />
                  <MiniStat 
                    icon={<TrendingUp className="w-3 h-3" />} 
                    label="RR" 
                    value={`${harvestStats.totalRR >= 0 ? "+" : ""}${harvestStats.totalRR.toFixed(1)}`}
                    color={harvestStats.totalRR >= 0 ? "text-emerald-500" : "text-red-500"}
                  />
                  <MiniStat icon={<Target className="w-3 h-3" />} label="WR" value={`${harvestStats.winRate.toFixed(0)}%`} />
                  <MiniStat icon={<Clock className="w-3 h-3" />} label="Moy" value={harvestStats.avgRR.toFixed(2)} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action footer */}
      <div 
        className={cn(
          "px-4 py-2.5 border-t border-border/50 cursor-pointer transition-colors flex items-center justify-center gap-2",
          accentColor === "emerald" 
            ? "bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500" 
            : "bg-primary/5 hover:bg-primary/10 text-primary"
        )}
        onClick={onClick}
      >
        {actionIcon || <Play className="w-3.5 h-3.5" />}
        <span className="text-xs font-semibold">{actionLabel}</span>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="text-center p-1.5 bg-muted/30 rounded-md">
      <div className="flex items-center justify-center gap-0.5 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[8px] font-mono uppercase">{label}</span>
      </div>
      <p className={cn("text-sm md:text-base font-bold", color || "text-foreground")}>{value}</p>
    </div>
  );
}
