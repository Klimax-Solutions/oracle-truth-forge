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
  result_date: string | null;
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
      try {
        const { data } = await supabase
          .from("results")
          .select("*")
          .order("result_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (data) {
          const sorted = (data as ResultItem[]);
          setResults(sorted);
          const paths = sorted.map((r: any) => r.image_path).filter(Boolean);
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
      } catch (err) {
        console.warn("[ResultsPage] fetch error:", err);
      } finally {
        setLoading(false);
      }
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
        <p className="text-xs text-muted-foreground font-mono mt-1">Plus de {results.length} résultats</p>
        
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {filteredResults.map((result) => {
              const url = signedUrls[result.image_path];
              const displayDate = result.result_date 
                ? formatLiteralDate(result.result_date) 
                : formatLiteralDate(result.created_at);
              return (
                <button
                  key={result.id}
                  onClick={() => url && setLightboxUrl(url)}
                  className="relative border border-border rounded-lg overflow-hidden bg-card hover:border-foreground/30 transition-all group text-left"
                >
                  {/* Title + Date on TOP */}
                  <div className="p-2.5 md:p-3 space-y-0.5">
                    {result.title && (
                      <p className="text-sm md:text-base font-semibold text-foreground leading-tight line-clamp-2 drop-shadow-[0_0_6px_hsl(var(--primary)/0.4)]">
                        {result.title}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] md:text-xs text-muted-foreground font-mono">{displayDate}</p>
                      {result.result_type && result.result_type !== "trade" && (
                        <span className="px-1.5 py-0.5 text-[8px] font-mono uppercase bg-primary/15 text-primary rounded">
                          {RESULT_TYPES.find(t => t.value === result.result_type)?.label || result.result_type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Screenshot */}
                  <div className="aspect-video bg-muted relative">
                    {url ? (
                      <img src={url} alt={result.title || "Résultat"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-4 h-4 border border-foreground border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
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
