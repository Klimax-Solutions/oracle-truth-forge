// Bloc "Séquences Email" affiché en tête du panel droit (timeline)
// d'un lead. Lit les events Kit depuis lead_events et résume l'état
// par séquence trackée :
// - Carte par séquence : point indicateur (orange pulsant si actif, gris si stoppé)
// - Nom : "Book-a-call" ou "Nurturing"
// - Date : "Démarré le {d MMMM à HH'h'mm}" (locale fr)
// - Badge ⚡ Active si la séquence est encore active
//
// Bloc entier masqué si le lead n'a jamais eu de séquence Kit.
// Lecture seule — pas de bouton start/stop manuel (géré par les automatisations
// subscribe-to-kit on form submit + unsubscribe-from-kit on call booked).

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { KIT_SEQUENCE_NAMES } from "./CRMDashboard";

interface KitSequenceSectionProps {
  requestId: string;
}

interface KitSequenceState {
  sequence_id: string;
  started_at: string | null;
  stopped_at: string | null;
  failed: boolean;
}

const fmtDateFr = (iso: string | null) => {
  if (!iso) return "—";
  return format(new Date(iso), "d MMMM 'à' HH'h'mm", { locale: fr });
};

// Couleurs par séquence
const seqStyles = (seqId: string, active: boolean) => {
  if (seqId === "2624505") {
    return active
      ? { dot: "bg-orange-400", text: "text-orange-300", ring: "ring-orange-500/30", glow: "shadow-[0_0_10px_rgba(251,146,60,0.5)]" }
      : { dot: "bg-orange-500/30", text: "text-orange-400/60", ring: "ring-orange-500/15", glow: "" };
  }
  if (seqId === "2626026") {
    return active
      ? { dot: "bg-sky-400", text: "text-sky-300", ring: "ring-sky-500/30", glow: "shadow-[0_0_10px_rgba(56,189,248,0.5)]" }
      : { dot: "bg-sky-500/30", text: "text-sky-400/60", ring: "ring-sky-500/15", glow: "" };
  }
  return active
    ? { dot: "bg-emerald-400", text: "text-emerald-300", ring: "ring-emerald-500/30", glow: "shadow-[0_0_10px_rgba(52,211,153,0.5)]" }
    : { dot: "bg-white/30", text: "text-white/50", ring: "ring-white/10", glow: "" };
};

export const KitSequenceSection = ({ requestId }: KitSequenceSectionProps) => {
  const [sequences, setSequences] = useState<KitSequenceState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setSequences([]);

    supabase
      .from("lead_events")
      .select("event_type, timestamp, metadata")
      .eq("request_id", requestId)
      .eq("source", "kit")
      .order("timestamp", { ascending: true })
      .then(({ data }) => {
        if (!mounted) return;
        if (!data || data.length === 0) {
          setSequences([]);
          setLoading(false);
          return;
        }

        // Aggrège par sequence_id (clé) pour gérer plusieurs séquences trackées
        const map: Record<string, KitSequenceState> = {};
        for (const ev of data as any[]) {
          const seqId = (ev.metadata?.sequence_id ?? null) as string | null;
          if (!seqId) continue;
          if (!map[seqId]) {
            map[seqId] = { sequence_id: seqId, started_at: null, stopped_at: null, failed: false };
          }
          const cur = map[seqId];
          if (ev.event_type === "kit_sequence_subscribed") {
            cur.started_at = ev.timestamp;
            cur.stopped_at = null;
            cur.failed = false;
          } else if (ev.event_type === "kit_subscribe_failed") {
            cur.failed = true;
          } else if (
            ev.event_type === "kit_unsubscribed" ||
            ev.event_type === "kit_sequence_unsubscribed"
          ) {
            cur.stopped_at = ev.timestamp;
          }
        }

        // Garde seulement les séquences avec au moins un event signifiant
        const list = Object.values(map).filter(s => s.started_at || s.failed);
        // Trie : actives d'abord, puis par date démarrage desc
        list.sort((a, b) => {
          const aActive = !!a.started_at && !a.stopped_at && !a.failed ? 1 : 0;
          const bActive = !!b.started_at && !b.stopped_at && !b.failed ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;
          return (b.started_at ?? "").localeCompare(a.started_at ?? "");
        });

        setSequences(list);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [requestId]);

  // Bloc entier masqué si pas de séquence trackée
  if (loading || sequences.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-white/[0.08] bg-white/[0.02] px-4 py-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Mail className="w-3 h-3 text-orange-400" />
        <span className="text-[10px] font-display uppercase tracking-widest text-white/50">
          Séquences Email
        </span>
      </div>

      <div className="space-y-1.5">
        {sequences.map(seq => {
          const seqName = KIT_SEQUENCE_NAMES[seq.sequence_id] || "Séquence Kit";
          const isActive = !!seq.started_at && !seq.stopped_at && !seq.failed;
          const styles = seqStyles(seq.sequence_id, isActive);

          return (
            <div
              key={seq.sequence_id}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.02] ring-1 transition-all",
                styles.ring
              )}
            >
              {/* Point indicateur */}
              <span className="relative flex shrink-0">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    styles.dot,
                    isActive && styles.glow,
                    isActive && "animate-pulse"
                  )}
                />
              </span>

              {/* Nom + date */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-sm font-display font-semibold truncate", styles.text)}>
                    {seqName}
                  </span>
                  {isActive && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                      <Zap className="w-2.5 h-2.5 text-emerald-300" />
                      <span className="text-[9px] font-display font-bold text-emerald-300 uppercase tracking-wider">
                        Active
                      </span>
                    </span>
                  )}
                  {seq.failed && !isActive && (
                    <span className="px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/30">
                      <span className="text-[9px] font-display font-bold text-red-300 uppercase tracking-wider">
                        Échec
                      </span>
                    </span>
                  )}
                  {!isActive && !seq.failed && seq.stopped_at && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10">
                      <span className="text-[9px] font-display font-semibold text-white/50 uppercase tracking-wider">
                        Terminée
                      </span>
                    </span>
                  )}
                </div>
                {seq.started_at && (
                  <p className="text-[10px] font-mono text-white/40 mt-0.5 truncate">
                    Démarré le {fmtDateFr(seq.started_at)}
                  </p>
                )}
                {!isActive && seq.stopped_at && (
                  <p className="text-[10px] font-mono text-white/30 truncate">
                    Arrêtée le {fmtDateFr(seq.stopped_at)}
                  </p>
                )}
                {seq.failed && !seq.started_at && (
                  <p className="text-[10px] font-mono text-red-400/70 mt-0.5">
                    Inscription échouée
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KitSequenceSection;
