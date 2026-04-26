import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EarlyAccessCRM } from "./EarlyAccessCRM";

interface EARequest {
  id: string;
  first_name: string;
  phone: string;
  email: string;
  status: string;
  created_at: string;
}

const DEFAULT_DURATION_HOURS = 168; // 7 jours par défaut

export const EarlyAccessRequestsTab = () => {
  const [requests, setRequests] = useState<EARequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const { toast } = useToast();

  // Format en heure de Paris (équipe FR — l'heure du navigateur peut différer)
  const fmtParis = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Paris" });
    const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
    return `${date} à ${time}`;
  };

  // Index des soumissions par email (case-insensitive) → détection de doublons.
  // Important : on n'écrase JAMAIS les anciennes soumissions, on les liste pour audit.
  const submissionsByEmail = useMemo(() => {
    const map = new Map<string, EARequest[]>();
    for (const r of requests) {
      const key = (r.email || "").trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Trier chaque groupe par date desc
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return map;
  }, [requests]);

  // Set des emails (lowercase) qui ont DÉJÀ un compte membre actif (rôle 'member')
  // → permet d'afficher une alerte CRITIQUE sur les nouvelles demandes pour ces emails
  const [memberEmails, setMemberEmails] = useState<Set<string>>(new Set());

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("early_access_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setRequests(data as any as EARequest[]);
    setLoading(false);
  };

  // Récupère la liste des emails de tous les comptes ayant le rôle 'member'.
  // Best-effort : si ça échoue, pas d'alerte mais rien ne casse.
  const fetchMemberEmails = async () => {
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "member");
      if (!roles?.length) return;
      const userIds = roles.map((r: any) => r.user_id);
      // Récupère les emails via early_access_requests qui linkent user_id↔email
      const { data: linked } = await supabase
        .from("early_access_requests" as any)
        .select("email, user_id")
        .in("user_id", userIds);
      const set = new Set<string>();
      (linked as any[] | null)?.forEach((r) => {
        if (r.email) set.add(String(r.email).trim().toLowerCase());
      });
      setMemberEmails(set);
    } catch (err) {
      console.warn("[EARequests] memberEmails fetch failed:", err);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchMemberEmails();
  }, []);

  const handleApprove = async (request: EARequest) => {
    setProcessing(request.id);
    try {
      const durationHours = durations[request.id] || DEFAULT_DURATION_HOURS;
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase.functions.invoke("approve-early-access", {
        body: { requestId: request.id, expiresAt },
      });

      if (error) throw error;

      toast({
        title: "Demande approuvée",
        description: `Le compte pour ${request.first_name} a été créé avec le rôle Early Access Pré-call.`,
      });
      fetchRequests();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible d'approuver la demande.",
        variant: "destructive",
      });
    }
    setProcessing(null);
  };

  const handleReject = async (request: EARequest) => {
    setProcessing(request.id);
    const { error } = await supabase
      .from("early_access_requests" as any)
      .update({ status: "refusée", reviewed_at: new Date().toISOString() } as any)
      .eq("id", request.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Demande refusée" });
      fetchRequests();
    }
    setProcessing(null);
  };

  const pendingRequests = requests.filter((r) => r.status === "en_attente");
  const processedRequests = requests.filter((r) => r.status !== "en_attente");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex flex-col lg:flex-row gap-6">
      {/* LEFT: CRM (2/3) */}
      <div className="lg:w-2/3 min-w-0">
        <EarlyAccessCRM />
      </div>

      {/* RIGHT: Approval Requests (1/3) */}
      <div className="lg:w-1/3 space-y-4">
        {/* Pending requests */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Demandes en attente ({pendingRequests.length})
          </h3>

          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-border rounded-md">
              Aucune demande en attente.
            </div>
          ) : (
            <div className="grid gap-3">
              {pendingRequests.map((req) => {
                const emailKey = (req.email || "").trim().toLowerCase();
                const allForEmail = submissionsByEmail.get(emailKey) || [];
                const otherSubmissions = allForEmail.filter((r) => r.id !== req.id);
                const isDuplicate = otherSubmissions.length > 0;

                return (
                <div
                  key={req.id}
                  className="border border-amber-500/30 bg-amber-500/5 rounded-md p-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30">
                        Early Access Pré-call
                      </span>
                      {isDuplicate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-orange-500/20 text-orange-500 border border-orange-500/40 cursor-help">
                              <AlertTriangle className="w-3 h-3" />
                              Doublon ({otherSubmissions.length})
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <div className="space-y-1.5 text-[11px]">
                              <p className="font-semibold">Autres soumissions pour cet email :</p>
                              {otherSubmissions.map((o) => (
                                <div key={o.id} className="border-l-2 border-orange-400 pl-2">
                                  <div className="font-mono">
                                    <span className="font-semibold">{o.first_name}</span>
                                    <span className="text-muted-foreground"> · {o.status}</span>
                                  </div>
                                  <div className="text-muted-foreground font-mono text-[10px]">
                                    {fmtParis(o.created_at)}
                                  </div>
                                </div>
                              ))}
                              <p className="text-[10px] text-muted-foreground italic pt-1">
                                Aucune donnée n'est écrasée — chaque soumission est conservée.
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="font-semibold">{req.first_name}</span>
                        {isDuplicate && (
                          <span className="text-[9px] text-orange-400 font-mono uppercase">(prénom de cette soumission)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="truncate">{req.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {req.phone}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Soumis le {fmtParis(req.created_at)} <span className="text-muted-foreground/60">(Paris)</span>
                    </p>
                    {/* Timer duration selector */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span className="text-[9px] font-mono text-muted-foreground uppercase">Minuteur :</span>
                      <select
                        value={durations[req.id] || DEFAULT_DURATION_HOURS}
                        onChange={(e) => setDurations(prev => ({ ...prev, [req.id]: Number(e.target.value) }))}
                        className="h-6 text-[10px] rounded border border-input bg-background px-1.5 font-mono"
                      >
                        <option value={24}>24h</option>
                        <option value={48}>48h</option>
                        <option value={72}>72h</option>
                        <option value={96}>96h</option>
                        <option value={120}>5 jours</option>
                        <option value={168}>7 jours</option>
                        <option value={336}>14 jours</option>
                        <option value={720}>30 jours</option>
                      </select>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="gap-1 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-7"
                        onClick={() => handleApprove(req)}
                        disabled={processing === req.id}
                      >
                        {processing === req.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1 flex-1 text-[10px] h-7"
                        onClick={() => handleReject(req)}
                        disabled={processing === req.id}
                      >
                        <XCircle className="w-3 h-3" />
                        Refuser
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Processed requests */}
        {processedRequests.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Traitées ({processedRequests.length})
            </h3>
            <div className="grid gap-2">
              {processedRequests.map((req) => (
                <div
                  key={req.id}
                  className="border border-border rounded-md p-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{req.first_name}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                      req.status === "approuvée"
                        ? "bg-emerald-500/20 text-emerald-500"
                        : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
};
