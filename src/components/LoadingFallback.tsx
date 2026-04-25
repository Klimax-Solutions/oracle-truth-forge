// ============================================
// LoadingFallback — anti spinner infini
// ============================================
// Spinner pendant N ms puis affiche un panneau "Réessayer / Se reconnecter"
// si la donnée n'arrive toujours pas.
//
// Usage :
//   if (loading) return <LoadingFallback onRetry={loadData} />;

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearStaleSession } from "@/lib/safeFetch";

interface LoadingFallbackProps {
  onRetry?: () => void;
  /** Délai avant d'afficher le panneau de secours (default 8s) */
  fallbackAfterMs?: number;
  /** Texte d'aide affiché dans le panneau de secours */
  message?: string;
}

export function LoadingFallback({
  onRetry,
  fallbackAfterMs = 8000,
  message = "Le chargement prend plus de temps que prévu.",
}: LoadingFallbackProps) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), fallbackAfterMs);
    return () => clearTimeout(timer);
  }, [fallbackAfterMs]);

  if (!showFallback) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 px-6">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
      <div className="text-center space-y-1 max-w-md">
        <p className="text-sm text-white/80 font-medium">{message}</p>
        <p className="text-xs text-white/50">
          Ta session est peut-être expirée. Réessaie ou reconnecte-toi.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowFallback(false); onRetry(); }}
            className="gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Réessayer
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearStaleSession("user_initiated")}
          className="gap-2 text-white/60 hover:text-white"
        >
          <LogOut className="w-3.5 h-3.5" />
          Se reconnecter
        </Button>
      </div>
    </div>
  );
}
