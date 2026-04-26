import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database, User, ArrowRight, TrendingUp, BarChart3, Clock, Target, AlertTriangle, CheckSquare, Globe, Play, Eye, Plus, Pencil, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OraclePage } from "./OraclePage";
import { OracleDatabase } from "./OracleDatabase";
import { SetupPerso } from "./SetupPerso";
import { usePersonalTrades } from "@/hooks/usePersonalTrades";
import { useDataGenerale } from "@/hooks/useDataGenerale";
import { useSidebarRoles } from "./DashboardSidebar";
import { useCustomSetups, CustomSetup } from "@/hooks/useCustomSetups";
import { CreateSetupDialog } from "./CreateSetupDialog";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";

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
  onBack?: () => void; // Récolte de données: bouton retour optionnel
}

type ActiveView = "overview" | "oracle" | "perso" | "data-generale" | `custom-${string}`;

const SETUP_VIEW_STATE_VERSION = 1;

const getSetupViewStorageKey = () => {
  try {
    const sessionToken = localStorage.getItem("oracle_session_token") || "anonymous";
    return `oracle_setup_view_${sessionToken}`;
  } catch {
    return "oracle_setup_view_anonymous";
  }
};

const hasInitialFilters = (initialFilters?: any) =>
  !!(initialFilters && Object.values(initialFilters).some((arr: any) => arr?.length > 0));

const isActiveViewValid = (value: unknown): value is ActiveView => {
  if (typeof value !== "string") return false;
  return value === "overview" || value === "oracle" || value === "perso" || value === "data-generale" || value.startsWith("custom-");
};

const getDefaultSetupView = (initialFilters?: any): ActiveView =>
  hasInitialFilters(initialFilters) ? "oracle" : "overview";

const readPersistedSetupView = (initialFilters?: any): ActiveView => {
  try {
    const rawState = localStorage.getItem(getSetupViewStorageKey());
    if (!rawState) return getDefaultSetupView(initialFilters);

    const parsedState = JSON.parse(rawState);
    if (parsedState?.version !== SETUP_VIEW_STATE_VERSION || !isActiveViewValid(parsedState?.activeView)) {
      return getDefaultSetupView(initialFilters);
    }

    return parsedState.activeView;
  } catch {
    return getDefaultSetupView(initialFilters);
  }
};

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

