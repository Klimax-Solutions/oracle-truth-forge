import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, Trophy, Lock, Star, Loader2, Trash2, ImageIcon, Send,
  Paperclip, X, Search, TrendingUp, TrendingDown, ChevronDown,
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

interface SuccessEntry {
  id: string;
  user_id: string;
  image_path: string;
  created_at: string;
  display_name?: string;
  success_type?: string;
  message?: string;
  linked_trade_id?: string;
  linked_trade?: PersonalTrade | null;
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

/* ─── Trade Picker Popover ─── */
const TradePicker = ({
  trades,
  selectedTrade,
  onSelect,
  onClear,
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
    return trades
      .filter(
        (t) =>
          t.trade_number.toString().includes(q) ||
          t.direction.toLowerCase().includes(q) ||
          t.trade_date.includes(q) ||
          (t.setup_type || "").toLowerCase().includes(q)
      )
      .reverse()
      .slice(0, 30);
  }, [trades, search]);

  if (selectedTrade) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
        <span className="font-semibold text-primary">
          #{selectedTrade.trade_number}
        </span>
        <span className={cn(
          "font-medium",
          selectedTrade.direction === "Long" ? "text-emerald-400" : "text-red-400"
        )}>
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
          <Input
            placeholder="Rechercher par n°, direction, date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucun trade trouvé
            </p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                onClick={() => {
                  onSelect(t);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span className="text-xs font-mono font-bold text-foreground w-8">
                  #{t.trade_number}
                </span>
                {t.direction === "Long" ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  t.direction === "Long" ? "text-emerald-400" : "text-red-400"
                )}>
                  {t.direction}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(t.trade_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
                {t.rr !== null && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {t.rr > 0 ? "+" : ""}{t.rr}R
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* ─── Chat Message Bubble ─── */
const ChatMessage = ({
  entry,
  signedUrl,
  isOwn,
  onDelete,
}: {
  entry: SuccessEntry;
  signedUrl?: string;
  isOwn: boolean;
  onDelete: () => void;
}) => {
  const initials = (entry.display_name || "A").charAt(0).toUpperCase();

  return (
    <div className={cn("group flex gap-3 px-4 py-2 hover:bg-muted/30 transition-colors")}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-sm font-bold text-primary">{initials}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {entry.display_name || "Anonyme"}
          </span>
          {entry.success_type && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
              {getTypeLabel(entry.success_type)}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(entry.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isOwn && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-auto"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Linked trade card */}
        {entry.linked_trade && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border w-fit text-xs">
            <span className="font-mono font-bold text-foreground">
              #{entry.linked_trade.trade_number}
            </span>
            {entry.linked_trade.direction === "Long" ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={cn(
              "font-medium",
              entry.linked_trade.direction === "Long" ? "text-emerald-400" : "text-red-400"
            )}>
              {entry.linked_trade.direction}
            </span>
            {entry.linked_trade.setup_type && (
              <span className="text-muted-foreground">· {entry.linked_trade.setup_type}</span>
            )}
            {entry.linked_trade.rr !== null && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  entry.linked_trade.rr >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {entry.linked_trade.rr > 0 ? "+" : ""}{entry.linked_trade.rr}R
              </Badge>
            )}
            <span className="text-muted-foreground">
              {new Date(entry.linked_trade.trade_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          </div>
        )}

        {/* Message */}
        {entry.message && (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {entry.message}
          </p>
        )}

        {/* Image */}
        {signedUrl && (
          <div className="mt-1 max-w-md">
            <img
              src={signedUrl}
              alt="Succès"
              className="rounded-lg object-contain max-h-[350px] w-auto border border-border cursor-pointer hover:brightness-110 transition"
              loading="lazy"
              onClick={() => window.open(signedUrl, "_blank")}
            />
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Milestones Sidebar ─── */
const MilestonesSidebar = ({ myCount }: { myCount: number }) => {
  const currentMilestoneIndex = MILESTONES.findIndex((m) => myCount < m.count);
  const nextMilestone = currentMilestoneIndex >= 0 ? MILESTONES[currentMilestoneIndex] : null;
  const prevMilestoneCount = currentMilestoneIndex > 0 ? MILESTONES[currentMilestoneIndex - 1].count : 0;
  const progressPercent = nextMilestone
    ? ((myCount - prevMilestoneCount) / (nextMilestone.count - prevMilestoneCount)) * 100
    : 100;

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Progression</span>
          <span className="text-xs font-mono text-muted-foreground">{myCount} succès</span>
        </div>
        <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
        {nextMilestone && (
          <p className="text-[10px] text-muted-foreground">
            Prochain : <span className="font-semibold text-foreground">{nextMilestone.label}</span> — {nextMilestone.count - myCount} restants
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {MILESTONES.map((m) => {
          const unlocked = myCount >= m.count;
          return (
            <div
              key={m.count}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs",
                unlocked ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-card"
              )}
            >
              {unlocked ? (
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              ) : (
                <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              )}
              <span className={cn("font-medium", unlocked ? "text-yellow-500" : "text-muted-foreground")}>
                {m.label}
              </span>
              <span className={cn("ml-auto text-[10px]", unlocked ? "text-foreground" : "text-muted-foreground italic")}>
                {m.visible || unlocked ? m.reward : "🔒"}
              </span>
            </div>
          );
        })}
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
  const { fireConfetti } = useSuccessConfetti();
  const { trades: personalTrades } = usePersonalTrades();

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchSuccesses(user.id);
      }
    };
    init();

    const channel = supabase
      .channel("successes_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_successes" }, () => {
        if (userId) fetchSuccesses(userId);
        else init();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [successes, loading]);

  const fetchSuccesses = async (uid: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("user_successes")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching successes:", error);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((data || []).map((s) => s.user_id))];
    let profileMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      if (profiles) {
        profileMap = Object.fromEntries(
          profiles.map((p) => [p.user_id, p.display_name || "Anonyme"])
        );
      }
    }

    // Fetch linked trades for entries that have linked_trade_id
    const linkedTradeIds = (data || [])
      .map((s) => (s as any).linked_trade_id)
      .filter(Boolean);

    let tradeMap: Record<string, PersonalTrade> = {};
    if (linkedTradeIds.length > 0) {
      const { data: linkedTrades } = await supabase
        .from("user_personal_trades")
        .select("*")
        .in("id", linkedTradeIds);
      if (linkedTrades) {
        tradeMap = Object.fromEntries(linkedTrades.map((t) => [t.id, t as PersonalTrade]));
      }
    }

    const enriched: SuccessEntry[] = (data || []).map((s: any) => ({
      ...s,
      display_name: profileMap[s.user_id] || "Anonyme",
      linked_trade: s.linked_trade_id ? tradeMap[s.linked_trade_id] || null : null,
    }));

    setSuccesses(enriched);
    setMyCount(enriched.filter((s) => s.user_id === uid).length);

    const urls: Record<string, string> = {};
    await Promise.all(
      enriched.map(async (s) => {
        const url = await getSignedUrl(s.image_path, "success-screenshots");
        if (url) urls[s.id] = url;
      })
    );
    setSignedUrls(urls);
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seules les images sont acceptées.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image dépasse 5 Mo.");
      return;
    }
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    if (!userId) return;
    if (!selectedFile && !message.trim() && !selectedTrade) {
      toast.error("Ajoutez un message ou une image.");
      return;
    }

    setUploading(true);
    let imagePath = "";

    // Upload image if selected
    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("success-screenshots")
        .upload(filePath, selectedFile);

      if (uploadError) {
        toast.error(`Erreur upload: ${uploadError.message}`);
        setUploading(false);
        return;
      }
      imagePath = filePath;
    }

    // If no image but we still need a path (required column), use a placeholder
    if (!imagePath) {
      imagePath = `${userId}/no-image-${Date.now()}.txt`;
      // Upload a tiny placeholder
      const { error: uploadError } = await supabase.storage
        .from("success-screenshots")
        .upload(imagePath, new Blob(["no-image"], { type: "text/plain" }));
      if (uploadError) {
        // If image_path is required but we can't create placeholder, force image
        toast.error("Veuillez ajouter une image.");
        setUploading(false);
        return;
      }
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

    if (insertError) {
      toast.error(`Erreur: ${insertError.message}`);
      setUploading(false);
      return;
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
    if (error) {
      toast.error("Erreur suppression");
      return;
    }
    await supabase.storage.from("success-screenshots").remove([imagePath]);
    toast.success("Succès supprimé");
    if (userId) fetchSuccesses(userId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex-1 overflow-hidden flex flex-col max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h1 className="text-lg font-bold tracking-tight">Vos Succès</h1>
          </div>
          <Badge variant="secondary" className="text-xs font-mono">
            {successes.length} messages
          </Badge>
        </div>

        {/* Main content: chat + sidebar */}
        <div className="flex-1 overflow-hidden flex">
          {/* Chat area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages feed */}
            <div className="flex-1 overflow-y-auto">
              {/* Leaderboard pinned at top */}
              <div className="p-4">
                <SuccessLeaderboard />
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : successes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucun succès partagé pour le moment.</p>
                  <p className="text-xs mt-1">Soyez le premier à partager !</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {successes.map((s) => (
                    <ChatMessage
                      key={s.id}
                      entry={s}
                      signedUrl={signedUrls[s.id]}
                      isOwn={s.user_id === userId}
                      onDelete={() => handleDelete(s.id, s.image_path)}
                    />
                  ))}
                </div>
              )}
              <div ref={feedEndRef} />
            </div>

            {/* Composer (Discord-like input) */}
            <div className="border-t border-border p-3 flex-shrink-0 bg-card">
              {/* File preview / Linked trade */}
              {(filePreview || selectedTrade) && (
                <div className="flex items-start gap-2 mb-2 flex-wrap">
                  {filePreview && (
                    <div className="relative">
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="h-20 w-auto rounded-lg border border-border object-cover"
                      />
                      <button
                        onClick={clearFile}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Trade picker row */}
              {selectedTrade && (
                <div className="mb-2">
                  <TradePicker
                    trades={personalTrades}
                    selectedTrade={selectedTrade}
                    onSelect={setSelectedTrade}
                    onClear={() => setSelectedTrade(null)}
                  />
                </div>
              )}

              <div className="flex items-end gap-2">
                {/* Attach + Trade link buttons */}
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {/* Text input */}
                <div className="flex-1 relative">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Partagez votre succès…"
                    className="min-h-[40px] max-h-32 resize-none pr-10 bg-muted/50 border-border text-sm"
                    rows={1}
                  />
                </div>

                {/* Send button */}
                <Button
                  onClick={handleSend}
                  disabled={uploading || (!selectedFile && !message.trim() && !selectedTrade)}
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Bottom toolbar */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-7 w-auto text-[10px] bg-muted/50 border-border gap-1 px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {SUCCESS_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!selectedTrade && (
                  <TradePicker
                    trades={personalTrades}
                    selectedTrade={selectedTrade}
                    onSelect={setSelectedTrade}
                    onClear={() => setSelectedTrade(null)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar: milestones (desktop only) */}
          <div className="hidden lg:block w-64 border-l border-border overflow-y-auto p-4">
            <MilestonesSidebar myCount={myCount} />
          </div>
        </div>
      </div>
    </div>
  );
};

export { SuccessPage };
