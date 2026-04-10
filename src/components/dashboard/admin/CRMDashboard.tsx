// ============================================
// CRM Dashboard — Pipeline view for sales tracking
// Reads from early_access_requests + profiles
// Inspired by spike-launch PipelineView
// ============================================

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Search, Filter, Users, TrendingUp, Phone, Mail,
  CheckCircle2, Circle, Clock, ArrowUpDown, Eye, PhoneCall,
  CreditCard, X, Calendar, BarChart3, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Types ──

interface PipelineLead {
  id: string;
  first_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  user_id: string | null;
  contacted: boolean;
  contact_method: string | null;
  form_submitted: boolean;
  call_booked: boolean;
  call_done: boolean;
}

type PipelineStage = "all" | "pending" | "approved" | "contacted" | "call_booked" | "call_done" | "closed";

const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; icon: typeof Circle }> = {
  all: { label: "Tous", color: "text-foreground", icon: Users },
  pending: { label: "En attente", color: "text-yellow-500", icon: Clock },
  approved: { label: "Approuvé", color: "text-blue-500", icon: CheckCircle2 },
  contacted: { label: "Contacté", color: "text-purple-500", icon: Phone },
  call_booked: { label: "Call booké", color: "text-orange-500", icon: PhoneCall },
  call_done: { label: "Call fait", color: "text-emerald-500", icon: CheckCircle2 },
  closed: { label: "Closed", color: "text-green-500", icon: CreditCard },
};

// ── Helpers ──

