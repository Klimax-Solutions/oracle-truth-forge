// ============================================
// New Session Dialog — popup pour créer une trading session
// Types : backtesting (bleu) | live_trading (orange)
// ============================================

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SessionType = "backtesting" | "live_trading";

interface NewSessionDialogProps {
  open: boolean;
  type: SessionType;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

export default function NewSessionDialog({ open, type, onClose, onCreated }: NewSessionDialogProps) {
  const [name, setName] = useState("");
  const [asset, setAsset] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isBacktesting = type === "backtesting";
  const accent = isBacktesting ? "#10B981" : "#F97316"; // emerald (thème) / orange
  const label = isBacktesting ? "BACKTESTING" : "LIVE TRADING";
  const ctaText = isBacktesting ? "Créer la session de backtesting" : "Créer la session de live trading";

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Le nom de la session est requis");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error: insertError } = await supabase
        .from("trading_sessions")
        .insert({
          user_id: user.id,
          name: trimmedName,
          asset: asset.trim() || null,
          type,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!data?.id) throw new Error("Session créée mais id non retourné");

      // Reset + notify parent
      setName("");
      setAsset("");
      onCreated(data.id);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setName("");
    setAsset("");
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-[#0F1116] border border-white/[0.08] rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Créer une nouvelle session</h2>
            <p
              className="text-xs font-semibold tracking-[0.15em] uppercase mt-1"
              style={{ color: accent }}
            >
              {label}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Nom de la session <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Setup NAS100 Breakout"
              className="w-full h-11 px-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-white/[0.2] transition-colors"
              autoFocus
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleSubmit();
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Actif <span className="text-white/40 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="Ex : NAS100, EUR/USD…"
              className="w-full h-11 px-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-white/[0.2] transition-colors"
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleSubmit();
              }}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className={cn(
              "w-full h-12 rounded-lg text-white font-semibold text-sm transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "inline-flex items-center justify-center gap-2"
            )}
            style={{
              backgroundColor: accent,
            }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : ctaText}
          </button>

          <p className="text-[10px] text-white/25 text-center">
            ↳ {isBacktesting
              ? 'Si Live Trading : bouton orange "Créer la session de live trading"'
              : 'Si Backtesting : bouton vert "Créer la session de backtesting"'}
          </p>
        </div>
      </div>
    </div>
  );
}
