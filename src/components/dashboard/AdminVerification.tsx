import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  TrendingUp,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface VerificationRequest {
  id: string;
  user_id: string;
  cycle_id: string;
  user_cycle_id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  admin_comments: string | null;
}

interface UserCycle {
  id: string;
  user_id: string;
  cycle_id: string;
  status: string;
  completed_trades: number;
  total_rr: number;
  completed_at: string | null;
  admin_feedback: string | null;
}

interface Cycle {
  id: string;
  cycle_number: number;
  name: string;
  trade_start: number;
  trade_end: number;
  total_trades: number;
}

interface Trade {
  id: string;
  trade_number: number;
  rr: number;
  direction: string;
  trade_date: string;
  user_id: string;
}

interface PendingRequest extends VerificationRequest {
  cycle: Cycle | null;
  userCycle: UserCycle | null;
  trades: Trade[];
  userEmail: string;
}

export const AdminVerification = () => {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    
    // Fetch all pending verification requests
    const { data: requestsData, error: requestsError } = await supabase
      .from("verification_requests")
      .select("*")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    if (requestsError) {
      console.error("Error fetching requests:", requestsError);
      setLoading(false);
      return;
    }

    if (!requestsData || requestsData.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Fetch cycles
    const { data: cyclesData } = await supabase
      .from("cycles")
      .select("*");

    // Fetch user cycles
    const userCycleIds = requestsData.map(r => r.user_cycle_id);
    const { data: userCyclesData } = await supabase
      .from("user_cycles")
      .select("*")
      .in("id", userCycleIds);

    // Fetch all trades for the users
    const userIds = [...new Set(requestsData.map(r => r.user_id))];
    const { data: tradesData } = await supabase
      .from("trades")
      .select("*")
      .in("user_id", userIds)
      .order("trade_number", { ascending: true });

    // Combine data
    const enrichedRequests: PendingRequest[] = requestsData.map(request => {
      const userCycle = userCyclesData?.find(uc => uc.id === request.user_cycle_id) || null;
      const cycle = cyclesData?.find(c => c.id === request.cycle_id) || null;
      
      const trades = tradesData?.filter(t => 
        t.user_id === request.user_id && 
        cycle && 
        t.trade_number >= cycle.trade_start && 
        t.trade_number <= cycle.trade_end
      ) || [];

      return {
        ...request,
        cycle: cycle as Cycle | null,
        userCycle: userCycle as UserCycle | null,
        trades: trades as Trade[],
        userEmail: request.user_id, // We'll just show user_id for now
      };
    });

    setRequests(enrichedRequests);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (request: PendingRequest) => {
    if (!request.userCycle || !request.cycle) return;
    
    setProcessing(request.id);
    const feedbackText = feedback[request.id] || "";

    try {
      // Update verification request
      const { error: requestError } = await supabase
        .from("verification_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          admin_comments: feedbackText,
        })
        .eq("id", request.id);

      if (requestError) throw requestError;

      // Update user cycle
      const { error: cycleError } = await supabase
        .from("user_cycles")
        .update({
          status: "validated",
          verified_at: new Date().toISOString(),
          admin_feedback: feedbackText,
        })
        .eq("id", request.userCycle.id);

      if (cycleError) throw cycleError;

      // Unlock next cycle
      await supabase.rpc("unlock_next_cycle", {
        p_user_id: request.user_id,
        p_current_cycle_number: request.cycle.cycle_number,
      });

      toast({
        title: "Cycle validé !",
        description: `Le ${request.cycle.name} a été validé avec succès. Le cycle suivant est maintenant débloqué.`,
      });

      // Refresh requests
      fetchRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la validation.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: PendingRequest) => {
    if (!request.userCycle || !request.cycle) return;
    
    const feedbackText = feedback[request.id];
    if (!feedbackText?.trim()) {
      toast({
        title: "Feedback requis",
        description: "Veuillez fournir un feedback pour expliquer le refus.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(request.id);

    try {
      // Update verification request
      const { error: requestError } = await supabase
        .from("verification_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          admin_comments: feedbackText,
        })
        .eq("id", request.id);

      if (requestError) throw requestError;

      // Update user cycle
      const { error: cycleError } = await supabase
        .from("user_cycles")
        .update({
          status: "rejected",
          admin_feedback: feedbackText,
        })
        .eq("id", request.userCycle.id);

      if (cycleError) throw cycleError;

      toast({
        title: "Cycle refusé",
        description: `Le ${request.cycle.name} a été refusé. L'utilisateur a été notifié.`,
      });

      // Refresh requests
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du refus.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const calculateStats = (trades: Trade[]) => {
    const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);
    const wins = trades.filter(t => t.rr > 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const avgRR = trades.length > 0 ? totalRR / trades.length : 0;
    
    return { totalRR, winRate, avgRR, wins, losses: trades.length - wins };
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground mb-1">
          Panel Administrateur
        </h2>
        <p className="text-sm text-muted-foreground font-mono">
          Vérification des demandes de validation de cycles
        </p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucune demande en attente
            </h3>
            <p className="text-sm text-muted-foreground">
              Toutes les demandes de vérification ont été traitées.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-orange-400" />
              <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                {requests.length} demande{requests.length > 1 ? "s" : ""} en attente
              </span>
            </div>

            {requests.map((request) => {
              const stats = calculateStats(request.trades);
              const isExpanded = expandedRequest === request.id;
              const isProcessing = processing === request.id;

              return (
                <div
                  key={request.id}
                  className="border border-orange-500/40 bg-orange-500/5 rounded-md overflow-hidden"
                >
                  {/* Request Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-orange-500/10 transition-colors"
                    onClick={() => setExpandedRequest(isExpanded ? null : request.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {request.cycle?.name || "Cycle inconnu"}
                          </h4>
                          <p className="text-xs text-muted-foreground font-mono">
                            Demandé le {new Date(request.requested_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={cn(
                            "text-lg font-bold",
                            stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(1)} RR
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.trades.length} trades
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-orange-500/20 p-4 space-y-4">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 bg-card border border-border/40 rounded-md">
                          <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">
                            Total RR
                          </p>
                          <p className={cn(
                            "text-xl font-bold",
                            stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(1)}
                          </p>
                        </div>
                        <div className="p-3 bg-card border border-border/40 rounded-md">
                          <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">
                            Win Rate
                          </p>
                          <p className="text-xl font-bold text-foreground">
                            {stats.winRate.toFixed(0)}%
                          </p>
                        </div>
                        <div className="p-3 bg-card border border-border/40 rounded-md">
                          <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">
                            RR Moyen
                          </p>
                          <p className="text-xl font-bold text-foreground">
                            {stats.avgRR.toFixed(2)}
                          </p>
                        </div>
                        <div className="p-3 bg-card border border-border/40 rounded-md">
                          <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">
                            Ratio W/L
                          </p>
                          <p className="text-xl font-bold text-foreground">
                            {stats.wins}/{stats.losses}
                          </p>
                        </div>
                      </div>

                      {/* Trades Grid */}
                      <div>
                        <p className="text-xs font-mono uppercase text-muted-foreground mb-2">
                          Détail des trades ({request.cycle?.trade_start}-{request.cycle?.trade_end})
                        </p>
                        <div className="grid grid-cols-10 gap-1 max-h-32 overflow-auto">
                          {request.trades.map((trade) => (
                            <div
                              key={trade.id}
                              className={cn(
                                "p-1.5 border rounded text-center text-[10px] font-mono",
                                trade.rr >= 0 
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : "bg-red-500/10 border-red-500/30 text-red-400"
                              )}
                            >
                              <div className="font-bold">#{trade.trade_number}</div>
                              <div>{trade.rr >= 0 ? "+" : ""}{trade.rr?.toFixed(1)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Feedback */}
                      <div>
                        <label className="text-xs font-mono uppercase text-muted-foreground mb-2 block">
                          Feedback (optionnel pour validation, requis pour refus)
                        </label>
                        <Textarea
                          value={feedback[request.id] || ""}
                          onChange={(e) => setFeedback(prev => ({
                            ...prev,
                            [request.id]: e.target.value,
                          }))}
                          placeholder="Laissez un commentaire pour l'utilisateur..."
                          className="resize-none bg-card border-border/40"
                          rows={3}
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleApprove(request)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Valider le Cycle
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleReject(request)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 mr-2" />
                          )}
                          Refuser (Corrections)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
