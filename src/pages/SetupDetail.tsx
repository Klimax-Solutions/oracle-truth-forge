import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { TradeCard } from "@/components/TradeCard";
import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BarChart3,
  Target,
  TrendingUp,
  Percent,
  Clock,
  Award,
  LogOut,
  User,
} from "lucide-react";

// Mock trades data - will be replaced with real data from Notion/Drive
const mockTrades = [
  { id: 1, pair: "EUR/USD", direction: "long" as const, entryTime: "09:30", result: "win" as const, rr: 3.2 },
  { id: 2, pair: "GBP/JPY", direction: "short" as const, entryTime: "14:15", result: "win" as const, rr: 2.1 },
  { id: 3, pair: "USD/CHF", direction: "long" as const, entryTime: "11:45", result: "loss" as const, rr: 1.0 },
  { id: 4, pair: "EUR/GBP", direction: "short" as const, entryTime: "16:00", result: "win" as const, rr: 4.5 },
  { id: 5, pair: "AUD/USD", direction: "long" as const, entryTime: "08:00", result: "win" as const, rr: 2.8 },
  { id: 6, pair: "NZD/USD", direction: "short" as const, entryTime: "10:30", result: "loss" as const, rr: 1.0 },
  { id: 7, pair: "USD/CAD", direction: "long" as const, entryTime: "13:00", result: "win" as const, rr: 3.5 },
  { id: 8, pair: "EUR/JPY", direction: "short" as const, entryTime: "15:30", result: "win" as const, rr: 2.3 },
  { id: 9, pair: "GBP/USD", direction: "long" as const, entryTime: "07:45", result: "loss" as const, rr: 1.0 },
];

const SetupDetail = () => {
  const { setupId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 trading-grid opacity-20" />

      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border/30 bg-background/50 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center shadow-lg">
                  <span className="text-xl font-black text-primary-foreground">O</span>
                </div>
                <span className="text-lg font-bold">Oracle</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{user?.email}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 container mx-auto px-6 py-12">
          {/* Title section */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 mb-12">
            <div>
              <p className="text-sm font-mono uppercase tracking-[0.3em] text-muted-foreground mb-2">
                Setup #01
              </p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                Oracle
              </h1>
              <p className="text-muted-foreground max-w-lg">
                Base de données complète avec 300 trades analysés. 
                Chaque trade inclut l'heure, la direction, le RR et le screenshot.
              </p>
            </div>

            {/* Progress ring */}
            <div className="glass-card rounded-2xl p-6">
              <ProgressRing
                progress={42}
                label="Complété"
                sublabel="126/300 trades"
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-12">
            <StatCard label="Trades Total" value={300} icon={BarChart3} />
            <StatCard label="Win Rate" value="67" suffix="%" icon={Percent} trend="up" />
            <StatCard label="RR Total" value="2,300" icon={TrendingUp} trend="up" />
            <StatCard label="Sharpe Ratio" value="2.4" icon={Award} trend="up" />
            <StatCard label="Durée Moy." value="4.2h" icon={Clock} />
            <StatCard label="Best Trade" value="+12.5R" icon={Target} trend="up" />
          </div>

          {/* Trades section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Tous les trades</h2>
              <p className="text-sm text-muted-foreground font-mono">
                Affichage: {mockTrades.length} trades
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockTrades.map((trade) => (
                <TradeCard key={trade.id} {...trade} />
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/30 py-6">
          <p className="text-center text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Oracle © 2026 — Accès confidentiel
          </p>
        </footer>
      </div>
    </div>
  );
};

export default SetupDetail;
