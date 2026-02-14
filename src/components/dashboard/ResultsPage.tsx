import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "./ImageLightbox";

interface ResultItem {
  id: string;
  title: string | null;
  image_path: string;
  sort_order: number;
  created_at: string;
}

export const ResultsPage = () => {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("Résultats les plus récents");

  useEffect(() => {
    const fetchResults = async () => {
      const { data } = await supabase
        .from("results")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (data) {
        setResults(data as ResultItem[]);
        // Sign URLs
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 md:p-6 border-b border-border">
        <h2 className="text-lg md:text-xl font-semibold text-foreground">{pageTitle}</h2>
        <p className="text-xs text-muted-foreground font-mono mt-1">{results.length} résultat{results.length > 1 ? "s" : ""}</p>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {results.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Aucun résultat disponible pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {results.map((result) => {
              const url = signedUrls[result.image_path];
              return (
                <button
                  key={result.id}
                  onClick={() => url && setLightboxUrl(url)}
                  className="border border-border rounded-md overflow-hidden bg-card hover:border-foreground/30 transition-all group"
                >
                  <div className="aspect-video bg-muted relative">
                    {url ? (
                      <img src={url} alt={result.title || "Résultat"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-4 h-4 border border-foreground border-t-transparent rounded-full animate-spin" />
                      </div>
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
        )}
      </div>

      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="Résultat" open={!!lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
};
