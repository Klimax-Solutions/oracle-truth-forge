import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  suffix?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export const StatCard = ({ label, value, icon: Icon, suffix, trend, className }: StatCardProps) => {
  return (
    <div className={cn(
      "glass-card rounded-xl p-6 group hover:border-primary/30 transition-all duration-300",
      "hover:shadow-[0_0_30px_hsl(38_92%_50%_/_0.1)]",
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            trend === "up" && "bg-success/10 text-success",
            trend === "down" && "bg-destructive/10 text-destructive",
            trend === "neutral" && "bg-muted text-muted-foreground"
          )}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "–"}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="stat-value">
          {value}
          {suffix && <span className="text-2xl ml-1">{suffix}</span>}
        </p>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
      </div>
    </div>
  );
};
