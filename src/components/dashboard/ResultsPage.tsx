import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "./ImageLightbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResultsManager } from "./ResultsManager";

interface ResultItem {
  id: string;
  title: string | null;
  image_path: string;
  sort_order: number;
  created_at: string;
  result_type: string | null;
}

const RESULT_TYPES = [
  { value: "all", label: "Tous" },
  { value: "trade", label: "Trade" },
  { value: "payout", label: "Payout" },
  { value: "challenge_validation", label: "Challenge" },
  { value: "account_validation", label: "Compte" },
  { value: "other", label: "Autre" },
];

const formatLiteralDate = (dateStr: string) => {
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const ResultsPage = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("view");

  useEffect(() => {
    const fetchResults = async () => {
      const { data } = await supabase
        .from("results")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (data) {
        setResults(data as ResultItem[]);
        const paths = data.map((r: any) => r.image_path).filter(Boolean);
        if (paths.length > 0) {
          const { data: signed } = await supabase.storage
            .from("result-screenshots")
            .createSignedUrls(paths, 3600);
          if (signed) {
            const urlMap: Record<string, string> = {};
            signed.forEach((s: any) => {
              if (s.signedUrl) urlMap[s.path] = s.signedUrl;
            });
            setSignedUrls(urlMap);
          }
        }
      }
      setLoading(false);
    };
    fetchResults();
  }, []);

  const filteredResults = activeFilter === "all" 
    ? results 
    : results.filter(r => r.result_type === activeFilter);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {isAdmin && (
        <div className="p-4 md:p-6 border-b border-border">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="view" className="text-xs">Résultats</TabsTrigger>
              <TabsTrigger value="manage" className="text-xs">Gestion des résultats</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      {activeTab === "manage" && isAdmin ? (
        <ResultsManager />
      ) : (
      <>
      <div className="p-4 md:p-6 border-b border-border">
        <h2 className="text-lg md:text-xl font-semibold text-foreground">Derniers résultats des membres</h2>
        <p className="text-xs text-muted-foreground font-mono mt-1">Plus de 35 résultats</p>
        
        {/* Category Filter */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {RESULT_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setActiveFilter(type.value)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-mono uppercase rounded-md border transition-all",
                activeFilter === type.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {filteredResults.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Aucun résultat disponible pour le moment.
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {filteredResults.map((result) => {
              const url = signedUrls[result.image_path];
              return (
                <button
                  key={result.id}
                  onClick={() => url && setLightboxUrl(url)}
                  className="relative border border-border rounded-md overflow-hidden bg-card hover:border-foreground/30 transition-all group result-glow-card"
                >
                  <div className="aspect-video bg-muted relative">
                    {url ? (
                      <img src={url} alt={result.title || "Résultat"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-4 h-4 border border-foreground border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {result.result_type && result.result_type !== "trade" && (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[8px] font-mono uppercase bg-black/60 backdrop-blur-sm text-white rounded">
                        {RESULT_TYPES.find(t => t.value === result.result_type)?.label || result.result_type}
                      </span>
                    )}
                  </div>
                  {result.title && (
                    <div className="p-2">
                      <p className="text-[10px] font-mono text-muted-foreground truncate">{result.title}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-center mt-6">
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-muted/50 text-muted-foreground text-xs font-mono uppercase cursor-not-allowed opacity-60"
            >
              <span className="w-5 h-5 rounded-full border border-muted-foreground/40 flex items-center justify-center text-sm leading-none">+</span>
              Accéder à plus de résultats — bientôt disponible
            </button>
          </div>
          </>
        )}
      </div>

      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="Résultat" open={!!lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
      </>
      )}
    </div>
  );
};
