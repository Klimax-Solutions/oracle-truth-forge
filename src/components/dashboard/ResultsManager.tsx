import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ResultItem {
  id: string;
  title: string | null;
  image_path: string;
  sort_order: number;
  created_at: string;
  result_type: string | null;
  result_date: string | null;
}

const RESULT_TYPES = [
  { value: "trade", label: "Trade" },
  { value: "payout", label: "Payout" },
  { value: "challenge_validation", label: "Validation de challenge" },
  { value: "account_validation", label: "Validation de compte" },
  { value: "other", label: "Autre" },
];

const formatLiteralDate = (dateStr: string) => {
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const stripLegacyDatePrefix = (value: string) =>
  value.replace(/^\d{1,2}\s+[\p{L}]+\s+\d{4}\s+—\s+/u, "").trim();

export const ResultsManager = () => {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ResultItem | null>(null);
  const [title, setTitle] = useState("");
  const [resultDate, setResultDate] = useState("");
  const [resultType, setResultType] = useState("trade");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const fetchResults = async () => {
    const { data } = await supabase
      .from("results")
      .select("*")
      .order("result_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (data) {
      setResults(data as ResultItem[]);
      const paths = data.map((r: any) => r.image_path).filter(Boolean);
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("result-screenshots")
          .createSignedUrls(paths, 3600);
        if (signed) {
          const urlMap: Record<string, string> = {};
          signed.forEach((s: any) => {
            if (s.signedUrl) urlMap[s.path] = s.signedUrl;
          });
          setSignedUrls(urlMap);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const resetForm = () => {
    setTitle("");
    setResultDate("");
    setResultType("trade");
    setFile(null);
    setEditing(null);
  };

  const handleSave = async () => {
    if (editing) {
      const finalTitle = title.trim() || null;
      const { error } = await supabase
        .from("results")
        .update({ title: finalTitle, result_type: resultType, result_date: resultDate || null } as any)
        .eq("id", editing.id);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Résultat mis à jour" });
    } else {
      if (!file) {
        toast({ title: "Erreur", description: "Sélectionnez un fichier", variant: "destructive" });
        return;
      }
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("result-screenshots")
        .upload(path, file);
      
      if (uploadError) {
        toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" });
        setUploading(false);
        return;
      }

      const finalTitle = title.trim() || null;
      const { error } = await supabase.from("results").insert({
        title: finalTitle,
        image_path: path,
        sort_order: results.length,
        result_type: resultType,
        result_date: resultDate || null,
      } as any);

      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        setUploading(false);
        return;
      }
      toast({ title: "Résultat ajouté" });
      setUploading(false);
    }

    setDialogOpen(false);
    resetForm();
    fetchResults();
  };

  const handleDelete = async (item: ResultItem) => {
    if (!confirm("Supprimer ce résultat ?")) return;
    
    await supabase.storage.from("result-screenshots").remove([item.image_path]);
    const { error } = await supabase.from("results").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Résultat supprimé" });
    fetchResults();
  };

  const moveResult = async (index: number, direction: "up" | "down") => {
    const newResults = [...results];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newResults.length) return;

    const tempOrder = newResults[index].sort_order;
    newResults[index].sort_order = newResults[swapIndex].sort_order;
    newResults[swapIndex].sort_order = tempOrder;

    await Promise.all([
      supabase.from("results").update({ sort_order: newResults[index].sort_order }).eq("id", newResults[index].id),
      supabase.from("results").update({ sort_order: newResults[swapIndex].sort_order }).eq("id", newResults[swapIndex].id),
    ]);

    fetchResults();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg md:text-xl font-semibold text-foreground">Gestion des Résultats</h2>
            <Badge variant="secondary" className="font-mono text-[10px] md:text-xs">{results.length}</Badge>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-hide p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-2">
          {results.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 p-3 md:p-4 border border-border bg-card rounded-lg">
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button onClick={() => moveResult(index, "up")} disabled={index === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">▲</button>
                <button onClick={() => moveResult(index, "down")} disabled={index === results.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">▼</button>
              </div>

              <div className="w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                {signedUrls[item.image_path] && (
                  <img src={signedUrls[item.image_path]} alt="" className="w-full h-full object-cover" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{item.title || "Sans titre"}</p>
                  {item.result_type && (
                    <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-primary/15 text-primary rounded flex-shrink-0">
                      {RESULT_TYPES.find(t => t.value === item.result_type)?.label || item.result_type}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {formatLiteralDate(item.result_date || item.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => { 
                  setEditing(item); 
                  setTitle(stripLegacyDatePrefix(item.title || ""));
                  setResultDate(item.result_date || "");
                  setResultType(item.result_type || "trade");
                  setDialogOpen(true); 
                }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {results.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucun résultat. Cliquez sur "Ajouter" pour commencer.
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le résultat" : "Ajouter un résultat"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Type de résultat</Label>
              <select
                value={resultType}
                onChange={(e) => setResultType(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-border bg-card text-foreground text-sm"
              >
                {RESULT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Date du résultat</Label>
              <Input type="date" value={resultDate} onChange={(e) => setResultDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Titre (optionnel)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: +3.2 RR NAS100" />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Screenshot *</Label>
                <div className="border-2 border-dashed border-border rounded-md p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="text-sm text-muted-foreground"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Annuler</Button>
              <Button onClick={handleSave} disabled={uploading} className="gap-1.5">
                <Save className="w-4 h-4" />
                {uploading ? "Upload..." : editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
