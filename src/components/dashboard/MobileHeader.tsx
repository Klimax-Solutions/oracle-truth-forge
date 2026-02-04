import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Database, Calendar, BarChart3, Clock, Crosshair, Video, ShieldCheck, Crown, FileUp } from "lucide-react";

interface MobileHeaderProps {
  userEmail: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  dataSourceSelector?: React.ReactNode;
}

const tabs = [
  { id: "execution", label: "Exécution d'Oracle", icon: Crosshair },
  { id: "setup", label: "Setup", icon: Database },
  { id: "journal", label: "Journal de Trading", icon: Calendar },
  { id: "distribution", label: "Distribution RR", icon: BarChart3 },
  { id: "timing", label: "Timing Analysis", icon: Clock },
  { id: "videos", label: "Vidéo du Setup", icon: Video },
];

const adminTabs = [
  { id: "batch-import", label: "Import Batch", icon: FileUp },
  { id: "admin", label: "Vérifications Admin", icon: ShieldCheck },
];

const superAdminTab = { id: "roles", label: "Gestion des Rôles", icon: Crown };

export const MobileHeader = ({
  userEmail,
  activeTab,
  onTabChange,
  onLogout,
  isAdmin,
  isSuperAdmin,
  dataSourceSelector,
}: MobileHeaderProps) => {
  let allTabs = [...tabs];
  if (isAdmin) {
    allTabs = [...allTabs, ...adminTabs];
  }
  if (isSuperAdmin) {
    allTabs = [...allTabs, superAdminTab];
  }

  const currentTab = allTabs.find((t) => t.id === activeTab);

  return (
    <header className="md:hidden border-b border-border bg-card sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="w-5 h-5" />
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
          <div className="flex items-center gap-2">
            {currentTab && <currentTab.icon className="w-4 h-4 text-muted-foreground" />}
            <span className="text-sm font-medium text-foreground truncate max-w-[150px]">
              {currentTab?.label || "Oracle"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dataSourceSelector}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
