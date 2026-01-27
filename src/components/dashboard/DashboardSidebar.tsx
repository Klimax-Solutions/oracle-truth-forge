import { cn } from "@/lib/utils";
import { Database, Calendar, BarChart3, Clock, ChevronRight, Crosshair, Video, ShieldCheck, Crown, FileUp } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "execution", label: "Exécution d'Oracle", icon: Crosshair },
  { id: "setup", label: "Setup", icon: Database },
  { id: "journal", label: "Journal de Trading", icon: Calendar },
  { id: "distribution", label: "Distribution RR", icon: BarChart3 },
  { id: "timing", label: "Timing Analysis", icon: Clock },
  { id: "videos", label: "Vidéo du Setup Oracle", icon: Video },
];

const adminTabs = [
  { id: "batch-import", label: "Import Batch", icon: FileUp },
  { id: "admin", label: "Vérifications Admin", icon: ShieldCheck },
];
const superAdminTab = { id: "roles", label: "Gestion des Rôles", icon: Crown };

export const DashboardSidebar = ({ activeTab, onTabChange }: DashboardSidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkRoles = async () => {
      // Check if user is admin
      const { data: isAdminData } = await supabase.rpc('is_admin');
      if (isAdminData) {
        setIsAdmin(true);
      }
      
      // Check if user is super_admin
      const { data: isSuperAdminData } = await supabase.rpc('is_super_admin');
      if (isSuperAdminData) {
        setIsSuperAdmin(true);
      }
    };
    checkRoles();
  }, []);

  let allTabs = [...tabs];
  if (isAdmin) {
    allTabs = [...allTabs, ...adminTabs];
  }
  if (isSuperAdmin) {
    allTabs = [...allTabs, superAdminTab];
  }

  return (
    <aside 
      className={cn(
        "border-r border-border bg-card flex flex-col transition-all duration-300 ease-out",
        isExpanded ? "w-64" : "w-16"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-border transition-all duration-300 flex items-center justify-center",
        isExpanded ? "p-6" : "p-4"
      )}>
        {isExpanded ? (
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-center">
            Oracle<sup className="text-sm font-normal align-super ml-0.5">™</sup>
          </h1>
        ) : (
          <span className="text-xl font-bold text-foreground">O</span>
        )}
      </div>

      {/* Tabs */}
      <nav className="flex-1 p-2 space-y-1">
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 transition-all",
              "text-sm font-mono uppercase tracking-wider",
              isExpanded ? "px-4 py-3" : "px-0 py-3 justify-center",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
              tab.id === "batch-import" && "border-t border-border/40 mt-2 pt-4"
            )}
          >
            <tab.icon className="w-4 h-4 flex-shrink-0" />
            {isExpanded && <span className="truncate text-left">{tab.label}</span>}
          </button>
        ))}
      </nav>

      {/* Expand indicator */}
      {!isExpanded && (
        <div className="p-4 flex justify-center">
          <ChevronRight className="w-4 h-4 text-muted-foreground animate-pulse" />
        </div>
      )}

      {/* Footer */}
      {isExpanded && (
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider text-center">
            Oracle™ © 2026
          </p>
        </div>
      )}
    </aside>
  );
};
