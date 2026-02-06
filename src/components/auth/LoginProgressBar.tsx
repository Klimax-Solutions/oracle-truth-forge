import { useEffect, useState, useRef } from "react";

interface LoginProgressBarProps {
  isActive: boolean;
  onComplete: () => void;
}

const TOTAL_DURATION = 3500; // ms for 0→100%
const MESSAGE_DURATION = 1200; // ms to show the message before vortex
const TICK_INTERVAL = 30; // ms between updates

const LoginProgressBar = ({ isActive, onComplete }: LoginProgressBarProps) => {
  const [progress, setProgress] = useState(0);
  const [showMessage, setShowMessage] = useState(false);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setShowMessage(false);
      completedRef.current = false;
      return;
    }

    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const rawProgress = Math.min((elapsed / TOTAL_DURATION) * 100, 100);

      // Easing: fast start, slight slowdown mid, burst at end
      let eased: number;
      const t = rawProgress / 100;
      if (t < 0.6) {
        eased = t * 1.4 * 100; // faster first 60%
      } else if (t < 0.85) {
        eased = 84 + (t - 0.6) * 40; // slower 60-85%
      } else {
        eased = 94 + (t - 0.85) * 40; // final burst
      }
      eased = Math.min(eased, 100);

      setProgress(eased);

      if (rawProgress >= 100 && !completedRef.current) {
        completedRef.current = true;
        clearInterval(interval);
        setShowMessage(true);

        setTimeout(() => {
          onComplete();
        }, MESSAGE_DURATION);
      }
    }, TICK_INTERVAL);

    return () => clearInterval(interval);
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-md px-6 space-y-6">
        {/* Status text */}
        <div className="text-center space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-muted-foreground">
            {showMessage ? "Accès autorisé" : "Vérification en cours"}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-3">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-75 ease-linear"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, hsl(var(--foreground) / 0.4), hsl(var(--foreground)))",
                boxShadow: "0 0 12px hsl(var(--foreground) / 0.3)",
              }}
            />
          </div>

          {/* Percentage + data readout */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground tracking-wider">
              {showMessage ? "IDENTITÉ CONFIRMÉE" : "AUTHENTIFICATION"}
            </span>
            <span className="text-xs font-mono text-foreground tabular-nums">
              {Math.floor(progress)}%
            </span>
          </div>
        </div>

        {/* Data stream effect */}
        <div className="font-mono text-[10px] text-muted-foreground/60 space-y-0.5 overflow-hidden h-12">
          {!showMessage && (
            <>
              <p className="animate-fade-in" style={{ animationDelay: "0s" }}>
                → Vérification des credentials...
              </p>
              {progress > 30 && (
                <p className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                  → Chargement du profil utilisateur...
                </p>
              )}
              {progress > 65 && (
                <p className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                  → Synchronisation de la base Oracle...
                </p>
              )}
              {progress > 90 && (
                <p className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                  → Initialisation du dashboard...
                </p>
              )}
            </>
          )}
        </div>

        {/* Success message */}
        {showMessage && (
          <div className="text-center animate-fade-in">
            <p className="text-sm font-semibold text-foreground tracking-wide">
              Identité confirmée, accès à Oracle déverrouillé
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginProgressBar;
