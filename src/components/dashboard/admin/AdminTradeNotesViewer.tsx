import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, MessageSquare, Loader2, Save, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TradeNote {
  id: string;
  execution_id: string;
  trade_number: number;
  is_valid: boolean | null;
  note: string | null;
  supplementary_note: string | null;
}

interface AdminTradeNotesViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  executions: { id: string; trade_number: number; direction: string; trade_date: string }[];
  onNotesUpdated?: () => void;
}

export const AdminTradeNotesViewer = ({
  open,
  onOpenChange,
  requestId,
  executions,
  onNotesUpdated,
}: AdminTradeNotesViewerProps) => {
  const [notes, setNotes] = useState<TradeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editSupplementary, setEditSupplementary] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && requestId) {
      fetchNotes();
    }
  }, [open, requestId]);

  const fetchNotes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_trade_notes")
      .select("id, execution_id, is_valid, note, supplementary_note")
      .eq("verification_request_id", requestId);

    if (data) {
      const enriched: TradeNote[] = data.map((n: any) => {
        const exec = executions.find(e => e.id === n.execution_id);
        return {
          ...n,
          trade_number: exec?.trade_number || 0,
        };
      });
      enriched.sort((a, b) => a.trade_number - b.trade_number);
      setNotes(enriched);
    }
    setLoading(false);
  };

  const handleSave = async (noteId: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("admin_trade_notes")
      .update({
        note: editNote || null,
        supplementary_note: editSupplementary || null,
      })
      .eq("id", noteId);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Note mise à jour" });
      setEditingId(null);
      fetchNotes();
      onNotesUpdated?.();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Notes admin — Vérification
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune note enregistrée pour cette vérification.
            </p>
          ) : (
            notes.map((n) => {
              const exec = executions.find(e => e.id === n.execution_id);
              const isEditing = editingId === n.id;

              return (
                <div
                  key={n.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    n.is_valid === true && "border-emerald-500/30 bg-emerald-500/5",
                    n.is_valid === false && "border-red-500/30 bg-red-500/5",
                    n.is_valid === null && "border-border bg-card"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {n.is_valid === true ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : n.is_valid === false ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : null}
                      <span className="text-sm font-mono font-bold text-foreground">
                        Trade #{n.trade_number}
                      </span>
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded",
                        n.is_valid === true ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {n.is_valid === true ? "Validé" : "Refusé"}
                      </span>
                      {exec && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {new Date(exec.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} · {exec.direction}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        if (isEditing) {
                          setEditingId(null);
                        } else {
                          setEditingId(n.id);
                          setEditNote(n.note || "");
                          setEditSupplementary(n.supplementary_note || "");
                        }
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-mono uppercase text-muted-foreground">
                          Justification ({n.is_valid ? "validation" : "refus"})
                        </label>
                        <Textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="min-h-[60px] text-sm mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono uppercase text-muted-foreground">
                          Note complémentaire
                        </label>
                        <Textarea
                          value={editSupplementary}
                          onChange={(e) => setEditSupplementary(e.target.value)}
                          className="min-h-[60px] text-sm mt-1"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                          Annuler
                        </Button>
                        <Button size="sm" className="gap-1.5" onClick={() => handleSave(n.id)} disabled={saving}>
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {n.note && (
                        <div>
                          <span className="text-[9px] font-mono uppercase text-muted-foreground">
                            {n.is_valid ? "Justification validation" : "Justification refus"}
                          </span>
                          <p className="text-sm text-foreground">{n.note}</p>
                        </div>
                      )}
                      {n.supplementary_note && (
                        <div>
                          <span className="text-[9px] font-mono uppercase text-blue-400">
                            Note complémentaire
                          </span>
                          <p className="text-sm text-foreground">{n.supplementary_note}</p>
                        </div>
                      )}
                      {!n.note && !n.supplementary_note && (
                        <p className="text-xs text-muted-foreground italic">Aucune note</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
