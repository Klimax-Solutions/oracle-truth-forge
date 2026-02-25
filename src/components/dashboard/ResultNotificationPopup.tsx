import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowRight } from "lucide-react";
import { SignedImageCard } from "./SignedImageCard";

interface NewResult {
  id: string;
  title: string | null;
  image_path: string;
  result_date: string | null;
  created_at: string;
}

export const ResultNotificationPopup = ({ onNavigateToResults }: { onNavigateToResults: () => void }) => {
  const [result, setResult] = useState<NewResult | null>(null);
  const [open, setOpen] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const channel = supabase
      .channel("result_popup_notif")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "results" }, (payload) => {
        if (!initialLoadDone.current) return;
        const row = payload.new as any;
        setResult({
          id: row.id,
          title: row.title,
          image_path: row.image_path,
          result_date: row.result_date,
          created_at: row.created_at,
        });
        setOpen(true);
      })
      .subscribe();

    const timer = setTimeout(() => { initialLoadDone.current = true; }, 2000);

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const formatDate = (dateStr: string) => {
    const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span className="text-sm font-bold text-foreground">Nouveau résultat Oracle</span>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          {result.title && (
            <h3 className="text-base font-bold text-foreground drop-shadow-[0_0_6px_hsl(var(--primary)/0.4)]">
              {result.title}
            </h3>
          )}
          <p className="text-xs text-muted-foreground font-mono">
            {formatDate(result.result_date || result.created_at)}
          </p>
          <div className="aspect-video rounded-lg overflow-hidden border border-border">
            <SignedImageCard
              storagePath={result.image_path}
              alt={result.title || "Résultat"}
              label=""
              fillContainer
              bucket="result-screenshots"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Fermer
          </Button>
          <Button className="flex-1 gap-1.5" onClick={() => { setOpen(false); onNavigateToResults(); }}>
            Voir tous les résultats
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
