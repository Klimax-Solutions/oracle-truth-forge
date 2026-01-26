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
        "group block glass-card rounded-2xl p-6 relative overflow-hidden",
        "hover:border-primary/40 transition-all duration-500",
        "hover:shadow-[0_0_60px_hsl(38_92%_50%_/_0.15)]",
        className
      )}
    >
      {/* Number badge */}
      <div className="absolute top-6 right-6">
        <span className="text-5xl font-black text-muted/30 group-hover:text-primary/20 transition-colors duration-500">
          {number}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-2xl font-bold group-hover:gradient-text transition-all duration-300">
            {title}
          </h3>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
            <ArrowUpRight className="w-5 h-5 text-primary" />
          </div>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
          {description}
        </p>

        {/* Stats row */}
        {stats && (
          <div className="flex items-center gap-6 pt-4 border-t border-border/50">
            <div>
              <p className="text-lg font-bold gradient-text">{stats.trades}</p>
              <p className="text-xs text-muted-foreground">Trades</p>
            </div>
            <div>
              <p className="text-lg font-bold gradient-text">+{stats.rr}</p>
              <p className="text-xs text-muted-foreground">RR Total</p>
            </div>
            <div>
              <p className="text-lg font-bold gradient-text">{stats.winRate}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </div>
          </div>
        )}
      </div>

      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </Link>
  );
};
