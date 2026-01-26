import { StatCard } from "./StatCard";
import { TradeCard } from "./TradeCard";
import { BarChart3, Target, TrendingUp, Percent, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mock data for demonstration
const mockTrades = [
  { id: 1, pair: "EUR/USD", direction: "long" as const, entryTime: "09:30", result: "win" as const, rr: 3.2 },
  { id: 2, pair: "GBP/JPY", direction: "short" as const, entryTime: "14:15", result: "win" as const, rr: 2.1 },
  { id: 3, pair: "USD/CHF", direction: "long" as const, entryTime: "11:45", result: "loss" as const, rr: 1.0 },
  { id: 4, pair: "EUR/GBP", direction: "short" as const, entryTime: "16:00", result: "win" as const, rr: 4.5 },
  { id: 5, pair: "AUD/USD", direction: "long" as const, entryTime: "08:00", result: "win" as const, rr: 2.8 },
  { id: 6, pair: "NZD/USD", direction: "short" as const, entryTime: "10:30", result: "loss" as const, rr: 1.0 },
];

export const DashboardSection = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Tableau de bord
            </h2>
            <p className="text-muted-foreground text-lg">
              Vue d'ensemble de tes performances sur le setup Oracle
            </p>
          </div>
          <Button variant="outline" className="self-start md:self-auto">
            Exporter les données
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-12">
          <StatCard
            label="Trades Total"
            value={300}
            icon={BarChart3}
            trend="neutral"
          />
          <StatCard
            label="Win Rate"
            value="67"
            suffix="%"
            icon={Percent}
            trend="up"
          />
          <StatCard
            label="RR Total"
            value="2,300"
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            label="Sharpe Ratio"
            value="2.4"
            icon={Award}
            trend="up"
          />
          <StatCard
            label="Avg Hold Time"
            value="4.2h"
            icon={Clock}
            trend="neutral"
          />
          <StatCard
            label="Best Trade"
            value="+12.5R"
            icon={Target}
            trend="up"
          />
        </div>

        {/* Trades section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">Derniers trades</h3>
            <Button variant="ghost" size="sm" className="text-primary">
              Voir tout →
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockTrades.map((trade) => (
              <TradeCard key={trade.id} {...trade} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
