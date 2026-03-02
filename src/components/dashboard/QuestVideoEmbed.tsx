import { useRef, useEffect, useMemo } from "react";

interface QuestVideoEmbedProps {
  embedCode: string;
}

// Convert Drive links to embeddable, clean iframes
const makeEmbedResponsive = (code: string): { html: string; isScript: boolean } => {
  let processed = code.trim();

  // Google Drive link → embed
  if (processed.includes("drive.google.com") && !processed.includes("<iframe")) {
    const match = processed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return {
        html: `<iframe src="https://drive.google.com/file/d/${match[1]}/preview" frameborder="0" allowfullscreen allow="autoplay"></iframe>`,
        isScript: false,
      };
    }
  }

  // YouTube link → embed
  if ((processed.includes("youtube.com/watch") || processed.includes("youtu.be")) && !processed.includes("<iframe")) {
    let videoId = "";
    const ytMatch = processed.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (ytMatch) videoId = ytMatch[1];
    if (videoId) {
      return {
        html: `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen allow="autoplay"></iframe>`,
        isScript: false,
      };
    }
  }

  const isScript = processed.includes("<script");

  // Remove fixed width/height from iframes
  processed = processed.replace(/\s(width|height)="[^"]*"/gi, "");
  processed = processed.replace(/\s(width|height)='[^']*'/gi, "");

  return { html: processed, isScript };
};

export const QuestVideoEmbed = ({ embedCode }: QuestVideoEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { html, isScript } = useMemo(() => makeEmbedResponsive(embedCode), [embedCode]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (isScript) {
      containerRef.current.innerHTML = "";
      const temp = document.createElement("div");
      temp.innerHTML = html;
      Array.from(temp.childNodes).forEach((node) => {
        if (node.nodeName === "SCRIPT") {
          const script = document.createElement("script");
          const src = (node as HTMLScriptElement).src;
          if (src) script.src = src;
          script.textContent = (node as HTMLScriptElement).textContent;
          containerRef.current?.appendChild(script);
        } else {
          containerRef.current?.appendChild(node.cloneNode(true));
        }
      });
    }
  }, [html, isScript]);

  if (isScript) {
    return (
      <div className="relative w-full max-h-[280px] rounded overflow-hidden bg-muted" style={{ aspectRatio: "16/9" }}>
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    );
  }

  return (
    <div className="relative w-full max-h-[280px] rounded overflow-hidden bg-muted" style={{ aspectRatio: "16/9" }}>
      <div
        className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
