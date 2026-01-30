import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to generate signed URLs for storage files.
 * This is used instead of public URLs to ensure files are only accessible
 * to authenticated users with proper permissions.
 */
export const useSignedUrl = (
  storagePath: string | null | undefined,
  bucket: string = "trade-screenshots",
  expiresIn: number = 3600 // 1 hour by default
) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateSignedUrl = async () => {
      // If the path looks like a full URL (old public URL), extract just the path
      let pathToSign = storagePath;
      
      if (!pathToSign) {
        setSignedUrl(null);
        return;
      }

      // Check if this is already a signed URL (contains token parameter)
      if (pathToSign.includes("token=")) {
        setSignedUrl(pathToSign);
        return;
      }

      // Extract path from full Supabase storage URL if needed
      const bucketUrlPattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
      const match = pathToSign.match(bucketUrlPattern);
      if (match) {
        pathToSign = match[1];
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(pathToSign, expiresIn);

        if (signError) {
          console.error("Error creating signed URL:", signError);
          setError(signError.message);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Error generating signed URL:", err);
        setError("Failed to generate signed URL");
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    generateSignedUrl();
  }, [storagePath, bucket, expiresIn]);

  return { signedUrl, loading, error };
};

/**
 * Utility function to extract storage path from a URL.
 * Used when we have a stored URL and need to regenerate a signed URL.
 */
export const extractStoragePath = (
  url: string | null | undefined,
  bucket: string = "trade-screenshots"
): string | null => {
  if (!url) return null;

  // If it's already just a path (not a full URL), return it
  if (!url.startsWith("http")) {
    return url;
  }

  // Extract path from full Supabase storage URL
  const bucketUrlPattern = new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/(.+?)(?:\\?|$)`);
  const match = url.match(bucketUrlPattern);
  
  if (match) {
    return decodeURIComponent(match[1]);
  }

  return null;
};

/**
 * Generate a signed URL on-demand (non-hook version for use in callbacks).
 * Returns the path that should be stored in the database (not the signed URL).
 */
export const uploadAndGetPath = async (
  file: File,
  bucket: string,
  filePath: string
): Promise<{ path: string | null; error: string | null }> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { upsert: true });

  if (error) {
    console.error("Upload error:", error);
    return { path: null, error: error.message };
  }

  // Return just the path, not a URL - we'll generate signed URLs on-demand
  return { path: data.path, error: null };
};

/**
 * Generate a signed URL for a given path (non-hook version).
 */
export const getSignedUrl = async (
  path: string,
  bucket: string = "trade-screenshots",
  expiresIn: number = 3600
): Promise<string | null> => {
  if (!path) return null;

  // Extract path from full URL if needed
  const extractedPath = extractStoragePath(path, bucket) || path;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(extractedPath, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data.signedUrl;
};
