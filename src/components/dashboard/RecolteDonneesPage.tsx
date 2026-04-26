// ============================================
// Récolte de données — page principale des trading sessions
// ============================================
// 2 CTA (Backtesting bleu / Live Trading orange)
// → popup de création
// → liste des sessions en cours (backtesting + live)
// → bloc Prime Setup Oracle (locked, placeholder)
// ============================================

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Play, Lock, Loader2, ChevronRight, Plus, Database, Pencil, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionButton } from "./ActionButton";
import { StepBadge } from "./StepBadge";

// Couleurs thème Récolte (cohérence homepage slide 02)
const TEAL   = "#1AAFA0";
const TEAL_G = "rgba(26,175,160,0.18)";
const ORANGE = "#F97316";
import { Input } from "@/components/ui/input";
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

const BLUE = "#10B981"; // vert thème (ex-bleu backtesting → cohérence visuelle)

interface RecolteDonneesPageProps {
  onNavigateToSetupOracle?: () => void;
  /** SA role simulation — si défini, override le hook useEarlyAccess */
  overrideIsEarlyAccess?: boolean;
  /** Admin-only : action de consultation Oracle Max (Data Analysis) */
  isAdmin?: boolean;
  onConsultOracleMax?: () => void;
}

export default function RecolteDonneesPage({ onNavigateToSetupOracle, overrideIsEarlyAccess, isAdmin, onConsultOracleMax }: RecolteDonneesPageProps = {}) {
  const { isEarlyAccess: isEarlyAccessFromDB } = useEarlyAccess();
  const isEarlyAccess = overrideIsEarlyAccess !== undefined ? overrideIsEarlyAccess : isEarlyAccessFromDB;
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [sessionStats, setSessionStats] = useState<Record<string, SessionStats>>({});
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState<SessionType | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // ── Rename state ──
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  const startRename = (s: TradingSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(s.id);
    setRenameValue(s.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const commitRename = async (sessionId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    await supabase.from("trading_sessions").update({ name: trimmed }).eq("id", sessionId);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, name: trimmed } : s));
    setRenamingId(null);
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
        <div className="shrink-0 border-b border-white/[0.08] px-3 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 flex-wrap">
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
                {renamingId === session.id ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") commitRename(session.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-7 text-sm font-semibold bg-white/5 border-white/20 text-white w-52"
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      onClick={() => commitRename(session.id)}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group/rename">
                    <span className="text-base font-semibold text-white">{session.name}</span>
                    <button
                      onClick={e => startRename(session, e)}
                      className="opacity-0 group-hover/rename:opacity-100 transition-opacity text-white/40 hover:text-white"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Session content : SetupPerso filtered by sessionId */}
        <div className="flex-1 overflow-auto">
          <SetupPerso sessionId={activeSessionId} customSetupName={session?.name} />
        </div>
      </div>
    );
  }

  // ── Vue principale ──
  return (
    <div className="h-full overflow-auto bg-[#07070A] text-white relative" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Grain texture */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.022 }} aria-hidden>
        <filter id="recolte-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#recolte-grain)" />
      </svg>

      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        background: `radial-gradient(ellipse 55% 45% at 15% 20%, ${TEAL_G}, transparent 65%)`,
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-3 md:px-10 py-6 md:py-10">

        {/* ── Header éditorial ── */}
        <div className="mb-10">
          <div style={{ marginBottom: "12px" }}>
            <StepBadge index="02" label="Récolte" accent={TEAL} />
          </div>
          <h1 style={{
            fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: "0.95",
            paddingBottom: "0.06em",
            backgroundImage: "linear-gradient(160deg, #ffffff 35%, rgba(255,255,255,0.30) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: "12px",
          }}>
            Ta récolte
          </h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.40)", lineHeight: 1.6, maxWidth: "44ch" }}>
            Saisie de tes exécutions, sessions backtesting et accès à la base Oracle.
          </p>
        </div>

        {/* ═══ Setup Oracle — HERO ═══ */}
        <section className="mb-12">
          {isEarlyAccess ? (
            <div className="relative overflow-hidden rounded-2xl p-8 md:p-10" style={{
              border: `1px solid ${TEAL}28`,
              background: `linear-gradient(135deg, ${TEAL}10 0%, transparent 60%)`,
            }}>
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle at 85% 15%, ${TEAL}20, transparent 55%)`
              }} />
              <div className="relative flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{
                  background: `${TEAL}18`, border: `1px solid ${TEAL}40`,
                  boxShadow: `0 0 24px ${TEAL}25`,
                }}>
                  <Lock className="w-6 h-6" style={{ color: TEAL }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: TEAL, marginBottom: "6px" }}>
                    Prime Setup Oracle · verrouillé
                  </p>
                  <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>Accéder au Setup Oracle</h2>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.50)", lineHeight: 1.5 }}>
                    Base de données de <strong style={{ color: "#fff" }}>314 trades de référence</strong> + méthodologie complète
                  </p>
                </div>
                <ActionButton label="Débloquer" icon={<Lock className="w-4 h-4" />} bg="#158A7E" shadow="rgba(21,138,126,0.45)" disabled />
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl p-8 md:p-10 cursor-pointer group transition-all" style={{
              border: `1px solid ${TEAL}35`,
              background: `linear-gradient(135deg, ${TEAL}12 0%, transparent 60%)`,
            }}
              onClick={() => onNavigateToSetupOracle?.()}
            >
              <div className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{
                backgroundImage: `radial-gradient(circle at 85% 15%, ${TEAL}25, transparent 55%)`
              }} />
              <div className="relative flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{
                  background: `${TEAL}20`, border: `1px solid ${TEAL}50`,
                  boxShadow: `0 0 28px ${TEAL}30`,
                }}>
                  <Database className="w-6 h-6" style={{ color: TEAL }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: TEAL, marginBottom: "6px" }}>
                    Prime Setup Oracle · débloqué
                  </p>
                  <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>Accéder au Setup Oracle</h2>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.50)", lineHeight: 1.5 }}>
                    Base de données de <strong style={{ color: "#fff" }}>314 trades de référence</strong> + méthodologie complète
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <ActionButton
                    label="Ouvrir"
                    icon={<ChevronRight className="w-4 h-4" />}
                    bg="#158A7E"
                    shadow="rgba(21,138,126,0.50)"
                    onClick={() => onNavigateToSetupOracle?.()}
                  />
                  {isAdmin && onConsultOracleMax && (
                    <ActionButton
                      label="Oracle Max"
                      icon={<Database className="w-3.5 h-3.5" />}
                      bg="#4B5563"
                      shadow="rgba(75,85,99,0.40)"
                      size="sm"
                      onClick={onConsultOracleMax}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Nouvelle session — 2 CTA */}
        <section className="mb-10">
          <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: "14px" }}>
            Nouvelle session
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BACKTESTING */}
            <div className="rounded-2xl p-4 md:p-6 border" style={{ borderColor: `${TEAL}30`, backgroundColor: `${TEAL}07` }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${TEAL}18` }}>
                  <LineChart className="w-5 h-5" style={{ color: TEAL }} />
                </div>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: TEAL }}>Backtesting</p>
                  <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Entamer une session</h3>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.42)", lineHeight: 1.6, marginBottom: "20px" }}>
                Récolte des trades gagnants dans le passé pour identifier ce qui fonctionne.
              </p>
              <ActionButton onClick={() => setDialogType("backtesting")} label="Commencer" icon={<ChevronRight className="w-4 h-4" />} bg="#158A7E" shadow="rgba(21,138,126,0.50)" fullWidth />
            </div>

            {/* LIVE TRADING */}
            <div className="rounded-2xl p-4 md:p-6 border" style={{ borderColor: `${ORANGE}30`, backgroundColor: `${ORANGE}07` }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ORANGE}18` }}>
                  <Play className="w-5 h-5" style={{ color: ORANGE }} />
                </div>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: ORANGE }}>Live Trading</p>
                  <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Récolter en live</h3>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.42)", lineHeight: 1.6, marginBottom: "20px" }}>
                Traquer les patterns de mes sessions pour les comparer au passé.
              </p>
              <ActionButton onClick={() => setDialogType("live_trading")} label="Démarrer" icon={<Play className="w-4 h-4" />} bg="#e06510" shadow="rgba(249,115,22,0.45)" fullWidth />
            </div>
          </div>
        </section>

        {/* Mes sessions en cours */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-5">
            <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
              Mes sessions
            </p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.22)", fontVariantNumeric: "tabular-nums" }}>
              {sessions.length} session{sessions.length !== 1 ? "s" : ""}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* ── Colonne Backtesting ── */}
              <div>
                <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: TEAL, marginBottom: "12px", opacity: 0.8 }}>
                  Backtesting · {backtestingSessions.length}
                </p>
                <div className="space-y-3">
                  {backtestingSessions.map(s => {
                    const stats = sessionStats[s.id] || { trades: 0, rr: 0, winRate: 0, avgRR: 0 };
                    return (
                      <button
                        key={s.id}
                        onClick={() => renamingId !== s.id && setActiveSessionId(s.id)}
                        className="group w-full text-left rounded-2xl p-5 border transition-all hover:scale-[1.01]"
                        style={{ borderColor: `${TEAL}33`, backgroundColor: "rgba(255,255,255,0.02)" }}
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${TEAL}22` }}>
                            <LineChart className="w-4 h-4" style={{ color: TEAL }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-semibold tracking-[0.15em] uppercase" style={{ color: TEAL }}>
                              BACKTESTING{s.asset && <span className="ml-1 opacity-60">· {s.asset}</span>}
                            </p>
                            {renamingId === s.id ? (
                              <div className="flex items-center gap-1.5 mt-0.5" onClick={e => e.stopPropagation()}>
                                <Input
                                  ref={renameInputRef}
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") commitRename(s.id);
                                    if (e.key === "Escape") setRenamingId(null);
                                  }}
                                  className="h-7 text-sm font-bold bg-white/5 border-white/20 text-white flex-1"
                                />
                                <button onClick={() => commitRename(s.id)} className="text-white/60 hover:text-white shrink-0">
                                  <Check className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group/name">
                                <h4 className="text-base font-bold text-white truncate">{s.name}</h4>
                                <button
                                  onClick={e => startRename(s, e)}
                                  className="opacity-0 group-hover/name:opacity-100 transition-opacity text-white/30 hover:text-white shrink-0"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                          <div><p className="text-[9px] font-mono uppercase text-white/30">Trades</p><p className="text-base font-bold text-white">{stats.trades}</p></div>
                          <div><p className="text-[9px] font-mono uppercase text-white/30">RR</p><p className={cn("text-base font-bold font-mono", stats.rr >= 0 ? "text-emerald-400" : "text-red-400")}>{stats.rr >= 0 ? "+" : ""}{stats.rr.toFixed(1)}</p></div>
                          <div><p className="text-[9px] font-mono uppercase text-white/30">WR</p><p className="text-base font-bold text-white">{stats.winRate.toFixed(0)}%</p></div>
                          <div><p className="text-[9px] font-mono uppercase text-white/30">Moy</p><p className="text-base font-bold text-white">{stats.avgRR.toFixed(2)}</p></div>
                        </div>
                        <div className="w-full h-10 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all group-hover:brightness-110" style={{ backgroundColor: `${TEAL}15`, color: TEAL }}>
                          ▶ Continuer ma récolte
                        </div>
                      </button>
                    );
                  })}
                  {/* Slot ajouter */}
                  <button
                    onClick={() => setDialogType("backtesting")}
                    className="w-full rounded-2xl p-4 border border-dashed hover:border-white/[0.15] transition-colors flex items-center justify-center gap-2 min-h-[60px]"
                    style={{ borderColor: `${TEAL}22` }}
                  >
                    <Plus className="w-4 h-4" style={{ color: `${TEAL}60` }} />
                    <span style={{ fontSize: "11px", color: `${TEAL}60` }}>Nouvelle session backtesting</span>
                  </button>
                </div>
              </div>

              {/* ── Colonne Live Trading ── */}
              <div>
                <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: ORANGE, marginBottom: "12px", opacity: 0.8 }}>
                  Live Trading · {liveSessions.length}
                </p>
                <div className="space-y-3">
                  {liveSessions.map(s => {
                    const stats = sessionStats[s.id] || { trades: 0, rr: 0, winRate: 0, avgRR: 0 };
                    return (
                      <button
                        key={s.id}
                        onClick={() => renamingId !== s.id && setActiveSessionId(s.id)}
                        className="group w-full text-left rounded-2xl p-5 border transition-all hover:scale-[1.01]"
                        style={{ borderColor: `${ORANGE}33`, backgroundColor: "rgba(255,255,255,0.02)" }}
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${ORANGE}22` }}>
                            <Play className="w-4 h-4" style={{ color: ORANGE }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-semibold tracking-[0.15em] uppercase" style={{ color: ORANGE }}>
                              LIVE TRADING{s.asset && <span className="ml-1 opacity-60">· {s.asset}</span>}
                            </p>
                            {renamingId === s.id ? (
                              <div className="flex items-center gap-1.5 mt-0.5" onClick={e => e.stopPropagation()}>
                                <Input
                                  ref={renameInputRef}
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") commitRename(s.id);
                                    if (e.key === "Escape") setRenamingId(null);
                                  }}
                                  className="h-7 text-sm font-bold bg-white/5 border-white/20 text-white flex-1"
                                />
                                <button onClick={() => commitRename(s.id)} className="text-white/60 hover:text-white shrink-0">
                                  <Check className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group/name">
                                <h4 className="text-base font-bold text-white truncate">{s.name}</h4>
                                <button
                                  onClick={e => startRename(s, e)}
                                  className="opacity-0 group-hover/name:opacity-100 transition-opacity text-white/30 hover:text-white shrink-0"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                          <div><p className="text-[9px] font-mono uppercase text-white/30">Trades</p><p className="text-base font-bold text-white">{stats.trades}</p></div>
                          <div><p className="text-[9px] font-mono uppercase text-white/30">RR</p><p className={cn("text-base font-bold font-mono", stats.rr >= 0 ? "text-emerald-400" : "text-red-400")}>{stats.rr >= 0 ? "+" : ""}{stats.rr.toFixed(1)}</p></div>
                          <div><p className="text-[9px] font-mono uppercase text-white/30">WR</p><p className="text-base font-bold text-white">{stats.winRate.toFixed(0)}%</p></div>
                          <div><p className="text-[9px] font-mono uppercase text-white/30">Moy</p><p className="text-base font-bold text-white">{stats.avgRR.toFixed(2)}</p></div>
                        </div>
                        <div className="w-full h-10 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all group-hover:brightness-110" style={{ backgroundColor: `${ORANGE}15`, color: ORANGE }}>
                          ▶ Continuer ma récolte
                        </div>
                      </button>
                    );
                  })}
                  {/* Slot ajouter */}
                  <button
                    onClick={() => setDialogType("live_trading")}
                    className="w-full rounded-2xl p-4 border border-dashed hover:border-white/[0.15] transition-colors flex items-center justify-center gap-2 min-h-[60px]"
                    style={{ borderColor: `${ORANGE}22` }}
                  >
                    <Plus className="w-4 h-4" style={{ color: `${ORANGE}60` }} />
                    <span style={{ fontSize: "11px", color: `${ORANGE}60` }}>Nouvelle session live trading</span>
                  </button>
                </div>
              </div>

            </div>
          )}
        </section>

      </div>{/* end max-w-5xl */}

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
