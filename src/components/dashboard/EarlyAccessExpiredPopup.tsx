import { useState, useEffect } from "react";
import { Trophy, Lock, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SignedImageCard } from "./SignedImageCard";

interface ResultItem {
  title: string | null;
  created_at: string;
  image_path: string;
}

const CTA_URL =
  "https://mercureinstitut.com/vip/apply?utm_source=youtube&utm_medium=organic_video&utm_campaign=awareness&utm_content=LSV87bNWxw0";

export const EarlyAccessExpiredPopup = () => {
  const [results, setResults] = useState<ResultItem[]>([]);

  useEffect(() => {
    supabase
      .from("results")
      .select("title, created_at, image_path")
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setResults(data);
      });
  }, []);

  const formatDate = (dateStr: string) => {
    const months = [
      "janvier","février","mars","avril","mai","juin",
      "juillet","août","septembre","octobre","novembre","décembre",
    ];
    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col md:flex-row">
          {/* LEFT: Latest results */}
          <div className="md:w-1/2 bg-muted/30 border-b md:border-b-0 md:border-r border-border p-4 md:p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-semibold text-foreground">
                Derniers résultats Oracle
              </span>
            </div>
            {results.length > 0 ? (
              <div className="space-y-3 flex-1">
                {results.map((r, i) => (
                  <div key={i} className="border border-border rounded-lg overflow-hidden bg-card">
                    <div className="aspect-video relative">
                      <SignedImageCard
                        storagePath={r.image_path}
                        alt={r.title || "Résultat"}
                        label=""
                        fillContainer
                        bucket="result-screenshots"
                      />
                    </div>
                    <div className="px-3 py-2">
                      {r.title && (
                        <p className="text-xs font-medium text-foreground truncate">
                          {r.title}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(r.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                <div className="text-center space-y-2">
                  <ImageIcon className="w-8 h-8 mx-auto opacity-40" />
                  <p>Aucun résultat disponible</p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Expired message + CTA */}
          <div className="md:w-1/2 p-5 md:p-6 flex flex-col justify-center items-center text-center gap-6">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="w-7 h-7 text-destructive" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">
                Accès anticipé expiré
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Votre accès anticipé est expiré. Débloquez votre accès à Oracle
                en déposant votre candidature.
              </p>
            </div>

            <a href={CTA_URL} target="_blank" rel="noopener noreferrer" className="w-full">
              <Button className="w-full gap-2" size="lg">
                Déposer ma candidature
              </Button>
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
