import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TradeCard } from "@/components/TradeCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";

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
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 grid-pattern" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground hover:bg-transparent -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="text-xs font-mono uppercase tracking-wider">Retour</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 container mx-auto px-6 py-16">
          {/* Title section */}
          <div className="text-center mb-16">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-muted-foreground mb-6">
              Setup #01
            </p>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground mb-6">
              Oracle<sup className="text-xl md:text-2xl font-normal align-super ml-1">™</sup>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Base de données complète avec 300 trades analysés.
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-12 mb-16">
            <div className="text-center">
              <p className="text-3xl font-black text-foreground">300</p>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Trades</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="text-3xl font-black text-foreground">+2,300</p>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">RR Total</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="text-center">
              <p className="text-3xl font-black text-foreground">67%</p>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Win Rate</p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-border mb-16" />

          {/* Trades grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockTrades.map((trade) => (
              <TradeCard key={trade.id} {...trade} />
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8">
          <p className="text-center text-xs text-muted-foreground font-mono uppercase tracking-[0.3em]">
            Oracle © 2026 — Accès confidentiel
          </p>
        </footer>
      </div>
    </div>
  );
};

export default SetupDetail;