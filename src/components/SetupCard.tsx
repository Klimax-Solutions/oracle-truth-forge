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
        "group block border border-neutral-800 bg-neutral-950 p-8 relative overflow-hidden",
        "hover:border-neutral-600 transition-all duration-300",
        "hover:bg-neutral-900",
        className
      )}
    >
      {/* Number badge */}
      <div className="absolute top-6 right-6">
        <span className="text-5xl font-black text-neutral-800 group-hover:text-neutral-700 transition-colors duration-300">
          {number}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-2xl font-bold text-white group-hover:text-white transition-all duration-300">
            {title}{title === "Oracle" && <sup className="text-xs font-normal align-super ml-0.5">™</sup>}
          </h3>
          <div className="w-8 h-8 border border-neutral-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <ArrowUpRight className="w-4 h-4 text-white" />
          </div>
        </div>

        <p className="text-neutral-500 text-sm leading-relaxed max-w-xs">
          {description}
        </p>

        {/* Stats row */}
        {stats && (
          <div className="flex items-center gap-8 pt-6 border-t border-neutral-800">
            <div>
              <p className="text-xl font-bold text-white">{stats.trades}</p>
              <p className="text-xs text-neutral-600 font-mono uppercase">Trades</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">+{stats.rr}</p>
              <p className="text-xs text-neutral-600 font-mono uppercase">RR</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">{stats.winRate}%</p>
              <p className="text-xs text-neutral-600 font-mono uppercase">Win</p>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};
