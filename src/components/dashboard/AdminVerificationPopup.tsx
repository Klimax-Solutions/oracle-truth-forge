import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Clock, ChevronRight, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PendingVerification {
  id: string;
  user_id: string;
  cycle_name: string;
  user_name: string;
  requested_at: string;
}

interface AdminVerificationPopupProps {
  onNavigateToAdmin: () => void;
}

export const AdminVerificationPopup = ({ onNavigateToAdmin }: AdminVerificationPopupProps) => {
  const [pendingItems, setPendingItems] = useState<PendingVerification[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check admin role
      const { data: adminCheck } = await supabase.rpc("is_admin");
      const { data: superAdminCheck } = await supabase.rpc("is_super_admin");
      
      if (!adminCheck && !superAdminCheck) {
        setLoaded(true);
        return;
      }
      setIsAdmin(true);

      // Fetch pending verification requests
      const { data: requests } = await supabase
        .from("verification_requests")
        .select("id, user_id, cycle_id, requested_at")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      if (!requests || requests.length === 0) {
        setLoaded(true);
        return;
      }

      // Get cycle names and user names
      const cycleIds = [...new Set(requests.map(r => r.cycle_id))];
      const userIds = [...new Set(requests.map(r => r.user_id))];

      const [{ data: cycles }, { data: profiles }] = await Promise.all([
        supabase.from("cycles").select("id, name").in("id", cycleIds),
        supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
      ]);

      const items: PendingVerification[] = requests.map(r => ({
        id: r.id,
        user_id: r.user_id,
        cycle_name: cycles?.find(c => c.id === r.cycle_id)?.name || "Cycle inconnu",
        user_name: profiles?.find(p => p.user_id === r.user_id)?.display_name || `User ${r.user_id.slice(0, 8)}`,
        requested_at: r.requested_at,
      }));

      setPendingItems(items);
      setLoaded(true);

      // Trigger animation
      setTimeout(() => setAnimateIn(true), 100);
    };
    check();
  }, []);

  // Listen for new verification requests in real-time
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("admin_verification_popup")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "verification_requests",
      }, async (payload) => {
        const newReq = payload.new as any;
        if (newReq.status !== "pending") return;

        const [{ data: cycle }, { data: profile }] = await Promise.all([
          supabase.from("cycles").select("name").eq("id", newReq.cycle_id).single(),
          supabase.from("profiles").select("display_name").eq("user_id", newReq.user_id).single(),
        ]);

        const item: PendingVerification = {
          id: newReq.id,
          user_id: newReq.user_id,
          cycle_name: cycle?.name || "Cycle inconnu",
          user_name: profile?.display_name || `User ${newReq.user_id.slice(0, 8)}`,
          requested_at: newReq.requested_at,
        };

        setPendingItems(prev => [item, ...prev]);
        setDismissed(false);
        setAnimateIn(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  if (!loaded || !isAdmin || pendingItems.length === 0 || dismissed) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300",
      animateIn ? "opacity-100" : "opacity-0"
    )}>
      <div className={cn(
        "relative w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden transition-all duration-500",
        animateIn ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
      )}>
        {/* Animated top bar */}
        <div className="h-1 bg-gradient-to-r from-orange-500 via-primary to-orange-500 animate-pulse" />

        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Demandes de vérification
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {pendingItems.length} en attente
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="px-5 pb-3 max-h-60 overflow-y-auto space-y-2">
          {pendingItems.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg"
            >
              <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.user_name}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {item.cycle_name} • {new Date(item.requested_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
            </div>
          ))}
          {pendingItems.length > 5 && (
            <p className="text-xs text-muted-foreground text-center py-1 font-mono">
              +{pendingItems.length - 5} autre{pendingItems.length - 5 > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Action */}
        <div className="p-5 pt-3 border-t border-border">
          <Button
            className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() => {
              setDismissed(true);
              onNavigateToAdmin();
            }}
          >
            <Shield className="w-4 h-4" />
            Vérifier les dernières demandes
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
