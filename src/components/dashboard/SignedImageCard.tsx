import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { extractStoragePath } from "@/hooks/useSignedUrl";

interface SignedImageCardProps {
  storagePath: string | null | undefined;
  alt: string;
  label: string;
  className?: string;
}

/**
 * Component that displays a screenshot in a card format with a label.
 * Uses signed URLs for secure access to private storage.
 */
export const SignedImageCard = ({
  storagePath,
  alt,
  label,
  className = "",
}: SignedImageCardProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const generateSignedUrl = async () => {
      if (!storagePath) {
        setSignedUrl(null);
        setLoading(false);
        return;
      }

      // Check if this is already a signed URL
      if (storagePath.includes("token=")) {
        setSignedUrl(storagePath);
        setLoading(false);
        return;
      }

      // Extract path from full URL if needed
      const pathToSign = extractStoragePath(storagePath) || storagePath;

      setLoading(true);
      setError(false);

      try {
        const { data, error: signError } = await supabase.storage
          .from("trade-screenshots")
          .createSignedUrl(pathToSign, 3600); // 1 hour expiry

        if (signError) {
          console.error("Error creating signed URL:", signError);
          setError(true);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Error generating signed URL:", err);
        setError(true);
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    generateSignedUrl();
  }, [storagePath]);

  if (!storagePath) {
    return null;
  }

  return (
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
        <a href={signedUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={signedUrl}
            alt={alt}
            className="w-full h-48 object-cover hover:opacity-80 transition-opacity cursor-pointer"
          />
        </a>
      )}
    </div>
  );
};
