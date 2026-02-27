import { useState, useMemo } from "react";
import {
  Swords,
  X,
  ExternalLink,
  Trophy,
  CheckCircle2,
  Circle,
  Play,
  Database,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { QuestData } from "@/hooks/useQuestData";
import { useToast } from "@/hooks/use-toast";
import { useQuestStepConfigs, QuestStepConfig } from "@/hooks/useQuestStepConfigs";
import { QuestVideoEmbed } from "./QuestVideoEmbed";

interface QuestFloatingBubbleProps {
  questData: QuestData;
  onNavigateToVideos: () => void;
  onNavigateToSetup: () => void;
  onNavigateToExecution: () => void;
}

const FX_REPLAY_LOGIN_URL = "https://app.fxreplay.com/en-US/login";
const FX_REPLAY_DASHBOARD_URL = "https://app.fxreplay.com/en-US/auth/testing/dashboard";

export const QuestFloatingBubble = ({
  questData,
  onNavigateToVideos,
  onNavigateToSetup,
  onNavigateToExecution,
}: QuestFloatingBubbleProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const {
    onboardingComplete,
    allVideosWatched,
    viewedVideos,
    totalVideos,
    ebaucheComplete,
    ebaucheTradesAnalyzed,
    ebaucheTradesRequired,
    fxReplayConnected,
    dailyGoalMet,
    todayWinningExecutions,
    dailyGoal,
    loading,
    setFxReplayFlag,
  } = questData;

  // Determine which config to load
  const questRole = useMemo(() => {
    if (!onboardingComplete) return "member";
    return "member";
  }, [onboardingComplete]);

  const questPhase = useMemo(() => {
    if (!onboardingComplete) return "ebauche";
    return "cycles";
  }, [onboardingComplete]);

  const { steps: configuredSteps } = useQuestStepConfigs(questRole, questPhase);

  if (loading) return null;

  const isFirstExecutionQuest = onboardingComplete && !fxReplayConnected;
  const showBadge = onboardingComplete ? !dailyGoalMet : true;
  const hasCustomSteps = configuredSteps.length > 0;

  const handleFxReplayCheckbox = (checked: boolean) => {
    if (!checked) return;
    setFxReplayFlag();
    toast({
      title: "FX Replay connecté !",
      description: "Vous pouvez maintenant récolter vos datas.",
    });
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2">
      {isOpen && (
        <div className="w-80 max-h-[70vh] bg-card border border-border rounded-lg shadow-2xl overflow-hidden animate-fade-in mb-2 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">
                {onboardingComplete
                  ? isFirstExecutionQuest
                    ? "Première quête d'exécution"
                    : "Quête du jour"
                  : "Quêtes d'initiation"}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            {/* If admin configured custom steps, show them */}
            {hasCustomSteps ? (
              <CustomQuestSteps steps={configuredSteps} />
            ) : (
              <>
                {/* Default onboarding quests */}
                {!onboardingComplete && (
                  <DefaultOnboardingQuests
                    allVideosWatched={allVideosWatched}
                    viewedVideos={viewedVideos}
                    totalVideos={totalVideos}
                    ebaucheComplete={ebaucheComplete}
                    ebaucheTradesAnalyzed={ebaucheTradesAnalyzed}
                    ebaucheTradesRequired={ebaucheTradesRequired}
                    onNavigateToVideos={() => { onNavigateToVideos(); setIsOpen(false); }}
                    onNavigateToSetup={() => { onNavigateToSetup(); setIsOpen(false); }}
                    onNavigateToExecution={() => { onNavigateToExecution(); setIsOpen(false); }}
                  />
                )}

                {/* First execution quest: FX Replay connection */}
                {isFirstExecutionQuest && (
                  <FxReplayQuest onCheckboxChange={handleFxReplayCheckbox} />
                )}

                {/* Daily quest */}
                {onboardingComplete && !isFirstExecutionQuest && (
                  <DailyQuest
                    dailyGoalMet={dailyGoalMet}
                    todayWinningExecutions={todayWinningExecutions}
                    dailyGoal={dailyGoal}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all",
          "bg-card border border-border hover:border-primary/50 hover:shadow-primary/10",
          isOpen && "border-primary/50"
        )}
      >
        <Swords className={cn("w-5 h-5 text-foreground", !dailyGoalMet && !isOpen && "animate-pulse")} />
        {showBadge && !isOpen && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center px-1 animate-pulse">
            !
          </span>
        )}
      </button>
    </div>
  );
};

// Custom quest steps from admin config
const CustomQuestSteps = ({ steps }: { steps: QuestStepConfig[] }) => (
  <>
    {steps.map((step, i) => (
      <div key={step.id} className="space-y-2">
        <BubbleQuestItem completed={false} label={step.step_label || `Étape ${i + 1}`} />
        {step.step_description && (
          <p className="text-[10px] text-muted-foreground ml-6">{step.step_description}</p>
        )}
        {step.video_embed && (
          <div className="ml-6">
            <QuestVideoEmbed embedCode={step.video_embed} />
          </div>
        )}
        {step.action_label && step.action_url && (
          <a href={step.action_url} target="_blank" rel="noopener noreferrer" className="block ml-6">
            <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1.5">
              <ExternalLink className="w-3 h-3" />
              {step.action_label}
            </Button>
          </a>
        )}
      </div>
    ))}
  </>
);

// Default onboarding quests (fallback)
const DefaultOnboardingQuests = ({
  allVideosWatched, viewedVideos, totalVideos,
  ebaucheComplete, ebaucheTradesAnalyzed, ebaucheTradesRequired,
  onNavigateToVideos, onNavigateToSetup, onNavigateToExecution,
}: any) => (
  <>
    <BubbleQuestItem
      completed={allVideosWatched}
      label={`Visionner les vidéos (${viewedVideos}/${totalVideos})`}
    />
    {!allVideosWatched && (
      <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1.5" onClick={onNavigateToVideos}>
        <Play className="w-3 h-3" />
        Accéder aux vidéos
      </Button>
    )}
    <BubbleQuestItem
      completed={ebaucheComplete}
      label={`Récolter les 15 premières data (${ebaucheTradesAnalyzed}/${ebaucheTradesRequired})`}
    />
    {allVideosWatched && !ebaucheComplete && (
      <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1.5" onClick={onNavigateToSetup}>
        <Database className="w-3 h-3" />
        Accéder aux datas
      </Button>
    )}
    <BubbleQuestItem completed={false} label="Demander la vérification" />
    {ebaucheComplete && (
      <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1.5" onClick={onNavigateToExecution}>
        Voir la progression
      </Button>
    )}
  </>
);

// FX Replay quest
const FxReplayQuest = ({ onCheckboxChange }: { onCheckboxChange: (checked: boolean) => void }) => (
  <>
    <BubbleQuestItem completed={false} label="Se connecter sur FX Replay" />
    <a href={FX_REPLAY_LOGIN_URL} target="_blank" rel="noopener noreferrer" className="block">
      <Button variant="outline" size="sm" className="w-full text-xs h-7 gap-1.5">
        <LogIn className="w-3 h-3" />
        Accéder à FX Replay
      </Button>
    </a>
    <div className="flex items-center gap-2">
      <Checkbox id="bubble-fxreplay" onCheckedChange={(checked) => onCheckboxChange(!!checked)} />
      <label htmlFor="bubble-fxreplay" className="text-[11px] text-muted-foreground cursor-pointer">
        Connecté sur FX Replay
      </label>
    </div>
  </>
);

// Daily quest
const DailyQuest = ({ dailyGoalMet, todayWinningExecutions, dailyGoal }: any) => (
  <>
    <div className="flex items-center gap-2.5">
      {dailyGoalMet ? (
        <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" />
      ) : (
        <Swords className="w-4 h-4 text-primary flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", dailyGoalMet ? "text-emerald-400" : "text-foreground")}>
          {dailyGoalMet ? "Objectif atteint ! 🎯" : `Récolter ${dailyGoal} datas gagnantes`}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {todayWinningExecutions}/{dailyGoal} récoltées aujourd'hui
        </p>
      </div>
    </div>
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", dailyGoalMet ? "bg-emerald-500" : "bg-primary")}
        style={{ width: `${Math.min((todayWinningExecutions / dailyGoal) * 100, 100)}%` }}
      />
    </div>
    {!dailyGoalMet && (
      <a href={FX_REPLAY_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="block">
        <Button variant="default" size="sm" className="w-full text-xs h-8 gap-1.5">
          <ExternalLink className="w-3 h-3" />
          Récolter ma data
        </Button>
      </a>
    )}
  </>
);

const BubbleQuestItem = ({ completed, label }: { completed: boolean; label: string }) => (
  <div className="flex items-center gap-2.5">
    {completed ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
    ) : (
      <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
    )}
    <span className={cn("text-xs", completed ? "text-emerald-400 line-through" : "text-foreground")}>
      {label}
    </span>
  </div>
);
