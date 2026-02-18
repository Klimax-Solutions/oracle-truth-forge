import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface Profile {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
}

interface CreateSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateSetupDialog = ({ isOpen, onClose, onCreated }: CreateSetupDialogProps) => {
  const [name, setName] = useState("");
  const [asset, setAsset] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [members, setMembers] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setName("");
      setAsset("");
      setAssignedTo("");
      fetchMembers();
    }
  }, [isOpen]);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, first_name")
      .order("display_name");
    if (data) setMembers(data);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nom requis", description: "Veuillez entrer un nom pour le setup.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase.from("custom_setups").insert({
      name: name.trim(),
      created_by: user.id,
      assigned_to: assignedTo || null,
      asset: asset.trim() || null,
    } as any);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Setup créé", description: `Le setup "${name}" a été créé avec succès.` });
      onCreated();
    }
    setSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un nouveau Setup</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nom du setup *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Setup NAS100 Breakout"
            />
          </div>

          <div className="space-y-2">
            <Label>Actif (optionnel)</Label>
            <Input
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="Ex: NAS100, EUR/USD..."
            />
          </div>

          <div className="space-y-2">
            <Label>Assigner à un membre (optionnel)</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un membre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.display_name || m.first_name || "Anonyme"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Créer le setup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
