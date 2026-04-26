// Section "Séquences Email" affichée en tête du panel droit (timeline)
// d'un lead. Lit les events Kit depuis lead_events et résume l'état :
// - séquence active + date de démarrage + badge ⚡ Active
// - ou séquence terminée + date d'arrêt
// Masquée si le lead n'a jamais été inscrit à une séquence Kit.
//
// Pas de bouton start/stop manuel — géré uniquement par les automatisations
// (subscribe-to-kit on form submit, unsubscribe-from-kit on call booked).

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIT_SEQUENCE_NAMES } from "./CRMDashboard";

interface KitSequenceSectionProps {
  requestId: string;
}

interface KitState {
  sequence_id: string | null;
  started_at: string | null;
  stopped_at: string | null;
  failed: boolean;
}

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const KitSequenceSection = ({ requestId }: KitSequenceSectionProps) => {
  const [state, setState] = useState<KitState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setState(null);

    supabase
      .from("lead_events")
      .select("event_type, timestamp, metadata")
      .eq("request_id", requestId)
      .eq("source", "kit")
      .order("timestamp", { ascending: true })
      .then(({ data }) => {
        if (!mounted) return;
        if (!data || data.length === 0) {
          setState(null);
          setLoading(false);
          return;
        }
        const acc: KitState = {
          sequence_id: null,
          started_at: null,
          stopped_at: null,
          failed: false,
        };
        for (const ev of data as any[]) {
          const seqId = (ev.metadata?.sequence_id ?? null) as string | null;
          if (ev.event_type === "kit_sequence_subscribed") {
            acc.sequence_id = seqId ?? acc.sequence_id;
            acc.started_at = ev.timestamp;
            acc.stopped_at = null;
            acc.failed = false;
          } else if (ev.event_type === "kit_subscribe_failed") {
            acc.failed = true;
            acc.sequence_id = seqId ?? acc.sequence_id;
          } else if (
            ev.event_type === "kit_unsubscribed" ||
            ev.event_type === "kit_sequence_unsubscribed"
          ) {
            acc.stopped_at = ev.timestamp;
          }
        }
        setState(acc);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [requestId]);

  // Section masquée si pas d'historique Kit
  if (loading || !state || (!state.started_at && !state.failed)) return null;

  const seqName =
    (state.sequence_id && KIT_SEQUENCE_NAMES[state.sequence_id]) || "Séquence Kit";
  const isActive = !!state.started_at && !state.stopped_at && !state.failed;
  const isStopped = !!state.stopped_at;

  // Couleur d'accent selon la séquence
  const accentClass =
    state.sequence_id === "2624505"
      ? "text-orange-400"
      : state.sequence_id === "2626026"
        ? "text-sky-400"
        : "text-emerald-400";

  return (
    <div className="shrink-0 border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Mail className="w-3 h-3 text-white/30" />
        <span className="text-[10px] font-display uppercase tracking-widest text-white/40">
          Séquence Email
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-sm font-display font-semibold truncate", accentClass)}>
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
            {isStopped && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10">
                <span className="text-[9px] font-display font-semibold text-white/50 uppercase tracking-wider">
                  Terminée
                </span>
              </span>
            )}
            {state.failed && !isActive && (
              <span className="px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/30">
                <span className="text-[9px] font-display font-bold text-red-300 uppercase tracking-wider">
                  Échec
                </span>
              </span>
            )}
          </div>
          <p className="text-[10px] font-mono text-white/40 mt-0.5">
            {state.started_at ? `Démarrée le ${fmtDateTime(state.started_at)}` : "Inscription échouée"}
          </p>
          {isStopped && state.stopped_at && (
            <p className="text-[10px] font-mono text-white/30">
              Arrêtée le {fmtDateTime(state.stopped_at)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitSequenceSection;
