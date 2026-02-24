import { Menu, LogOut, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Database, BarChart3, Crosshair, Video, ShieldCheck, Crown, FileUp, Trophy, Film, Award } from "lucide-react";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { useEarlyAccessSettings } from "@/hooks/useEarlyAccessSettings";

interface MobileHeaderProps {
  userEmail: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isSetter?: boolean;
  dataSourceSelector?: React.ReactNode;
  earlyAccessTimer?: React.ReactNode;
}

const tabs = [
  { id: "execution", label: "Exécution d'Oracle", icon: Crosshair },
  { id: "setup", label: "Setup", icon: Database },
  { id: "data-analysis", label: "Data Analysis", icon: BarChart3 },
  { id: "videos", label: "Vidéo du Setup", icon: Video },
  { id: "successes", label: "Chat", icon: Trophy },
];

const earlyAccessTabs = [
  { id: "results", label: "Résultats", icon: Award },
];

const adminTabs = [
  { id: "admin", label: "Vérifications Admin", icon: ShieldCheck },
];

const superAdminTabs: { id: string; label: string; icon: any }[] = [];
import { Users as UsersIcon } from "lucide-react";
const setterOnlyTabs = [{ id: "early-access-mgmt", label: "Early Access", icon: UsersIcon }];

export const MobileHeader = ({
  userEmail,
  activeTab,
  onTabChange,
  onLogout,
  isAdmin,
  isSuperAdmin,
  dataSourceSelector,
  earlyAccessTimer,
}: MobileHeaderProps) => {
  const { isEarlyAccess } = useEarlyAccess();
  const { settings: eaSettings } = useEarlyAccessSettings();
  const oracleBtn = eaSettings.find(s => s.button_key === "acceder_a_oracle");
  const oracleUrl = oracleBtn?.button_url;
  const { isAdmin: isMobileAdmin, isSuperAdmin: isMobileSuperAdmin } = (() => {
    return { isAdmin, isSuperAdmin };
  })();
  let allTabs = isEarlyAccess 
    ? tabs.filter(t => t.id !== "successes") 
    : [...tabs];
  
  if (isEarlyAccess || isAdmin || isSuperAdmin) {
    allTabs = [...allTabs, ...earlyAccessTabs];
  }
  if (isAdmin) {
    allTabs = [...allTabs, ...adminTabs];
  }
  if (isSuperAdmin) {
    allTabs = [...allTabs, ...superAdminTabs];
  }

  const currentTab = allTabs.find((t) => t.id === activeTab);

  return (
    <header className="md:hidden border-b border-border bg-card sticky top-0 z-50">
      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 w-8 h-8">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="p-6 border-b border-border">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Oracle<sup className="text-sm font-normal align-super ml-0.5">™</sup>
                </h1>
              </div>
              <nav className="p-2 space-y-1">
                {allTabs.map((tab) => (
                  <SheetTrigger key={tab.id} asChild>
                    <button
                      onClick={() => onTabChange(tab.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 transition-all",
                        "text-sm font-medium",
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                        tab.id === "batch-import" && "border-t border-border/40 mt-2 pt-4"
                      )}
                    >
                      <tab.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  </SheetTrigger>
                ))}
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
                <p className="text-xs text-muted-foreground truncate mb-3">{userEmail}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                  className="w-full gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Déconnexion
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-1.5 min-w-0">
            {currentTab && <currentTab.icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
            <span className="text-xs font-medium text-foreground truncate">
              {currentTab?.label || "Oracle"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isEarlyAccess && oracleUrl && (
            <a href={oracleUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="icon" className="w-8 h-8 shrink-0">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          {earlyAccessTimer}
          {dataSourceSelector}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
