import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Save, Loader2, Video, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface QuestStep {
  id?: string;
  target_role: string;
  target_phase: string;
  step_order: number;
  step_label: string;
  step_description: string | null;
  video_embed: string | null;
  action_label: string | null;
  action_url: string | null;
}

const ROLE_PHASES: Record<string, { label: string; phases: { key: string; label: string }[] }> = {
  member: {
    label: "Membre",
    phases: [
      { key: "ebauche", label: "Phase Ébauche (premiers 15 trades)" },
      { key: "cycles", label: "Phase Cycles (après ébauche)" },
    ],
  },
  early_access_precall: {
    label: "Early Access — Pré-call",
    phases: [
      { key: "default", label: "Parcours Pré-call" },
    ],
  },
  early_access_postcall: {
    label: "Early Access — Post-call",
    phases: [
      { key: "default", label: "Parcours Post-call" },
    ],
  },
};

export const QuestStepManager = () => {
  const [steps, setSteps] = useState<QuestStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState("member");
  const [activePhase, setActivePhase] = useState("ebauche");
  const { toast } = useToast();

  const fetchSteps = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("quest_step_configs")
      .select("*")
      .order("step_order", { ascending: true });
    if (data) setSteps(data as QuestStep[]);
    setLoading(false);
  };

  useEffect(() => { fetchSteps(); }, []);

  // When role changes, pick the first phase
  useEffect(() => {
    const role = ROLE_PHASES[activeRole];
    if (role && role.phases.length > 0) {
      setActivePhase(role.phases[0].key);
    }
  }, [activeRole]);

  const currentSteps = steps
    .filter(s => s.target_role === activeRole && s.target_phase === activePhase)
    .sort((a, b) => a.step_order - b.step_order);

  const addStep = () => {
    const maxOrder = currentSteps.length > 0 ? Math.max(...currentSteps.map(s => s.step_order)) : -1;
    const newStep: QuestStep = {
      target_role: activeRole,
      target_phase: activePhase,
      step_order: maxOrder + 1,
      step_label: "",
      step_description: null,
      video_embed: null,
      action_label: null,
      action_url: null,
    };
    setSteps(prev => [...prev, newStep]);
  };

  const updateStep = (index: number, field: keyof QuestStep, value: string | null) => {
    const globalIndex = steps.findIndex(s => s === currentSteps[index]);
    if (globalIndex === -1) return;
    setSteps(prev => {
      const next = [...prev];
      next[globalIndex] = { ...next[globalIndex], [field]: value };
      return next;
    });
  };

  const removeStep = async (index: number) => {
    const step = currentSteps[index];
    if (step.id) {
      await supabase.from("quest_step_configs").delete().eq("id", step.id);
    }
    setSteps(prev => prev.filter(s => s !== step));
    toast({ title: "Étape supprimée" });
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentSteps.length) return;
    
    const stepA = currentSteps[index];
    const stepB = currentSteps[targetIndex];
    const globalA = steps.findIndex(s => s === stepA);
    const globalB = steps.findIndex(s => s === stepB);
    
    setSteps(prev => {
      const next = [...prev];
      const orderA = next[globalA].step_order;
      next[globalA] = { ...next[globalA], step_order: next[globalB].step_order };
      next[globalB] = { ...next[globalB], step_order: orderA };
      return next;
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const toSave = currentSteps;

      // Delete removed steps
      const existingIds = toSave.filter(s => s.id).map(s => s.id!);
      const { data: dbSteps } = await supabase
        .from("quest_step_configs")
        .select("id")
        .eq("target_role", activeRole)
        .eq("target_phase", activePhase);
      
      const toDelete = (dbSteps || []).filter(d => !existingIds.includes(d.id)).map(d => d.id);
      if (toDelete.length > 0) {
        await supabase.from("quest_step_configs").delete().in("id", toDelete);
      }

      // Upsert current steps
      for (const step of toSave) {
        const payload = {
          target_role: step.target_role,
          target_phase: step.target_phase,
          step_order: step.step_order,
          step_label: step.step_label,
          step_description: step.step_description || null,
          video_embed: step.video_embed || null,
          action_label: step.action_label || null,
          action_url: step.action_url || null,
          updated_at: new Date().toISOString(),
          created_by: user.id,
        };

        if (step.id) {
          await supabase.from("quest_step_configs").update(payload).eq("id", step.id);
        } else {
          await supabase.from("quest_step_configs").insert(payload);
        }
      }

      toast({ title: "Sauvegardé", description: "Les étapes ont été mises à jour." });
      await fetchSteps();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const roleConfig = ROLE_PHASES[activeRole];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Gestion des Quêtes</h3>
      </div>

      {/* Role selector */}
      <Tabs value={activeRole} onValueChange={setActiveRole}>
        <TabsList className="flex-wrap h-auto gap-1">
          {Object.entries(ROLE_PHASES).map(([key, val]) => (
            <TabsTrigger key={key} value={key} className="text-xs">
              {val.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Phase selector if multiple */}
      {roleConfig && roleConfig.phases.length > 1 && (
        <div className="flex gap-2">
          {roleConfig.phases.map(phase => (
            <Button
              key={phase.key}
              variant={activePhase === phase.key ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setActivePhase(phase.key)}
            >
              {phase.label}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {currentSteps.map((step, i) => (
            <div key={step.id || `new-${i}`} className="border border-border rounded-lg p-4 bg-card space-y-3">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-mono text-muted-foreground w-8">#{i + 1}</span>
                <Input
                  placeholder="Titre de l'étape"
                  value={step.step_label}
                  onChange={(e) => updateStep(i, "step_label", e.target.value)}
                  className="flex-1 h-8 text-sm"
                />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => moveStep(i, -1)} disabled={i === 0}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => moveStep(i, 1)} disabled={i === currentSteps.length - 1}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeStep(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <Textarea
                placeholder="Description (optionnel)"
                value={step.step_description || ""}
                onChange={(e) => updateStep(i, "step_description", e.target.value)}
                className="text-xs min-h-[50px]"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground font-mono">Lien vidéo embed (optionnel)</label>
                  <div className="flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="URL ou code embed"
                      value={step.video_embed || ""}
                      onChange={(e) => updateStep(i, "video_embed", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground font-mono">Bouton d'action (optionnel)</label>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Label du bouton"
                      value={step.action_label || ""}
                      onChange={(e) => updateStep(i, "action_label", e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      placeholder="URL"
                      value={step.action_url || ""}
                      onChange={(e) => updateStep(i, "action_url", e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addStep}>
              <Plus className="w-3.5 h-3.5" />
              Ajouter une étape
            </Button>
            <Button size="sm" className="gap-1.5 text-xs" onClick={saveAll} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Sauvegarder
            </Button>
          </div>

          {currentSteps.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucune étape configurée pour ce rôle/phase. Les quêtes par défaut seront affichées.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
