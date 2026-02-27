import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2, Video, CheckCircle2, Circle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QuestVideoEmbed } from "../QuestVideoEmbed";

// Default steps per role/phase (read-only reference)
const DEFAULT_STEPS: Record<string, { label: string; subtitle: string }[]> = {
  "member__ebauche": [
    { label: "Visionner l'intégralité des vidéos Oracle", subtitle: "X/X vidéos vues" },
    { label: "Récolter les 15 premières data", subtitle: "0/15 data récoltées, analysées et comprises" },
    { label: "Demander la vérification", subtitle: "Débloquer le cycle 1 de récolte" },
  ],
  "member__cycle_1": [
    { label: "Récolter 5 datas gagnantes aujourd'hui", subtitle: "Objectif quotidien de récolte" },
  ],
  "member__cycle_2": [
    { label: "Récolter 5 datas gagnantes aujourd'hui", subtitle: "Objectif quotidien de récolte" },
  ],
  "member__cycle_3": [
    { label: "Récolter 5 datas gagnantes aujourd'hui", subtitle: "Objectif quotidien de récolte" },
  ],
  "member__cycle_4": [
    { label: "Récolter 5 datas gagnantes aujourd'hui", subtitle: "Objectif quotidien de récolte" },
  ],
  "member__cycle_5": [
    { label: "Récolter 5 datas gagnantes aujourd'hui", subtitle: "Objectif quotidien de récolte" },
  ],
  "member__cycle_6": [
    { label: "Récolter 5 datas gagnantes aujourd'hui", subtitle: "Objectif quotidien de récolte" },
  ],
  "member__cycle_7": [
    { label: "Récolter 5 datas gagnantes aujourd'hui", subtitle: "Objectif quotidien de récolte" },
  ],
  "member__cycle_8": [
    { label: "Récolter 5 datas gagnantes aujourd'hui", subtitle: "Objectif quotidien de récolte" },
  ],
  "early_access_precall__default": [
    { label: "Accéder à la plateforme", subtitle: "Connecté à la plateforme Oracle" },
    { label: "Accéder aux vidéos exclusives", subtitle: "Consultez les vidéos de formation Oracle" },
    { label: "Déposer ma candidature", subtitle: "Accéder à Oracle" },
  ],
  "early_access_postcall__default": [
    { label: "Appel confidentiel avec l'équipe Mercure", subtitle: "Candidature validée" },
    { label: "Accéder aux vidéos exclusives Oracle", subtitle: "Consultez les vidéos de formation Oracle" },
    { label: "Accéder à Oracle", subtitle: "Procéder au règlement" },
  ],
};

const ROLE_PHASES: Record<string, { label: string; phases: { key: string; label: string }[] }> = {
  member: {
    label: "Membre",
    phases: [
      { key: "ebauche", label: "Phase Ébauche" },
      { key: "cycle_1", label: "Cycle 1" },
      { key: "cycle_2", label: "Cycle 2" },
      { key: "cycle_3", label: "Cycle 3" },
      { key: "cycle_4", label: "Cycle 4" },
      { key: "cycle_5", label: "Cycle 5" },
      { key: "cycle_6", label: "Cycle 6" },
      { key: "cycle_7", label: "Cycle 7" },
      { key: "cycle_8", label: "Cycle 8" },
    ],
  },
  early_access_precall: {
    label: "EA — Pré-call",
    phases: [{ key: "default", label: "Parcours Pré-call" }],
  },
  early_access_postcall: {
    label: "EA — Post-call",
    phases: [{ key: "default", label: "Parcours Post-call" }],
  },
};

export const QuestStepManager = () => {
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState("member");
  const [activePhase, setActivePhase] = useState("ebauche");
  const { toast } = useToast();

  // Fetch all quest video settings
  const fetchVideos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ea_global_settings")
      .select("setting_key, setting_value")
      .like("setting_key", "quest_video_%");
    
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(d => { map[d.setting_key] = d.setting_value; });
      setVideoUrls(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  useEffect(() => {
    const role = ROLE_PHASES[activeRole];
    if (role && role.phases.length > 0) {
      setActivePhase(role.phases[0].key);
    }
  }, [activeRole]);

  const settingKey = `quest_video_${activeRole}_${activePhase}`;
  const currentVideo = videoUrls[settingKey] || "";
  const defaultSteps = DEFAULT_STEPS[`${activeRole}__${activePhase}`] || [];
  const roleConfig = ROLE_PHASES[activeRole];

  const handleVideoChange = (value: string) => {
    setVideoUrls(prev => ({ ...prev, [settingKey]: value }));
  };

  const saveVideo = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: existing } = await supabase
        .from("ea_global_settings")
        .select("id")
        .eq("setting_key", settingKey)
        .maybeSingle();

      if (existing) {
        await supabase.from("ea_global_settings")
          .update({ setting_value: currentVideo, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("ea_global_settings")
          .insert({ setting_key: settingKey, setting_value: currentVideo, updated_by: user.id });
      }

      toast({ title: "Vidéo sauvegardée", description: `Vidéo mise à jour pour ${roleConfig?.label} — ${roleConfig?.phases.find(p => p.key === activePhase)?.label}` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

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

      {/* Phase selector */}
      {roleConfig && roleConfig.phases.length > 1 && (
        <div className="flex flex-wrap gap-2">
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
        <div className="space-y-4">
          {/* Default steps (read-only) */}
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
              Étapes affichées à l'utilisateur
            </p>
            {defaultSteps.length > 0 ? (
              <div className="space-y-2">
                {defaultSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-md border border-border bg-card/50">
                    <div className="mt-0.5">
                      {i === 0 && activePhase === "ebauche" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{step.subtitle}</p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                Aucune étape par défaut pour cette phase.
              </p>
            )}
          </div>

          {/* Video configuration */}
          <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Vidéo explicative de la phase</p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Cette vidéo sera affichée en haut de la section quête pour guider l'utilisateur. Supporte YouTube, Google Drive, ou un code embed (iframe/script).
            </p>
            <Input
              placeholder="URL YouTube, Google Drive, ou code embed iframe..."
              value={currentVideo}
              onChange={(e) => handleVideoChange(e.target.value)}
              className="text-sm"
            />
            {currentVideo && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground font-mono mb-2">Aperçu :</p>
                <QuestVideoEmbed embedCode={currentVideo} />
              </div>
            )}
            <Button size="sm" className="gap-1.5 text-xs" onClick={saveVideo} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Sauvegarder la vidéo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
