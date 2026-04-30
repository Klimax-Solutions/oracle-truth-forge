import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Bell, CheckCircle, XCircle, User, Mail, Phone, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface EANotif {
  id: string;
  first_name: string;
  email: string;
  phone: string;
  created_at: string;
}

const DEFAULT_DURATION_HOURS = 168; // 7 jours par défaut

export const EAApprovalNotification = () => {
  const { state } = useUserRoles();
  const isSuperAdmin = state.status === "ready" && state.data.isSuperAdmin;

  const [pending, setPending] = useState<EANotif[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  // Initial fetch when roles are ready
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchPending();
  }, [isSuperAdmin]);

  // Realtime for new requests
  useEffect(() => {
    if (!isSuperAdmin) return;
    const channel = supabase
      .channel("ea_requests_notif")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "early_access_requests",
      }, () => {
        fetchPending();
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "early_access_requests",
      }, () => {
        fetchPending();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isSuperAdmin]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const fetchPending = async () => {
    const { data } = await supabase
      .from("early_access_requests" as any)
      .select("*")
      .eq("status", "en_attente")
      .order("created_at", { ascending: false });
    if (data) setPending(data as any as EANotif[]);
  };

  const handleApprove = async (req: EANotif) => {
    setProcessing(req.id);
    try {
      const durationHours = durations[req.id] || DEFAULT_DURATION_HOURS;
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.functions.invoke("approve-early-access", {
        body: { requestId: req.id, expiresAt },
      });
      if (error) throw error;
      toast({ title: "Approuvé", description: `${req.first_name} a été approuvé.` });
      fetchPending();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setProcessing(null);
  };

  const handleReject = async (req: EANotif) => {
    setProcessing(req.id);
    const { error } = await supabase
      .from("early_access_requests" as any)
      .update({ status: "refusée", reviewed_at: new Date().toISOString() } as any)
      .eq("id", req.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Refusé" });
      fetchPending();
    }
    setProcessing(null);
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md hover:bg-accent transition-colors"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {pending.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center animate-pulse">
            {pending.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-auto rounded-lg border border-border bg-card shadow-xl z-50">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground">
              Demandes EA en attente ({pending.length})
            </p>
          </div>

          {pending.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Aucune demande en attente
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pending.map((req) => (
                <div key={req.id} className="p-3 space-y-2">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <User className="w-3 h-3 text-muted-foreground" />
                      {req.first_name}
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <span className="truncate">{req.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {req.phone}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {new Date(req.created_at).toLocaleDateString("fr-FR")} à{" "}
                      {new Date(req.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* Timer */}
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span className="text-[9px] font-mono text-muted-foreground uppercase">Minuteur :</span>
                    <select
                      value={durations[req.id] || DEFAULT_DURATION_HOURS}
                      onChange={(e) => setDurations(prev => ({ ...prev, [req.id]: Number(e.target.value) }))}
                      className="h-5 text-[10px] rounded border border-input bg-background px-1 font-mono"
                    >
                      <option value={24}>24h</option>
                      <option value={48}>48h</option>
                      <option value={72}>72h</option>
                      <option value={96}>96h</option>
                      <option value={120}>5j</option>
                      <option value={168}>7j</option>
                      <option value={336}>14j</option>
                      <option value={720}>30j</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-6"
                      onClick={() => handleApprove(req)}
                      disabled={processing === req.id}
                    >
                      {processing === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 gap-1 text-[10px] h-6"
                      onClick={() => handleReject(req)}
                      disabled={processing === req.id}
                    >
                      <XCircle className="w-3 h-3" />
                      Refuser
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
