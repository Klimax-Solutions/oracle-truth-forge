import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SetupCard } from "@/components/SetupCard";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const setups = [
  {
    title: "Oracle",
    number: "01",
    description: "Base de données NAS100 avec 314 trades analysés et documentés.",
    href: "/oracle-m",
    stats: {
      trades: 314,
      rr: 2300,
      winRate: 100,
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 grid-pattern" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Minimal header */}
        <header className="border-b border-neutral-800">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
              {user?.email}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-neutral-500 hover:text-white hover:bg-transparent"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 container mx-auto px-6 py-24">
          {/* Title section */}
          <div className="text-center mb-16">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-neutral-500 mb-6">
              Database
            </p>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white">
              Hub central
            </h1>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-neutral-800 mb-16" />

          {/* Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {setups.map((setup) => (
              <SetupCard key={setup.number} {...setup} />
            ))}

            {/* Placeholder cards */}
            <div className="border border-neutral-800 border-dashed p-8 flex flex-col items-center justify-center min-h-[220px]">
              <span className="text-5xl font-black text-neutral-800 mb-4">02</span>
              <p className="text-xs text-neutral-600 text-center font-mono uppercase tracking-wider">
                À venir
              </p>
            </div>

            <div className="border border-neutral-800 border-dashed p-8 flex flex-col items-center justify-center min-h-[220px]">
              <span className="text-5xl font-black text-neutral-800 mb-4">03</span>
              <p className="text-xs text-neutral-600 text-center font-mono uppercase tracking-wider">
                À venir
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-neutral-800 py-8">
          <p className="text-center text-xs text-neutral-600 font-mono uppercase tracking-[0.3em]">
            Oracle © 2026 — Accès confidentiel
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
