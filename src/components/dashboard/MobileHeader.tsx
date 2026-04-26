import { Menu, LogOut, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Database, BarChart3, Crosshair, Video, ShieldCheck, Crown, FileUp, Trophy, Film, Award, Users, Settings, Layers } from "lucide-react";
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
  overrideIsEarlyAccess?: boolean;
}

const tabs = [
  { id: "execution", label: "Exécution d'Oracle", icon: Crosshair },
  { id: "setup", label: "Setup", icon: Database },
  { id: "data-analysis", label: "Data Analysis", icon: BarChart3 },
  { id: "videos", label: "Vidéo du Setup", icon: Video },
  { id: "successes", label: "Chat", icon: Trophy },
  { id: "results", label: "Résultats", icon: Award },
];

// Admin tabs V2 — synchronisés avec DashboardSidebar (CRM, Gestion, Config + legacy)
const adminTabs = [
  { id: "crm", label: "CRM", icon: Users, section: "admin" },
  { id: "gestion", label: "Gestion", icon: Crown, section: "admin" },
  { id: "config", label: "Configuration", icon: Settings, section: "admin" },
  { id: "video-admin", label: "Vidéos (Admin)", icon: Film, section: "admin" },
  { id: "admin", label: "Vérif. Admin", icon: ShieldCheck, section: "admin", deprecated: true },
  { id: "early-access-mgmt", label: "Early Access", icon: Users, section: "admin", deprecated: true },
];

const setterOnlyTabs = [{ id: "crm", label: "CRM", icon: Users }];

export const MobileHeader = ({
  userEmail,
  activeTab,
  onTabChange,
  onLogout,
  isAdmin,
  isSuperAdmin,
  isSetter,
  dataSourceSelector,
  earlyAccessTimer,
  overrideIsEarlyAccess,
}: MobileHeaderProps) => {
  const { isEarlyAccess: _isEarlyAccess } = useEarlyAccess();
  const isEarlyAccess = overrideIsEarlyAccess !== undefined ? overrideIsEarlyAccess : _isEarlyAccess;
  const { settings: eaSettings } = useEarlyAccessSettings();
  const oracleBtn = eaSettings.find(s => s.button_key === "acceder_a_oracle");
  const oracleUrl = oracleBtn?.button_url;
  const { isAdmin: isMobileAdmin, isSuperAdmin: isMobileSuperAdmin } = (() => {
    return { isAdmin, isSuperAdmin };
  })();
  // Setter-only mode
  if (isSetter && !isSuperAdmin && !isAdmin) {
    const allTabs = setterOnlyTabs;
    const currentTab = allTabs.find((t) => t.id === activeTab);
    return (
      <header className="md:hidden border-b border-border bg-card sticky top-0 z-50">
        <div className="flex items-center justify-between px-3 py-2.5 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {currentTab && <currentTab.icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
            <span className="text-xs font-medium text-foreground truncate">{currentTab?.label || "Early Access"}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
    );
  }

  let allTabs: Array<{ id: string; label: string; icon: any; section?: string; deprecated?: boolean }> = [...tabs];

  // Admin V2: tous les onglets admin pour admin OU super_admin (Sidebar fait pareil)
  if (isAdmin || isSuperAdmin) {
    allTabs = [...allTabs, ...adminTabs];
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
              <nav className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
                {(() => {
                  let adminSectionShown = false;
                  return allTabs.map((tab) => {
                    const showAdminHeader = tab.section === "admin" && !adminSectionShown;
                    if (showAdminHeader) adminSectionShown = true;
                    return (
                      <div key={tab.id}>
                        {showAdminHeader && (
                          <div className="border-t border-border/40 mt-3 pt-3 px-4 pb-1">
                            <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
                              Admin
                            </span>
                          </div>
                        )}
                        <SheetTrigger asChild>
                          <button
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 transition-all",
                              "text-sm font-medium",
                              activeTab === tab.id
                                ? tab.deprecated
                                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                                  : "bg-primary text-primary-foreground"
                                : tab.deprecated
                                  ? "text-muted-foreground/40 hover:text-amber-400/60 hover:bg-amber-500/5"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
                            )}
                          >
                            <tab.icon className={cn("w-4 h-4 flex-shrink-0", tab.deprecated && "opacity-50")} />
                            <span className={cn("flex-1 text-left", tab.deprecated && "opacity-60")}>{tab.label}</span>
                            {tab.deprecated && (
                              <AlertTriangle className="w-3 h-3 text-amber-500/60 flex-shrink-0" />
                            )}
                          </button>
                        </SheetTrigger>
                      </div>
                    );
                  });
                })()}
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
