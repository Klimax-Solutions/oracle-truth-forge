import { useState, useEffect } from "react";
import { X, CheckCircle, XCircle, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CycleNotification {
  id: string;
  type: string;
  message: string;
  created_at: string;
}

export const CycleReportPopup = () => {
  const [notifications, setNotifications] = useState<CycleNotification[]>([]);
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .in("type", ["cycle_validated", "cycle_rejected"])
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        setNotifications(data as CycleNotification[]);
        setVisible(true);
      }
    };
    fetchUnread();
  }, []);

  const markAsRead = async (id: string) => {
    await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("id", id);
  };

  const handleDismiss = async () => {
    // Mark all displayed as read
    for (const n of notifications) {
      await markAsRead(n.id);
    }
    setVisible(false);
  };

  const handleNext = () => {
    markAsRead(notifications[currentIndex].id);
    if (currentIndex < notifications.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setVisible(false);
    }
  };

  if (!visible || notifications.length === 0) return null;

  const current = notifications[currentIndex];
  const isValidated = current.type === "cycle_validated";
  const lines = current.message.split("\n").filter(Boolean);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className={cn(
          "w-full max-w-lg mx-4 rounded-lg border shadow-2xl overflow-hidden",
          isValidated ? "border-emerald-500/40 bg-card" : "border-red-500/40 bg-card"
        )}
      >
        {/* Header */}
        <div className={cn(
          "px-5 py-4 flex items-center justify-between",
          isValidated ? "bg-emerald-500/10" : "bg-red-500/10"
        )}>
          <div className="flex items-center gap-3">
            {isValidated ? (
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400" />
            )}
            <h3 className="text-lg font-semibold text-foreground">
              Rapport de vérification
            </h3>
          </div>
          <button onClick={handleDismiss} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[60vh] overflow-auto space-y-3">
          {lines.map((line, i) => {
            if (line.startsWith("•")) {
              return (
                <div key={i} className="flex items-start gap-2 pl-2">
                  <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground">{line.replace("• ", "")}</p>
                </div>
              );
            }
            if (line.startsWith("✅") || line.startsWith("❌")) {
              return (
                <p key={i} className="text-base font-semibold text-foreground">{line}</p>
              );
            }
            if (line.startsWith("Commentaire")) {
              return (
                <div key={i} className="mt-2 p-3 bg-muted/50 rounded-md">
                  <p className="text-sm text-muted-foreground">{line}</p>
                </div>
              );
            }
            if (line.startsWith("Trades refusés")) {
              return (
                <p key={i} className="text-xs font-mono uppercase text-red-400 mt-3">{line}</p>
              );
            }
            return <p key={i} className="text-sm text-muted-foreground">{line}</p>;
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground">
            {currentIndex + 1} / {notifications.length}
          </span>
          <Button size="sm" onClick={handleNext}>
            {currentIndex < notifications.length - 1 ? "Suivant" : "Compris"}
          </Button>
        </div>
      </div>
    </div>
  );
};
