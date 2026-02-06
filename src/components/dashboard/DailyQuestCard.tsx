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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QuestData } from "@/hooks/useQuestData";

interface DailyQuestCardProps {
  questData: QuestData;
  onNavigateToVideos: () => void;
  onNavigateToSetup: () => void;
  onRequestVerification?: () => void;
}

const FX_REPLAY_URL = "https://app.fxreplay.com/en-US/auth/testing/dashboard";

export const DailyQuestCard = ({
  questData,
  onNavigateToVideos,
  onNavigateToSetup,
  onRequestVerification,
}: DailyQuestCardProps) => {
  const [showCalendar, setShowCalendar] = useState(false);

  const {
    allVideosWatched,
    viewedVideos,
    totalVideos,
    ebaucheComplete,
    ebaucheTradesEntered,
    ebaucheTradesRequired,
    ebaucheStatus,
    todayWinningExecutions,
    dailyGoal,
    dailyGoalMet,
    executionsByDate,
    onboardingComplete,
  } = questData;

  // Determine which onboarding step is active
  const onboardingStep = !allVideosWatched ? 1 : !ebaucheComplete ? 2 : 3;

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

        {onboardingComplete && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setShowCalendar(!showCalendar)}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Historique</span>
            {showCalendar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        )}
      </div>

      {/* Onboarding Quests */}
      {!onboardingComplete && (
        <div className="space-y-3">
          {/* Quest 1: Videos */}
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-md border transition-all",
            allVideosWatched
              ? "border-emerald-500/30 bg-emerald-500/5"
              : onboardingStep === 1
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card/50 opacity-60"
          )}>
            <div className="mt-0.5">
              {allVideosWatched ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Circle className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                allVideosWatched ? "text-emerald-400 line-through" : "text-foreground"
              )}>
                Visionner l'intégralité des vidéos Oracle
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {viewedVideos}/{totalVideos} vidéos vues
              </p>
              {!allVideosWatched && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs h-7 gap-1.5"
                  onClick={onNavigateToVideos}
                >
                  <Play className="w-3 h-3" />
                  Accéder aux vidéos
                </Button>
              )}
            </div>
          </div>

          {/* Quest 2: Analyze 15 trades */}
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-md border transition-all",
            ebaucheComplete
              ? "border-emerald-500/30 bg-emerald-500/5"
              : onboardingStep === 2
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card/50 opacity-60"
          )}>
            <div className="mt-0.5">
              {ebaucheComplete ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                ebaucheComplete ? "text-emerald-400 line-through" : "text-foreground"
              )}>
                Analyser en détail les 15 premières datas
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {ebaucheTradesEntered}/{ebaucheTradesRequired} datas saisies
              </p>
              {!ebaucheComplete && onboardingStep === 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs h-7 gap-1.5"
                  onClick={onNavigateToSetup}
                >
                  <Database className="w-3 h-3" />
                  Accéder aux 15 premières datas
                </Button>
              )}
            </div>
          </div>

          {/* Quest 3: Request verification */}
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-md border transition-all",
            ebaucheStatus === "validated" || ebaucheStatus === "pending_review"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : onboardingStep === 3
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card/50 opacity-60"
          )}>
            <div className="mt-0.5">
              {ebaucheStatus === "validated" || ebaucheStatus === "pending_review" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                ebaucheStatus === "validated" || ebaucheStatus === "pending_review"
                  ? "text-emerald-400 line-through"
                  : "text-foreground"
              )}>
                Demander la vérification
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {ebaucheStatus === "pending_review"
                  ? "En attente de validation"
                  : ebaucheStatus === "validated"
                  ? "Phase d'ébauche validée !"
                  : "Débloquer le cycle 1 de récolte"}
              </p>
              {onboardingStep === 3 && ebaucheStatus !== "pending_review" && ebaucheStatus !== "validated" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs h-7 gap-1.5"
                  onClick={onRequestVerification}
                >
                  <Send className="w-3 h-3" />
                  Demander la vérification
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daily Quest (after onboarding) */}
      {onboardingComplete && (
        <div className="space-y-3">
          {/* Main daily quest */}
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
                  href={FX_REPLAY_URL}
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
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                Historique des 30 derniers jours
              </p>
              <div className="grid grid-cols-10 gap-1">
                {calendarDays.map((day) => {
                  const hasData = day.data && day.data.count > 0;
                  const metGoal = day.data && day.data.wins >= dailyGoal;
                  const isToday = day.key === today.toISOString().split("T")[0];

                  return (
                    <div
                      key={day.key}
                      className={cn(
                        "aspect-square rounded-sm flex items-center justify-center text-[8px] font-mono relative group cursor-default",
                        metGoal
                          ? "bg-emerald-500/30 text-emerald-400"
                          : hasData
                          ? "bg-primary/20 text-primary"
                          : "bg-muted/50 text-muted-foreground/50",
                        isToday && "ring-1 ring-primary"
                      )}
                      title={`${day.date.toLocaleDateString("fr-FR")} — ${day.data?.count || 0} trades, ${day.data?.wins || 0} wins`}
                    >
                      {day.date.getDate()}
                    </div>
                  );
                })}
              </div>
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
