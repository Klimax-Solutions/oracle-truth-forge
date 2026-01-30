import { useSignedUrl } from "@/hooks/useSignedUrl";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignedImageProps {
  storagePath: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  bucket?: string;
}

/**
 * Component that displays an image from storage using a signed URL.
 * Automatically handles URL generation and loading states.
 */
export const SignedImage = ({
  storagePath,
  alt,
  className,
  fallback,
  bucket = "trade-screenshots",
}: SignedImageProps) => {
  const { signedUrl, loading, error } = useSignedUrl(storagePath, bucket);

  if (!storagePath) {
    return fallback ? <>{fallback}</> : null;
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !signedUrl) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
    />
  );
};
