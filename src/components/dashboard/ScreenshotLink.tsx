import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Image as ImageIcon, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { extractStoragePath } from "@/hooks/useSignedUrl";

interface ScreenshotLinkProps {
  storagePath: string | null | undefined;
  alt?: string;
  showExternalIcon?: boolean;
  className?: string;
}

/**
 * Component that displays a screenshot link with hover preview.
 * Uses signed URLs for secure access to private storage.
 */
export const ScreenshotLink = ({
  storagePath,
  alt = "Screenshot",
  showExternalIcon = false,
  className = "",
}: ScreenshotLinkProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const generateSignedUrl = async () => {
      if (!storagePath) {
        setSignedUrl(null);
        return;
      }

      // Check if this is already a signed URL
      if (storagePath.includes("token=")) {
        setSignedUrl(storagePath);
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
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (loading) {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;
  }

  if (error || !signedUrl) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 ${className}`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          {showExternalIcon && <ExternalLink className="w-3 h-3" />}
        </a>
      </TooltipTrigger>
      <TooltipContent side="left" className="p-0 overflow-hidden">
        <img
          src={signedUrl}
          alt={alt}
          className="max-w-[300px] max-h-[200px] object-contain"
        />
      </TooltipContent>
    </Tooltip>
  );
};
