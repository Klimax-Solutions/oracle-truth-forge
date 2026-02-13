import { useState, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export const ImageLightbox = ({ src, alt = "Screenshot", open, onClose }: ImageLightboxProps) => {
  const [zoom, setZoom] = useState(1);

  const resetZoom = useCallback(() => setZoom(1), []);

  useEffect(() => {
    if (open) {
      setZoom(1);
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
        if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 5));
        if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
        if (e.key === "0") setZoom(1);
      };
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKey);
        document.body.style.overflow = "";
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Controls */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2 z-[210]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
          className="p-2 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors"
          title="Zoom arrière"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono text-foreground/70 min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.25, 5))}
          className="p-2 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors"
          title="Zoom avant"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={resetZoom}
          className="p-2 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors"
          title="Réinitialiser"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image */}
      <div
        className="overflow-auto max-w-[95vw] max-h-[90vh] cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => {
          e.stopPropagation();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          setZoom((z) => Math.min(Math.max(z + delta, 0.25), 5));
        }}
      >
        <img
          src={src}
          alt={alt}
          className="transition-transform duration-150 ease-out select-none"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          draggable={false}
        />
      </div>
    </div>
  );
};
