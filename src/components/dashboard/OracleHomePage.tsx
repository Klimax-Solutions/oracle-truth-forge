import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Database, ShieldCheck, ExternalLink,
  Check, Clock, AlertCircle, Send, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// FONT : Inter via Google Fonts
// ─────────────────────────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("inter-font-oracle")) {
  const link = document.createElement("link");
  link.id = "inter-font-oracle";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap";
  document.head.appendChild(link);
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface VideoInfo { id: string; title: string; embed_url: string; }
interface ExecInfo { id: string; trade_number: number; rr: number | null; trade_date: string; direction: string; screenshot_url: string | null; }
interface CycleInfo { id: string; name: string; total_trades: number; cycle_number: number; userStatus: string | null; userProgress: number; }

interface OracleHomePageProps {
  onNavigateToVideos: () => void;
  onNavigateToRecolte: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG DES SLIDES
// ─────────────────────────────────────────────────────────────────────────────

const SLIDE_DURATION = 5000;

const SLIDES = [
  {
    index: "01", label: "Fondations",
    heading: "Commence ici.",
    accent: "#4F78CC",
    glow: "rgba(79,120,204,0.18)",
    border: "rgba(79,120,204,0.22)",
    badgeBg: "rgba(79,120,204,0.10)", badgeText: "#8EB4F0",
    ctaBg: "#3A64B8", ctaShadow: "rgba(58,100,184,0.50)",
  },
  {
    index: "02", label: "Récolte",
    heading: "Ta récolte",
    accent: "#1AAFA0",
    glow: "rgba(26,175,160,0.16)",
    border: "rgba(26,175,160,0.22)",
    badgeBg: "rgba(26,175,160,0.09)", badgeText: "#5ECFC4",
    ctaBg: "#158A7E", ctaShadow: "rgba(21,138,126,0.50)",
  },
  {
    index: "03", label: "Vérification",
    heading: "Ton cycle",
    accent: "#C8882A",
    glow: "rgba(200,136,42,0.15)",
    border: "rgba(200,136,42,0.20)",
    badgeBg: "rgba(200,136,42,0.09)", badgeText: "#E8B96A",
    ctaBg: "#A8701C", ctaShadow: "rgba(168,112,28,0.50)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LOGIQUE : Slide de départ intelligent
// ─────────────────────────────────────────────────────────────────────────────

function getInitialSlide(
  viewedCount: number,
  totalVideos: number,
  totalExecs: number,
  currentCycle: CycleInfo | null
): number {
  const cycleReady =
    currentCycle &&
    currentCycle.userProgress >= currentCycle.total_trades &&
    currentCycle.userStatus !== "pending" &&
    currentCycle.userStatus !== "validated";

  if (cycleReady) return 2;
  if (totalVideos > 0 && viewedCount < totalVideos) return 0;
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIQUE : Message contextuel
// ─────────────────────────────────────────────────────────────────────────────

function getContextualMessage(
  slideIndex: number,
  firstName: string,
  viewedCount: number,
  totalVideos: number,
  totalExecs: number,
  currentCycle: CycleInfo | null
): string {
  if (slideIndex === 0) {
    if (viewedCount === 0) return "Commencez par les vidéos explicatives du setup. C'est la fondation.";
    if (viewedCount < totalVideos) return `${viewedCount}/${totalVideos} vidéos vues — vous y êtes presque.`;
    return "Toutes les vidéos regardées. La récolte vous attend.";
  }

  if (slideIndex === 1) {
    if (totalExecs === 0) return "Saisissez vos premières exécutions sur FXReplay pour alimenter votre data.";
    if (currentCycle && currentCycle.userProgress >= currentCycle.total_trades)
      return "Cycle complet ! Passez à la vérification pour valider votre travail.";
    return `${totalExecs} trade${totalExecs > 1 ? "s" : ""} récolté${totalExecs > 1 ? "s" : ""}. Continuez sur votre lancée.`;
  }

  if (slideIndex === 2) {
    if (!currentCycle) return "Complétez un cycle pour soumettre une vérification.";
    if (currentCycle.userStatus === "validated") return "Cycle validé — félicitations. Passez au suivant.";
    if (currentCycle.userStatus === "pending") return "Vérification en cours. Un admin examine votre cycle.";
    if (currentCycle.userStatus === "rejected") return "Cycle rejeté. Revoyez les points de feedback et recommencez.";
    if (currentCycle.userProgress >= currentCycle.total_trades) return "Cycle terminé. Soumettez-le pour validation.";
    return `${currentCycle.userProgress}/${currentCycle.total_trades} trades — continuez la récolte avant de soumettre.`;
  }

  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export const OracleHomePage = ({ onNavigateToVideos, onNavigateToRecolte }: OracleHomePageProps) => {
  const { toast } = useToast();

  // ── Animation d'entrée : déclenche au mount, JAMAIS après
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Slide state — PAS de `transitioning`, seulement key={slide}
  const [slide, setSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const [hoverPreview, setHoverPreview] = useState(false);

  // ── User data
  const [firstName, setFirstName] = useState("");
  const [firstVideo, setFirstVideo] = useState<VideoInfo | null>(null);
  const [totalVideos, setTotalVideos] = useState(0);
  const [viewedCount, setViewedCount] = useState(0);
  const [lastExec, setLastExec] = useState<ExecInfo | null>(null);
  const [totalExecs, setTotalExecs] = useState(0);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [currentCycle, setCurrentCycle] = useState<CycleInfo | null>(null);
  const [allCycles, setAllCycles] = useState<CycleInfo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Data loading
  useEffect(() => {
    const safetyTimer = setTimeout(() => {}, 4000);

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { return; }
        setUserId(user.id);

        const [profileRes, videosRes, viewsRes, execLastRes, execCountRes, cyclesRes, userCyclesRes] = await Promise.all([
          supabase.from("profiles").select("first_name, display_name").eq("user_id", user.id).single(),
          supabase.from("videos").select("id, title, embed_url, sort_order").order("sort_order"),
          supabase.from("user_video_views").select("video_id").eq("user_id", user.id),
          supabase.from("user_executions").select("id, trade_number, rr, trade_date, direction, screenshot_url").eq("user_id", user.id).order("trade_number", { ascending: false }).limit(1),
          supabase.from("user_executions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("cycles").select("id, name, total_trades, cycle_number").order("cycle_number").gte("cycle_number", 1),
          supabase.from("user_cycles").select("id, cycle_id, status").eq("user_id", user.id),
        ]);

        const name = profileRes.data?.first_name || profileRes.data?.display_name || "";
        setFirstName(name.split(" ")[0] || "");

        if (videosRes.data?.length) { setFirstVideo(videosRes.data[0]); setTotalVideos(videosRes.data.length); }
        const views = viewsRes.data?.length || 0;
        setViewedCount(views);

        const latest = execLastRes.data?.[0] || null;
        setLastExec(latest);
        const count = execCountRes.count || 0;
        setTotalExecs(count);

        if (latest?.screenshot_url) {
          supabase.storage.from("trade-screenshots").createSignedUrl(latest.screenshot_url, 3600)
            .then(({ data }) => { if (data) setScreenshotUrl(data.signedUrl); });
        }

        let resolvedCurrent: CycleInfo | null = null;
        if (cyclesRes.data?.length) {
          const ucMap = Object.fromEntries((userCyclesRes.data || []).map(uc => [uc.cycle_id, { status: uc.status, id: uc.id }]));
          const enriched: CycleInfo[] = cyclesRes.data.map((c, i) => {
            const priorTotal = cyclesRes.data!.slice(0, i).reduce((s, pc) => s + pc.total_trades, 0);
            const prog = Math.min(Math.max(count - priorTotal, 0), c.total_trades);
            const uc = ucMap[c.id];
            return { id: c.id, name: c.name, total_trades: c.total_trades, cycle_number: c.cycle_number, userStatus: uc?.status || null, userProgress: uc?.status === "validated" ? c.total_trades : prog };
          });
          setAllCycles(enriched);
          resolvedCurrent = enriched.find(c => c.userStatus === "in_progress") || enriched.find(c => !c.userStatus) || enriched[0] || null;
          setCurrentCycle(resolvedCurrent);
        }

        // Always compute initial slide — regardless of whether cycles exist
        const initialSlide = getInitialSlide(views, videosRes.data?.length || 0, count, resolvedCurrent);
        setSlide(initialSlide);
      } catch (err) {
        console.warn("[OracleHomePage] load error:", err);
      } finally {
        clearTimeout(safetyTimer);
      }
    };
    load();
    return () => clearTimeout(safetyTimer);
  }, []);

  // ── Navigation manuelle — PAS de transitioning
  const goTo = useCallback((idx: number) => {
    setSlide(idx);
    setProgress(0);
  }, []);

  // ── RAF auto-advance — PAS de transitioning
  useEffect(() => {
    setProgress(0);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = performance.now();

    const tick = (now: number) => {
      const pct = Math.min((now - startRef.current) / SLIDE_DURATION * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setSlide(s => (s + 1) % 3);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [slide]);

  // ── Verification request
  const handleRequestVerification = async () => {
    if (!currentCycle || !userId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("verification_requests").insert({ user_id: userId, cycle_id: currentCycle.id, status: "pending" });
      if (error) throw error;
      setCurrentCycle(prev => prev ? { ...prev, userStatus: "pending" } : prev);
      toast({ title: "Demande envoyée", description: "Un admin va vérifier votre cycle." });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  const meta = SLIDES[slide];
  const isComplete = !!currentCycle && currentCycle.userProgress >= currentCycle.total_trades;
  const isPending = currentCycle?.userStatus === "pending";
  const isValidated = currentCycle?.userStatus === "validated";
  const isRejected = currentCycle?.userStatus === "rejected";
  const contextMsg = getContextualMessage(slide, firstName, viewedCount, totalVideos, totalExecs, currentCycle);

  // ── Cycle pct for slide 2
  const cyclePct = currentCycle
    ? Math.round(Math.min((currentCycle.userProgress / currentCycle.total_trades) * 100, 100))
    : 0;

  // ── Big metric values per slide
  const bigMetric = [
    totalVideos > 0 ? `${viewedCount}/${totalVideos}` : "—",
    `${totalExecs}`,
    currentCycle
      ? (isPending ? "ATTENTE" : isValidated ? "VALIDÉ" : isRejected ? "REJETÉ" : `${cyclePct}%`)
      : "—",
  ][slide];

  const metricLabel = [
    "vidéos vues",
    "trades récoltés",
    currentCycle ? (isPending ? "en attente" : isValidated ? "cycle validé" : isRejected ? "à reprendre" : "complété") : "—",
  ][slide];

  // ── Bottom nav status per step
  const stepStatus = [
    totalVideos > 0 ? `${viewedCount}/${totalVideos}` : "–",
    totalExecs > 0 ? `${totalExecs} trades` : "–",
    currentCycle ? (isPending ? "en attente" : isValidated ? "validé ✓" : `${cyclePct}%`) : "–",
  ];

  // ── fadeIn helper — no transitioning dependency, just key remount
  const fadeIn = (delayMs: number): React.CSSProperties =>
    entered
      ? { animation: `oracleSlideIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms both` }
      : { opacity: 0 };

  return (
    <div
      className="relative flex flex-col h-full overflow-hidden"
      style={{ background: "#07070A", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── CSS Keyframes ── */}
      <style>{`
        @keyframes oracleSlideIn {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ── Grain texture ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.022 }} aria-hidden>
        <filter id="oracle-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#oracle-grain)" />
      </svg>

      {/* ── Dual radial glow ── */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 z-0"
        style={{ background: `radial-gradient(ellipse 60% 65% at 78% 42%, ${meta.glow}, transparent 72%)` }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse 45% 40% at 8% 88%, rgba(255,255,255,0.010), transparent 70%)" }}
      />

      {/* ── Decorative bg number — behind the right screen ── */}
      <div
        className="absolute select-none pointer-events-none transition-all duration-700 z-0"
        style={{
          right: "4%",
          top: "50%",
          transform: "translateY(-52%)",
          fontSize: "clamp(14rem, 38vw, 46rem)",
          color: meta.accent,
          opacity: 0.055,
          letterSpacing: "-0.06em",
          lineHeight: 0.85,
          fontWeight: 900,
          fontFamily: "'Inter', system-ui, sans-serif",
          userSelect: "none",
        }}
      >
        {meta.index}
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex min-h-0 relative z-10">

        {/* ── Left column — ancré en haut, éditorial ── */}
        <div
          className="shrink-0 flex flex-col justify-start"
          style={{
            width: "42%",
            paddingLeft: "clamp(2.5rem, 5vw, 5rem)",
            paddingRight: "2rem",
            paddingTop: "clamp(5rem, 13vh, 8rem)",
            paddingBottom: "clamp(2rem, 5vh, 3rem)",
          }}
        >

          {/* ── Greeting — discret, en haut ── */}
          {firstName && (
            <div style={{ marginBottom: "18px", opacity: 1, transition: "opacity 0.6s ease" }}>
              <span style={{
                fontSize: "12px",
                fontWeight: 400,
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: "0.02em",
                color: "rgba(255,255,255,0.28)",
              }}>
                {(() => { const h = new Date().getHours(); return h < 12 ? "Bonjour" : h < 19 ? "Bon après-midi" : "Bonsoir"; })()}, {firstName}
              </span>
            </div>
          )}

          {/* ── Slide content ── */}
          <div key={`content-${slide}`}>

            {/* Étape — label uppercase au-dessus du heading */}
            <div style={{ ...fadeIn(0), marginBottom: "8px" }}>
              <span style={{
                fontSize: "11px",
                fontWeight: 600,
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: meta.accent,
                opacity: 0.9,
              }}>
                Étape {String(slide + 1).padStart(2, "0")} — {meta.label}
              </span>
            </div>

            {/* Heading — héro absolu */}
            <h2 style={{
              ...fadeIn(20),
              fontSize: "clamp(3rem, 6.2vw, 5rem)",
              fontWeight: 900,
              letterSpacing: "-0.045em",
              lineHeight: "0.90",
              backgroundImage: "linear-gradient(170deg, #ffffff 30%, rgba(255,255,255,0.28) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: "'Inter', system-ui, sans-serif",
              marginBottom: "28px",
              display: "block",
            }}>
              {meta.heading}
            </h2>

            {/* Metric — si pertinente */}
            {bigMetric !== "—" && bigMetric !== "0" && bigMetric !== "0%" && (
              <div style={{ ...fadeIn(70), display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "clamp(1.4rem, 2.8vw, 1.9rem)", fontWeight: 800, fontFamily: "'Inter', system-ui, sans-serif", color: meta.accent, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {bigMetric}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 400, fontFamily: "'Inter', system-ui, sans-serif", color: "rgba(255,255,255,0.30)" }}>
                  {metricLabel}
                </span>
              </div>
            )}

            {/* Message */}
            <p style={{
              ...fadeIn(100),
              fontSize: "14px",
              lineHeight: "1.65",
              color: "rgba(255,255,255,0.42)",
              maxWidth: "36ch",
              marginBottom: "32px",
            }}>
              {contextMsg}
            </p>

            {/* CTA */}
            <div style={fadeIn(180)}>
              {slide === 0 && (
                <ActionButton
                  onClick={onNavigateToVideos}
                  bg={meta.ctaBg} shadow={meta.ctaShadow}
                  icon={<Play className="w-4 h-4" />}
                  label={viewedCount === 0 ? "Regarder les vidéos" : viewedCount < totalVideos ? "Continuer les vidéos" : "Revoir les vidéos"}
                />
              )}
              {slide === 1 && (
                <ActionButton
                  onClick={onNavigateToRecolte}
                  bg={meta.ctaBg} shadow={meta.ctaShadow}
                  icon={<ExternalLink className="w-4 h-4" />}
                  label={
                    totalExecs === 0
                      ? `Saisir mes trades${currentCycle ? (currentCycle.cycle_number === 0 ? " — Ébauche" : ` — ${currentCycle.name}`) : ""}`
                      : `Reprendre la récolte${currentCycle ? (currentCycle.cycle_number === 0 ? " — Ébauche" : ` — ${currentCycle.name}`) : ""}`
                  }
                />
              )}
              {slide === 2 && isComplete && !isPending && !isValidated && (
                <ActionButton
                  onClick={handleRequestVerification}
                  bg={meta.ctaBg} shadow={meta.ctaShadow}
                  icon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  label={submitting ? "Envoi..." : "Soumettre mon cycle"}
                />
              )}
              {slide === 2 && !isComplete && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "8px",
                    padding: "11px 18px", borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    fontSize: "13px", fontWeight: 500,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: "rgba(255,255,255,0.30)",
                  }}>
                    <Lock className="w-3.5 h-3.5" style={{ opacity: 0.5 }} />
                    {currentCycle ? `${currentCycle.userProgress}/${currentCycle.total_trades} trades requis` : "Cycle incomplet"}
                  </div>
                </div>
              )}
              {slide === 2 && isPending && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "11px 18px", borderRadius: "12px",
                  border: `1px solid ${meta.accent}30`,
                  background: `${meta.accent}0a`,
                  fontSize: "13px", fontWeight: 500,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  color: meta.accent,
                }}>
                  <Clock className="w-3.5 h-3.5" />
                  En attente de validation
                </div>
              )}
              {slide === 2 && isValidated && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "11px 18px", borderRadius: "12px",
                  border: "1px solid rgba(52,211,153,0.25)",
                  background: "rgba(52,211,153,0.06)",
                  fontSize: "13px", fontWeight: 600,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  color: "#34d399",
                }}>
                  <Check className="w-3.5 h-3.5" />
                  Cycle validé
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Right panel : floating screen in 3D space ── */}
        <div
          className="flex-1 relative flex items-center justify-center"
          style={{ padding: "28px 32px 28px 24px" }}
          onMouseEnter={() => setHoverPreview(true)}
          onMouseLeave={() => setHoverPreview(false)}
        >
          {/* Ambient neon light blob behind the screen */}
          <div
            className="absolute pointer-events-none transition-all duration-1000"
            style={{
              inset: 0,
              background: `radial-gradient(ellipse 75% 65% at 55% 50%, ${meta.glow} 0%, transparent 68%)`,
            }}
          />
          {/* Secondary bottom light leak */}
          <div
            className="absolute pointer-events-none transition-all duration-1000"
            style={{
              bottom: "0",
              left: "10%",
              right: "10%",
              height: "40%",
              background: `radial-gradient(ellipse 80% 100% at 50% 100%, ${meta.accent}10 0%, transparent 70%)`,
            }}
          />

          {/* The screen — 16:9, floating, 3D-tilted, neon-glowing */}
          <div
            className="relative rounded-xl overflow-hidden transition-all duration-500 ease-out"
            style={{
              aspectRatio: "16 / 9",
              width: "100%",
              maxHeight: "100%",
              transform: hoverPreview
                ? "perspective(1400px) rotateY(0deg) rotateX(0deg) scale(1.01)"
                : "perspective(1400px) rotateY(-5deg) rotateX(2deg) scale(0.98)",
              boxShadow: [
                `0 0 0 1px ${meta.accent}28`,
                `0 0 0 1.5px rgba(255,255,255,0.04)`,
                `0 0 30px -4px ${meta.accent}44`,
                `0 0 80px -10px ${meta.accent}28`,
                `0 0 160px -20px ${meta.accent}14`,
                `0 40px 120px -30px rgba(0,0,0,0.9)`,
                `inset 0 0 0 1px rgba(255,255,255,0.04)`,
              ].join(", "),
            }}
          >
            {/* Top edge glow bar — neon line */}
            <div
              className="absolute top-0 inset-x-0 z-20 pointer-events-none"
              style={{
                height: "1px",
                background: `linear-gradient(to right, transparent 5%, ${meta.accent}cc 40%, ${meta.accent}ff 50%, ${meta.accent}cc 60%, transparent 95%)`,
              }}
            />
            {/* Left edge subtle glow */}
            <div
              className="absolute left-0 inset-y-0 z-20 pointer-events-none"
              style={{
                width: "1px",
                background: `linear-gradient(to bottom, transparent 5%, ${meta.accent}44 50%, transparent 95%)`,
              }}
            />
            {/* Corner flares */}
            <div className="absolute top-0 left-0 w-12 h-12 z-20 pointer-events-none" style={{
              background: `radial-gradient(circle at 0% 0%, ${meta.accent}30, transparent 70%)`,
            }} />
            <div className="absolute top-0 right-0 w-12 h-12 z-20 pointer-events-none" style={{
              background: `radial-gradient(circle at 100% 0%, ${meta.accent}18, transparent 70%)`,
            }} />

            {/* Scene fills absolutely */}
            <div className="absolute inset-0">
              {slide === 0 && (
                <Slide0Scene
                  firstVideo={firstVideo}
                  accent={meta.accent}
                  glow={meta.glow}
                />
              )}
              {slide === 1 && (
                <Slide1Scene
                  screenshotUrl={screenshotUrl}
                  lastExec={lastExec}
                  totalExecs={totalExecs}
                  accent={meta.accent}
                  glow={meta.glow}
                />
              )}
              {slide === 2 && (
                <Slide2Scene
                  allCycles={allCycles}
                  currentCycle={currentCycle}
                  accent={meta.accent}
                  glow={meta.glow}
                  isValidated={isValidated}
                  isRejected={isRejected}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <div
        className="relative z-10 shrink-0 px-8 md:px-12 lg:px-16 pb-6 pt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex gap-6">
          {SLIDES.map((s, i) => {
            const isActive = i === slide;
            const isDone = i < slide;
            return (
              <button key={i} onClick={() => goTo(i)} className="flex-1 text-left group">
                {/* Label row with dot */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: isActive ? s.accent : isDone ? `${s.accent}60` : "rgba(255,255,255,0.12)",
                      boxShadow: isActive ? `0 0 6px 1px ${s.accent}88` : "none",
                      transition: "all 0.4s ease",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.22)",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {/* Progress bar — 2px, gradient, glow on active */}
                <div
                  style={{
                    height: "2px",
                    borderRadius: "9999px",
                    background: "rgba(255,255,255,0.07)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: "9999px",
                      width: isDone ? "100%" : isActive ? `${progress}%` : "0%",
                      background: `linear-gradient(to right, ${s.accent}bb, ${s.accent})`,
                      boxShadow: isActive ? `0 0 8px 0 ${s.accent}99` : "none",
                      transition: isActive ? "none" : "width 0.4s ease",
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL SCENES
// ─────────────────────────────────────────────────────────────────────────────

// Slide 0: Video iframe fills the entire panel
const Slide0Scene = ({
  firstVideo,
  accent,
  glow,
}: {
  firstVideo: VideoInfo | null;
  accent: string;
  glow: string;
}) => {
  if (firstVideo) {
    return (
      <iframe
        src={firstVideo.embed_url}
        className="w-full h-full bg-black"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        title={firstVideo.title}
        style={{ border: "none" }}
      />
    );
  }
  // Atmospheric dark scene when no video
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "50%",
          border: `1px solid ${accent}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${accent}0a`,
          boxShadow: `0 0 40px 0px ${glow}`,
        }}
      >
        <Play style={{ width: "28px", height: "28px", color: accent, opacity: 0.6 }} />
      </div>
      <span
        style={{
          fontSize: "11px",
          fontFamily: "monospace",
          color: "rgba(255,255,255,0.18)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Vidéo 1 — Setup Oracle
      </span>
    </div>
  );
};

// Slide 1: Screenshot fills panel, or terminal scene with last trade
const Slide1Scene = ({
  screenshotUrl,
  lastExec,
  totalExecs,
  accent,
  glow,
}: {
  screenshotUrl: string | null;
  lastExec: ExecInfo | null;
  totalExecs: number;
  accent: string;
  glow: string;
}) => {
  if (screenshotUrl) {
    return (
      <img
        src={screenshotUrl}
        alt="Dernier trade"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }

  // Terminal scene — turns empty state into a feature
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        gap: "8px",
      }}
    >
      {lastExec ? (
        <>
          <span
            style={{
              fontSize: "clamp(5rem, 12vw, 9rem)",
              fontWeight: 900,
              color: lastExec.direction === "Long" ? "#34d399" : "#f87171",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {lastExec.direction.toUpperCase()}
          </span>
          {lastExec.rr !== null && (
            <span
              style={{
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                fontWeight: 700,
                color: (lastExec.rr || 0) >= 0 ? "#34d399" : "#f87171",
                letterSpacing: "-0.03em",
              }}
            >
              {(lastExec.rr || 0) >= 0 ? "+" : ""}{lastExec.rr?.toFixed(1)} R
            </span>
          )}
          <span
            style={{
              fontSize: "12px",
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.25)",
              marginTop: "8px",
            }}
          >
            {new Date(lastExec.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
        </>
      ) : (
        <span
          style={{
            fontSize: "clamp(6rem, 14vw, 11rem)",
            fontWeight: 900,
            color: accent,
            opacity: 0.15,
            letterSpacing: "-0.05em",
            lineHeight: 1,
          }}
        >
          {totalExecs > 0 ? totalExecs : "—"}
        </span>
      )}
    </div>
  );
};

// Slide 2: CycleViz redesigned to fill full height with taller bars and active glow
const Slide2Scene = ({
  allCycles,
  currentCycle,
  accent,
  glow,
  isValidated,
  isRejected,
}: {
  allCycles: CycleInfo[];
  currentCycle: CycleInfo | null;
  accent: string;
  glow: string;
  isValidated: boolean;
  isRejected: boolean;
}) => {
  if (!allCycles.length) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.35)",
          gap: "16px",
        }}
      >
        <ShieldCheck style={{ width: "48px", height: "48px", color: "rgba(255,255,255,0.08)" }} />
        <span style={{ fontSize: "11px", fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 400, color: "rgba(255,255,255,0.22)" }}>
          Aucun cycle disponible
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "28px",
        padding: "40px 36px",
        background: "rgba(0,0,0,0.35)",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 500,
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "0.01em",
        }}
      >
        Progression des cycles
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {allCycles.slice(0, 4).map((c) => {
          const pct = Math.min((c.userProgress / c.total_trades) * 100, 100);
          const isActive = c.id === currentCycle?.id;
          const isVal = c.userStatus === "validated";
          const isRej = c.userStatus === "rejected";
          return (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontWeight: isActive ? 600 : 400,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: isActive ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.22)",
                  }}
                >
                  {c.name}
                  {isActive && (
                    <span
                      style={{
                        fontSize: "9px",
                        padding: "2px 7px",
                        borderRadius: "9999px",
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontWeight: 600,
                        background: `${accent}20`,
                        color: accent,
                      }}
                    >
                      en cours
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontWeight: 500,
                    color: isVal ? "#34d399" : isActive ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.15)",
                  }}
                >
                  {isVal ? "validé" : `${c.userProgress}/${c.total_trades}`}
                </span>
              </div>
              {/* Bar: h-1.5 (6px), active bar has glow */}
              <div
                style={{
                  height: "6px",
                  borderRadius: "9999px",
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: "9999px",
                    width: `${pct}%`,
                    background: isVal ? "#10b981" : isRej ? "#ef4444" : isActive ? accent : "rgba(255,255,255,0.12)",
                    boxShadow: isActive && pct > 5 ? `0 0 12px 2px ${glow}` : undefined,
                    transition: "width 0.7s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const ActionButton = ({ onClick, bg, shadow, icon, label, disabled = false }: {
  onClick: () => void; bg: string; shadow: string; icon: React.ReactNode;
  label: string; disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      padding: "13px 22px",
      borderRadius: "14px",
      fontSize: "14px",
      fontWeight: 700,
      fontFamily: "'Inter', system-ui, sans-serif",
      letterSpacing: "-0.01em",
      color: "#ffffff",
      background: disabled
        ? "rgba(255,255,255,0.05)"
        : `linear-gradient(135deg, ${bg} 0%, ${bg}cc 100%)`,
      border: disabled
        ? "1px solid rgba(255,255,255,0.08)"
        : `1px solid ${shadow.replace("0.50", "0.55")}`,
      boxShadow: disabled
        ? "none"
        : [
            `0 0 0 1px rgba(255,255,255,0.06)`,
            `0 8px 32px -6px ${shadow}`,
            `0 2px 0 0 rgba(255,255,255,0.10) inset`,
          ].join(", "),
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.35 : 1,
      transition: "all 0.18s ease",
    }}
    onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1.02)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = [`0 0 0 1px rgba(255,255,255,0.09)`, `0 12px 40px -6px ${shadow}`, `0 2px 0 0 rgba(255,255,255,0.12) inset`].join(", "); } }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = disabled ? "none" : [`0 0 0 1px rgba(255,255,255,0.06)`, `0 8px 32px -6px ${shadow}`, `0 2px 0 0 rgba(255,255,255,0.10) inset`].join(", "); }}
    onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px) scale(0.98)"; }}
    onMouseUp={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px) scale(1.02)"; }}
  >
    <span style={{ opacity: 0.9, display: "flex", alignItems: "center" }}>{icon}</span>
    {label}
  </button>
);
