import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";
import { extractStoragePath } from "@/hooks/useSignedUrl";
import { ImageLightbox } from "./ImageLightbox";

interface SignedImageCardProps {
  storagePath: string | null | undefined;
  alt: string;
  label: string;
  className?: string;
}

export const SignedImageCard = ({
  storagePath,
  alt,
  label,
  className = "",
}: SignedImageCardProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const generateSignedUrl = async () => {
      if (!storagePath) {
        setSignedUrl(null);
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
          .from("trade-screenshots")
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
  }, [storagePath]);

  if (!storagePath) return null;

  return (
    <>
      <div className={`border border-border rounded-md overflow-hidden ${className}`}>
        <div className="p-2 bg-muted/30 border-b border-border">
          <p className="text-[10px] text-muted-foreground font-mono uppercase">{label}</p>
        </div>
        {loading ? (
          <div className="w-full h-48 flex items-center justify-center bg-muted/20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !signedUrl ? (
          <div className="w-full h-48 flex items-center justify-center bg-muted/20">
            <p className="text-xs text-muted-foreground">Erreur de chargement</p>
          </div>
        ) : (
          <img
            src={signedUrl}
            alt={alt}
            className="w-full h-48 object-cover hover:opacity-80 transition-opacity cursor-pointer"
            onClick={() => setLightboxOpen(true)}
          />
        )}
        {signedUrl && !loading && !error && (
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
