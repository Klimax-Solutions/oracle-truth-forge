import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy, Lock, Star, Loader2, Trash2, Send,
  Paperclip, X, Search, TrendingUp, TrendingDown, ChevronDown, Circle,
  Shield, AtSign, MessageSquare, Award,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  super_admin: { label: "Super Admin", className: "bg-red-500/20 text-red-400 border-red-500/30", nameColor: "text-red-400" },
  admin: { label: "Admin", className: "bg-blue-500/20 text-blue-400 border-blue-500/30", nameColor: "text-blue-400" },
  member: { label: "Membre", className: "bg-muted text-muted-foreground border-border", nameColor: "text-foreground" },
};

/* ─── User Avatar ─── */
const UserAvatar = ({ avatarUrl, name, size = "md" }: { avatarUrl?: string | null; name: string; size?: "sm" | "md" | "lg" }) => {
  const sizes = { sm: "w-6 h-6 text-[9px]", md: "w-9 h-9 text-sm", lg: "w-10 h-10 text-sm" };
  const initials = (name || "A").charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn("rounded-full object-cover flex-shrink-0", sizes[size])}
      />
    );
  }

  return (
    <div className={cn("rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0", sizes[size])}>
      <span className="font-bold text-primary">{initials}</span>
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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
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

/* ─── Chat Message ─── */
const ChatMessage = ({ entry, signedUrl, isOwn, onDelete }: {
  entry: SuccessEntry; signedUrl?: string; isOwn: boolean; onDelete: () => void;
}) => {
  const roleCfg = ROLE_BADGE_MAP[entry.role || "member"] || ROLE_BADGE_MAP.member;
  const isAdmin = entry.role === "admin" || entry.role === "super_admin";

  // Render message with @everyone highlighted — Discord yellow style
  const renderMessage = (msg: string) => {
    const parts = msg.split(/(@everyone)/g);
    return parts.map((part, i) =>
      part === "@everyone" ? (
        <span key={i} className="bg-yellow-500/20 text-yellow-300 px-1 rounded font-semibold cursor-pointer hover:bg-yellow-500/30 transition-colors">@everyone</span>
      ) : part
    );
  };

  // Check if message contains @everyone for row highlight
  const hasEveryone = entry.message?.includes("@everyone");

  return (
    <div className={cn(
      "group flex gap-3 px-4 py-2 hover:bg-muted/30 transition-colors",
      hasEveryone && "bg-yellow-500/[0.06] border-l-2 border-yellow-500/40"
    )}>
      <div className="mt-0.5 flex-shrink-0">
        <UserAvatar avatarUrl={entry.avatar_url} name={entry.display_name || "A"} size="lg" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={cn("text-sm font-semibold", roleCfg.nameColor)}>
            {entry.display_name || "Anonyme"}
          </span>
          {isAdmin && <Shield className="w-3 h-3 text-red-400 self-center" />}
          <span className="text-[10px] text-muted-foreground">
            {new Date(entry.created_at).toLocaleTimeString("fr-FR", {
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
          {isOwn && (
            <Button variant="ghost" size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-auto"
              onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>

        {entry.linked_trade && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border w-fit text-xs">
            <span className="font-mono font-bold text-foreground">#{entry.linked_trade.trade_number}</span>
            {entry.linked_trade.direction === "Long"
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
            <span className={cn("font-medium", entry.linked_trade.direction === "Long" ? "text-emerald-400" : "text-red-400")}>
              {entry.linked_trade.direction}
            </span>
            {entry.linked_trade.setup_type && <span className="text-muted-foreground">· {entry.linked_trade.setup_type}</span>}
            {entry.linked_trade.rr !== null && (
              <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", entry.linked_trade.rr >= 0 ? "text-emerald-400" : "text-red-400")}>
                {entry.linked_trade.rr > 0 ? "+" : ""}{entry.linked_trade.rr}R
              </Badge>
            )}
          </div>
        )}

        {entry.message && (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
            {renderMessage(entry.message)}
          </p>
        )}

        {signedUrl && (
          <div className="mt-1.5 max-w-sm sm:max-w-md">
            <img src={signedUrl} alt="Succès"
              className="rounded-lg object-contain max-h-[350px] w-auto border border-border cursor-pointer hover:brightness-110 transition"
              loading="lazy" onClick={() => window.open(signedUrl, "_blank")} />
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Right Sidebar ─── */
const RightSidebar = ({ myCount, onlineUsers, allUsers, isAdmin }: {
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
    <div className="space-y-4">
      {/* Progression — collapsible milestones */}
      <div className="border border-border bg-card rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Progression</span>
          <span className="text-[10px] font-mono text-muted-foreground">{myCount} succès</span>
        </div>
        <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(progressPercent, 100)}%` }} />
        </div>
        {nextMilestone && (
          <p className="text-[9px] text-muted-foreground">
            → <span className="font-semibold text-foreground">{nextMilestone.label}</span> ({nextMilestone.count - myCount} restants)
          </p>
        )}

        <Collapsible open={milestonesOpen} onOpenChange={setMilestonesOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full pt-1">
            <ChevronDown className={cn("w-3 h-3 transition-transform", milestonesOpen && "rotate-180")} />
            <span>Paliers à débloquer</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1 pt-1.5">
              {MILESTONES.map((m) => {
                const unlocked = myCount >= m.count;
                return (
                  <div key={m.count} className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-[10px]",
                    unlocked ? "text-yellow-500" : "text-muted-foreground"
                  )}>
                    {unlocked ? <Star className="w-2.5 h-2.5 fill-yellow-500" /> : <Lock className="w-2.5 h-2.5" />}
                    <span className="font-medium">{m.label}</span>
                    <span className="ml-auto text-[9px]">{m.visible || unlocked ? m.reward : "🔒"}</span>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Online Users */}
      <div className="border border-border bg-card rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            En ligne — {onlineUsers.length}
          </span>
        </div>
        <div className="space-y-1">
          {onlineUsers.map((u) => (
            <div key={u.user_id} className="flex items-center gap-2 py-0.5">
              <div className="relative flex-shrink-0">
                <UserAvatar avatarUrl={u.avatar_url} name={u.display_name} size="sm" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-card" />
              </div>
              <span className="text-[10px] font-medium text-foreground truncate">{u.display_name}</span>
            </div>
          ))}
          {onlineUsers.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic">Personne en ligne</p>
          )}
        </div>
      </div>

      {/* Offline Users — admin only */}
      {isAdmin && offlineUsers.length > 0 && (
        <div className="border border-border bg-card rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Circle className="w-2 h-2 fill-muted-foreground text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Hors ligne — {offlineUsers.length}
            </span>
          </div>
          <div className="space-y-1">
            {offlineUsers.map((u) => (
              <div key={u.user_id} className="flex items-center gap-2 py-0.5 opacity-50">
                <div className="relative flex-shrink-0">
                  <UserAvatar avatarUrl={u.avatar_url} name={u.display_name} size="sm" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-muted-foreground border border-card" />
                </div>
                <span className="text-[10px] font-medium text-foreground truncate">{u.display_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState("discussion");
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

      // Get role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (roleData) setUserRole(roleData.role);

      // Get profile for presence
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .single();

      // Fetch all profiles for offline users list
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url");
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

    // Listen for @everyone notifications
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
      .from("user_successes")
      .select("*")
      .order("created_at", { ascending: true });

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
    // Get all active user IDs
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("status", "active");

    if (!profiles) return;

    const notifs = profiles
      .filter((p) => p.user_id !== userId)
      .map((p) => ({
        user_id: p.user_id,
        sender_id: userId,
        type: "mention",
        message: `📢 ${senderName} a mentionné @everyone dans les Succès !`,
      }));

    if (notifs.length > 0) {
      await supabase.from("user_notifications").insert(notifs as any);
    }
  }, [userId]);

  const handleSend = async () => {
    if (!userId) return;
    if (!selectedFile && !message.trim() && !selectedTrade) {
      toast.error("Ajoutez un message ou une image.");
      return;
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
        user_id: userId,
        image_path: imagePath,
        success_type: selectedType,
        message: message.trim() || null,
        linked_trade_id: selectedTrade?.id || null,
      } as any);

    if (insertError) { toast.error(`Erreur: ${insertError.message}`); setUploading(false); return; }

    // Check for @everyone mention
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

  const insertMention = () => {
    setMessage((prev) => prev + "@everyone ");
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex-1 overflow-hidden flex flex-col max-w-7xl mx-auto w-full">
        {/* Main content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Tabs (Discussion / Leaderboard) */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
              <TabsList className="bg-muted/50 h-8">
                <TabsTrigger value="discussion" className="text-xs gap-1.5 px-3 h-7">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Discussion
                </TabsTrigger>
                <TabsTrigger value="leaderboard" className="text-xs gap-1.5 px-3 h-7">
                  <Award className="w-3.5 h-3.5" />
                  Leaderboard
                </TabsTrigger>
              </TabsList>
              <Badge variant="secondary" className="text-xs font-mono">{successes.length} messages</Badge>
            </div>

            {/* Discussion Tab */}
            <TabsContent value="discussion" className="flex-1 flex flex-col overflow-hidden mt-0">
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : successes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun succès partagé pour le moment.</p>
                  </div>
                ) : (
                  <div>
                    {successes.map((s) => (
                      <ChatMessage key={s.id} entry={s} signedUrl={signedUrls[s.id]} isOwn={s.user_id === userId}
                        onDelete={() => handleDelete(s.id, s.image_path)} />
                    ))}
                  </div>
                )}
                <div ref={feedEndRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-border p-3 flex-shrink-0 bg-card">
                {(filePreview || selectedTrade) && (
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
                    {filePreview && (
                      <div className="relative">
                        <img src={filePreview} alt="Preview" className="h-20 w-auto rounded-lg border border-border object-cover" />
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

                <div className="flex items-end gap-2">
                  <div className="flex gap-0.5 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      onClick={insertMention} title="@everyone">
                      <AtSign className="w-4 h-4" />
                    </Button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  </div>

                  <div className="flex-1">
                    <Textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder="Partagez votre succès…" className="min-h-[40px] max-h-32 resize-none bg-muted/50 border-border text-sm" rows={1} />
                  </div>

                  <Button onClick={handleSend} disabled={uploading || (!selectedFile && !message.trim() && !selectedTrade)}
                    size="icon" className="h-9 w-9 flex-shrink-0">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="h-7 w-auto text-[10px] bg-muted/50 border-border gap-1 px-2"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {SUCCESS_TYPES.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!selectedTrade && (
                    <TradePicker trades={personalTrades} selectedTrade={selectedTrade} onSelect={setSelectedTrade} onClear={() => setSelectedTrade(null)} />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard" className="flex-1 overflow-y-auto mt-0 p-4">
              <SuccessLeaderboard />
            </TabsContent>
          </Tabs>

          {/* Right sidebar (desktop) */}
          <div className="hidden lg:block w-56 border-l border-border overflow-y-auto p-3">
            <RightSidebar myCount={myCount} onlineUsers={onlineUsers} allUsers={allUsers} isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </div>
  );
};

export { SuccessPage };
