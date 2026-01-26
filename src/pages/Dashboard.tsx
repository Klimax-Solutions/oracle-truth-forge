import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SetupCard } from "@/components/SetupCard";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

const setups = [
  {
    title: "Oracle",
    number: "01",
    description: "Setup principal avec 300 trades analysés et documentés. Système de vérification complet.",
    href: "/setup/oracle",
    stats: {
      trades: 300,
      rr: 2300,
      winRate: 67,
    },
  },
];

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

    // Check initial session
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
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-primary/3 rounded-full blur-[100px]" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border/30 bg-background/50 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center shadow-lg">
                <span className="text-xl font-black text-primary-foreground">O</span>
              </div>
              <span className="text-lg font-bold">Oracle</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{user?.email}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Déconnexion</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 container mx-auto px-6 py-16">
          {/* Title section */}
          <div className="text-center mb-16">
            <p className="text-sm font-mono uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Database
            </p>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight">
              Hub central
            </h1>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mb-16" />

          {/* Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {setups.map((setup) => (
              <SetupCard key={setup.number} {...setup} />
            ))}

            {/* Placeholder for future setups */}
            <div className="glass-card rounded-2xl p-6 border-dashed border-2 border-border/30 flex flex-col items-center justify-center min-h-[200px] opacity-50">
              <span className="text-5xl font-black text-muted/20 mb-4">02</span>
              <p className="text-sm text-muted-foreground text-center">
                Prochain setup à venir
              </p>
            </div>

            <div className="glass-card rounded-2xl p-6 border-dashed border-2 border-border/30 flex flex-col items-center justify-center min-h-[200px] opacity-50">
              <span className="text-5xl font-black text-muted/20 mb-4">03</span>
              <p className="text-sm text-muted-foreground text-center">
                Prochain setup à venir
              </p>
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

export default Dashboard;
