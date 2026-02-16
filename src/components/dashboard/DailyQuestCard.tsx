import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Play,
  Database,
  Send,
  ExternalLink,
  Swords,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  Trophy,
  LogIn,
  Info,
  Phone,
  Layout,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { QuestData } from "@/hooks/useQuestData";
import { useToast } from "@/hooks/use-toast";
import { EarlyAccessTimer } from "./EarlyAccessTimer";

interface EASetting {
  button_key: string;
  button_label: string;
  button_url: string;
}

interface DailyQuestCardProps {
  questData: QuestData;
  onNavigateToVideos: () => void;
  onNavigateToSetup: () => void;
  onRequestVerification?: () => void;
  isEarlyAccess?: boolean;
  expiresAt?: string | null;
  eaSettings?: EASetting[];
}

const FX_REPLAY_LOGIN_URL = "https://app.fxreplay.com/en-US/login";
const FX_REPLAY_DASHBOARD_URL = "https://app.fxreplay.com/en-US/auth/testing/dashboard";

export const DailyQuestCard = ({
  questData,
  onNavigateToVideos,
  onNavigateToSetup,
  onRequestVerification,
  isEarlyAccess = false,
  expiresAt,
  eaSettings = [],
}: DailyQuestCardProps) => {
  const [showCalendar, setShowCalendar] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    allVideosWatched,
    viewedVideos,
    totalVideos,
    ebaucheComplete,
    ebaucheTradesAnalyzed,
    ebaucheTradesRequired,
    ebaucheStatus,
    fxReplayConnected,
    todayWinningExecutions,
    todayExecutions,
    dailyGoal,
    dailyGoalMet,
    executionsByDate,
    onboardingComplete,
    setFxReplayFlag,
  } = questData;

  // Determine which onboarding step is active
  const onboardingStep = !allVideosWatched ? 1 : !ebaucheComplete ? 2 : 3;

  // After onboarding, determine execution quest phase
  const isFirstExecutionQuest = onboardingComplete && !fxReplayConnected;

  const handleFxReplayCheckbox = (checked: boolean) => {
    if (!checked) return;
    setFxReplayFlag();
    toast({
      title: "FX Replay connecté !",
      description: "Vous pouvez maintenant récolter vos datas quotidiennes.",
    });
  };

  // Build calendar data (last 30 days)
  const calendarDays = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    calendarDays.push({
      date: d,
      key,
      data: executionsByDate[key] || null,
    });
  }

  // Selected day details
  const selectedDayData = selectedDay ? executionsByDate[selectedDay] : null;

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 md:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Swords className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {onboardingComplete ? "Quête du jour" : "Quêtes d'initiation"}
            </h3>
            <p className="text-[10px] text-muted-foreground font-mono">
              {onboardingComplete
                ? `${todayWinningExecutions}/${dailyGoal} datas gagnantes récoltées`
                : `Étape ${onboardingStep}/3`}
            </p>
          </div>
        </div>

        {onboardingComplete && !isFirstExecutionQuest && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => { setShowCalendar(!showCalendar); setSelectedDay(null); }}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Historique de récolte</span>
            {showCalendar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        )}
      </div>

      {/* Onboarding Quests */}
      {!onboardingComplete && !isEarlyAccess && (
        <div className="space-y-3">
          {/* Quest 1: Videos */}
          <QuestItem
            completed={allVideosWatched}
            active={onboardingStep === 1}
            title="Visionner l'intégralité des vidéos Oracle"
            subtitle={`${viewedVideos}/${totalVideos} vidéos vues`}
            actionLabel="Accéder aux vidéos"
            actionIcon={<Play className="w-3 h-3" />}
            onAction={onNavigateToVideos}
            showAction={!allVideosWatched}
          />

          {/* Quest 2: Harvest first 15 data */}
          <QuestItem
            completed={ebaucheComplete}
            active={onboardingStep === 2}
            title="Récolter les 15 premières data"
            subtitle={`${ebaucheTradesAnalyzed}/${ebaucheTradesRequired} data récoltées, analysées et comprises`}
            actionLabel="Accéder aux 15 premières datas"
            actionIcon={<Database className="w-3 h-3" />}
            onAction={onNavigateToSetup}
            showAction={!ebaucheComplete && onboardingStep === 2}
          />

          {/* Quest 3: Request verification */}
          <QuestItem
            completed={ebaucheStatus === "validated" || ebaucheStatus === "pending_review"}
            active={onboardingStep === 3}
            title="Demander la vérification"
            subtitle={
              ebaucheStatus === "pending_review"
                ? "En attente de validation"
                : ebaucheStatus === "validated"
                ? "Phase d'ébauche validée !"
                : "Débloquer le cycle 1 de récolte"
            }
            actionLabel="Demander la vérification"
            actionIcon={<Send className="w-3 h-3" />}
            onAction={onRequestVerification}
            showAction={onboardingStep === 3 && ebaucheStatus !== "pending_review" && ebaucheStatus !== "validated"}
          />
        </div>
      )}

      {/* Early Access Quest Steps */}
      {isEarlyAccess && (
        <div className="space-y-3">
          {/* Step 1: Appel confidentiel - always completed */}
          <QuestItem
            completed={true}
            active={false}
            title="Appel confidentiel avec l'équipe Mercure"
            subtitle="Candidature sur le point d'être validée"
          />

          {/* Step 2: Prendre en main la plateforme */}
          <QuestItem
            completed={false}
            active={true}
            title="Prendre en main la plateforme"
            subtitle="Explorez les onglets, le simulateur de performance et consultez les 50 premières data accessibles"
          />

          {/* Step 3: Accéder à Oracle with timer + button */}
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-md border transition-all",
            "border-border bg-card/50 opacity-80"
          )}>
            <div className="mt-0.5">
              <Circle className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-medium text-foreground">Accéder à Oracle</p>
              <p className="text-[10px] text-muted-foreground">Procéder au règlement</p>
              {expiresAt && (
                <div className="mt-1">
                  <EarlyAccessTimer expiresAt={expiresAt} />
                </div>
              )}
              {(() => {
                const oracleSetting = eaSettings.find(s => s.button_key === "acceder_a_oracle");
                const oracleUrl = oracleSetting?.button_url || "#";
                return (
                  <a href={oracleUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="default" size="sm" className="mt-1 text-xs h-7 gap-1.5">
                      <Zap className="w-3 h-3" />
                      Accéder à Oracle
                    </Button>
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* First Execution Quest (FX Replay setup) - member only */}
      {isFirstExecutionQuest && !isEarlyAccess && (
        <div className="space-y-3">
          <QuestItem
            completed={false}
            active={true}
            title="S'inscrire ou se connecter sur FX Replay"
            subtitle="Configurez votre accès pour récolter vos datas"
          >
            <div className="mt-2 space-y-2">
              <a
                href={FX_REPLAY_LOGIN_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5">
                  <LogIn className="w-3 h-3" />
                  Accéder à FX Replay
                </Button>
              </a>
              <div className="flex items-center gap-2 mt-2">
                <Checkbox
                  id="fxreplay-check"
                  onCheckedChange={(checked) => handleFxReplayCheckbox(!!checked)}
                />
                <label htmlFor="fxreplay-check" className="text-xs text-muted-foreground cursor-pointer">
                  J'ai créé mon compte / je suis connecté sur FX Replay
                </label>
              </div>
            </div>
          </QuestItem>

          <QuestItem
            completed={false}
            active={false}
            title="Récolter vos 5 premières datas"
            subtitle="Disponible après connexion à FX Replay"
          />
        </div>
      )}

      {/* Daily Quest (after onboarding + FX Replay connected) */}
      {onboardingComplete && !isFirstExecutionQuest && (
        <div className="space-y-3">
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-md border transition-all",
            dailyGoalMet
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-primary/40 bg-primary/5"
          )}>
            <div className="mt-0.5">
              {dailyGoalMet ? (
                <Trophy className="w-4 h-4 text-yellow-500" />
              ) : (
                <Swords className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                dailyGoalMet ? "text-emerald-400" : "text-foreground"
              )}>
                {dailyGoalMet
                  ? "Objectif atteint ! 🎯"
                  : `Récolter ${dailyGoal} datas gagnantes aujourd'hui`}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {todayWinningExecutions}/{dailyGoal} datas gagnantes récoltées
                {todayExecutions > dailyGoal && ` (${todayExecutions} au total)`}
              </p>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    dailyGoalMet ? "bg-emerald-500" : "bg-primary"
                  )}
                  style={{ width: `${Math.min((todayWinningExecutions / dailyGoal) * 100, 100)}%` }}
                />
              </div>

              {!dailyGoalMet && (
                <a
                  href={FX_REPLAY_DASHBOARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-3 text-xs h-8 gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Récolter ma data
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* Calendar tracker */}
          {showCalendar && (
            <div className="border border-border rounded-md p-3 bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Historique de récolte — 30 derniers jours
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {today.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {calendarDays.map((day) => {
                  const hasData = day.data && day.data.count > 0;
                  const metGoal = day.data && day.data.wins >= dailyGoal;
                  const isToday = day.key === today.toISOString().split("T")[0];
                  const isSelected = selectedDay === day.key;

                  return (
                    <div
                      key={day.key}
                      onClick={() => hasData ? setSelectedDay(isSelected ? null : day.key) : null}
                      className={cn(
                        "aspect-square rounded-sm flex flex-col items-center justify-center text-[8px] font-mono relative transition-all",
                        metGoal
                          ? "bg-emerald-500/30 text-emerald-400"
                          : hasData
                          ? "bg-primary/20 text-primary"
                          : "bg-muted/50 text-muted-foreground/50",
                        isToday && "ring-1 ring-primary",
                        hasData && "cursor-pointer hover:ring-1 hover:ring-foreground/30",
                        isSelected && "ring-2 ring-foreground"
                      )}
                      title={`${day.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} — ${day.data?.count || 0} data récoltées`}
                    >
                      <span className="leading-none">{day.date.getDate()}</span>
                      {hasData && (
                        <span className="text-[6px] font-bold leading-none mt-0.5">{day.data!.count} data</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Selected day detail panel */}
              {selectedDay && selectedDayData && (
                <div className="mt-3 p-3 border border-border rounded-md bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      {new Date(selectedDay).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-muted/50 rounded-md">
                      <p className="text-lg font-bold text-foreground">{selectedDayData.count}</p>
                      <p className="text-[9px] text-muted-foreground font-mono uppercase">Data récoltées</p>
                    </div>
                    <div className="text-center p-2 bg-emerald-500/10 rounded-md">
                      <p className="text-lg font-bold text-emerald-400">{selectedDayData.wins}</p>
                      <p className="text-[9px] text-muted-foreground font-mono uppercase">Gagnantes</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-md">
                      <p className={cn(
                        "text-lg font-bold",
                        selectedDayData.rr >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {selectedDayData.rr >= 0 ? "+" : ""}{selectedDayData.rr.toFixed(1)}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono uppercase">RR Total</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-emerald-500/30" /> Objectif atteint
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-primary/20" /> Datas récoltées
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-muted/50" /> Aucune data
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Reusable quest item component
interface QuestItemProps {
  completed: boolean;
  active: boolean;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  showAction?: boolean;
  children?: React.ReactNode;
}

const QuestItem = ({
  completed,
  active,
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
  showAction = false,
  children,
}: QuestItemProps) => (
  <div className={cn(
    "flex items-start gap-3 p-3 rounded-md border transition-all",
    completed
      ? "border-emerald-500/30 bg-emerald-500/5"
      : active
      ? "border-primary/40 bg-primary/5"
      : "border-border bg-card/50 opacity-60"
  )}>
    <div className="mt-0.5">
      {completed ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : (
        <Circle className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn(
        "text-sm font-medium",
        completed ? "text-emerald-400 line-through" : "text-foreground"
      )}>
        {title}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {subtitle}
      </p>
      {showAction && onAction && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 text-xs h-7 gap-1.5"
          onClick={onAction}
        >
          {actionIcon}
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  </div>
);