function getLeadStage(lead: PipelineLead): PipelineStage {
  if (lead.call_done) return "call_done";
  if (lead.call_booked) return "call_booked";
  if (lead.contacted) return "contacted";
  if (lead.status === "approuvée") return "approved";
  return "pending";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function timeSince(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}j`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(diff / 60000);
  return `${mins}m`;
}

// ── Pipeline Stats Cards ──

function StatsCards({ leads, activeStage, onStageChange }: {
  leads: PipelineLead[];
  activeStage: PipelineStage;
  onStageChange: (s: PipelineStage) => void;
}) {
  const counts = useMemo(() => {
    const c: Record<PipelineStage, number> = {
      all: leads.length,
      pending: 0, approved: 0, contacted: 0, call_booked: 0, call_done: 0, closed: 0,
    };
    leads.forEach(l => { c[getLeadStage(l)]++; });
    return c;
  }, [leads]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {(Object.keys(STAGE_CONFIG) as PipelineStage[]).map(stage => {
        const cfg = STAGE_CONFIG[stage];
        const Icon = cfg.icon;
        return (
          <button
            key={stage}
            onClick={() => onStageChange(stage)}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
              activeStage === stage
                ? "bg-primary/10 border-primary/30 shadow-sm"
                : "bg-card border-border/50 hover:border-border hover:bg-accent/50"
            )}
          >
            <Icon className={cn("w-4 h-4", cfg.color)} />
            <span className="text-2xl font-bold text-foreground">{counts[stage]}</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Pipeline Stage Badge ──

function StageBadge({ stage }: { stage: PipelineStage }) {
  const cfg = STAGE_CONFIG[stage];
  const Icon = cfg.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      stage === "pending" && "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
      stage === "approved" && "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
      stage === "contacted" && "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
      stage === "call_booked" && "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
      stage === "call_done" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      stage === "closed" && "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
    )}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Pipeline Progress Bar ──

function PipelineProgress({ lead }: { lead: PipelineLead }) {
  const steps = [
    { key: "form", done: true, label: "Form" },
    { key: "approved", done: lead.status === "approuvée", label: "EA" },
    { key: "contacted", done: lead.contacted, label: "Contact" },
    { key: "call_booked", done: lead.call_booked, label: "Call" },
    { key: "call_done", done: lead.call_done, label: "Close" },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-colors",
            step.done ? "bg-primary" : "bg-muted-foreground/20"
          )} />
          {i < steps.length - 1 && (
            <div className={cn(
              "w-4 h-px",
              step.done ? "bg-primary/50" : "bg-muted-foreground/10"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Lead Row ──

function LeadRow({ lead, onSelect }: { lead: PipelineLead; onSelect: (l: PipelineLead) => void }) {
  const stage = getLeadStage(lead);

  return (
    <tr
      onClick={() => onSelect(lead)}
      className="group border-b border-border/30 hover:bg-accent/30 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{lead.first_name}</span>
          <span className="text-xs text-muted-foreground">{lead.email}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <StageBadge stage={stage} />
      </td>
      <td className="px-4 py-3">
        <PipelineProgress lead={lead} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
        {formatDate(lead.created_at)}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
        {timeSince(lead.created_at)}
      </td>
      <td className="px-4 py-3">
        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
}

// ── Main CRM Dashboard ──

export default function CRMDashboard() {
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeStage, setActiveStage] = useState<PipelineStage>("all");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);

  // Load leads from early_access_requests
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("early_access_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setLeads(data.map((r: any) => ({
          id: r.id,
          first_name: r.first_name || "",
          email: r.email || "",
          phone: r.phone || "",
          status: r.status || "en_attente",
          created_at: r.created_at,
          reviewed_at: r.reviewed_at,
          user_id: r.user_id,
          contacted: r.contacted || false,
          contact_method: r.contact_method,
          form_submitted: r.form_submitted || false,
          call_booked: r.call_booked || false,
          call_done: r.call_done || false,
        })));
      }
      setLoading(false);
    };
    load();

    // Realtime updates
    const channel = supabase
      .channel("crm-pipeline-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "early_access_requests" }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Filter & sort
  const filtered = useMemo(() => {
    let result = [...leads];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.first_name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.includes(q)
      );
    }

    // Stage filter
    if (activeStage !== "all") {
      result = result.filter(l => getLeadStage(l) === activeStage);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "name") {
        return sortAsc
          ? a.first_name.localeCompare(b.first_name)
          : b.first_name.localeCompare(a.first_name);
      }
      return sortAsc
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [leads, search, activeStage, sortBy, sortAsc]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">CRM Pipeline</h2>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              {leads.length} lead{leads.length !== 1 ? "s" : ""} au total
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <StatsCards leads={leads} activeStage={activeStage} onStageChange={setActiveStage} />
      </div>

      {/* Tabs : Pipeline | Calendrier | Métriques */}
      <Tabs defaultValue="pipeline" className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 px-6 pt-3 border-b border-border">
          <TabsList className="bg-transparent border-none gap-4 p-0 h-auto">
            <TabsTrigger value="pipeline" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 px-1 text-xs font-mono uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Pipeline
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 px-1 text-xs font-mono uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 mr-1.5" /> Calendrier
            </TabsTrigger>
            <TabsTrigger value="metrics" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 px-1 text-xs font-mono uppercase tracking-wider">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Métriques
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="flex-1 flex flex-col overflow-hidden mt-0">
          {/* Search + Sort bar */}
          <div className="shrink-0 px-6 py-3 flex items-center gap-3 border-b border-border/50">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, email, tel..."
                className="pl-9 h-9 text-sm bg-background"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (sortBy === "date") setSortAsc(!sortAsc);
                else { setSortBy("date"); setSortAsc(false); }
              }}
              className="text-xs font-mono uppercase tracking-wider"
            >
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              Date {sortBy === "date" && (sortAsc ? "↑" : "↓")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (sortBy === "name") setSortAsc(!sortAsc);
                else { setSortBy("name"); setSortAsc(true); }
              }}
              className="text-xs font-mono uppercase tracking-wider"
            >
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              Nom {sortBy === "name" && (sortAsc ? "↑" : "↓")}
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun lead</p>
                <p className="text-xs">Les leads apparaîtront ici quand ils soumettront le formulaire</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                  <tr className="border-b border-border text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    <th className="text-left px-4 py-2.5 font-medium">Lead</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium">Pipeline</th>
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium">Ancienneté</th>
                    <th className="text-left px-4 py-2.5 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lead => (
                    <LeadRow key={lead.id} lead={lead} onSelect={setSelectedLead} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Calendar Tab (placeholder) */}
        <TabsContent value="calendar" className="flex-1 flex items-center justify-center mt-0">
          <div className="text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Calendrier</p>
            <p className="text-xs">Les bookings Cal.com apparaîtront ici une fois connecté</p>
          </div>
        </TabsContent>

        {/* Metrics Tab (placeholder) */}
        <TabsContent value="metrics" className="flex-1 flex items-center justify-center mt-0">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Métriques</p>
            <p className="text-xs">Taux de closing, revenue, conversions — bientôt disponible</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
