import { useState, useEffect } from "react";
import { ExternalLink, Check, Lock, Unlock, Play, ChevronRight } from "lucide-react";
import { StepBadge } from "./StepBadge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { useEarlyAccessSettings } from "@/hooks/useEarlyAccessSettings";
import { BonusVideoViewer } from "./BonusVideoViewer";

// ── Font (même pattern qu'OracleHomePage) ────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("inter-font-oracle")) {
  const link = document.createElement("link");
  link.id = "inter-font-oracle";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap";
  document.head.appendChild(link);
}

// ── Palette — cohérente avec OracleHomePage ──────────────────────────────────
// Oracle  → bleu (slide 1 "Apprendre")
// Mercure → ambre (slide 3 "Vérifier") — ancrage visuel fort, prestige
const PALETTE = {
  oracle: {
    accent: "#4F78CC",
    glow:   "rgba(79,120,204,0.18)",
    border: "rgba(79,120,204,0.22)",
    badgeBg:"rgba(79,120,204,0.10)",
    badgeText: "#8EB4F0",
    ctaBg:  "#3A64B8",
  },
  mercure: {
    accent: "#C8882A",
    glow:   "rgba(200,136,42,0.15)",
    border: "rgba(200,136,42,0.20)",
    badgeBg:"rgba(200,136,42,0.09)",
    badgeText: "#E8B96A",
    ctaBg:  "#A8701C",
  },
};

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  embed_url: string;
  open_url: string | null;
  sort_order: number;
  accessible_roles: string[];
}

