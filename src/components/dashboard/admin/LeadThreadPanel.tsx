// ============================================
// Lead Thread Panel — spike-launch exact timeline
// Date separators, centered cards, chat bubbles
// ============================================

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, MessageCircle, Mail, Calendar, Phone, XCircle,
  CheckCircle2, UserX, RotateCcw, CreditCard, Loader2,
  Send, Clock, PhoneForwarded, Headphones, Shield,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CRMLead } from "@/lib/admin/types";
import { useUserRoles } from "@/hooks/useUserRoles";

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

// ── Date formatting ──

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function fmtTime(d: string) {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function fmtDayMonth(d: string) {
  const date = new Date(d);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function fmtFullTimestamp(d: string) {
  return `${fmtDayMonth(d)} à ${fmtTime(d)}`;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dateSeparatorLabel(d: Date) {
  const now = new Date();
  const today = dateKey(now);
  const yesterday = dateKey(new Date(now.getTime() - 86400000));
  const key = dateKey(d);
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return "Hier";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// ── Event config ──

const EVENT_CONFIG: Record<string, { label: string; icon: any; style: "card" | "chip" | "debrief"; color: string }> = {
  form_submitted:              { label: "Formulaire soumis",    icon: FileText,      style: "card",  color: "amber" },
  funnel_resubmitted:          { label: "Form re-soumis",       icon: RotateCcw,     style: "card",  color: "amber" },
  ea_approved:                 { label: "EA approuvé",          icon: Shield,        style: "card",  color: "cyan" },
  ea_timer_extended:           { label: "Timer prolongé",       icon: Clock,         style: "chip",  color: "cyan" },
  setting_contacted_whatsapp:  { label: "Contacté sur WhatsApp",icon: MessageCircle, style: "chip",  color: "cyan" },
  setting_contacted_email:     { label: "Contacté par Email",   icon: Mail,          style: "chip",  color: "amber" },
  setting_contact_reset:       { label: "Contact réinitialisé", icon: RotateCcw,     style: "chip",  color: "gray" },
  setting_debrief_saved:       { label: "CR Setting créé",      icon: FileText,      style: "chip",  color: "cyan" },
  setting_responded:           { label: "A répondu",            icon: CheckCircle2,  style: "chip",  color: "emerald" },
  call_booked:                 { label: "Call réservé",         icon: Calendar,      style: "card",  color: "blue" },
  call_rescheduled:            { label: "Call reprogrammé",     icon: RotateCcw,     style: "card",  color: "pink" },
  call_cancelled:              { label: "Call annulé",          icon: XCircle,       style: "card",  color: "red" },
  call_done:                   { label: "Call effectué",        icon: Headphones,    style: "card",  color: "blue" },
  call_no_show:                { label: "No-show",              icon: UserX,         style: "card",  color: "red" },
  outcome_contracted:          { label: "Contracté ✓",         icon: CheckCircle2,  style: "card",  color: "violet" },
  outcome_closing_in_progress: { label: "Closing en cours",     icon: Loader2,       style: "card",  color: "amber" },
  outcome_not_closed:          { label: "Non closé",            icon: XCircle,       style: "card",  color: "red" },
  outcome_changed:             { label: "Issue modifiée",       icon: RotateCcw,     style: "card",  color: "blue" },
  payment_received:            { label: "Paiement reçu",        icon: CreditCard,    style: "card",  color: "emerald" },
  lead_assigned_setter:        { label: "Setter assigné",       icon: PhoneForwarded,style: "chip",  color: "purple" },
  lead_assigned_closer:        { label: "Closer assigné",       icon: Headphones,    style: "chip",  color: "violet" },
  lead_created_from_webhook:   { label: "Call booké sans form", icon: Calendar,      style: "card",  color: "gray" },
  funnel_lead_fallback_recovered: { label: "Lead récupéré (filet)", icon: Shield,    style: "chip",  color: "gray" },
  setting_call_recap_saved:    { label: "Récap call opt-in",    icon: FileText,      style: "chip",  color: "purple" },
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/25",   text: "text-amber-400",   iconBg: "bg-amber-500/20" },
  cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/25",    text: "text-cyan-400",    iconBg: "bg-cyan-500/20" },
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400",    iconBg: "bg-blue-500/20" },
  violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/25",  text: "text-violet-400",  iconBg: "bg-violet-500/20" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400", iconBg: "bg-emerald-500/20" },
  red:     { bg: "bg-red-500/10",     border: "border-red-500/25",     text: "text-red-400",     iconBg: "bg-red-500/20" },
  pink:    { bg: "bg-pink-500/10",    border: "border-pink-500/25",    text: "text-pink-400",    iconBg: "bg-pink-500/20" },
  purple:  { bg: "bg-purple-500/10",  border: "border-purple-500/25",  text: "text-purple-400",  iconBg: "bg-purple-500/20" },
  gray:    { bg: "bg-white/[0.04]",   border: "border-white/[0.10]",   text: "text-white/50",    iconBg: "bg-white/[0.08]" },
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:       { bg: "bg-purple-500/15", text: "text-purple-300" },
  super_admin: { bg: "bg-purple-500/15", text: "text-purple-300" },
  setter:      { bg: "bg-cyan-500/15",   text: "text-cyan-300" },
  closer:      { bg: "bg-amber-500/15",  text: "text-amber-300" },
};

// ============================================

export default function LeadThreadPanel({ lead }: { lead: CRMLead }) {
  const { state } = useUserRoles();
  const isAdmin = state.status === "ready" && (state.data.isAdmin || state.data.isSuperAdmin);
  const isSetter = state.status === "ready" && state.data.isSetter;

  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [comments, setComments] = useState<LeadComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Antifragile: if lead_events / lead_comments don't exist yet (pre-migration env),
  // just show an empty thread instead of crashing.
  const loadThread = async () => {
    setLoading(true);
    try {
      const [eventsRes, commentsRes] = await Promise.all([
        supabase.from("lead_events").select("*").eq("request_id", lead.id).order("timestamp", { ascending: true }),
        supabase.from("lead_comments").select("*").eq("request_id", lead.id).order("created_at", { ascending: true }),
      ]);
      setEvents((eventsRes.data || []) as LeadEvent[]);
      setComments((commentsRes.data || []) as LeadComment[]);
    } catch (err) {
      console.warn("[ThreadPanel] loadThread failed (non-blocking):", err);
      setEvents([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadThread(); }, [lead.id]);

  useEffect(() => {
    if (!loading && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [loading, events.length, comments.length]);

  // ── Build thread ──
  const thread = useMemo(() => {
    const items: ThreadItem[] = [];
    const eventTypes = new Set(events.map(e => e.event_type));

    // Synthetic events from lead fields
    if (!eventTypes.has("form_submitted") && lead.form_submitted && lead.created_at)
      items.push({ kind: "event", data: { id: "syn-form", event_type: "form_submitted", source: "synthetic", timestamp: lead.created_at, metadata: {}, created_by: null }, time: new Date(lead.created_at) });
    if (!eventTypes.has("lead_created_from_webhook") && !lead.form_submitted && lead.call_booked && lead.created_at)
      items.push({ kind: "event", data: { id: "syn-webhook", event_type: "lead_created_from_webhook", source: "synthetic", timestamp: lead.created_at, metadata: {}, created_by: null }, time: new Date(lead.created_at) });
    if (!eventTypes.has("ea_approved") && lead.status === "approuvée" && lead.reviewed_at)
      items.push({ kind: "event", data: { id: "syn-ea", event_type: "ea_approved", source: "synthetic", timestamp: lead.reviewed_at, metadata: {}, created_by: null }, time: new Date(lead.reviewed_at) });
    if (!eventTypes.has("setting_contacted_whatsapp") && !eventTypes.has("setting_contacted_email") && lead.contacted && (lead as any).contacted_at) {
      const type = lead.contact_method === "whatsapp" ? "setting_contacted_whatsapp" : "setting_contacted_email";
      items.push({ kind: "event", data: { id: "syn-contact", event_type: type, source: "synthetic", timestamp: (lead as any).contacted_at, metadata: {}, created_by: null }, time: new Date((lead as any).contacted_at) });
    }
    if (!eventTypes.has("call_booked") && lead.call_booked && lead.call_scheduled_at)
      items.push({ kind: "event", data: { id: "syn-booked", event_type: "call_booked", source: "synthetic", timestamp: lead.call_scheduled_at, metadata: { start_time: lead.call_scheduled_at }, created_by: null }, time: new Date(lead.call_scheduled_at) });
    if (!eventTypes.has("call_no_show") && lead.call_no_show && lead.call_scheduled_at) {
      const t = new Date(new Date(lead.call_scheduled_at).getTime() + 5 * 60000);
      items.push({ kind: "event", data: { id: "syn-noshow", event_type: "call_no_show", source: "synthetic", timestamp: t.toISOString(), metadata: {}, created_by: null }, time: t });
    }
    if (!eventTypes.has("payment_received") && lead.paid_at)
      items.push({ kind: "event", data: { id: "syn-paid", event_type: "payment_received", source: "synthetic", timestamp: lead.paid_at, metadata: { amount: lead.paid_amount }, created_by: null }, time: new Date(lead.paid_at) });

    events.forEach(e => items.push({ kind: "event", data: e, time: new Date(e.timestamp) }));
    comments.forEach(c => items.push({ kind: "comment", data: c, time: new Date(c.created_at) }));

    const seen = new Set<string>();
    return items.filter(item => {
      if (item.kind === "event") {
        const key = item.data.event_type;
        if (item.data.source === "synthetic" && events.some(e => e.event_type === key)) return false;
        if (seen.has(`${key}-${item.data.id}`)) return false;
        seen.add(`${key}-${item.data.id}`);
      }
      return true;
    }).sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [events, comments, lead]);

  const noteCount = comments.length;
  const eventCount = events.length + thread.filter(t => t.kind === "event" && t.data.source === "synthetic").length;

  // ── Send comment ──
  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("display_name, first_name").eq("user_id", user.id).single();
      const authorName = profile?.first_name || profile?.display_name || "Admin";
      const role = isAdmin ? "admin" : isSetter ? "setter" : "admin";
      await supabase.from("lead_comments").insert({
        request_id: lead.id, author_id: user.id, author_name: authorName, author_role: role,
        content: newComment.trim(), comment_type: "manual",
      });
      setNewComment("");
      loadThread();
    } catch (err) { console.error("Error sending comment:", err); }
    finally { setSending(false); }
  };

  // ── Render ──

  const renderDateSeparator = (label: string) => (
    <div className="flex justify-center my-3">
      <span className="px-3 py-1 rounded-full bg-white/[0.06] text-[10px] font-display text-white/40 tracking-wider">
        {label}
      </span>
    </div>
  );

  const renderEvent = (item: LeadEvent) => {
    const config = EVENT_CONFIG[item.event_type];
    if (!config) return (
      <div key={item.id} className="flex justify-center my-1">
        <span className="text-[9px] text-white/20 font-mono">{item.event_type} · {fmtTime(item.timestamp)}</span>
      </div>
    );

    const c = COLOR_MAP[config.color] || COLOR_MAP.gray;
    const Icon = config.icon;

    // ── Chip ──
    if (config.style === "chip") {
      return (
        <div key={item.id} className="flex justify-center my-1.5">
          <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border", c.bg, c.border)}>
            <Icon className={cn("w-3 h-3", c.text)} />
            <span className={cn("text-[11px] font-display font-semibold", c.text)}>{config.label}</span>
            {item.metadata?.setter_name && <span className={cn("text-[10px] font-display opacity-70", c.text)}>· {item.metadata.setter_name}</span>}
            <span className="text-[9px] text-white/30 font-mono">· {fmtFullTimestamp(item.timestamp)}</span>
          </div>
        </div>
      );
    }

    // ── Card ──
    return (
      <div key={item.id} className="flex justify-center my-2.5">
        <div className={cn("rounded-xl border px-5 py-4 w-full max-w-[280px] text-center", c.bg, c.border)}>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", c.iconBg)}>
              <Icon className={cn("w-3 h-3", c.text)} />
            </div>
            <span className={cn("text-[11px] font-display font-bold uppercase tracking-wider", c.text)}>{config.label}</span>
          </div>
          <p className="text-sm font-display font-bold text-white">{fmtFullTimestamp(item.timestamp)}</p>

          {/* Extra metadata */}
          {item.metadata?.start_time && item.metadata.start_time !== item.timestamp && (
            <p className="text-[10px] text-white/40 font-display mt-1">réservé le {fmtFullTimestamp(item.metadata.start_time)}</p>
          )}
          {item.metadata?.amount && (
            <p className={cn("text-xl font-display font-bold mt-1", c.text)}>
              {Number(item.metadata.amount).toLocaleString("fr-FR")}€
            </p>
          )}
          {item.metadata?.previous_outcome && item.metadata?.new_outcome && (
            <p className="text-[10px] font-display mt-1">
              <span className="text-white/40">{item.metadata.previous_outcome}</span>
              <span className="text-white/30 mx-1">→</span>
              <span className={cn("font-semibold", c.text)}>{item.metadata.new_outcome}</span>
            </p>
          )}
          {item.metadata?.cancellation_reason && (
            <p className="text-[10px] text-white/40 font-display mt-1">{item.metadata.cancellation_reason}</p>
          )}
        </div>
      </div>
    );
  };

  const renderComment = (item: LeadComment) => {
    const roleCls = ROLE_COLORS[item.author_role] || ROLE_COLORS.admin;
    const isDebrief = item.comment_type === "setting_notes" || item.comment_type === "closing_debrief";
    const debriefColor = item.comment_type === "setting_notes" ? "cyan" : "amber";

    if (isDebrief) {
      return (
        <div key={item.id} className="my-3 mx-2">
          <div className={cn("rounded-xl border p-4",
            debriefColor === "cyan"
              ? "bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 border-cyan-500/25"
              : "bg-gradient-to-br from-amber-500/15 to-amber-600/5 border-amber-500/25"
          )}>
            <p className={cn("text-[10px] font-display uppercase tracking-wider mb-1",
              debriefColor === "cyan" ? "text-cyan-300" : "text-amber-300"
            )}>
              {item.comment_type === "setting_notes" ? "Compte-rendu Setting" : "Débrief Closing"}
            </p>
            <p className="text-[10px] text-white/30 font-display mb-2">· par {item.author_name}</p>
            <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">{item.content}</p>
          </div>
        </div>
      );
    }

    return (
      <div key={item.id} className="flex justify-start my-2 px-2">
        <div className={cn("rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] border border-white/[0.06]", roleCls.bg)}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[11px] font-display font-semibold", roleCls.text)}>{item.author_name}</span>
            <span className="text-[8px] font-display text-white/20 uppercase tracking-wider">{item.author_role}</span>
            <span className="text-[9px] text-white/25 font-mono ml-auto">{fmtTime(item.created_at)}</span>
          </div>
          <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">{item.content}</p>
          {item.edited_at && <p className="text-[8px] text-white/15 mt-1 font-display">modifié</p>}
        </div>
      </div>
    );
  };

  // ── Group items by date for separators ──
  const renderThread = () => {
    let lastDateKey = "";
    return thread.map((item) => {
      const dk = dateKey(item.time);
      const showSeparator = dk !== lastDateKey;
      lastDateKey = dk;
      return (
        <div key={item.kind === "event" ? item.data.id : item.data.id}>
          {showSeparator && renderDateSeparator(dateSeparatorLabel(item.time))}
          {item.kind === "event" ? renderEvent(item.data) : renderComment(item.data)}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.08] flex items-center gap-3">
        <Clock className="w-4 h-4 text-white/40" />
        <span className="text-sm font-display font-semibold text-white">Timeline</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] font-display text-white/30 px-2 py-0.5 rounded bg-white/[0.04]">{noteCount} notes</span>
          <span className="text-[10px] font-display text-white/30 px-2 py-0.5 rounded bg-white/[0.04]">{eventCount} events</span>
        </div>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-2 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        ) : thread.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm font-display">
            Aucun événement
          </div>
        ) : renderThread()}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/[0.08] p-3 space-y-1">
        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Écrire un message..."
            className="flex-1 min-h-[44px] max-h-[120px] bg-white/[0.05] border-white/[0.08] text-[13px] text-white placeholder:text-white/25 resize-none rounded-xl font-display"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSendComment(); } }}
          />
          <button
            onClick={handleSendComment}
            disabled={!newComment.trim() || sending}
            className="h-10 w-10 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.10] rounded-xl shrink-0 transition-colors disabled:opacity-30"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin text-white/30" /> : <Send className="w-4 h-4 text-white/50" />}
          </button>
        </div>
        <p className="text-[9px] text-white/15 text-center font-display">⌘ + Entrée pour envoyer</p>
      </div>
    </div>
  );
}
