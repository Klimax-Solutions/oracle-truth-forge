// ============================================
// Lead Thread Panel — Timeline of all lead events + comments
// Adapted from spike-launch for Oracle CRM
// ============================================

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, MessageCircle, Mail, Calendar, Phone, XCircle,
  CheckCircle2, UserX, RotateCcw, CreditCard, Loader2,
  Send, Clock, PhoneForwarded, Headphones, Shield, Edit3,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CRMLead } from "@/lib/admin/types";

// ── Types ──

interface LeadEvent {
  id: string;
  event_type: string;
  source: string;
  timestamp: string;
  metadata: Record<string, any>;
  created_by: string | null;
}

interface LeadComment {
  id: string;
  author_name: string;
  author_role: string;
  content: string;
  comment_type: string;
  created_at: string;
  edited_at: string | null;
}

type ThreadItem =
  | { kind: "event"; data: LeadEvent; time: Date }
  | { kind: "comment"; data: LeadComment; time: Date };

// ── Helpers ──

function fmtTime(d: string) {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function fmtDateTime(d: string) {
  const date = new Date(d);
  const day = date.getDate();
  const months = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  return `${day} ${months[date.getMonth()]} à ${fmtTime(d)}`;
}

// Event type → display config
const EVENT_CONFIG: Record<string, { label: string; icon: any; style: "card" | "chip"; color: string }> = {
  // Form
  form_submitted: { label: "Formulaire soumis", icon: FileText, style: "card", color: "amber" },
  // EA
  ea_approved: { label: "EA approuvé", icon: Shield, style: "card", color: "cyan" },
  ea_timer_extended: { label: "Timer EA prolongé", icon: Clock, style: "chip", color: "cyan" },
  // Setting
  setting_contacted_whatsapp: { label: "Contacté sur WhatsApp", icon: MessageCircle, style: "chip", color: "cyan" },
  setting_contacted_email: { label: "Contacté par Email", icon: Mail, style: "chip", color: "amber" },
  setting_contact_reset: { label: "Contact réinitialisé", icon: RotateCcw, style: "chip", color: "gray" },
  setting_debrief_saved: { label: "CR Setting sauvé", icon: FileText, style: "chip", color: "cyan" },
  // Call
  call_booked: { label: "Call réservé", icon: Calendar, style: "card", color: "blue" },
  call_rescheduled: { label: "Call reprogrammé", icon: RotateCcw, style: "card", color: "pink" },
  call_cancelled: { label: "Call annulé", icon: XCircle, style: "card", color: "red" },
  call_done: { label: "Call effectué", icon: Headphones, style: "card", color: "blue" },
  call_no_show: { label: "No-show", icon: UserX, style: "card", color: "red" },
  // Outcome
  outcome_contracted: { label: "Contracté ✓", icon: CheckCircle2, style: "card", color: "violet" },
  outcome_closing_in_progress: { label: "Closing en cours", icon: Loader2, style: "card", color: "amber" },
  outcome_not_closed: { label: "Non closé", icon: XCircle, style: "card", color: "red" },
  outcome_changed: { label: "Issue modifiée", icon: RotateCcw, style: "card", color: "blue" },
  // Payment
  payment_received: { label: "Paiement reçu", icon: CreditCard, style: "card", color: "emerald" },
  // Assignment
  lead_assigned_setter: { label: "Setter assigné", icon: PhoneForwarded, style: "chip", color: "purple" },
  lead_assigned_closer: { label: "Closer assigné", icon: Headphones, style: "chip", color: "violet" },
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/25", text: "text-amber-400", iconBg: "bg-amber-500/20" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/25", text: "text-cyan-400", iconBg: "bg-cyan-500/20" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/25", text: "text-blue-400", iconBg: "bg-blue-500/20" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/25", text: "text-violet-400", iconBg: "bg-violet-500/20" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400", iconBg: "bg-emerald-500/20" },
  red: { bg: "bg-red-500/10", border: "border-red-500/25", text: "text-red-400", iconBg: "bg-red-500/20" },
  pink: { bg: "bg-pink-500/10", border: "border-pink-500/25", text: "text-pink-400", iconBg: "bg-pink-500/20" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/25", text: "text-purple-400", iconBg: "bg-purple-500/20" },
  gray: { bg: "bg-white/[0.04]", border: "border-white/[0.10]", text: "text-white/50", iconBg: "bg-white/[0.08]" },
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "bg-purple-500/15", text: "text-purple-300" },
  super_admin: { bg: "bg-purple-500/15", text: "text-purple-300" },
  setter: { bg: "bg-cyan-500/15", text: "text-cyan-300" },
  closer: { bg: "bg-amber-500/15", text: "text-amber-300" },
};

// ============================================
// ── Main Component ──
// ============================================

export default function LeadThreadPanel({ lead }: { lead: CRMLead }) {
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [comments, setComments] = useState<LeadComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Fetch ──
  const loadThread = async () => {
    setLoading(true);
    const [eventsRes, commentsRes] = await Promise.all([
      supabase.from("lead_events").select("*").eq("request_id", lead.id).order("timestamp", { ascending: true }),
      supabase.from("lead_comments").select("*").eq("request_id", lead.id).order("created_at", { ascending: true }),
    ]);
    setEvents((eventsRes.data || []) as LeadEvent[]);
    setComments((commentsRes.data || []) as LeadComment[]);
    setLoading(false);
  };

  useEffect(() => { loadThread(); }, [lead.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading, events.length, comments.length]);

  // ── Build thread (merge events + comments, sorted by time) ──
  const thread = useMemo(() => {
    const items: ThreadItem[] = [];

    // Add synthetic events from lead data (for backwards compat / when no events table entries exist)
    const eventTypes = new Set(events.map((e) => e.event_type));

    if (!eventTypes.has("form_submitted") && lead.created_at) {
      items.push({ kind: "event", data: { id: "syn-form", event_type: "form_submitted", source: "synthetic", timestamp: lead.created_at, metadata: {}, created_by: null }, time: new Date(lead.created_at) });
    }
    if (!eventTypes.has("ea_approved") && lead.status === "approuvée" && lead.reviewed_at) {
      items.push({ kind: "event", data: { id: "syn-ea", event_type: "ea_approved", source: "synthetic", timestamp: lead.reviewed_at, metadata: {}, created_by: null }, time: new Date(lead.reviewed_at) });
    }
    if (!eventTypes.has("setting_contacted_whatsapp") && !eventTypes.has("setting_contacted_email") && lead.contacted && (lead as any).contacted_at) {
      const type = lead.contact_method === "whatsapp" ? "setting_contacted_whatsapp" : "setting_contacted_email";
      items.push({ kind: "event", data: { id: "syn-contact", event_type: type, source: "synthetic", timestamp: (lead as any).contacted_at, metadata: {}, created_by: null }, time: new Date((lead as any).contacted_at) });
    }
    if (!eventTypes.has("call_booked") && lead.call_booked && lead.call_scheduled_at) {
      items.push({ kind: "event", data: { id: "syn-booked", event_type: "call_booked", source: "synthetic", timestamp: lead.call_scheduled_at, metadata: { start_time: lead.call_scheduled_at }, created_by: null }, time: new Date(lead.call_scheduled_at) });
    }
    if (!eventTypes.has("call_no_show") && lead.call_no_show && lead.call_scheduled_at) {
      const noShowTime = new Date(new Date(lead.call_scheduled_at).getTime() + 5 * 60000);
      items.push({ kind: "event", data: { id: "syn-noshow", event_type: "call_no_show", source: "synthetic", timestamp: noShowTime.toISOString(), metadata: {}, created_by: null }, time: noShowTime });
    }
    if (!eventTypes.has("payment_received") && lead.paid_at) {
      items.push({ kind: "event", data: { id: "syn-paid", event_type: "payment_received", source: "synthetic", timestamp: lead.paid_at, metadata: { amount: lead.paid_amount }, created_by: null }, time: new Date(lead.paid_at) });
    }

    // Add real events
    events.forEach((e) => items.push({ kind: "event", data: e, time: new Date(e.timestamp) }));

    // Add comments
    comments.forEach((c) => items.push({ kind: "comment", data: c, time: new Date(c.created_at) }));

    // Deduplicate synthetic events if real ones exist
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      if (item.kind === "event") {
        const key = item.data.event_type;
        if (item.data.source === "synthetic" && events.some((e) => e.event_type === key)) return false;
        if (seen.has(`${key}-${item.data.id}`)) return false;
        seen.add(`${key}-${item.data.id}`);
      }
      return true;
    });

    return deduped.sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [events, comments, lead]);

  // ── Add comment ──
  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("display_name, first_name").eq("user_id", user.id).single();
      const authorName = profile?.first_name || profile?.display_name || "Admin";

      // Detect role
      const [adminRes, setterRes] = await Promise.all([supabase.rpc("is_admin"), supabase.rpc("is_setter")]);
      const role = adminRes.data ? "admin" : setterRes.data ? "setter" : "admin";

      await supabase.from("lead_comments").insert({
        request_id: lead.id,
        author_id: user.id,
        author_name: authorName,
        author_role: role,
        content: newComment.trim(),
        comment_type: "manual",
      });
      setNewComment("");
      loadThread();
    } catch (err) {
      console.error("Error sending comment:", err);
    } finally {
      setSending(false);
    }
  };

  // ── Render event ──
  const renderEvent = (item: LeadEvent) => {
    const config = EVENT_CONFIG[item.event_type];
    if (!config) return (
      <div key={item.id} className="flex justify-center my-1">
        <span className="text-[9px] text-white/20 font-mono">{item.event_type} · {fmtTime(item.timestamp)}</span>
      </div>
    );

    const colors = COLOR_MAP[config.color] || COLOR_MAP.gray;
    const Icon = config.icon;

    // Chip style (small inline)
    if (config.style === "chip") {
      return (
        <div key={item.id} className="flex justify-center my-1.5">
          <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full border", colors.bg, colors.border)}>
            <Icon className={cn("w-3 h-3", colors.text)} />
            <span className={cn("text-[10px] font-medium", colors.text)}>{config.label}</span>
            {item.metadata?.setter_name && <span className={cn("text-[10px] opacity-70", colors.text)}>· {item.metadata.setter_name}</span>}
            {item.metadata?.closer_name && <span className={cn("text-[10px] opacity-70", colors.text)}>· {item.metadata.closer_name}</span>}
            <span className="text-[9px] text-white/30">· {fmtTime(item.timestamp)}</span>
          </div>
        </div>
      );
    }

    // Card style (large centered)
    return (
      <div key={item.id} className="flex justify-center my-3">
        <div className={cn("rounded-xl border p-4 w-full max-w-sm", colors.bg, colors.border)}>
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-2">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", colors.iconBg)}>
              <Icon className={cn("w-3.5 h-3.5", colors.text)} />
            </div>
            <div>
              <p className={cn("text-xs font-semibold uppercase tracking-wider", colors.text)}>{config.label}</p>
              <p className="text-[9px] text-white/30 font-mono">{fmtDateTime(item.timestamp)}</p>
            </div>
          </div>

          {/* Metadata content */}
          {item.metadata?.start_time && (
            <p className="text-sm text-white/70 font-mono ml-9">
              {fmtDateTime(item.metadata.start_time)}
            </p>
          )}
          {item.metadata?.previous_date && item.metadata?.new_date && (
            <div className="ml-9 text-xs">
              <span className="text-white/40 line-through">{fmtDateTime(item.metadata.previous_date)}</span>
              <span className="text-white/30 mx-1.5">→</span>
              <span className={cn("font-medium", colors.text)}>{fmtDateTime(item.metadata.new_date)}</span>
            </div>
          )}
          {item.metadata?.amount && (
            <p className={cn("text-lg font-bold font-mono ml-9", colors.text)}>
              {Number(item.metadata.amount).toLocaleString("fr-FR")}€
            </p>
          )}
          {item.metadata?.cancellation_reason && (
            <p className="text-xs text-white/40 ml-9 mt-1">{item.metadata.cancellation_reason}</p>
          )}
          {item.metadata?.previous_outcome && item.metadata?.new_outcome && (
            <div className="ml-9 text-xs">
              <span className="text-white/40">{item.metadata.previous_outcome}</span>
              <span className="text-white/30 mx-1.5">→</span>
              <span className={cn("font-medium", colors.text)}>{item.metadata.new_outcome}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render comment ──
  const renderComment = (item: LeadComment) => {
    const roleCls = ROLE_COLORS[item.author_role] || ROLE_COLORS.admin;
    return (
      <div key={item.id} className="flex justify-start my-2 px-2">
        <div className={cn("rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] border border-white/[0.06]", roleCls.bg)}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] font-semibold", roleCls.text)}>{item.author_name}</span>
            <span className="text-[8px] text-white/20 uppercase">{item.author_role}</span>
            <span className="text-[9px] text-white/20 font-mono ml-auto">{fmtTime(item.created_at)}</span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{item.content}</p>
          {item.edited_at && <p className="text-[8px] text-white/15 mt-1">modifié</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-white/40" />
          <span className="text-sm font-medium text-white/70">Timeline</span>
          <span className="text-[10px] text-white/30 font-mono">{thread.length} événements</span>
        </div>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-2 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        ) : thread.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm">
            Aucun événement pour ce lead
          </div>
        ) : (
          <>
            {thread.map((item) =>
              item.kind === "event" ? renderEvent(item.data) : renderComment(item.data)
            )}
          </>
        )}
      </div>

      {/* Comment input */}
      <div className="shrink-0 border-t border-white/[0.08] p-3">
        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ajouter une note..."
            className="flex-1 min-h-[40px] max-h-[100px] bg-white/[0.03] border-white/[0.08] text-sm text-white placeholder:text-white/25 resize-none rounded-xl"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
          />
          <Button
            onClick={handleSendComment}
            disabled={!newComment.trim() || sending}
            className="h-10 w-10 p-0 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-xl shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-primary" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
