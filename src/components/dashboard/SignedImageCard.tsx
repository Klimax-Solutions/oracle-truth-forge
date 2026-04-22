import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";
import { extractStoragePath } from "@/hooks/useSignedUrl";
import { ImageLightbox } from "./ImageLightbox";
import { cn } from "@/lib/utils";

interface SignedImageCardProps {
  storagePath: string | null | undefined;
  alt: string;
  label: string;
  className?: string;
  fillContainer?: boolean;
  bucket?: string;
}

export const SignedImageCard = ({
  storagePath,
  alt,
  label,
  className = "",
  fillContainer = false,
  bucket = "trade-screenshots",
}: SignedImageCardProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Whether the storagePath is an external link (not a Supabase storage path)
  const isExternalLink = !!storagePath && (storagePath.startsWith("http://") || storagePath.startsWith("https://"));

  useEffect(() => {
    const generateSignedUrl = async () => {
      if (!storagePath) {
        setSignedUrl(null);
        setLoading(false);
        return;
      }
      // External URLs (TradingView, Lightshot, etc.) — use directly, no signing needed
      if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
        setSignedUrl(storagePath);
        setLoading(false);
        return;
      }
      if (storagePath.includes("token=")) {
        setSignedUrl(storagePath);
        setLoading(false);
        return;
      }
      const pathToSign = extractStoragePath(storagePath) || storagePath;
      setLoading(true);
      setError(false);
      try {
        const { data, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(pathToSign, 3600);
        if (signError) {
          setError(true);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch {
        setError(true);
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };
    generateSignedUrl();
  }, [storagePath, bucket]);

  if (!storagePath) return null;

  return (
    <>
      <div className={`border border-border rounded-md overflow-hidden ${className}`}>
        {!fillContainer && (
          <div className="p-2 bg-muted/30 border-b border-border">
            <p className="text-[10px] text-muted-foreground font-mono uppercase">{label}</p>
          </div>
        )}
        {loading ? (
          <div className={cn("w-full flex items-center justify-center bg-muted/20", fillContainer ? "aspect-video" : "h-48")}>
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !signedUrl ? (
          <div className={cn("w-full flex items-center justify-center bg-muted/20", fillContainer ? "aspect-video" : "h-48")}>
            <p className="text-xs text-muted-foreground">Erreur de chargement</p>
          </div>
        ) : imgFailed || (isExternalLink && signedUrl && imgFailed) ? (
          // External URL that failed to load as image → show as clickable link card
          <div className={cn("w-full flex flex-col items-center justify-center gap-2 bg-muted/20 px-3", fillContainer ? "aspect-video" : "h-48")}>
            <ExternalLink className="w-5 h-5 text-muted-foreground" />
            <a
              href={signedUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline text-center break-all max-w-full line-clamp-3"
            >
              {signedUrl}
            </a>
          </div>
        ) : (
          <img
            src={signedUrl!}
            alt={alt}
            className={cn(
              "w-full object-cover hover:opacity-80 transition-opacity cursor-pointer",
              fillContainer ? "aspect-video" : "h-48"
            )}
            onClick={() => setLightboxOpen(true)}
            onError={() => setImgFailed(true)}
          />
        )}
        {signedUrl && !loading && !error && !fillContainer && (
          <div className="px-2 py-1 border-t border-border">
            <a href={signedUrl} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
              <ExternalLink className="w-2.5 h-2.5" /> Ouvrir dans un nouvel onglet
            </a>
          </div>
        )}
      </div>
      {signedUrl && (
        <ImageLightbox
          src={signedUrl}
          alt={alt}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
};
