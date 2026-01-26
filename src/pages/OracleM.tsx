import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, TrendingUp, TrendingDown } from "lucide-react";

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure: string;
  entry_time: string;
  exit_time: string;
  trade_duration: string;
  rr: number;
  stop_loss_size: string;
  setup_type: string;
  entry_timing: string;
  entry_model: string;
  target_timing: string;
  speculation_hl_valid: boolean;
  target_hl_valid: boolean;
  news_day: boolean;
  news_label: string;
}

const OracleM = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

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

  useEffect(() => {
    const fetchTrades = async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('trade_number', { ascending: true });
      
      if (data) {
        setTrades(data);
      }
    };

    if (user) {
      fetchTrades();
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Stats
  const totalTrades = trades.length;
  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const longTrades = trades.filter(t => t.direction === 'Long').length;
  const shortTrades = trades.filter(t => t.direction === 'Short').length;

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 grid-pattern" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-neutral-800">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="text-neutral-500 hover:text-white hover:bg-transparent -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="text-xs font-mono uppercase tracking-wider">Retour</span>
            </Button>
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
        <main className="flex-1 container mx-auto px-6 py-12">
          {/* Title section */}
          <div className="text-center mb-12">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-neutral-500 mb-4">
              Database
            </p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-white">
              Oracle<sup className="text-xl md:text-2xl font-normal align-super ml-1">™</sup>
              <span className="text-neutral-500 ml-2">M</span>
            </h1>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-8 md:gap-12 mb-12">
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-white">{totalTrades}</p>
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">Trades</p>
            </div>
            <div className="w-px h-8 bg-neutral-800" />
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-white">+{totalRR.toFixed(0)}</p>
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">RR Total</p>
            </div>
            <div className="w-px h-8 bg-neutral-800" />
            <div className="text-center flex items-center gap-4">
              <div>
                <p className="text-2xl md:text-3xl font-bold text-white">{longTrades}</p>
                <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">Long</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-bold text-white">{shortTrades}</p>
                <p className="text-xs text-neutral-600 font-mono uppercase tracking-wider">Short</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-neutral-800 mb-8" />

          {trades.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-neutral-500 text-lg mb-4">Aucun trade dans la base de données</p>
              <p className="text-neutral-600 text-sm">Les données seront importées prochainement.</p>
            </div>
          ) : (
            /* Trades list */
            <div className="space-y-2">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                  className={`border transition-all cursor-pointer ${
                    selectedTrade?.id === trade.id 
                      ? 'border-white bg-neutral-900' 
                      : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950'
                  }`}
                >
                  {/* Main row */}
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      {/* Trade number */}
                      <span className="text-2xl font-bold text-neutral-700 w-12">
                        {String(trade.trade_number).padStart(3, '0')}
                      </span>
                      
                      {/* Direction indicator */}
                      <div className={`flex items-center gap-2 w-20 ${
                        trade.direction === 'Long' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {trade.direction === 'Long' ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span className="text-sm font-mono uppercase">{trade.direction}</span>
                      </div>

                      {/* Date */}
                      <div className="hidden md:block">
                        <p className="text-sm text-white">{formatDate(trade.trade_date)}</p>
                        <p className="text-xs text-neutral-600">{trade.day_of_week}</p>
                      </div>

                      {/* Setup type */}
                      <div className="hidden lg:block">
                        <p className="text-xs text-neutral-500 font-mono">{trade.setup_type || '—'}</p>
                      </div>
                    </div>

                    {/* RR */}
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">+{trade.rr?.toFixed(2) || '0'}</p>
                      <p className="text-xs text-neutral-600 font-mono uppercase">RR</p>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {selectedTrade?.id === trade.id && (
                    <div className="px-6 py-4 border-t border-neutral-800 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Entrée</p>
                        <p className="text-sm text-white">{trade.entry_time || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Sortie</p>
                        <p className="text-sm text-white">{trade.exit_time || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Durée</p>
                        <p className="text-sm text-white">{trade.trade_duration || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Stop Loss</p>
                        <p className="text-sm text-white">{trade.stop_loss_size || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Structure</p>
                        <p className="text-sm text-white">{trade.direction_structure || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Entry Timing</p>
                        <p className="text-sm text-white">{trade.entry_timing || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-600 font-mono uppercase mb-1">Modèle</p>
                        <p className="text-sm text-white">{trade.entry_model || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-600 font-mono uppercase mb-1">News</p>
                        <p className="text-sm text-white">{trade.news_day ? trade.news_label || 'Oui' : 'Non'}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-neutral-800 py-8">
          <p className="text-center text-xs text-neutral-600 font-mono uppercase tracking-[0.3em]">
            Oracle™ © 2026 — Accès confidentiel
          </p>
        </footer>
      </div>
    </div>
  );
};

export default OracleM;
