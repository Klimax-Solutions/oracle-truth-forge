import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, Loader2, Camera, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AvatarCropper } from "./AvatarCropper";

interface ProfileSettingsDialogProps {
  onDisplayNameChange?: (name: string) => void;
}

const TIMEZONE_OPTIONS = [
  { value: "Europe/Paris", label: "Paris (UTC+1/+2)", city: "Paris" },
  { value: "Europe/London", label: "Londres (UTC+0/+1)", city: "Londres" },
  { value: "Europe/Berlin", label: "Berlin (UTC+1/+2)", city: "Berlin" },
  { value: "Europe/Madrid", label: "Madrid (UTC+1/+2)", city: "Madrid" },
  { value: "Europe/Rome", label: "Rome (UTC+1/+2)", city: "Rome" },
  { value: "Europe/Brussels", label: "Bruxelles (UTC+1/+2)", city: "Bruxelles" },
  { value: "Europe/Zurich", label: "Zurich (UTC+1/+2)", city: "Zurich" },
  { value: "Europe/Moscow", label: "Moscou (UTC+3)", city: "Moscou" },
  { value: "America/New_York", label: "New York (UTC-5/-4)", city: "New York" },
  { value: "America/Chicago", label: "Chicago (UTC-6/-5)", city: "Chicago" },
  { value: "America/Denver", label: "Denver (UTC-7/-6)", city: "Denver" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC-8/-7)", city: "Los Angeles" },
  { value: "America/Toronto", label: "Toronto (UTC-5/-4)", city: "Toronto" },
  { value: "America/Montreal", label: "Montréal (UTC-5/-4)", city: "Montréal" },
  { value: "America/Sao_Paulo", label: "São Paulo (UTC-3)", city: "São Paulo" },
  { value: "Asia/Dubai", label: "Dubaï (UTC+4)", city: "Dubaï" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)", city: "Tokyo" },
  { value: "Asia/Shanghai", label: "Shanghai (UTC+8)", city: "Shanghai" },
  { value: "Asia/Singapore", label: "Singapour (UTC+8)", city: "Singapour" },
  { value: "Asia/Kolkata", label: "Mumbai (UTC+5:30)", city: "Mumbai" },
  { value: "Australia/Sydney", label: "Sydney (UTC+10/+11)", city: "Sydney" },
  { value: "Africa/Casablanca", label: "Casablanca (UTC+0/+1)", city: "Casablanca" },
  { value: "Africa/Lagos", label: "Lagos (UTC+1)", city: "Lagos" },
  { value: "Africa/Johannesburg", label: "Johannesburg (UTC+2)", city: "Johannesburg" },
  { value: "Pacific/Auckland", label: "Auckland (UTC+12/+13)", city: "Auckland" },
];

export const ProfileSettingsDialog = ({ onDisplayNameChange }: ProfileSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const fetchProfile = async () => {
      setFetching(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, timezone" as any)
        .eq("user_id", user.id)
        .single();

      if (data) {
        setDisplayName((data as any).display_name || "");
        setAvatarUrl((data as any).avatar_url || null);
        setTimezone((data as any).timezone || "Europe/Paris");
      }
      setFetching(false);
    };
    fetchProfile();
  }, [open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seules les images sont acceptées.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropperOpen(false);
    setCropImageSrc(null);
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const filePath = `${user.id}/avatar.jpg`;

    // Remove old avatar if exists
    await supabase.storage.from("avatars").remove([filePath]);

    const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (error) {
      toast.error("Erreur upload avatar.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl } as any)
      .eq("user_id", user.id);

    setAvatarUrl(publicUrl);
    toast.success("Avatar mis à jour !");
    setUploading(false);
  };

  const handleSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error("Le pseudo ne peut pas être vide.");
      return;
    }
    if (trimmed.length > 30) {
      toast.error("Le pseudo ne peut pas dépasser 30 caractères.");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed, timezone } as any)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erreur lors de la mise à jour.");
    } else {
      toast.success("Profil mis à jour !");
      onDisplayNameChange?.(trimmed);
      setOpen(false);
    }
    setLoading(false);
  };

  const initials = (displayName || "?").charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-transparent">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>Paramètres du profil</DialogTitle>
        </DialogHeader>
        {fetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-2 border-border">
                    <span className="text-2xl font-bold text-primary">{initials}</span>
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <p className="text-[10px] text-muted-foreground">Cliquez pour changer l'avatar</p>

              {/* Avatar Cropper */}
              {cropImageSrc && (
                <AvatarCropper
                  imageSrc={cropImageSrc}
                  open={cropperOpen}
                  onClose={() => { setCropperOpen(false); setCropImageSrc(null); }}
                  onCropComplete={handleCropComplete}
                />
              )}
            </div>

            {/* Display name */}
            <div className="space-y-2">
              <Label htmlFor="display-name">Pseudo (affiché sur le leaderboard)</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre pseudo..."
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                Ce nom sera visible par tous les membres.
              </p>
            </div>

            {/* Password section */}
            <PasswordSection />

            <Button onClick={handleSave} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Password sub-component ──
const PasswordSection = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Mot de passe défini avec succès !");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  };

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Définir un mot de passe</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Optionnel — vous permet de vous connecter avec email + mot de passe en plus du lien par email.
      </p>
      <div className="space-y-2">
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            minLength={6}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <Input
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmer le mot de passe"
          minLength={6}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSetPassword}
        disabled={saving || !newPassword || !confirmPassword}
        className="w-full gap-2"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
        Définir le mot de passe
      </Button>
    </div>
  );
};