interface VideoSetupProps {
  overrideIsEarlyAccess?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export const VideoSetup = ({ overrideIsEarlyAccess }: VideoSetupProps = {}) => {
  const [videos, setVideos]               = useState<VideoData[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [viewedIds, setViewedIds]         = useState<Set<string>>(new Set());
  const [loading, setLoading]             = useState(true);
  const [userRoles, setUserRoles]         = useState<string[]>([]);
  const [section, setSection] = useState<"oracle" | "mercure">("oracle");
  const [entered, setEntered] = useState(false);
  const { isEarlyAccess: isEarlyAccessFromDB, isExpired: isEaExpiredFromDB } = useEarlyAccess();
  const isEarlyAccess = overrideIsEarlyAccess !== undefined ? overrideIsEarlyAccess : isEarlyAccessFromDB;
  const isEaExpired   = overrideIsEarlyAccess !== undefined ? false : isEaExpiredFromDB;
  const { settings: eaSettings } = useEarlyAccessSettings();

  // Entrance animation — déclenché après le premier paint (même logique qu'OracleHomePage)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [videosRes, viewsRes, rolesRes] = await Promise.all([
          supabase.from("videos").select("*").order("sort_order", { ascending: true }),
          supabase.from("user_video_views").select("video_id").eq("user_id", user.id),
          supabase.from("user_roles").select("role").eq("user_id", user.id),
        ]);
        const userRolesList: string[] = rolesRes.data?.map((r: any) => r.role) ?? [];
        if (rolesRes.data) setUserRoles(userRolesList);
        if (viewsRes.data) setViewedIds(new Set(viewsRes.data.map((v: any) => v.video_id)));
        if (videosRes.data) {
          // Filtrer selon accessible_roles configuré dans la médiathèque
          // (tableau vide = accessible à tous)
          const filtered = videosRes.data.filter((v: any) => {
            const roles: string[] = v.accessible_roles ?? [];
            if (roles.length === 0) return true;
            return userRolesList.some(r => roles.includes(r));
          });
          setVideos(filtered);
          setSelectedVideo(filtered[0] ?? null);
        }
      } catch (err) {
        console.warn("[VideoSetup]", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const markAsViewed = async (videoId: string) => {
    if (viewedIds.has(videoId)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_video_views").insert({ user_id: user.id, video_id: videoId });
    setViewedIds(prev => new Set([...prev, videoId]));
  };

  const toggleViewed = async (videoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (viewedIds.has(videoId)) {
      await supabase.from("user_video_views").delete().eq("user_id", user.id).eq("video_id", videoId);
      setViewedIds(prev => { const n = new Set(prev); n.delete(videoId); return n; });
    } else {
      await supabase.from("user_video_views").insert({ user_id: user.id, video_id: videoId });
      setViewedIds(prev => new Set([...prev, videoId]));
    }
  };

  const handleSelect = (video: VideoData) => {
    setSelectedVideo(video);
    markAsViewed(video.id);
  };

  const pal    = PALETTE[section];
  const viewedCount = viewedIds.size;
  const totalCount  = videos.length;

  // Helper d'animation — même système qu'OracleHomePage
  const fadeIn = (delayMs: number) => ({
    style: entered
      ? { animation: `vsSlideIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms both` }
      : { opacity: 0 },
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "#07070A" }}>
        <div className="w-5 h-5 rounded-full border border-white/20 border-t-white/60 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="relative h-full flex flex-col overflow-hidden"
      style={{ background: "#07070A", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes vsSlideIn {
          from { opacity: 0; transform: translateX(22px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes vsSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vsPopIn {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes vsBarFill {
          from { width: 0%; }
        }
      `}</style>

      {/* ── Grain — texture subtile (identique OracleHomePage, opacity 2.2%) ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        style={{ opacity: 0.022 }}
        aria-hidden
      >
        <filter id="vs-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#vs-grain)" />
      </svg>

      {/* ── Glow — radial, change avec la section (transition 700ms) ── */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 z-0"
        style={{ background: `radial-gradient(ellipse 55% 60% at 80% 38%, ${pal.glow}, transparent 70%)` }}
      />
      {/* Lueur froide bas-gauche (identique OracleHomePage) */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse 40% 35% at 5% 90%, rgba(255,255,255,0.008), transparent 70%)" }}
      />

      {/* ── Numéro décoratif géant (identique OracleHomePage) ── */}
      {selectedVideo && (
        <div
          className="absolute right-0 top-1/2 -translate-y-[55%] select-none pointer-events-none transition-all duration-700 z-0"
          style={{
            fontSize: "clamp(10rem, 28vw, 30rem)",
            color: pal.accent,
            opacity: 0.065,
            letterSpacing: "-0.06em",
            lineHeight: 1,
            fontWeight: 900,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {String(videos.findIndex(v => v.id === selectedVideo.id) + 1).padStart(2, "0")}
        </div>
      )}

      {/* ── Navigation sections — style progress tracks (comme le bas d'OracleHomePage) ── */}
      <div className="relative z-10 shrink-0 px-3 md:px-10 pt-4 pb-2">
        <div className="flex gap-3 md:gap-6 max-w-5xl">
          {(["oracle", "mercure"] as const).map((s) => {
            const p = PALETTE[s];
            const isActive = section === s;
            return (
              <button
                key={s}
                onClick={() => setSection(s)}
                className="group text-left py-1"
              >
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span
                    className="text-[10px] font-mono uppercase tracking-[0.16em] transition-colors duration-300"
                    style={{ color: isActive ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.18)" }}
                  >
                    {s === "oracle" ? "Fondations Oracle" : "Sessions Mercure"}
                  </span>
                  {/* Pulse dot — vivant, identique OracleHomePage badge */}
                  {isActive && (
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                        style={{ background: p.accent }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-1.5 w-1.5"
                        style={{ background: p.accent }}
                      />
                    </span>
                  )}
                </div>
                <div className="h-0.5 w-28 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: isActive ? "100%" : "0%",
                      background: p.accent,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contenu principal ── */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {section === "oracle" ? (
          <OraclePlayer
            videos={videos}
            selectedVideo={selectedVideo}
            viewedIds={viewedIds}
            viewedCount={viewedCount}
            totalCount={totalCount}
            isEarlyAccess={isEarlyAccess}
            isEaExpired={isEaExpired}
            eaSettings={eaSettings}
            palette={pal}
            entered={entered}
            fadeIn={fadeIn}
            onSelect={handleSelect}
            onToggleViewed={toggleViewed}
          />
        ) : (
          <MercureSection userRoles={userRoles} isEaExpired={isEaExpired} palette={pal} />
        )}
      </div>

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ORACLE PLAYER — le cœur du redesign
// ─────────────────────────────────────────────────────────────────────────────

interface OraclePlayerProps {
  videos: VideoData[];
  selectedVideo: VideoData | null;
  viewedIds: Set<string>;
  viewedCount: number;
  totalCount: number;
  isEarlyAccess: boolean;
  isEaExpired: boolean;
  eaSettings: { button_key: string; button_url: string }[];
  palette: typeof PALETTE.oracle;
  entered: boolean;
  fadeIn: (delay: number) => { style: React.CSSProperties };
  onSelect: (v: VideoData) => void;
  onToggleViewed: (id: string) => void;
}

const OraclePlayer = ({
  videos, selectedVideo, viewedIds, viewedCount, totalCount,
  isEarlyAccess, isEaExpired, eaSettings, palette, entered, fadeIn,
  onSelect, onToggleViewed,
}: OraclePlayerProps) => {
  const unlockUrl  = eaSettings.find(s => s.button_key === "acceder_a_oracle")?.button_url;
  const idx        = selectedVideo ? videos.findIndex(v => v.id === selectedVideo.id) : -1;
  // Les vidéos visibles ont déjà été filtrées par accessible_roles.
  // Le seul cas de lock restant : EA avec timer expiré.
  const isLocked   = (_v: VideoData) => isEarlyAccess && isEaExpired;
  const pct        = totalCount > 0 ? Math.round((viewedCount / totalCount) * 100) : 0;

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">

      {/* ── Colonne principale : header + player ── */}
      <div className="flex-1 flex flex-col overflow-auto" style={{ scrollbarWidth: "none" }}>
        <div className="px-3 md:px-10 pt-4 md:pt-5 pb-4 md:pb-6 flex flex-col gap-4">

          {/*
           * Header info — animé à chaque changement de vidéo via key remount.
           * Même technique que le wrapper de texte dans OracleHomePage.
           */}
          <div
            key={selectedVideo?.id ?? "none"}
            className="space-y-3"
          >
            {/* Badge étape — StepBadge partagé (cohérent RecolteDonneesPage) */}
            <div {...fadeIn(0)}>
              <StepBadge
                index="01"
                label="Fondations"
                accent={palette.accent}
                sub={idx >= 0 ? `· Chapitre ${String(idx + 1).padStart(2, "0")}` : undefined}
              />
            </div>

            {/* Grand titre — Inter 900, gradient blanc, identique OracleHomePage */}
            {selectedVideo && (
              <h2
                {...fadeIn(80)}
                style={{
                  ...fadeIn(80).style,
                  fontSize: "clamp(1.8rem, 3.5vw, 3.2rem)",
                  fontWeight: 900,
                  letterSpacing: "-0.032em",
                  lineHeight: "0.95",
                  backgroundImage: "linear-gradient(180deg, #ffffff 20%, rgba(255,255,255,0.42) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {selectedVideo.title}
              </h2>
            )}

            {/* Séparateur coloré (identique OracleHomePage) */}
            <div
              {...fadeIn(140)}
              className="h-px w-10 rounded-full"
              style={{ ...fadeIn(140).style, background: `linear-gradient(to right, ${palette.accent}70, transparent)` }}
            />

            {/* Description */}
            {selectedVideo?.description && (
              <p
                {...fadeIn(180)}
                className="text-sm leading-relaxed"
                style={{ ...fadeIn(180).style, color: "rgba(255,255,255,0.34)", maxWidth: "52ch" }}
              >
                {selectedVideo.description}
              </p>
            )}

            {/* Progress global */}
            <div {...fadeIn(220)} className="flex items-center gap-3">
              <div className="flex gap-[5px]">
                {Array.from({ length: Math.min(totalCount, 8) }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i < viewedCount ? "7px" : "4px",
                      height: i < viewedCount ? "7px" : "4px",
                      background: i < viewedCount ? palette.accent : "rgba(255,255,255,0.08)",
                    }}
                  />
                ))}
              </div>
              <span className="text-[11px] font-mono" style={{ color: viewedCount > 0 ? palette.badgeText : "rgba(255,255,255,0.16)" }}>
                {viewedCount}/{totalCount} chapitres vus · {pct}%
              </span>
            </div>
          </div>

          {/* ── Player ── */}
          <div
            style={{ animation: entered ? "vsSlideUp 0.60s cubic-bezier(0.22,1,0.36,1) 260ms both" : undefined }}
          >
            {selectedVideo ? (
              <div
                className="w-full rounded-2xl overflow-hidden"
                style={{
                  background: "#000",
                  border: `1px solid ${palette.border}`,
                  boxShadow: `0 0 80px -20px ${palette.glow}, 0 32px 80px -24px rgba(0,0,0,0.7)`,
                }}
              >
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  {isLocked(selectedVideo) ? (
                    <LockedOverlay isExpired={isEaExpired} unlockUrl={unlockUrl} palette={palette} />
                  ) : (
                    <iframe
                      key={selectedVideo.id}
                      src={selectedVideo.embed_url}
                      className="absolute inset-0 w-full h-full"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      title={selectedVideo.title}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div
                className="w-full rounded-2xl flex items-center justify-center"
                style={{ paddingBottom: "56.25%", position: "relative", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Play className="w-10 h-10" style={{ color: "rgba(255,255,255,0.08)" }} />
                  <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.16)" }}>Aucune vidéo disponible</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Actions sous le player ── */}
          {selectedVideo && !isLocked(selectedVideo) && (
            <div
              className="flex items-center gap-4"
              style={{ animation: entered ? "vsSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) 380ms both" : undefined }}
            >
              <button
                onClick={() => onToggleViewed(selectedVideo.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: viewedIds.has(selectedVideo.id) ? `${palette.accent}22` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${viewedIds.has(selectedVideo.id) ? palette.border : "rgba(255,255,255,0.08)"}`,
                  color: viewedIds.has(selectedVideo.id) ? palette.badgeText : "rgba(255,255,255,0.30)",
                  boxShadow: viewedIds.has(selectedVideo.id) ? `0 0 16px -4px ${palette.glow}` : "none",
                }}
              >
                <Check className="w-3.5 h-3.5" style={{ opacity: viewedIds.has(selectedVideo.id) ? 1 : 0.35 }} />
                {viewedIds.has(selectedVideo.id) ? "Chapitre terminé" : "Marquer comme terminé"}
              </button>
              {selectedVideo.open_url && (
                <a
                  href={selectedVideo.open_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs transition-colors duration-200 hover:opacity-70"
                  style={{ color: "rgba(255,255,255,0.20)" }}
                >
                  <ExternalLink className="w-3 h-3" />
                  Ouvrir dans un onglet
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar playlist ── */}
      <div
        className="lg:w-72 xl:w-80 shrink-0 flex flex-col"
        style={{ borderLeft: "1px solid rgba(255,255,255,0.048)" }}
      >
        {/* Header sidebar */}
        <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.048)" }}>
          <p className="text-[9px] font-mono uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.18)" }}>
            Programme · {totalCount} chapitres
          </p>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-auto" style={{ scrollbarWidth: "none" }}>
          {videos.map((video, i) => {
            const isActive  = selectedVideo?.id === video.id;
            const isViewed  = viewedIds.has(video.id);
            const locked    = isLocked(video);
            return (
              <button
                key={video.id}
                onClick={() => !locked && onSelect(video)}
                disabled={locked}
                className={cn(
                  "w-full flex items-start gap-3.5 px-5 py-3.5 text-left transition-all duration-150",
                  isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.025]",
                  locked ? "cursor-not-allowed" : "cursor-pointer"
                )}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.038)",
                  borderLeft: isActive
                    ? `2px solid ${palette.accent}`
                    : "2px solid transparent",
                }}
              >
                {/* Indicateur numéro / check / lock */}
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                  style={{
                    background: isViewed
                      ? `${palette.accent}22`
                      : isActive
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(255,255,255,0.03)",
                    border: isActive
                      ? `1px solid ${palette.border}`
                      : isViewed
                      ? `1px solid ${palette.border}`
                      : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: isActive ? `0 0 10px -2px ${palette.glow}` : "none",
                  }}
                >
                  {locked ? (
                    <Lock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.18)" }} />
                  ) : isViewed ? (
                    <Check className="w-3 h-3" style={{ color: palette.badgeText }} />
                  ) : (
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: isActive ? palette.badgeText : "rgba(255,255,255,0.22)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </div>

                {/* Texte */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn("text-sm font-medium leading-snug", locked && "blur-sm select-none")}
                    style={{
                      color: isActive
                        ? "rgba(255,255,255,0.88)"
                        : isViewed
                        ? "rgba(255,255,255,0.36)"
                        : "rgba(255,255,255,0.52)",
                    }}
                  >
                    {video.title}
                  </p>
                  {video.description && (
                    <p
                      className={cn("text-[11px] mt-0.5 line-clamp-1", locked && "blur-sm select-none")}
                      style={{ color: "rgba(255,255,255,0.15)" }}
                    >
                      {video.description}
                    </p>
                  )}
                </div>

                {isActive && !locked && (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: palette.accent, opacity: 0.7 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MERCURE SECTION — wrap BonusVideoViewer avec le même fond dark
// ─────────────────────────────────────────────────────────────────────────────

const MercureSection = ({
  userRoles, isEaExpired, palette,
}: {
  userRoles: string[];
  isEaExpired: boolean;
  palette: typeof PALETTE.mercure;
}) => (
  <div className="h-full flex flex-col overflow-hidden">
    {/* Header Mercure — même style badge/titre qu'Oracle */}
    <div className="px-3 md:px-10 pt-4 md:pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
      <div className="flex items-center gap-3">
        <StepBadge
          index="01"
          label="Fondations"
          accent={palette.accent}
          sub="· Institut Mercure"
        />
      </div>
    </div>
    <div className="flex-1 overflow-hidden">
      <BonusVideoViewer userRoles={userRoles} isEaExpired={isEaExpired} />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// LOCKED OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

const LockedOverlay = ({
  isExpired, unlockUrl, palette,
}: {
  isExpired: boolean;
  unlockUrl?: string;
  palette: typeof PALETTE.oracle;
}) => (
  <div
    className="absolute inset-0 flex flex-col items-center justify-center gap-4"
    style={{ background: "rgba(7,7,10,0.90)", backdropFilter: "blur(16px)" }}
  >
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center"
      style={{ background: palette.badgeBg, border: `1px solid ${palette.border}` }}
    >
      <Lock className="w-5 h-5" style={{ color: palette.badgeText }} />
    </div>
    <div className="text-center space-y-1.5">
      <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.82)" }}>
        {isExpired ? "Accès expiré" : "Réservé aux membres Oracle"}
      </p>
      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)", maxWidth: "30ch", lineHeight: 1.5 }}>
        {isExpired
          ? "Votre période d'essai est terminée."
          : "Ces chapitres se débloquent après l'activation de votre accès complet."}
      </p>
    </div>
    {unlockUrl && (
      <a href={unlockUrl} target="_blank" rel="noopener noreferrer">
        <button
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.03]"
          style={{
            background: palette.ctaBg,
            color: "#fff",
            boxShadow: `0 6px 24px -4px ${palette.glow}`,
          }}
        >
          <Unlock className="w-4 h-4" />
          Activer mon accès
        </button>
      </a>
    )}
  </div>
);
