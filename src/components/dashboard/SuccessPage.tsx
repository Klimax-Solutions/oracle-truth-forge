import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trophy, Lock, Star, Loader2, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSignedUrl } from "@/hooks/useSignedUrl";

interface SuccessEntry {
  id: string;
  user_id: string;
  image_path: string;
  created_at: string;
  display_name?: string;
  success_type?: string;
}

const SUCCESS_TYPES = [
  { value: "prop_firm", label: "Prop Firm Validée" },
  { value: "phase_1", label: "Phase 1 Validée" },
  { value: "payout", label: "Payout" },
  { value: "tp", label: "TP (Take Profit)" },
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

const getTypeLabel = (value?: string) => {
  return SUCCESS_TYPES.find((t) => t.value === value)?.label || value || "";
};

/* ─── Upload Panel (Left) ─── */
const UploadPanel = ({
  myCount,
  uploading,
  selectedType,
  setSelectedType,
  fileInputRef,
  handleUpload,
}: {
  myCount: number;
  uploading: boolean;
  selectedType: string;
  setSelectedType: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const currentMilestoneIndex = MILESTONES.findIndex((m) => myCount < m.count);
  const nextMilestone = currentMilestoneIndex >= 0 ? MILESTONES[currentMilestoneIndex] : null;
  const prevMilestoneCount = currentMilestoneIndex > 0 ? MILESTONES[currentMilestoneIndex - 1].count : 0;
  const progressPercent = nextMilestone
    ? ((myCount - prevMilestoneCount) / (nextMilestone.count - prevMilestoneCount)) * 100
    : 100;

  return (
    <div className="space-y-5">
      {/* Gamification */}
      <div className="border border-border bg-card rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Votre progression</span>
          <span className="text-sm font-mono text-muted-foreground">
            {myCount} succès au total
          </span>
        </div>

        <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>

        {nextMilestone && (
          <p className="text-xs text-muted-foreground">
            Prochain palier :{" "}
            <span className="font-semibold text-foreground">{nextMilestone.label}</span> — encore{" "}
            {nextMilestone.count - myCount} succès
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
          {MILESTONES.map((m) => {
            const unlocked = myCount >= m.count;
            return (
              <div
                key={m.count}
                className={cn(
                  "border rounded-lg p-3 text-center transition-all",
                  unlocked ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-muted/30"
                )}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {unlocked ? (
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      unlocked ? "text-yellow-500" : "text-muted-foreground"
                    )}
                  >
                    {m.label}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-[10px]",
                    unlocked ? "text-foreground" : "text-muted-foreground italic"
                  )}
                >
                  {m.visible || unlocked ? m.reward : "🔒 Confidentiel"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload zone */}
      <div className="border border-dashed border-border rounded-lg p-6 text-center space-y-4 bg-card hover:border-primary/40 transition-colors">
        <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Partagez vos succès</p>
          <p className="text-xs text-muted-foreground mt-1">
            Trades gagnants, payouts, prop firms validées — images uniquement (max 5 Mo)
          </p>
        </div>

        {/* Type selector */}
        <div className="max-w-xs mx-auto">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Type de succès" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {SUCCESS_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Upload en cours…" : "Uploader un succès"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </div>
  );
};

/* ─── Feed Panel (Right) ─── */
const FeedPanel = ({
  successes,
  signedUrls,
  loading,
  userId,
  handleDelete,
}: {
  successes: SuccessEntry[];
  signedUrls: Record<string, string>;
  loading: boolean;
  userId: string | null;
  handleDelete: (id: string, path: string) => void;
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (successes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Aucun succès partagé pour le moment.</p>
        <p className="text-xs mt-1">Soyez le premier à partager !</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {successes.map((s) => (
        <div key={s.id} className="border border-border bg-card rounded-lg overflow-hidden">
          {/* Image */}
          <div className="relative">
            {signedUrls[s.id] ? (
              <img
                src={signedUrls[s.id]}
                alt="Succès"
                className="w-full object-contain max-h-[400px] bg-muted/30"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-40 flex items-center justify-center bg-muted">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-primary uppercase">
                  {(s.display_name || "A").charAt(0)}
                </span>
              </div>
              <span className="text-xs font-medium text-foreground truncate">
                {s.display_name}
              </span>
              {s.success_type && (
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                  {getTypeLabel(s.success_type)}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                {new Date(s.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            {s.user_id === userId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={() => handleDelete(s.id, s.image_path)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSuccesses = async (uid: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("user_successes")
      .select("*")
      .order("created_at", { ascending: false });

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

    const enriched: SuccessEntry[] = (data || []).map((s) => ({
      ...s,
      display_name: profileMap[s.user_id] || "Anonyme",
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !userId) return;

    setUploading(true);
    let uploadedCount = 0;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} n'est pas une image.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} dépasse 5 Mo.`);
        continue;
      }

      const ext = file.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("success-screenshots")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Erreur upload: ${uploadError.message}`);
        continue;
      }

      const { error: insertError } = await supabase
        .from("user_successes")
        .insert({ user_id: userId, image_path: filePath, success_type: selectedType });

      if (insertError) {
        toast.error(`Erreur enregistrement: ${insertError.message}`);
        continue;
      }

      uploadedCount++;
    }

    if (uploadedCount > 0) {
      toast.success(`${uploadedCount} succès partagé${uploadedCount > 1 ? "s" : ""} !`);
      fetchSuccesses(userId);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (successId: string, imagePath: string) => {
    const { error: deleteDbError } = await supabase
      .from("user_successes")
      .delete()
      .eq("id", successId);

    if (deleteDbError) {
      toast.error("Erreur suppression");
      return;
    }

    await supabase.storage.from("success-screenshots").remove([imagePath]);
    toast.success("Succès supprimé");
    if (userId) fetchSuccesses(userId);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <h1 className="text-2xl font-bold tracking-tight">Vos Succès</h1>
          </div>
          <Badge variant="secondary" className="text-xs font-mono">
            {successes.length} succès partagé{successes.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left: Upload + Gamification */}
          <UploadPanel
            myCount={myCount}
            uploading={uploading}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            fileInputRef={fileInputRef}
            handleUpload={handleUpload}
          />

          {/* Right: Feed */}
          <div className="border border-border bg-card/50 rounded-lg p-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
              Fil des succès
            </h2>
            <FeedPanel
              successes={successes}
              signedUrls={signedUrls}
              loading={loading}
              userId={userId}
              handleDelete={handleDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export { SuccessPage };
