import { useState, useEffect } from "react";
import { Clock, Unlock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { useEarlyAccessSettings } from "@/hooks/useEarlyAccessSettings";
import { SignedImageCard } from "./SignedImageCard";

export const EarlyAccessLoginPopup = () => {
  const [open, setOpen] = useState(false);
  const { isEarlyAccess, expiresAt, earlyAccessType } = useEarlyAccess();
  const { settings: eaSettings } = useEarlyAccessSettings();
  const [lastResult, setLastResult] = useState<{ title: string | null; created_at: string; image_path: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Show popup once per session for EA users
  useEffect(() => {
    if (!isEarlyAccess || !expiresAt) return;
    const key = `ea_popup_shown_${new Date().toDateString()}`;
    if (!sessionStorage.getItem(key)) {
      setOpen(true);
      sessionStorage.setItem(key, "1");
    }
  }, [isEarlyAccess, expiresAt]);

  // Fetch last result
  useEffect(() => {
    if (!isEarlyAccess) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("results")
        .select("title, created_at, image_path")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setLastResult(data);
    };
    fetch();
  }, [isEarlyAccess]);

  // Timer
  useEffect(() => {
    if (!expiresAt) return;
    const calc = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!isEarlyAccess || !expiresAt) return null;

  const pad = (n: number) => n.toString().padStart(2, "0");
  const expired = new Date(expiresAt).getTime() <= Date.now();

  const unlockBtn = eaSettings.find(s => s.button_key === "acceder_a_oracle");
  const unlockUrl = unlockBtn?.button_url;

  const formatDate = (dateStr: string) => {
    const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 text-center border-b border-border">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Accès Anticipé</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {expired ? "Votre accès a expiré" : "Temps restant pour débloquer votre accès"}
          </p>
        </div>

        {/* Timer */}
        <div className="p-6 flex justify-center">
          {expired ? (
            <span className="text-2xl font-mono font-bold text-destructive">EXPIRÉ</span>
          ) : (
            <div className="flex items-center gap-2">
              {timeLeft.days > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-mono font-bold text-foreground">{timeLeft.days}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">jours</div>
                </div>
              )}
              {timeLeft.days > 0 && <span className="text-xl font-mono text-muted-foreground">:</span>}
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-foreground">{pad(timeLeft.hours)}</div>
                <div className="text-[9px] text-muted-foreground uppercase">heures</div>
              </div>
              <span className="text-xl font-mono text-muted-foreground">:</span>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-foreground">{pad(timeLeft.minutes)}</div>
                <div className="text-[9px] text-muted-foreground uppercase">min</div>
              </div>
              <span className="text-xl font-mono text-muted-foreground">:</span>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-foreground">{pad(timeLeft.seconds)}</div>
                <div className="text-[9px] text-muted-foreground uppercase">sec</div>
              </div>
            </div>
          )}
        </div>

        {/* Last result */}
        {lastResult && (
          <div className="px-6 pb-4">
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <div className="p-3 border-b border-border flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-semibold text-foreground">Dernier résultat Oracle</span>
              </div>
              <div className="p-3 space-y-2">
                {lastResult.title && (
                  <p className="text-sm font-medium text-foreground">{lastResult.title}</p>
                )}
                <p className="text-[10px] text-muted-foreground">{formatDate(lastResult.created_at)}</p>
                <div className="rounded-md overflow-hidden border border-border max-h-40">
                  <SignedImageCard
                    storagePath={lastResult.image_path}
                    alt="Dernier résultat"
                    label=""
                    fillContainer
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action */}
        <div className="p-6 pt-2 space-y-3">
          {unlockUrl && (
            <a href={unlockUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full gap-2">
                <Unlock className="w-4 h-4" />
                Débloquer mon accès à Oracle
              </Button>
            </a>
          )}
          <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
            Continuer en accès anticipé
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
