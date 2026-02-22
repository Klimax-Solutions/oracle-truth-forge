import { useState, useEffect } from "react";
import { Clock, Unlock, Trophy, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { useEarlyAccessSettings } from "@/hooks/useEarlyAccessSettings";
import { SignedImageCard } from "./SignedImageCard";

interface ResultItem {
  title: string | null;
  created_at: string;
  image_path: string;
}

export const EarlyAccessLoginPopup = () => {
  const [open, setOpen] = useState(false);
  const { isEarlyAccess, expiresAt, earlyAccessType } = useEarlyAccess();
  const { settings: eaSettings } = useEarlyAccessSettings();
  const [results, setResults] = useState<ResultItem[]>([]);
  const [popupTexts, setPopupTexts] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch data first, then show popup
  useEffect(() => {
    if (!isEarlyAccess || !expiresAt) return;
    const fetchData = async () => {
      const [resultsRes, textsRes] = await Promise.all([
        supabase
          .from("results")
          .select("title, created_at, image_path")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("ea_global_settings" as any)
          .select("setting_key, setting_value"),
      ]);
      if (resultsRes.data) setResults(resultsRes.data);
      if (textsRes.data) {
        const map: Record<string, string> = {};
        (textsRes.data as any[]).forEach((r: any) => { map[r.setting_key] = r.setting_value; });
        setPopupTexts(map);
      }
      setDataLoaded(true);
    };
    fetchData();
  }, [isEarlyAccess, expiresAt]);

  // Show popup on every fresh page load (not persisted across refreshes)
  useEffect(() => {
    if (!dataLoaded || !isEarlyAccess || !expiresAt) return;
    setOpen(true);
  }, [dataLoaded, isEarlyAccess, expiresAt]);

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
  const isPrecall = earlyAccessType === "precall";

  const unlockBtn = eaSettings.find(s => s.button_key === "acceder_a_oracle");
  const unlockUrl = unlockBtn?.button_url;

  const title = popupTexts["popup_title"] || "Accès Anticipé";
  const subtitle = isPrecall
    ? (popupTexts["popup_subtitle_precall"] || "Candidatez pour débloquer votre accès complet")
    : (popupTexts["popup_subtitle_postcall"] || "Finalisez votre paiement pour débloquer votre accès");

  const formatDate = (dateStr: string) => {
    const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* LEFT: Proof screenshots */}
          <div className="md:w-1/2 bg-muted/30 border-b md:border-b-0 md:border-r border-border p-4 md:p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-semibold text-foreground">Derniers résultats Oracle</span>
            </div>
            {results.length > 0 ? (
              <div className="space-y-3 flex-1">
                {results.map((r, i) => (
                  <div key={i} className="border border-border rounded-lg overflow-hidden bg-card">
                    <div className="aspect-video relative">
                      <SignedImageCard
                        storagePath={r.image_path}
                        alt={r.title || "Résultat"}
                        label=""
                        fillContainer
                        bucket="result-screenshots"
                      />
                    </div>
                    <div className="px-3 py-2">
                      {r.title && <p className="text-xs font-medium text-foreground truncate">{r.title}</p>}
                      <p className="text-[10px] text-muted-foreground">{formatDate(r.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                <div className="text-center space-y-2">
                  <ImageIcon className="w-8 h-8 mx-auto opacity-40" />
                  <p>Aucun résultat disponible</p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Timer + CTA */}
          <div className="md:w-1/2 p-5 md:p-6 flex flex-col justify-between">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </div>

            {/* Timer */}
            <div className="flex justify-center mb-6">
              {expired ? (
                <span className="text-2xl font-mono font-bold text-destructive">EXPIRÉ</span>
              ) : (
                <div className="flex items-center gap-2">
                  {timeLeft.days > 0 && (
                    <>
                      <div className="text-center">
                        <div className="text-3xl font-mono font-bold text-foreground">{timeLeft.days}</div>
                        <div className="text-[9px] text-muted-foreground uppercase">jours</div>
                      </div>
                      <span className="text-xl font-mono text-muted-foreground">:</span>
                    </>
                  )}
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-foreground">{pad(timeLeft.hours)}</div>
                    <div className="text-[9px] text-muted-foreground uppercase">heures</div>
                  </div>
                  <span className="text-xl font-mono text-muted-foreground">:</span>
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-foreground">{pad(timeLeft.minutes)}</div>
                    <div className="text-[9px] text-muted-foreground uppercase">min</div>
                  </div>
                  <span className="text-xl font-mono text-muted-foreground">:</span>
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-foreground">{pad(timeLeft.seconds)}</div>
                    <div className="text-[9px] text-muted-foreground uppercase">sec</div>
                  </div>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="space-y-3">
              {unlockUrl && (
                <a href={unlockUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full gap-2" size="lg">
                    <Unlock className="w-4 h-4" />
                    Débloquer mon accès à Oracle
                  </Button>
                </a>
              )}
              <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
                Continuer en accès anticipé
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
