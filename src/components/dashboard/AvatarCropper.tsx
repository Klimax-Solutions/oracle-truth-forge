import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Check, RotateCcw, ZoomIn } from "lucide-react";

interface AvatarCropperProps {
  imageSrc: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}

// Utility to create cropped image from canvas
const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  const size = Math.min(pixelCrop.width, pixelCrop.height);
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    256,
    256
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      0.9
    );
  });
};

export const AvatarCropper = ({
  imageSrc,
  open,
  onClose,
  onCropComplete,
}: AvatarCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((z: number) => {
    setZoom(z);
  }, []);

  const onCropAreaComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(blob);
    } catch (err) {
      console.error("Crop error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md bg-card p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Recadrer votre photo</DialogTitle>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative w-full aspect-square bg-black/90">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaComplete}
          />
        </div>

        {/* Controls */}
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 text-right font-mono">
              {zoom.toFixed(1)}x
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={saving} className="gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Appliquer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