export const SetupPage = ({ trades, initialFilters, analyzedTradeNumbers, onAnalysisToggle, ebaucheComplete, onBack }: SetupPageProps) => {
  const [activeView, setActiveView] = useState<ActiveView>(() => readPersistedSetupView(initialFilters));
  const { trades: personalTrades } = usePersonalTrades();
  const { isAdmin, isSuperAdmin } = useSidebarRoles();
  const { isEarlyAccess } = useEarlyAccess();
  const showDataGenerale = isAdmin || isSuperAdmin;
  const needsDataGenerale = showDataGenerale || isEarlyAccess;
  const { dataGenerale, stats: dgStats, loading: dgLoading } = useDataGenerale(trades, needsDataGenerale);
  const { setups: customSetups, loading: setupsLoading, refetch: refetchSetups } = useCustomSetups();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [renamingSetupId, setRenamingSetupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (hasInitialFilters(initialFilters)) {
      setActiveView((prev) => (prev === "overview" ? "oracle" : prev));
    }
  }, [initialFilters]);

  useEffect(() => {
    try {
      localStorage.setItem(
        getSetupViewStorageKey(),
        JSON.stringify({
          version: SETUP_VIEW_STATE_VERSION,
          activeView,
        }),
      );
    } catch {
      // noop
    }
  }, [activeView]);

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

  // Perso stats (exclude custom setup trades)
  const defaultPersoTrades = personalTrades.filter(t => !t.custom_setup_id);
  const persoStats = {
    totalTrades: defaultPersoTrades.length,
    totalRR: defaultPersoTrades.reduce((sum, t) => sum + (t.rr || 0), 0),
    winRate: defaultPersoTrades.length > 0 
      ? (defaultPersoTrades.filter(t => (t.rr || 0) > 0).length / defaultPersoTrades.length * 100) 
      : 0,
    avgRR: defaultPersoTrades.length > 0 
      ? defaultPersoTrades.reduce((sum, t) => sum + (t.rr || 0), 0) / defaultPersoTrades.length 
      : 0,
  };

  // Last Oracle trade
  const lastOracleTrade = trades.length > 0 ? trades[trades.length - 1] : null;
  // Last personal trade (exclude custom setup trades)
  const lastPersoTrade = defaultPersoTrades.length > 0 ? defaultPersoTrades[defaultPersoTrades.length - 1] : null;
  // Last Data Générale trade
  const lastDGTrade = dataGenerale.length > 0 ? dataGenerale[dataGenerale.length - 1] : null;

  // Rename handler
  const handleRename = async (setupId: string) => {
    if (!renameValue.trim()) return;
    const { error } = await supabase.from("custom_setups").update({ name: renameValue.trim() } as any).eq("id", setupId);
    if (!error) {
      refetchSetups();
      setRenamingSetupId(null);
    }
  };

  const handleDeleteSetup = async (setupId: string) => {
    if (!confirm("Supprimer ce setup et toutes ses données ?")) return;
    // Delete trades linked to this setup first
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    await supabase.from("user_personal_trades").delete().eq("custom_setup_id", setupId).eq("user_id", currentUser.id);
    const { error } = await supabase.from("custom_setups").delete().eq("id", setupId);
    if (!error) {
      refetchSetups();
    }
  };

  // Custom setup trades count
  const customSetupStats = useMemo(() => {
    const stats: Record<string, { count: number; totalRR: number }> = {};
    for (const t of personalTrades) {
      const sid = (t as any).custom_setup_id;
      if (sid) {
        if (!stats[sid]) stats[sid] = { count: 0, totalRR: 0 };
        stats[sid].count++;
        stats[sid].totalRR += t.rr || 0;
      }
    }
    return stats;
  }, [personalTrades]);

  // Group personal trades by asset class
  const persoByAssetClass = useMemo(() => {
    const groups: Record<string, typeof personalTrades> = {};
    for (const t of personalTrades) {
      if ((t as any).custom_setup_id) continue;
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
    const isEAOnly = isEarlyAccess && !isAdmin && !isSuperAdmin;
    const viewTrades = dataGenerale;
    return (
      <div className="h-full flex flex-col">
        <SubViewHeader
          icon={<Globe className="w-4 h-4 text-primary" />}
          label={isEAOnly ? "Oracle — Data Générale, Setup Indices US" : "Data Générale — Setup Indices US"}
          onBack={() => setActiveView("overview")}
        />
        <div className="flex-1 overflow-auto">
          <OracleDatabase
            trades={viewTrades}
            isDataGenerale={true}
            isAdmin={isAdmin || isSuperAdmin}
            onTradeUpdated={() => {
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
          label="Data Personnelle"
          onBack={() => setActiveView("overview")}
        />
        <div className="flex-1 overflow-auto">
          <SetupPerso />
        </div>
      </div>
    );
  }

  // Custom setup view
  if (activeView.startsWith("custom-")) {
    const setupId = activeView.replace("custom-", "");
    const setup = customSetups.find(s => s.id === setupId);
    if (setup) {
      return (
        <div className="h-full flex flex-col">
          <SubViewHeader
            icon={<Database className="w-4 h-4 text-primary" />}
            label={setup.name}
            onBack={() => setActiveView("overview")}
          />
          <div className="flex-1 overflow-auto">
            <SetupPerso customSetupId={setup.id} customSetupName={setup.name} />
          </div>
        </div>
      );
    }
  }

  // ──────────────── EA OVERVIEW ────────────────
  if (isEarlyAccess && !isAdmin && !isSuperAdmin) {
    const eaPersonalCount = personalTrades.length;
    const EA_LIMIT = 25;
    const eaLimitReached = eaPersonalCount >= EA_LIMIT;

    return (
      <div className="h-full overflow-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
          <div className="text-center">
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-1">Setup</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Explorez les données de trading</p>
          </div>

          {/* Warning banner for EA */}
          <div className="flex items-start gap-3 p-3 border border-amber-500/30 rounded-md bg-amber-500/5">
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Pour bâtir un système qui fonctionne, la data a été récoltée exclusivement sur des trades gagnants.{" "}
              <span className="text-foreground/70">(Sachez qu'une récolte sur les trades perdants est en cours et que la win rate réelle et objective se situe entre 69% et 80%.)</span>
            </p>
          </div>

          {/* Data Générale — Full width for EA */}
          <SetupCard
            icon={<Globe className="w-5 h-5 text-primary" />}
            title="Oracle — Data Générale, Setup Indices US"
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

          {/* EA Data Collection Card */}
          <div className="border border-border rounded-xl bg-card p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Commencez votre récolte de data</h3>
              <p className="text-xs text-muted-foreground mt-1">
                En accès anticipé, vous pouvez récolter jusqu'à 25 données personnelles.
              </p>
            </div>

            {/* Counter */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((eaPersonalCount / EA_LIMIT) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                {eaPersonalCount} / {EA_LIMIT} data récoltées
              </span>
            </div>

            {eaLimitReached ? (
              <div className="flex items-start gap-2 p-3 border border-amber-500/30 rounded-md bg-amber-500/5">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Vous avez atteint la limite de 25 data en accès anticipé.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setActiveView("perso")}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Data Live Trading
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Créer un Setup
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Create Setup Dialog reuse */}
        <CreateSetupDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onCreated={refetchSetups}
          isAdmin={isAdmin || isSuperAdmin}
        />
      </div>
    );
  }

  // ──────────────── OVERVIEW ────────────────
  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        {/* Back button (if opened from Récolte de données) */}
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour à Récolte de données
          </button>
        )}

        {/* Title */}
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-bold text-foreground mb-1">Setup Oracle</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Base de données de 314 trades de référence</p>
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

          {/* Data Personnelle Card */}
          <SetupCard
            icon={<User className="w-5 h-5 text-emerald-500" />}
            title="Data Personnelle"
            subtitle="Vos trades de live trading"
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


          {/* Custom Setup Cards */}
          {customSetups.map((setup) => {
            const st = customSetupStats[setup.id] || { count: 0, totalRR: 0 };
            return (
              <div key={setup.id} className="relative group">
                {/* Rename overlay */}
                {renamingSetupId === setup.id ? (
                  <div className="border border-primary/50 rounded-xl bg-card p-4 space-y-3">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Nouveau nom"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(setup.id);
                        if (e.key === "Escape") setRenamingSetupId(null);
                      }}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleRename(setup.id)}>Renommer</Button>
                      <Button size="sm" variant="ghost" onClick={() => setRenamingSetupId(null)}>Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <SetupCard
                      icon={<Database className="w-5 h-5 text-primary" />}
                      title={setup.name}
                      subtitle={setup.asset ? `Actif: ${setup.asset}` : "Setup personnalisé"}
                      accentColor="primary"
                      stats={{
                        trades: st.count,
                        totalRR: st.totalRR,
                        winRate: st.count > 0 ? ((st.totalRR > 0 ? 1 : 0) / st.count * 100) : 0,
                        avgRR: st.count > 0 ? st.totalRR / st.count : 0,
                      }}
                      lastTrade={null}
                      onClick={() => setActiveView(`custom-${setup.id}`)}
                      actionLabel="Ouvrir le setup"
                    />
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-card/80 backdrop-blur-sm rounded-md p-0.5 border border-border/50">
                      <button
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        title="Renommer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingSetupId(setup.id);
                          setRenameValue(setup.name);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                        title="Supprimer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSetup(setup.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Create Setup Button (Admin only) */}
          {(isAdmin || isSuperAdmin) && (
            <div
              onClick={() => setIsCreateDialogOpen(true)}
              className="border-2 border-dashed border-border rounded-xl bg-card/50 hover:border-primary/40 hover:bg-card transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] gap-3"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Créer un setup (Admin)</span>
            </div>
          )}

          {/* Data Live Trading button — for all members */}
          <div
            onClick={() => setActiveView("perso")}
            className="border-2 border-dashed border-border rounded-xl bg-card/50 hover:border-emerald-500/40 hover:bg-card transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] gap-3"
          >
            <div className="p-3 rounded-full bg-emerald-500/10">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="text-center">
              <span className="text-sm font-semibold text-muted-foreground block">Data Live Trading</span>
              <span className="text-xs text-muted-foreground/60">Récolter ma data personnelle</span>
            </div>
          </div>

        </div>

        {/* Create Setup Dialog */}
        <CreateSetupDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onCreated={() => {
            setIsCreateDialogOpen(false);
            refetchSetups();
          }}
          isAdmin={isAdmin || isSuperAdmin}
        />

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
    <div className="px-3 md:px-6 py-3 border-b border-border bg-card flex items-center gap-3">
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
