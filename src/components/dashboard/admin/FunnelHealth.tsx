/**
 * Funnel Health — dashboard temps réel de l'état du funnel d'acquisition.
 *
 * Vérifie en un coup d'œil :
 *  - Volume de leads reçus (24h / 7j)
 *  - Pipeline de statuts (en_attente vs approuvée)
 *  - Dernière approbation EA réussie (edge function approve-early-access OK)
 *  - Leads bloqués dans la queue locale du navigateur courant
 *  - Comptes EA actifs en ce moment
 *
 * Source : early_access_requests + user_roles.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Inbox, RefreshCw,
  TrendingUp, Users, Zap, Mail, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface HealthStats {
  leads24h: number;
  leads7d: number;
  pendingCount: number;
  approvedCount: number;
  lastLeadAt: string | null;
  lastApprovedAt: string | null;
  activeEaCount: number;
  expiredEaCount: number;
  queueLocal: number;
}

const STORAGE_KEY = "oracle_funnel_pending_leads";

export function FunnelHealth() {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const now = new Date();
      const day = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [leads24h, leads7d, pending, approved, lastLead, lastApproved, eaActive, eaExpired] = await Promise.all([
        supabase.from("early_access_requests").select("id", { count: "exact", head: true }).gte("created_at", day),
        supabase.from("early_access_requests").select("id", { count: "exact", head: true }).gte("created_at", week),
        supabase.from("early_access_requests").select("id", { count: "exact", head: true }).eq("status", "en_attente"),
        supabase.from("early_access_requests").select("id", { count: "exact", head: true }).eq("status", "approuvée"),
        supabase.from("early_access_requests").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("early_access_requests").select("reviewed_at").eq("status", "approuvée").not("reviewed_at", "is", null).order("reviewed_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "early_access").or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "early_access").lte("expires_at", now.toISOString()),
      ]);

      // Queue locale (navigateur courant)
      let queueLocal = 0;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) queueLocal = (JSON.parse(raw) as unknown[]).length;
      } catch { /* noop */ }

      setStats({
        leads24h: leads24h.count || 0,
        leads7d: leads7d.count || 0,
        pendingCount: pending.count || 0,
        approvedCount: approved.count || 0,
        lastLeadAt: lastLead.data?.created_at || null,
        lastApprovedAt: lastApproved.data?.reviewed_at || null,
        activeEaCount: eaActive.count || 0,
        expiredEaCount: eaExpired.count || 0,
        queueLocal,
      });
    } catch (err) {
      console.error("[FunnelHealth]", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>;
  }
  if (!stats) {
    return <div className="text-center text-white/40 py-12 text-sm">Impossible de charger les données</div>;
  }

  const fmtTime = (iso: string | null) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  };

  // Health checks
  const checks = [
    {
      label: "Capture des leads",
      ok: !!stats.lastLeadAt && (Date.now() - new Date(stats.lastLeadAt).getTime()) < 7 * 24 * 60 * 60 * 1000,
      detail: stats.lastLeadAt ? `Dernier lead ${fmtTime(stats.lastLeadAt)}` : "Aucun lead reçu",
      icon: Inbox,
    },
    {
      label: "Approbation EA (edge function)",
      ok: !!stats.lastApprovedAt,
      detail: stats.lastApprovedAt ? `Dernière approbation ${fmtTime(stats.lastApprovedAt)}` : "Aucune approbation enregistrée",
      icon: Zap,
    },
    {
      label: "Aucun lead bloqué localement",
      ok: stats.queueLocal === 0,
      detail: stats.queueLocal === 0 ? "Queue locale vide" : `${stats.queueLocal} lead(s) en attente de retry`,
      icon: AlertTriangle,
    },
    {
      label: "Pipeline vivant",
      ok: stats.pendingCount > 0 || stats.approvedCount > 0,
      detail: `${stats.pendingCount} en attente · ${stats.approvedCount} approuvés`,
      icon: Activity,
    },
  ];

  const allOk = checks.every(c => c.ok);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Santé du Funnel
          </h2>
          <p className="text-xs text-white/40 mt-0.5">État temps réel du pipeline d'acquisition</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={refreshing} className="h-8 text-xs">
          <RefreshCw className={cn("w-3 h-3 mr-1.5", refreshing && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* Statut global */}
      <div className={cn(
        "rounded-lg border p-4 flex items-center gap-3",
        allOk ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"
      )}>
        {allOk ? <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" /> : <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />}
        <div>
          <p className={cn("font-semibold text-sm", allOk ? "text-emerald-400" : "text-amber-400")}>
            {allOk ? "Tout fonctionne" : "Attention nécessaire"}
          </p>
          <p className="text-xs text-white/50 mt-0.5">
            {allOk ? "Le funnel capture, approuve et déploie les EA correctement." : "Au moins un point critique nécessite une vérification."}
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Leads 24h" value={stats.leads24h} tone="violet" />
        <StatCard icon={Inbox} label="Leads 7j" value={stats.leads7d} tone="blue" />
        <StatCard icon={Clock} label="En attente" value={stats.pendingCount} tone="amber" />
        <StatCard icon={Users} label="EA actifs" value={stats.activeEaCount} tone="emerald" />
      </div>

      {/* Health checks */}
      <div className="space-y-2">
        <p className="text-xs font-mono uppercase tracking-wider text-white/40 mb-3">Points de contrôle</p>
        {checks.map((c) => (
          <div key={c.label} className={cn(
            "flex items-center gap-3 p-3 rounded-lg border",
            c.ok ? "bg-white/[0.02] border-white/[0.06]" : "bg-amber-500/5 border-amber-500/20"
          )}>
            <div className={cn(
              "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
              c.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            )}>
              {c.ok ? <CheckCircle2 className="w-4 h-4" /> : <c.icon className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{c.label}</p>
              <p className="text-xs text-white/50">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Procédure de test */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs font-mono uppercase tracking-wider text-white/50 mb-3 flex items-center gap-2">
          <Mail className="w-3 h-3" /> Tester le funnel de bout en bout
        </p>
        <ol className="space-y-2 text-xs text-white/60">
          <li><span className="text-violet-400 font-bold">1.</span> Ouvre <code className="text-emerald-400">/oracle/landing</code> en navigation privée (ou avec un alias <code className="text-emerald-400">ton+test01@gmail.com</code>).</li>
          <li><span className="text-violet-400 font-bold">2.</span> Soumets le form Apply → vérifie que le compteur <strong>Leads 24h</strong> ci-dessus s'incrémente.</li>
          <li><span className="text-violet-400 font-bold">3.</span> Reviens ici → onglet <strong>CRM</strong> → trouve le lead → clique <strong>Approuver</strong>.</li>
          <li><span className="text-violet-400 font-bold">4.</span> Vérifie que le compteur <strong>EA actifs</strong> s'incrémente et que le bloc <strong>Approbation EA</strong> passe au vert.</li>
          <li><span className="text-violet-400 font-bold">5.</span> Récupère le magic link reçu par email → connecte-toi → vérifie le dashboard EA (timer, vidéos, quêtes).</li>
        </ol>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: number; tone: "violet" | "blue" | "amber" | "emerald" }) {
  const tones = {
    violet:  "bg-violet-500/10 border-violet-500/20 text-violet-400",
    blue:    "bg-blue-500/10 border-blue-500/20 text-blue-400",
    amber:   "bg-amber-500/10 border-amber-500/20 text-amber-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  };
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center border", tones[tone])}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">{label}</p>
      </div>
      <p className="text-2xl font-display font-bold text-white">{value}</p>
    </div>
  );
}
