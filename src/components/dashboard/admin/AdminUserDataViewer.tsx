import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScreenshotLink } from "../ScreenshotLink";
import {
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Crosshair,
  Trophy,
  ExternalLink,
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  Newspaper,
} from "lucide-react";

interface AdminUserDataViewerProps {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PersonalTrade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure: string | null;
  entry_time: string | null;
  exit_time: string | null;
  trade_duration: string | null;
  rr: number | null;
  stop_loss_size: string | null;
  setup_type: string | null;
  entry_timing: string | null;
  entry_model: string | null;
  result: string | null;
  screenshot_url: string | null;
  screenshot_context_url: string | null;
  screenshot_entry_url: string | null;
  chart_link: string | null;
  comment: string | null;
  news_day: boolean | null;
  news_label: string | null;
}

interface Execution {
  id: string;
  trade_number: number;
  trade_date: string;
  direction: string;
  direction_structure: string | null;
  entry_time: string | null;
  exit_time: string | null;
  rr: number | null;
  result: string | null;
  setup_type: string | null;
  entry_model: string | null;
  entry_timing: string | null;
  screenshot_url: string | null;
  notes: string | null;
}

interface Success {
  id: string;
  image_path: string;
  success_type: string | null;
  created_at: string;
}

export const AdminUserDataViewer = ({
  userId,
  userName,
  open,
  onOpenChange,
}: AdminUserDataViewerProps) => {
  const [personalTrades, setPersonalTrades] = useState<PersonalTrade[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [successes, setSuccesses] = useState<Success[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      fetchAllData();
    }
  }, [open, userId]);

  const fetchAllData = async () => {
    if (!userId) return;
    setLoading(true);

    const [personalRes, execRes, successRes] = await Promise.all([
      supabase
        .from("user_personal_trades")
        .select("*")
        .eq("user_id", userId)
        .order("trade_number", { ascending: true }),
      supabase
        .from("user_executions")
        .select("*")
        .eq("user_id", userId)
        .order("trade_number", { ascending: true }),
      supabase
        .from("user_successes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (personalRes.data) setPersonalTrades(personalRes.data as PersonalTrade[]);
    if (execRes.data) setExecutions(execRes.data as Execution[]);
    if (successRes.data) setSuccesses(successRes.data as Success[]);

    setLoading(false);
  };

  const calcStats = (items: { rr: number | null }[]) => {
    const total = items.reduce((s, t) => s + (t.rr || 0), 0);
    const wins = items.filter((t) => (t.rr || 0) > 0).length;
    const winRate = items.length > 0 ? (wins / items.length) * 100 : 0;
    return { total, wins, losses: items.length - wins, winRate };
  };

  const execStats = calcStats(executions);
  const personalStats = calcStats(personalTrades);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Données complètes — {userName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="executions" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="self-start flex-wrap gap-1 h-auto mb-4">
              <TabsTrigger value="executions" className="gap-1.5 text-xs">
                <Crosshair className="w-3.5 h-3.5" />
                Exécutions ({executions.length})
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-1.5 text-xs">
                <Database className="w-3.5 h-3.5" />
                Trades Perso ({personalTrades.length})
              </TabsTrigger>
              <TabsTrigger value="successes" className="gap-1.5 text-xs">
                <Trophy className="w-3.5 h-3.5" />
                Succès ({successes.length})
              </TabsTrigger>
            </TabsList>

            {/* Executions Tab */}
            <TabsContent value="executions" className="flex-1 overflow-auto mt-0">
              {executions.length === 0 ? (
                <EmptyState label="Aucune exécution enregistrée" />
              ) : (
                <div className="space-y-4">
                  <StatsRow stats={execStats} count={executions.length} />
                  <div className="border border-border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="h-8 text-[10px] font-mono">#</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Date</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Dir</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Entrée</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Sortie</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Setup</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Modèle</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Timing</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono text-right">RR</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Screenshot</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {executions.map((exec) => (
                          <TableRow key={exec.id} className="hover:bg-muted/30">
                            <TableCell className="py-1.5 text-xs font-mono font-bold">
                              {exec.trade_number}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                              {new Date(exec.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <DirectionBadge direction={exec.direction} />
                            </TableCell>
                            <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                              {exec.entry_time || "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                              {exec.exit_time || "—"}
                            </TableCell>
                            <TableCell className="py-1.5">
                              {exec.setup_type && (
                                <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-mono rounded">
                                  {exec.setup_type}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                              {exec.entry_model || "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                              {exec.entry_timing || "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-right">
                              <RRValue rr={exec.rr} />
                            </TableCell>
                            <TableCell className="py-1.5">
                              <ScreenshotLink
                                storagePath={exec.screenshot_url}
                                alt={`Trade #${exec.trade_number}`}
                                showExternalIcon
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Personal Trades Tab */}
            <TabsContent value="personal" className="flex-1 overflow-auto mt-0">
              {personalTrades.length === 0 ? (
                <EmptyState label="Aucun trade personnel enregistré" />
              ) : (
                <div className="space-y-4">
                  <StatsRow stats={personalStats} count={personalTrades.length} />
                  <div className="border border-border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="h-8 text-[10px] font-mono">#</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Date</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Dir</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Structure</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Setup</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Modèle</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Timing</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono text-right">RR</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">News</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Screenshots</TableHead>
                          <TableHead className="h-8 text-[10px] font-mono">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {personalTrades.map((trade) => (
                          <TableRow key={trade.id} className="hover:bg-muted/30">
                            <TableCell className="py-1.5 text-xs font-mono font-bold">
                              {trade.trade_number}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                              {new Date(trade.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <DirectionBadge direction={trade.direction} />
                            </TableCell>
                            <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                              {trade.direction_structure || "—"}
                            </TableCell>
                            <TableCell className="py-1.5">
                              {trade.setup_type && (
                                <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-mono rounded">
                                  {trade.setup_type}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground max-w-[120px] truncate">
                              {trade.entry_model || "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                              {trade.entry_timing || "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-right">
                              <RRValue rr={trade.rr} />
                            </TableCell>
                            <TableCell className="py-1.5">
                              {trade.news_day && (
                                <div className="flex items-center gap-1">
                                  <Newspaper className="w-3 h-3 text-orange-400" />
                                  {trade.news_label && (
                                    <span className="text-[9px] text-muted-foreground truncate max-w-[60px]">
                                      {trade.news_label}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <div className="flex items-center gap-1">
                                <ScreenshotLink
                                  storagePath={trade.screenshot_context_url || trade.screenshot_url}
                                  alt={`Contexte #${trade.trade_number}`}
                                  showExternalIcon
                                />
                                <ScreenshotLink
                                  storagePath={trade.screenshot_entry_url}
                                  alt={`Entrée #${trade.trade_number}`}
                                  showExternalIcon
                                />
                                {trade.chart_link && (
                                  <a
                                    href={trade.chart_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/80"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5 text-[10px] text-muted-foreground max-w-[100px] truncate">
                              {trade.comment || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Successes Tab */}
            <TabsContent value="successes" className="flex-1 overflow-auto mt-0">
              {successes.length === 0 ? (
                <EmptyState label="Aucun succès enregistré" />
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground font-mono">
                    {successes.length} succès enregistré{successes.length > 1 ? "s" : ""}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {successes.map((success) => (
                      <div
                        key={success.id}
                        className="border border-border rounded-md overflow-hidden bg-card"
                      >
                        <ScreenshotLink
                          storagePath={success.image_path}
                          alt={`Succès ${success.success_type || ""}`}
                          showExternalIcon
                        />
                        <div className="p-2">
                          <Badge variant="outline" className="text-[9px]">
                            {success.success_type || "TP"}
                          </Badge>
                          <p className="text-[9px] text-muted-foreground mt-1">
                            {new Date(success.created_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Shared sub-components
const EmptyState = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center h-40 text-center">
    <Database className="w-10 h-10 text-muted-foreground mb-3" />
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);

const DirectionBadge = ({ direction }: { direction: string }) => (
  <div
    className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono",
      direction === "Long"
        ? "bg-emerald-500/20 text-emerald-400"
        : "bg-red-500/20 text-red-400"
    )}
  >
    {direction === "Long" ? (
      <ArrowUpRight className="w-3 h-3" />
    ) : (
      <ArrowDownRight className="w-3 h-3" />
    )}
    {direction}
  </div>
);

const RRValue = ({ rr }: { rr: number | null }) => (
  <span
    className={cn(
      "font-mono font-bold text-xs",
      (rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
    )}
  >
    {(rr || 0) >= 0 ? "+" : ""}
    {(rr || 0).toFixed(1)}
  </span>
);

const StatsRow = ({
  stats,
  count,
}: {
  stats: { total: number; wins: number; losses: number; winRate: number };
  count: number;
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
    <div className="p-3 bg-card border border-border rounded-md">
      <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Total RR</p>
      <p
        className={cn(
          "text-lg font-bold",
          stats.total >= 0 ? "text-emerald-400" : "text-red-400"
        )}
      >
        {stats.total >= 0 ? "+" : ""}
        {stats.total.toFixed(1)}
      </p>
    </div>
    <div className="p-3 bg-card border border-border rounded-md">
      <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Win Rate</p>
      <p className="text-lg font-bold text-foreground">{stats.winRate.toFixed(0)}%</p>
    </div>
    <div className="p-3 bg-card border border-border rounded-md">
      <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">W / L</p>
      <p className="text-lg font-bold text-foreground">
        {stats.wins} / {stats.losses}
      </p>
    </div>
    <div className="p-3 bg-card border border-border rounded-md">
      <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Trades</p>
      <p className="text-lg font-bold text-foreground">{count}</p>
    </div>
  </div>
);
