import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy, Lock, Star, Loader2, Trash2, Send,
  Paperclip, X, Search, TrendingUp, TrendingDown, ChevronDown, Circle,
  Shield, AtSign, MessageSquare, Award, Hash, Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSignedUrl } from "@/hooks/useSignedUrl";
import { SuccessLeaderboard } from "./SuccessLeaderboard";
import { useSuccessConfetti } from "./SuccessConfetti";
import { usePersonalTrades, PersonalTrade } from "@/hooks/usePersonalTrades";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SuccessEntry {
  id: string;
  user_id: string;
  image_path: string;
  created_at: string;
  display_name?: string;
  avatar_url?: string | null;
  role?: string;
  success_type?: string;
  message?: string;
  linked_trade_id?: string;
  linked_trade?: PersonalTrade | null;
}

interface OnlineUser {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
}

interface AllUser {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
}

const SUCCESS_TYPES = [
  { value: "prop_firm", label: "Prop Firm Validée" },
  { value: "phase_1", label: "Phase 1 Validée" },
  { value: "payout", label: "Payout" },
  { value: "tp", label: "Take Profit" },
  { value: "retrait", label: "Retrait" },
  { value: "checkpoint_data", label: "Checkpoint Data" },
];

const MILESTONES = [
  { count: 1, label: "1er Succès", reward: "Badge Débutant 🏅", visible: true },
  { count: 5, label: "5 Succès", reward: "Confidentiel", visible: false },
  { count: 10, label: "10 Succès", reward: "Confidentiel", visible: false },
  { count: 15, label: "15 Succès", reward: "Confidentiel", visible: false },
  { count: 20, label: "20 Succès", reward: "Confidentiel", visible: false },
  { count: 50, label: "50 Succès", reward: "Confidentiel", visible: false },
];

const getTypeLabel = (value?: string) =>
  SUCCESS_TYPES.find((t) => t.value === value)?.label || value || "";

const ROLE_BADGE_MAP: Record<string, { label: string; className: string; nameColor: string }> = {
  super_admin: { label: "Super Admin", className: "bg-red-500/20 text-red-400 border-red-500/30", nameColor: "text-red-500 dark:text-red-400" },
  admin: { label: "Admin", className: "bg-blue-500/20 text-blue-400 border-blue-500/30", nameColor: "text-blue-600 dark:text-blue-400" },
  member: { label: "Membre", className: "bg-muted text-muted-foreground border-border", nameColor: "text-foreground" },
};

/* ─── User Avatar (Discord L3) ─── */
const UserAvatar = ({ avatarUrl, name, size = "md", statusColor }: {
  avatarUrl?: string | null; name: string; size?: "sm" | "md" | "lg"; statusColor?: string;
}) => {
  const sizes = { sm: "w-6 h-6 text-[9px]", md: "w-8 h-8 text-xs", lg: "w-10 h-10 text-sm" };
  const statusSizes = { sm: "w-2 h-2", md: "w-2.5 h-2.5", lg: "w-3 h-3" };
  const initials = (name || "A").charAt(0).toUpperCase();

  return (
    <div className="relative flex-shrink-0">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name}
          className={cn("rounded-full object-cover ring-1 ring-border/30", sizes[size])} />
      ) : (
        <div className={cn("rounded-full bg-accent flex items-center justify-center ring-1 ring-border/20", sizes[size])}>
          <span className="font-bold text-muted-foreground">{initials}</span>
        </div>
      )}
      {statusColor && (
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 rounded-full border-[2.5px] border-card",
          statusSizes[size],
          statusColor
        )} />
      )}
    </div>
  );
};

