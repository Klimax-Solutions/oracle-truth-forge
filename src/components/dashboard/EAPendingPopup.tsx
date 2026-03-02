import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Clock, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PendingEA {
  id: string;
  first_name: string;
  email: string;
  created_at: string;
}

interface EAPendingPopupProps {
  onNavigateToEA: () => void;
}

export const EAPendingPopup = ({ onNavigateToEA }: EAPendingPopupProps) => {
  const [pending, setPending] = useState<PendingEA[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  const buildPendingSignature = (items: PendingEA[]) => {
    if (items.length === 0) return "empty";
    const first = items[0]?.id ?? "none";
    const last = items[items.length - 1]?.id ?? "none";
    return `${items.length}:${first}:${last}`;
  };

  const handleDismiss = () => {
    const signature = buildPendingSignature(pending);
    localStorage.setItem("ea_pending_popup_dismissed_signature", signature);
    setDismissed(true);
  };

  useEffect(() => {
    const check = async () => {
      const { data: sa } = await supabase.rpc("is_super_admin");
      if (!sa) { setLoaded(true); return; }
      setIsSuperAdmin(true);

      const { data } = await supabase
        .from("early_access_requests" as any)
        .select("id, first_name, email, created_at")
        .eq("status", "en_attente")
        .order("created_at", { ascending: false });

      if (data && (data as any[]).length > 0) {
        const nextPending = data as any as PendingEA[];
        setPending(nextPending);

        const signature = buildPendingSignature(nextPending);
        const dismissedSignature = localStorage.getItem("ea_pending_popup_dismissed_signature");
        if (dismissedSignature === signature) {
          setDismissed(true);
        } else {
          setDismissed(false);
        }
      }
      setLoaded(true);
      setTimeout(() => setAnimateIn(true), 200);
    };
    check();
  }, []);

  if (!loaded || !isSuperAdmin || pending.length === 0 || dismissed) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[101] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 overflow-y-auto p-4",
      animateIn ? "opacity-100" : "opacity-0"
    )}
      onClick={() => setDismissed(true)}
    >
      <div className={cn(
        "relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden transition-all duration-500",
        animateIn ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
      )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-amber-500 via-primary to-amber-500 animate-pulse" />

        <div className="p-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Demandes Early Access</h3>
                <p className="text-xs text-muted-foreground font-mono">{pending.length} en attente</p>
              </div>
            </div>
            <button onClick={() => setDismissed(true)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-3 max-h-60 overflow-y-auto space-y-2">
          {pending.slice(0, 5).map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <UserPlus className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.first_name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {item.email} • {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            </div>
          ))}
          {pending.length > 5 && (
            <p className="text-xs text-muted-foreground text-center py-1 font-mono">+{pending.length - 5} autre{pending.length - 5 > 1 ? "s" : ""}</p>
          )}
        </div>

        <div className="p-5 pt-3 border-t border-border">
          <Button className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setDismissed(true); onNavigateToEA(); }}>
            <UserPlus className="w-4 h-4" />
            Voir les demandes EA
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
