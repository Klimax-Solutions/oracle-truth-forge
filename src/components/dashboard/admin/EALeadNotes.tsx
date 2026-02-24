import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, StickyNote, Pencil, Check, X } from "lucide-react";

interface Note {
  id: string;
  request_id: string;
  author_id: string;
  note: string;
  created_at: string;
  author_name?: string;
}

interface EALeadNotesProps {
  requestId: string;
}

export const EALeadNotes = ({ requestId }: EALeadNotesProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchNotes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ea_lead_notes" as any)
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const authorIds = [...new Set((data as any[]).map((n: any) => n.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, first_name")
        .in("user_id", authorIds);

      const enriched = (data as any[]).map((n: any) => {
        const profile = profiles?.find((p: any) => p.user_id === n.author_id);
        return {
          ...n,
          author_name: profile?.display_name || profile?.first_name || "Inconnu",
        };
      });
      setNotes(enriched);
    } else {
      setNotes([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotes();
  }, [requestId]);

  const handleSend = async () => {
    if (!newNote.trim()) return;
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    await supabase
      .from("ea_lead_notes" as any)
      .insert({
        request_id: requestId,
        author_id: user.id,
        note: newNote.trim(),
      } as any);

    setNewNote("");
    await fetchNotes();
    setSending(false);
  };

  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditText(note.note);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    setSavingEdit(true);

    await supabase
      .from("ea_lead_notes" as any)
      .update({ note: editText.trim() } as any)
      .eq("id", editingId);

    setNotes(prev => prev.map(n => n.id === editingId ? { ...n, note: editText.trim() } : n));
    setEditingId(null);
    setEditText("");
    setSavingEdit(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold flex items-center gap-1.5">
        <StickyNote className="w-3.5 h-3.5" /> Notes
      </p>

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Ajouter une note..."
          className="min-h-[60px] text-xs resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 self-end"
          onClick={handleSend}
          disabled={sending || !newNote.trim()}
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center py-2">Aucune note</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {notes.map((n) => (
            <div key={n.id} className="border border-border rounded-md p-2 bg-muted/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-primary">{n.author_name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground font-mono">{fmt(n.created_at)}</span>
                  {editingId !== n.id && (
                    <button onClick={() => handleStartEdit(n)} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
              {editingId === n.id ? (
                <div className="space-y-1">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[40px] text-xs resize-none"
                    autoFocus
                  />
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={handleCancelEdit} disabled={savingEdit}>
                      <X className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-primary" onClick={handleSaveEdit} disabled={savingEdit || !editText.trim()}>
                      {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-foreground whitespace-pre-wrap">{n.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