/* ─── Trade Picker Popover ─── */
const TradePicker = ({
  trades, selectedTrade, onSelect, onClear,
}: {
  trades: PersonalTrade[];
  selectedTrade: PersonalTrade | null;
  onSelect: (t: PersonalTrade) => void;
  onClear: () => void;
}) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return trades.slice(-30).reverse();
    const q = search.toLowerCase();
    return trades.filter((t) =>
      t.trade_number.toString().includes(q) || t.direction.toLowerCase().includes(q) ||
      t.trade_date.includes(q) || (t.setup_type || "").toLowerCase().includes(q)
    ).reverse().slice(0, 30);
  }, [trades, search]);

  if (selectedTrade) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 border border-primary/20 text-xs">
        <span className="font-semibold text-primary">#{selectedTrade.trade_number}</span>
        <span className={cn("font-medium", selectedTrade.direction === "Long" ? "text-emerald-400" : "text-red-400")}>
          {selectedTrade.direction}
        </span>
        <span className="text-muted-foreground">
          {new Date(selectedTrade.trade_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </span>
        {selectedTrade.rr !== null && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {selectedTrade.rr > 0 ? "+" : ""}{selectedTrade.rr}R
          </Badge>
        )}
        <button onClick={onClear} className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8">
          <Search className="w-3.5 h-3.5" />
          Lier un trade
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-popover" align="start" side="top">
        <div className="p-2 border-b border-border">
          <Input placeholder="Rechercher par n°, direction, date…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucun trade trouvé</p>
          ) : filtered.map((t) => (
            <button key={t.id} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
              onClick={() => { onSelect(t); setOpen(false); setSearch(""); }}>
              <span className="text-xs font-mono font-bold text-foreground w-8">#{t.trade_number}</span>
              {t.direction === "Long" ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
              <span className={cn("text-xs font-medium", t.direction === "Long" ? "text-emerald-400" : "text-red-400")}>{t.direction}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {new Date(t.trade_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </span>
              {t.rr !== null && <Badge variant="secondary" className="text-[10px] px-1 py-0">{t.rr > 0 ? "+" : ""}{t.rr}R</Badge>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* ─── Chat Message (Discord L3) ─── */
const ChatMessage = ({ entry, signedUrl, isOwn, onDelete }: {
  entry: SuccessEntry; signedUrl?: string; isOwn: boolean; onDelete: () => void;
}) => {
  const roleCfg = ROLE_BADGE_MAP[entry.role || "member"] || ROLE_BADGE_MAP.member;
  const isAdminUser = entry.role === "admin" || entry.role === "super_admin";

  const renderMessage = (msg: string) => {
    const parts = msg.split(/(@everyone)/g);
    return parts.map((part, i) =>
      part === "@everyone" ? (
        <span key={i} className="discord-mention-everyone">@everyone</span>
      ) : part
    );
  };

  const hasEveryone = entry.message?.includes("@everyone");

  return (
    <div className={cn(
      "group flex gap-3 sm:gap-4 px-3 sm:px-4 py-1 hover:bg-muted/30 transition-colors relative",
      hasEveryone && "discord-mention-highlight"
    )}>
      <div className="mt-0.5 flex-shrink-0">
        <UserAvatar avatarUrl={entry.avatar_url} name={entry.display_name || "A"} size="lg" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={cn("text-sm font-semibold leading-snug cursor-pointer hover:underline", roleCfg.nameColor)}>
            {entry.display_name || "Anonyme"}
          </span>
          {isAdminUser && (
            <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-3.5 leading-none font-medium border", roleCfg.className)}>
              {ROLE_BADGE_MAP[entry.role || "member"].label}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground/50 font-normal leading-tight select-none">
            {new Date(entry.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à{" "}
            {new Date(entry.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {isOwn && (
            <Button variant="ghost" size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-auto"
              onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>

        {entry.message && (
          <p className="text-[13px] sm:text-sm text-foreground/90 whitespace-pre-wrap break-words leading-[1.375rem]">
            {renderMessage(entry.message)}
          </p>
        )}

        {entry.linked_trade && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border/40 w-fit text-xs mt-1">
            <span className="font-mono font-bold text-foreground">#{entry.linked_trade.trade_number}</span>
            {entry.linked_trade.direction === "Long"
              ? <TrendingUp className="w-3 h-3 text-emerald-400" />
              : <TrendingDown className="w-3 h-3 text-red-400" />}
            <span className={cn("font-medium", entry.linked_trade.direction === "Long" ? "text-emerald-400" : "text-red-400")}>
              {entry.linked_trade.direction}
            </span>
            {entry.linked_trade.rr !== null && (
              <span className={cn("font-mono font-bold", entry.linked_trade.rr >= 0 ? "text-emerald-400" : "text-red-400")}>
                {entry.linked_trade.rr > 0 ? "+" : ""}{entry.linked_trade.rr}R
              </span>
            )}
          </div>
        )}

        {signedUrl && (
          <div className="mt-1.5">
            <img src={signedUrl} alt="Succès"
              className="rounded-lg object-contain max-h-[280px] sm:max-h-[360px] max-w-full sm:max-w-md w-auto border border-border/30 cursor-pointer hover:brightness-110 transition-all shadow-sm"
              loading="lazy" onClick={() => window.open(signedUrl, "_blank")} />
          </div>
        )}

        {entry.success_type && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal mt-0.5">
            {getTypeLabel(entry.success_type)}
          </Badge>
        )}
      </div>
    </div>
  );
};

/* ─── Discord-style Member Sidebar (L3) ─── */
const MemberSidebar = ({ myCount, onlineUsers, allUsers, isAdmin }: {
  myCount: number;
  onlineUsers: OnlineUser[];
  allUsers: AllUser[];
  isAdmin: boolean;
}) => {
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const currentMilestoneIndex = MILESTONES.findIndex((m) => myCount < m.count);
  const nextMilestone = currentMilestoneIndex >= 0 ? MILESTONES[currentMilestoneIndex] : null;
  const prevMilestoneCount = currentMilestoneIndex > 0 ? MILESTONES[currentMilestoneIndex - 1].count : 0;
  const progressPercent = nextMilestone
    ? ((myCount - prevMilestoneCount) / (nextMilestone.count - prevMilestoneCount)) * 100
    : 100;

  const onlineUserIds = new Set(onlineUsers.map((u) => u.user_id));
  const offlineUsers = allUsers.filter((u) => !onlineUserIds.has(u.user_id));

  return (
    <div className="h-full flex flex-col bg-card/30">
      {/* Progression */}
      <div className="px-3 pt-4 pb-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Progression</span>
          <span className="text-[10px] font-mono text-muted-foreground">{myCount}</span>
        </div>
        <div className="relative h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(progressPercent, 100)}%` }} />
        </div>
        {nextMilestone && (
          <p className="text-[9px] text-muted-foreground">
            → {nextMilestone.label} ({nextMilestone.count - myCount} restants)
          </p>
        )}
        <Collapsible open={milestonesOpen} onOpenChange={setMilestonesOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors w-full">
            <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", milestonesOpen && "rotate-180")} />
            <span>Paliers</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-0.5 pt-1">
              {MILESTONES.map((m) => {
                const unlocked = myCount >= m.count;
                return (
                  <div key={m.count} className={cn(
                    "flex items-center gap-1.5 px-1 py-0.5 rounded text-[9px]",
                    unlocked ? "text-yellow-500" : "text-muted-foreground"
                  )}>
                    {unlocked ? <Star className="w-2 h-2 fill-yellow-500" /> : <Lock className="w-2 h-2" />}
                    <span>{m.label}</span>
                    <span className="ml-auto">{m.visible || unlocked ? m.reward : "🔒"}</span>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="border-t border-border/30 mx-2" />

      {/* Members list — Discord L3 */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pt-3 pb-2 space-y-4">
        {/* Online section */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] px-1.5 mb-2">
            En ligne — {onlineUsers.length}
          </p>
          <div className="space-y-px">
            {onlineUsers.map((u) => (
              <div key={u.user_id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors cursor-default group/member">
                <UserAvatar avatarUrl={u.avatar_url} name={u.display_name} size="sm" statusColor="bg-emerald-500" />
                <span className="text-[13px] font-medium text-muted-foreground group-hover/member:text-foreground truncate transition-colors">{u.display_name}</span>
              </div>
            ))}
            {onlineUsers.length === 0 && (
              <p className="text-[10px] text-muted-foreground/40 italic px-2 py-2">Personne en ligne</p>
            )}
          </div>
        </div>

        {/* Offline section — admin only */}
        {isAdmin && offlineUsers.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em] px-1.5 mb-2">
              Hors ligne — {offlineUsers.length}
            </p>
            <div className="space-y-px">
              {offlineUsers.map((u) => (
                <div key={u.user_id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors cursor-default opacity-30 hover:opacity-60 group/member">
                  <UserAvatar avatarUrl={u.avatar_url} name={u.display_name} size="sm" statusColor="bg-muted-foreground" />
                  <span className="text-[13px] font-medium text-muted-foreground truncate">{u.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Page ─── */
const SuccessPage = () => {
  const [successes, setSuccesses] = useState<SuccessEntry[]>([]);
  const [myCount, setMyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [selectedType, setSelectedType] = useState("tp");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<PersonalTrade | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("member");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [activeView, setActiveView] = useState<"discussion" | "leaderboard">("discussion");
  const [showMembers, setShowMembers] = useState(true);
  const { fireConfetti } = useSuccessConfetti();
  const { trades: personalTrades } = usePersonalTrades();
  const isAdmin = userRole === "admin" || userRole === "super_admin";

  const scrollToBottom = () => { feedEndRef.current?.scrollIntoView({ behavior: "smooth" }); };

  // Init + presence
  useEffect(() => {
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      fetchSuccesses(user.id);

      const { data: roleData } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).single();
      if (roleData) setUserRole(roleData.role);

      const { data: profile } = await supabase
        .from("profiles").select("display_name, avatar_url").eq("user_id", user.id).single();

      const { data: allProfiles } = await supabase
        .from("profiles").select("user_id, display_name, avatar_url");
      if (allProfiles) {
        setAllUsers(allProfiles.map((p: any) => ({
          user_id: p.user_id,
          display_name: p.display_name || "Anonyme",
          avatar_url: p.avatar_url,
        })));
      }

      const displayName = profile?.display_name || "Anonyme";
      const avatarUrl = (profile as any)?.avatar_url || null;

      presenceChannel = supabase.channel("online_users", {
        config: { presence: { key: user.id } },
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel!.presenceState();
          const users: OnlineUser[] = [];
          for (const [uid, presences] of Object.entries(state)) {
            const p = (presences as any[])[0];
            users.push({ user_id: uid, display_name: p?.display_name || "Anonyme", avatar_url: p?.avatar_url });
          }
          setOnlineUsers(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel!.track({ display_name: displayName, avatar_url: avatarUrl, online_at: new Date().toISOString() });
          }
        });
    };
    init();

    const channel = supabase
      .channel("successes_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_successes" }, () => {
        if (userId) fetchSuccesses(userId);
      })
      .subscribe();

    const notifChannel = supabase
      .channel("my_notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_notifications" }, (payload) => {
        const row = payload.new as any;
        if (row.type === "mention") {
          toast.info(row.message, { duration: 5000 });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(notifChannel);
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
  }, []);

  useEffect(() => { if (!loading) scrollToBottom(); }, [successes, loading]);

  const fetchSuccesses = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_successes").select("*").order("created_at", { ascending: true });

    if (error) { console.error(error); setLoading(false); return; }

    const userIds = [...new Set((data || []).map((s) => s.user_id))];
    let profileMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
    let roleMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      ]);
      if (profilesRes.data) {
        profileMap = Object.fromEntries(
          profilesRes.data.map((p: any) => [p.user_id, { display_name: p.display_name || "Anonyme", avatar_url: p.avatar_url }])
        );
      }
      if (rolesRes.data) {
        roleMap = Object.fromEntries(rolesRes.data.map((r) => [r.user_id, r.role]));
      }
    }

    const linkedTradeIds = (data || []).map((s) => (s as any).linked_trade_id).filter(Boolean);
    let tradeMap: Record<string, PersonalTrade> = {};
    if (linkedTradeIds.length > 0) {
      const { data: linkedTrades } = await supabase.from("user_personal_trades").select("*").in("id", linkedTradeIds);
      if (linkedTrades) tradeMap = Object.fromEntries(linkedTrades.map((t) => [t.id, t as PersonalTrade]));
    }

    const enriched: SuccessEntry[] = (data || []).map((s: any) => ({
      ...s,
      display_name: profileMap[s.user_id]?.display_name || "Anonyme",
      avatar_url: profileMap[s.user_id]?.avatar_url || null,
      role: roleMap[s.user_id] || "member",
      linked_trade: s.linked_trade_id ? tradeMap[s.linked_trade_id] || null : null,
    }));

    setSuccesses(enriched);
    setMyCount(enriched.filter((s) => s.user_id === uid).length);

    const urls: Record<string, string> = {};
    await Promise.all(
      enriched.map(async (s) => {
        if (s.image_path && !s.image_path.includes("no-image")) {
          const url = await getSignedUrl(s.image_path, "success-screenshots");
          if (url) urls[s.id] = url;
        }
      })
    );
    setSignedUrls(urls);
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Seules les images sont acceptées."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("L'image dépasse 5 Mo."); return; }
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendEveryoneNotification = useCallback(async (senderName: string) => {
    const { data: profiles } = await supabase
      .from("profiles").select("user_id").eq("status", "active");
    if (!profiles) return;
    const notifs = profiles
      .filter((p) => p.user_id !== userId)
      .map((p) => ({
        user_id: p.user_id, sender_id: userId, type: "mention",
        message: `📢 ${senderName} a mentionné @everyone dans les Succès !`,
      }));
    if (notifs.length > 0) {
      await supabase.from("user_notifications").insert(notifs as any);
    }
  }, [userId]);

  const handleSend = async () => {
    if (!userId) return;
    if (!selectedFile && !message.trim() && !selectedTrade) {
      toast.error("Ajoutez un message ou une image."); return;
    }
    setUploading(true);
    let imagePath = "";

    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("success-screenshots").upload(filePath, selectedFile);
      if (uploadError) { toast.error(`Erreur upload: ${uploadError.message}`); setUploading(false); return; }
      imagePath = filePath;
    }

    if (!imagePath) {
      imagePath = `${userId}/no-image-${Date.now()}.txt`;
      const { error: uploadError } = await supabase.storage.from("success-screenshots").upload(imagePath, new Blob(["no-image"], { type: "text/plain" }));
      if (uploadError) { toast.error("Veuillez ajouter une image."); setUploading(false); return; }
    }

    const { error: insertError } = await supabase
      .from("user_successes")
      .insert({
        user_id: userId, image_path: imagePath, success_type: selectedType,
        message: message.trim() || null, linked_trade_id: selectedTrade?.id || null,
      } as any);

    if (insertError) { toast.error(`Erreur: ${insertError.message}`); setUploading(false); return; }

    if (message.includes("@everyone")) {
      const { data: myProfile } = await supabase.from("profiles").select("display_name").eq("user_id", userId).single();
      sendEveryoneNotification(myProfile?.display_name || "Quelqu'un");
    }

    toast.success("Succès partagé !");
    fireConfetti();
    setMessage("");
    clearFile();
    setSelectedTrade(null);
    fetchSuccesses(userId);
    setUploading(false);
  };

  const handleDelete = async (successId: string, imagePath: string) => {
    const { error } = await supabase.from("user_successes").delete().eq("id", successId);
    if (error) { toast.error("Erreur suppression"); return; }
    await supabase.storage.from("success-screenshots").remove([imagePath]);
    toast.success("Succès supprimé");
    if (userId) fetchSuccesses(userId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const insertMention = () => { setMessage((prev) => prev + "@everyone "); };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ─── Discord Top Bar ─── */}
      <div className="flex items-center h-12 px-3 sm:px-4 border-b border-border bg-card/80 flex-shrink-0 gap-2 backdrop-blur-sm">
        <Hash className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <div className="flex items-center gap-0.5 min-w-0">
          <button
            onClick={() => setActiveView("discussion")}
            className={cn(
              "px-2.5 py-1 rounded-md text-sm font-semibold transition-all",
              activeView === "discussion"
                ? "text-foreground bg-muted/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            Discussion
          </button>
          <button
            onClick={() => setActiveView("leaderboard")}
            className={cn(
              "px-2.5 py-1 rounded-md text-sm font-semibold transition-all",
              activeView === "leaderboard"
                ? "text-foreground bg-muted/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            Leaderboard
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] font-mono hidden sm:flex">{successes.length} msg</Badge>
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              showMembers ? "text-foreground bg-muted/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
            title="Membres"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Content area: fills remaining height ─── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Center column */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {activeView === "discussion" ? (
            <>
              {/* Chat feed — takes ALL available space, pushes composer to bottom */}
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : successes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
                    <Trophy className="w-12 h-12 mb-4 opacity-15" />
                    <p className="text-sm font-medium">Aucun succès partagé</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Soyez le premier à partager !</p>
                  </div>
                ) : (
                  <div className="py-2">
                    {successes.map((s) => (
                      <ChatMessage key={s.id} entry={s} signedUrl={signedUrls[s.id]} isOwn={s.user_id === userId}
                        onDelete={() => handleDelete(s.id, s.image_path)} />
                    ))}
                  </div>
                )}
                <div ref={feedEndRef} />
              </div>

              {/* ─── Composer — pinned to bottom ─── */}
              <div className="flex-shrink-0 px-2 sm:px-4 pb-2 sm:pb-4 pt-1">
                {(filePreview || selectedTrade) && (
                  <div className="flex items-start gap-2 mb-2 flex-wrap px-1">
                    {filePreview && (
                      <div className="relative">
                        <img src={filePreview} alt="Preview" className="h-16 sm:h-20 w-auto rounded-lg border border-border object-cover" />
                        <button onClick={clearFile} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {selectedTrade && (
                      <TradePicker trades={personalTrades} selectedTrade={selectedTrade} onSelect={setSelectedTrade} onClear={() => setSelectedTrade(null)} />
                    )}
                  </div>
                )}

                <div className="flex items-end gap-1.5 sm:gap-2 bg-muted/40 border border-border/60 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 transition-colors focus-within:border-muted-foreground/30">
                  <div className="flex gap-0.5 flex-shrink-0 pb-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  </div>

                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Envoyer un message dans #chatroom"
                    className="flex-1 min-h-[36px] max-h-28 resize-none bg-transparent border-none text-sm placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0 p-1" rows={1} />

                  <div className="flex gap-0.5 flex-shrink-0 pb-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={insertMention} title="@everyone">
                      <AtSign className="w-4 h-4" />
                    </Button>
                    <Button onClick={handleSend} disabled={uploading || (!selectedFile && !message.trim() && !selectedTrade)}
                      size="icon" className="h-8 w-8 flex-shrink-0">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1 px-1 flex-wrap">
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="h-6 w-auto text-[10px] bg-transparent border-border/50 gap-1 px-2"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {SUCCESS_TYPES.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!selectedTrade && (
                    <TradePicker trades={personalTrades} selectedTrade={selectedTrade} onSelect={setSelectedTrade} onClear={() => setSelectedTrade(null)} />
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ─── Leaderboard View ─── */
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
              <SuccessLeaderboard />
            </div>
          )}
        </div>

        {/* ─── Right sidebar — full height, Discord L3 ─── */}
        {showMembers && (
          <div className="hidden md:flex w-56 lg:w-60 border-l border-border bg-secondary/30 flex-col overflow-hidden flex-shrink-0">
            <MemberSidebar myCount={myCount} onlineUsers={onlineUsers} allUsers={allUsers} isAdmin={isAdmin} />
          </div>
        )}
      </div>
    </div>
  );
};

export { SuccessPage };
