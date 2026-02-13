import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Image as ImageIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { extractStoragePath } from "@/hooks/useSignedUrl";
import { ImageLightbox } from "./ImageLightbox";

interface ScreenshotLinkProps {
  storagePath: string | null | undefined;
  alt?: string;
  showExternalIcon?: boolean;
  className?: string;
}

export const ScreenshotLink = ({
  storagePath,
  alt = "Screenshot",
  showExternalIcon = false,
  className = "",
}: ScreenshotLinkProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const generateSignedUrl = async () => {
      if (!storagePath) {
        setSignedUrl(null);
        return;
      }
      if (storagePath.includes("token=")) {
        setSignedUrl(storagePath);
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
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setLightboxOpen(true)}
            className={`inline-flex items-center gap-1 text-primary hover:text-primary/80 cursor-pointer ${className}`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="p-0 overflow-hidden">
          <img
            src={signedUrl}
            alt={alt}
            className="max-w-[300px] max-h-[200px] object-contain"
          />
        </TooltipContent>
      </Tooltip>
      <ImageLightbox
        src={signedUrl}
        alt={alt}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
};
