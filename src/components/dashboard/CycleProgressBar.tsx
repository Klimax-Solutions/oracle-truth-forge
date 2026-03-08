import { cn } from "@/lib/utils";
import { Send, CheckCircle, Clock, AlertCircle, Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CycleProgressBarProps {
  cycleName: string;
  cycleNumber: number;
  progress: number;
  total: number;
  status: string | undefined;
  isComplete: boolean;
  canRequestVerification: boolean;
  alreadyRequested: boolean;
  submitting: boolean;
  onRequestVerification: () => void;
  adminFeedback?: string | null;
}

export const CycleProgressBar = ({
  cycleName,
  cycleNumber,
  progress,
  total,
  status,
  isComplete,
  canRequestVerification,
  alreadyRequested,
  submitting,
  onRequestVerification,
  adminFeedback,
}: CycleProgressBarProps) => {
  const percent = Math.min((progress / total) * 100, 100);
  const isRejected = status === "rejected";
  const isPendingReview = status === "pending_review";
  const showVerificationButton = isComplete && canRequestVerification && !alreadyRequested && !isPendingReview;

  // Extract rejected trade numbers from admin feedback
  const rejectedTradeNumbers: number[] = [];
  if (isRejected && adminFeedback) {
    const matches = adminFeedback.match(/Trade #(\d+)/g);
    if (matches) {
      matches.forEach(m => {
        const num = parseInt(m.replace("Trade #", ""));
        if (!isNaN(num)) rejectedTradeNumbers.push(num);
      });
    }
  }

  return (
    <div
      className={cn(
        "mx-4 md:mx-6 mt-4 rounded-lg border p-3 md:p-4 transition-all",
        isRejected
          ? "border-red-500/50 bg-red-500/5"
          : showVerificationButton
          ? "border-orange-500/50 bg-orange-500/5 animate-pulse-subtle"
          : isPendingReview
          ? "border-orange-500/40 bg-orange-500/5"
          : "border-primary/30 bg-primary/5"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Cycle info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
              isRejected
                ? "bg-red-500/20 text-red-400"
                : showVerificationButton
                ? "bg-orange-500/20 text-orange-400"
                : isPendingReview
                ? "bg-orange-500/20 text-orange-400"
                : "bg-primary/20 text-primary"
            )}
          >
            {cycleNumber === 0 ? "É" : cycleNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground truncate">
                {cycleName}
              </span>
              <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                {progress}/{total}
              </span>
              {isPendingReview && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono flex-shrink-0">
                  En attente de vérification
                </span>
              )}
              {isRejected && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono flex-shrink-0">
                  À corriger
                </span>
              )}
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isRejected
                    ? "bg-red-500"
                    : showVerificationButton
                    ? "bg-orange-500"
                    : isPendingReview
                    ? "bg-orange-500"
                    : percent >= 100
                    ? "bg-emerald-500"
                    : "bg-primary"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action button */}
        {showVerificationButton && (
          <Button
            onClick={onRequestVerification}
            disabled={submitting}
            className="gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold flex-shrink-0 shadow-lg"
            size="sm"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Demander ma vérification
          </Button>
        )}

        {alreadyRequested && isPendingReview && (
          <div className="flex items-center gap-1.5 text-orange-400 flex-shrink-0">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-mono">Demande envoyée</span>
          </div>
        )}
      </div>

      {/* Rejected trades message */}
      {isRejected && rejectedTradeNumbers.length > 0 && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
          <p className="text-sm font-bold text-red-400 mb-1">
            ⚠️ Vous devez corriger les trades suivants :
          </p>
          <p className="text-sm text-foreground font-mono">
            {rejectedTradeNumbers.map(n => `Trade #${n}`).join(", ")}
          </p>
          <p className="text-xs text-red-400 font-bold mt-2">
            Modifiez les paramètres des trades incorrects puis redemandez la vérification.
          </p>
        </div>
      )}

      {isRejected && rejectedTradeNumbers.length === 0 && adminFeedback && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
          <p className="text-sm font-bold text-red-400 mb-1">
            ⚠️ Cycle refusé — Corrections requises
          </p>
          <p className="text-xs text-red-400 font-bold mt-1">
            Corrigez les trades signalés puis redemandez la vérification.
          </p>
        </div>
      )}
    </div>
  );
};
