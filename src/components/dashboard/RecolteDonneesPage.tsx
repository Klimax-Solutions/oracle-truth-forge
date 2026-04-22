// ============================================
// Récolte de données — page principale des trading sessions
// ============================================
// 2 CTA (Backtesting bleu / Live Trading orange)
// → popup de création
// → liste des sessions en cours (backtesting + live)
// → bloc Prime Setup Oracle (locked, placeholder)
// ============================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Play, Lock, Loader2, ChevronRight, Plus, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NewSessionDialog, { SessionType } from "./NewSessionDialog";
import { SetupPerso } from "./SetupPerso";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";

interface TradingSession {
  id: string;
  user_id: string;
  name: string;
  asset: string | null;
  type: SessionType;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface SessionStats {
  trades: number;
  rr: number;
  winRate: number;
  avgRR: number;
}

const BLUE = "#3B82F6";
const ORANGE = "#F97316";

interface RecolteDonneesPageProps {
  onNavigateToSetupOracle?: () => void;
}

export default function RecolteDonneesPage({ onNavigateToSetupOracle }: RecolteDonneesPageProps = {}) {
  const { isEarlyAccess } = useEarlyAccess();
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [sessionStats, setSessionStats] = useState<Record<string, SessionStats>>({});
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState<SessionType | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // ── Fetch sessions + stats ──
  const loadSessions = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: sessionsData } = await supabase
      .from("trading_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("updated_at", { ascending: false });

    setSessions((sessionsData || []) as TradingSession[]);

    // Fetch stats per session
    if (sessionsData && sessionsData.length > 0) {
      const ids = sessionsData.map(s => s.id);
      const { data: trades } = await supabase
        .from("user_personal_trades")
        .select("session_id, rr, result")
        .in("session_id", ids);

      const stats: Record<string, SessionStats> = {};
      (trades || []).forEach((t: any) => {
        if (!t.session_id) return;
        if (!stats[t.session_id]) stats[t.session_id] = { trades: 0, rr: 0, winRate: 0, avgRR: 0 };
        stats[t.session_id].trades += 1;
        stats[t.session_id].rr += t.rr || 0;
      });

      // Calcul winRate + avgRR
      for (const sid of Object.keys(stats)) {
        const sessionTrades = (trades || []).filter((t: any) => t.session_id === sid);
        const wins = sessionTrades.filter((t: any) => (t.rr || 0) > 0).length;
        stats[sid].winRate = sessionTrades.length > 0 ? (wins / sessionTrades.length) * 100 : 0;
        stats[sid].avgRR = sessionTrades.length > 0 ? stats[sid].rr / sessionTrades.length : 0;
      }

      setSessionStats(stats);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleSessionCreated = (sessionId: string) => {
    setDialogType(null);
    setActiveSessionId(sessionId);
    // Refresh list after they come back
  };

  const handleBackFromSession = () => {
    setActiveSessionId(null);
    loadSessions();
  };

  // Séparer backtesting vs live
  const backtestingSessions = useMemo(() => sessions.filter(s => s.type === "backtesting"), [sessions]);
  const liveSessions = useMemo(() => sessions.filter(s => s.type === "live_trading"), [sessions]);

  // ── Si une session est ouverte, afficher l'interface de session ──
  if (activeSessionId) {
    const session = sessions.find(s => s.id === activeSessionId);
    return (
      <div className="h-full flex flex-col bg-[#0A0B10]">
        {/* Session header */}
        <div className="shrink-0 border-b border-white/[0.08] px-6 py-4 flex items-center gap-4">
          <button
            onClick={handleBackFromSession}
            className="text-sm text-white/60 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            ← Retour
          </button>
          {session && (
            <>
              <div className="w-px h-5 bg-white/10" />
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-semibold tracking-[0.15em] uppercase"
                  style={{ color: session.type === "backtesting" ? BLUE : ORANGE }}
                >
                  {session.type === "backtesting" ? "BACKTESTING" : "LIVE TRADING"}
                </span>
                {session.asset && <span className="text-[10px] text-white/40">· {session.asset}</span>}
                <span className="text-base font-semibold text-white">{session.name}</span>
              </div>
            </>
          )}
        </div>

        {/* Session content : SetupPerso filtered by sessionId */}
        <div className="flex-1 overflow-auto">
          <SetupPerso sessionId={activeSessionId} />
        </div>
      </div>
    );
  }

  // ── Vue principale ──
  return (
    <div className="h-full overflow-auto bg-[#0A0B10] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Récolte de données</h1>
          <p className="text-sm text-white/50 mt-2">Explorez et gérez vos données de trading</p>
        </div>

        {/* ═══ Setup Oracle — HERO en haut ═══ */}
        <section className="mb-12">
          {isEarlyAccess ? (
            /* EA : locked, hero */
            <div className="relative overflow-hidden rounded-2xl border border-blue-500/25 p-8 md:p-10 bg-gradient-to-br from-blue-500/[0.12] via-blue-500/[0.04] to-transparent">
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "radial-gradient(circle at 85% 15%, rgba(59,130,246,0.18), transparent 55%)"
              }} />
              <div className="relative flex items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(59,130,246,0.2)]">
                  <Lock className="w-7 h-7 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-blue-400 mb-1.5">
                    Prime Setup Oracle · verrouillé
                  </p>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                    Accéder au Setup Oracle
                  </h2>
                  <p className="text-sm text-white/60 max-w-xl mb-5 leading-relaxed">
                    Base de données de <span className="text-white font-semibold">314 trades de référence</span> + méthodologie complète.
                    Débloqué en passant membre.
                  </p>
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500/40 text-white text-sm font-semibold opacity-70 cursor-not-allowed border border-blue-400/30"
                  >
                    <Lock className="w-4 h-4" />
                    Débloquer le Prime Setup Oracle
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Membre / Admin : hero débloqué, bouton saillant */
            <button
              onClick={() => onNavigateToSetupOracle?.()}
              className="group relative overflow-hidden w-full text-left rounded-2xl border border-blue-500/40 hover:border-blue-400/60 p-8 md:p-10 transition-all bg-gradient-to-br from-blue-500/[0.14] via-blue-500/[0.06] to-transparent hover:shadow-[0_20px_48px_-16px_rgba(59,130,246,0.35)]"
            >
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "radial-gradient(circle at 85% 15%, rgba(59,130,246,0.22), transparent 55%)"
              }} />
              <div className="relative flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/50 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(59,130,246,0.3)] group-hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] transition-shadow">
                  <Database className="w-7 h-7 text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-blue-400 mb-1.5">
                    Prime Setup Oracle · débloqué
                  </p>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                    Accéder au Setup Oracle
                  </h2>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Base de données de <span className="text-white font-semibold">314 trades de référence</span> + méthodologie complète
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-blue-300 shrink-0 transition-transform group-hover:translate-x-1.5" />
              </div>
            </button>
          )}
        </section>

        {/* Nouvelle session — 2 CTA */}
        <section className="mb-10">
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-3">Nouvelle session</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BACKTESTING */}
            <button
              onClick={() => setDialogType("backtesting")}
              className="group text-left rounded-2xl p-6 border transition-all hover:scale-[1.01]"
              style={{
                borderColor: `${BLUE}33`,
                backgroundColor: `${BLUE}08`,
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${BLUE}22` }}
                >
                  <LineChart className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: BLUE }}>
                    Backtesting
                  </p>
                  <h3 className="text-lg font-bold text-white leading-tight">Entamer une session</h3>
                </div>
              </div>
              <p className="text-xs text-white/50 leading-relaxed mb-5">
                Récolte des trades gagnants dans le passé pour identifier ce qui fonctionne.
              </p>
              <div
                className="w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all group-hover:brightness-110"
                style={{ backgroundColor: BLUE }}
              >
                Commencer une session <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* LIVE TRADING */}
            <button
              onClick={() => setDialogType("live_trading")}
              className="group text-left rounded-2xl p-6 border transition-all hover:scale-[1.01]"
              style={{
                borderColor: `${ORANGE}33`,
                backgroundColor: `${ORANGE}08`,
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${ORANGE}22` }}
                >
                  <Play className="w-5 h-5" style={{ color: ORANGE }} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: ORANGE }}>
                    Live Trading
                  </p>
                  <h3 className="text-lg font-bold text-white leading-tight">Récolter ma data en session</h3>
                </div>
              </div>
              <p className="text-xs text-white/50 leading-relaxed mb-5">
                Traquer les patterns de mes sessions de trading pour les comparer au passé.
              </p>
              <div
                className="w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all group-hover:brightness-110"
                style={{ backgroundColor: ORANGE }}
              >
                Démarrer ma session live <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </section>

        {/* Mes sessions en cours */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Mes sessions en cours</p>
            <p className="text-[10px] font-mono text-white/30">
              {sessions.length} session{sessions.length > 1 ? "s" : ""}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/[0.08] rounded-2xl">
              <p className="text-sm text-white/30">Aucune session en cours</p>
              <p className="text-xs text-white/20 mt-1">
                Démarre une session backtesting ou live trading pour commencer
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map(s => {
                const stats = sessionStats[s.id] || { trades: 0, rr: 0, winRate: 0, avgRR: 0 };
                const isBacktest = s.type === "backtesting";
                const accent = isBacktest ? BLUE : ORANGE;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className="group text-left rounded-2xl p-5 border transition-all hover:scale-[1.01]"
                    style={{
                      borderColor: `${accent}33`,
                      backgroundColor: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${accent}22` }}
                      >
                        {isBacktest
                          ? <LineChart className="w-4 h-4" style={{ color: accent }} />
                          : <Play className="w-4 h-4" style={{ color: accent }} />}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-[9px] font-semibold tracking-[0.15em] uppercase"
                          style={{ color: accent }}
                        >
                          {isBacktest ? "BACKTESTING" : "LIVE TRADING"}
                          {s.asset && <span className="ml-1 opacity-60">· {s.asset}</span>}
                        </p>
                        <h4 className="text-base font-bold text-white truncate">{s.name}</h4>
                      </div>
                    </div>

                    {/* Stats 4 columns */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <div className="text-left">
                        <p className="text-[9px] font-mono uppercase text-white/30">Trades</p>
                        <p className="text-base font-bold text-white">{stats.trades}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] font-mono uppercase text-white/30">RR</p>
                        <p className={cn(
                          "text-base font-bold font-mono",
                          stats.rr >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {stats.rr >= 0 ? "+" : ""}{stats.rr.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] font-mono uppercase text-white/30">WR</p>
                        <p className="text-base font-bold text-white">{stats.winRate.toFixed(0)}%</p>
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] font-mono uppercase text-white/30">Moy</p>
                        <p className="text-base font-bold text-white">{stats.avgRR.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* CTA */}
                    <div
                      className="w-full h-10 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all group-hover:brightness-110"
                      style={{
                        backgroundColor: `${accent}15`,
                        color: accent,
                      }}
                    >
                      ▶ Continuer ma récolte
                    </div>
                  </button>
                );
              })}

              {/* Emplacement libre visuel (si moins de 4 sessions) */}
              {sessions.length < 4 && (
                <button
                  onClick={() => setDialogType("backtesting")}
                  className="group text-left rounded-2xl p-5 border border-dashed border-white/[0.08] hover:border-white/[0.15] transition-colors flex items-center justify-center min-h-[180px]"
                >
                  <div className="text-center">
                    <Plus className="w-6 h-6 text-white/20 mx-auto mb-2" />
                    <p className="text-xs text-white/30">Emplacement libre</p>
                    <p className="text-[10px] text-white/20 mt-0.5">pour une nouvelle session</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </section>

      </div>

      {/* Popup de création */}
      <NewSessionDialog
        open={dialogType !== null}
        type={dialogType || "backtesting"}
        onClose={() => setDialogType(null)}
        onCreated={handleSessionCreated}
      />
    </div>
  );
}
