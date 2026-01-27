import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

interface SetupCardProps {
  title: string;
  number: string;
  description: string;
  href: string;
  stats?: {
    trades: number;
    rr: number;
    winRate: number;
  };
  className?: string;
}

export const SetupCard = ({
  title,
  number,
  description,
  href,
  stats,
  className,
}: SetupCardProps) => {
  return (
    <Link
      to={href}
      className={cn(
        "group block border border-border bg-card p-8 relative overflow-hidden",
        "hover:border-muted-foreground/30 transition-all duration-300",
        "hover:bg-secondary",
        className
      )}
    >
      {/* Number badge */}
      <div className="absolute top-6 right-6">
        <span className="text-5xl font-black text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors duration-300">
          {number}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-2xl font-bold text-foreground group-hover:text-foreground transition-all duration-300">
            {title}{title === "Oracle" && <sup className="text-xs font-normal align-super ml-0.5">™</sup>}
          </h3>
          <div className="w-8 h-8 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <ArrowUpRight className="w-4 h-4 text-foreground" />
          </div>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
          {description}
        </p>

        {/* Stats row */}
        {stats && (
          <div className="flex items-center gap-8 pt-6 border-t border-border">
            <div>
              <p className="text-xl font-bold text-foreground">{stats.trades}</p>
              <p className="text-xs text-muted-foreground font-mono uppercase">Trades</p>
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">+{stats.rr}</p>
              <p className="text-xs text-muted-foreground font-mono uppercase">RR</p>
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{stats.winRate}%</p>
              <p className="text-xs text-muted-foreground font-mono uppercase">Win</p>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};