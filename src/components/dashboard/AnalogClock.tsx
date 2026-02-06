import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ZoomOut, Clock, Target, TrendingUp, TrendingDown, Calendar, Eye } from "lucide-react";

interface Trade {
  id: string;
  entry_time: string;
  rr: number;
  trade_number: number;
  direction: string;
  trade_date: string;
  setup_type?: string;
  entry_model?: string;
  entry_timing?: string;
  exit_time?: string;
  trade_duration?: string;
  stop_loss_size?: string;
  news_day?: boolean;
  news_label?: string;
}

interface AnalogClockProps {
  trades: Trade[];
  onSelectTiming?: (hour: string, trades: Trade[]) => void;
}

export const AnalogClock = ({ trades, onSelectTiming }: AnalogClockProps) => {
  const [now, setNow] = useState(new Date());
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomTransitioning, setZoomTransitioning] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const parisTime = useMemo(() => {
    return new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  }, [now]);

  const hours = parisTime.getHours();
  const minutes = parisTime.getMinutes();
  const seconds = parisTime.getSeconds();

  const secondAngle = (seconds / 60) * 360;
  const minuteAngle = ((minutes + seconds / 60) / 60) * 360;
  const hourAngle = (((hours % 12) + minutes / 60) / 12) * 360;

  const currentDate = parisTime.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Detect entry time range from data
  const entryTimeRange = useMemo(() => {
    let minH = 24, minM = 60, maxH = 0, maxM = 0;
    let hasEntry = false;
    trades.forEach(t => {
      if (!t.entry_time) return;
      const [h, m] = t.entry_time.split(":").map(Number);
      if (!hasEntry || h < minH || (h === minH && m < minM)) {
        minH = h; minM = m; hasEntry = true;
      }
      if (h > maxH || (h === maxH && m > maxM)) {
        maxH = h; maxM = m;
      }
    });
    if (!hasEntry) return null;
    return { minH, minM, maxH, maxM };
  }, [trades]);

  // Group trades by 30-minute slots
  const tradeSlots = useMemo(() => {
    const slots: Record<string, { trades: Trade[]; totalRR: number }> = {};
    trades.forEach(t => {
      if (!t.entry_time) return;
      const [h, m] = t.entry_time.split(":").map(Number);
      const slotMin = Math.floor(m / 30) * 30;
      const key = `${h.toString().padStart(2, "0")}:${slotMin.toString().padStart(2, "0")}`;
      if (!slots[key]) slots[key] = { trades: [], totalRR: 0 };
      slots[key].trades.push(t);
      slots[key].totalRR += t.rr || 0;
    });
    return slots;
  }, [trades]);

  const getSlotRangeLabel = (key: string) => {
    const [h, m] = key.split(":").map(Number);
    const endMin = m + 30;
    const endH = endMin >= 60 ? h + 1 : h;
    const endM = endMin >= 60 ? endMin - 60 : endMin;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} à ${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
  };

  const timeToAngle = (h: number, m: number) => {
    const h12 = h % 12;
    return ((h12 + m / 60) / 12) * 360 - 90;
  };

  const cx = 200;
  const cy = 200;
  const radius = 170;

  // Entry zone arc path
  const entryZoneArc = useMemo(() => {
    if (!entryTimeRange) return null;
    const { minH, minM, maxH, maxM } = entryTimeRange;
    const startAngle = timeToAngle(minH, minM);
    const endAngle = timeToAngle(maxH, maxM);
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const innerR = 50;
    const outerR = radius - 35;

    const x1 = cx + outerR * Math.cos(startRad);
    const y1 = cy + outerR * Math.sin(startRad);
    const x2 = cx + outerR * Math.cos(endRad);
    const y2 = cy + outerR * Math.sin(endRad);
    const x3 = cx + innerR * Math.cos(endRad);
    const y3 = cy + innerR * Math.sin(endRad);
    const x4 = cx + innerR * Math.cos(startRad);
    const y4 = cy + innerR * Math.sin(startRad);

    let angleDiff = endAngle - startAngle;
    if (angleDiff < 0) angleDiff += 360;
    const largeArcFlag = angleDiff > 180 ? 1 : 0;

    return {
      path: `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`,
      label: `${minH.toString().padStart(2, "0")}:${minM.toString().padStart(2, "0")} - ${maxH.toString().padStart(2, "0")}:${maxM.toString().padStart(2, "0")}`,
    };
  }, [entryTimeRange]);

  // Zoomed viewBox — much wider for well-spaced needles
  const getViewBox = useCallback(() => {
    if (!entryTimeRange || !isZoomed) return "0 0 400 400";
    const { minH, minM, maxH, maxM } = entryTimeRange;
    const startAngle = timeToAngle(minH, minM);
    const endAngle = timeToAngle(maxH, maxM);
    const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
    const zoomCx = cx + 30 * Math.cos(midAngle);
    const zoomCy = cy + 30 * Math.sin(midAngle);
    // Much wider viewBox (200x200) for maximum spacing between needles
    return `${zoomCx - 100} ${zoomCy - 100} 200 200`;
  }, [entryTimeRange, isZoomed]);

  // Handle zoom toggle via button
  const handleToggleZoom = () => {
    if (isZoomed) {
      setZoomTransitioning(true);
      setIsZoomed(false);
      setSelectedSlot(null);
      setSelectedTrade(null);
      setTimeout(() => setZoomTransitioning(false), 800);
    } else {
      setZoomTransitioning(true);
      setTimeout(() => {
        setIsZoomed(true);
        setTimeout(() => setZoomTransitioning(false), 800);
      }, 200);
    }
  };

  // Convert SVG coordinates to screen coordinates for HTML tooltip
  const handleNeedleHover = (key: string, event: React.MouseEvent<SVGGElement>) => {
    setHoveredSlot(key);
    if (svgContainerRef.current) {
      const rect = svgContainerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const handleNeedleMove = (event: React.MouseEvent<SVGGElement>) => {
    if (svgContainerRef.current) {
      const rect = svgContainerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const selectedTrades = selectedSlot ? tradeSlots[selectedSlot]?.trades || [] : [];

  // 3D perspective styles
  const clockContainerStyle = useMemo(() => {
    if (zoomTransitioning && !isZoomed) {
      return {
        transform: "perspective(800px) rotateX(15deg) scale(1.05)",
        transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      };
    }
    if (isZoomed) {
      return {
        transform: "perspective(800px) rotateX(5deg) scale(1.02)",
        transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
      };
    }
    return {
      transform: "perspective(800px) rotateX(0deg) scale(1)",
      transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
    };
  }, [isZoomed, zoomTransitioning]);

  return (
    <div className="flex flex-col items-center w-full max-w-full overflow-visible relative">
      {/* ── Clock with 3D perspective ── */}
      <div className="w-full flex flex-col items-center" style={clockContainerStyle}>
        <div
          ref={svgContainerRef}
          className="relative w-full max-w-[min(480px,90vw)] md:max-w-[560px] lg:max-w-[600px] aspect-square mx-auto"
        >
          <svg
            width="100%"
            height="100%"
            viewBox={getViewBox()}
            className={cn(
              "clock-glow w-full h-full",
              "transition-all duration-700 ease-out"
            )}
            style={{
              overflow: "visible",
              filter: isZoomed ? "drop-shadow(0 0 30px hsl(142 71% 45% / 0.15))" : undefined,
            }}
          >
            <defs>
              <radialGradient id="clockGlow" cx="50%" cy="50%" r="50%">
                <stop offset="85%" stopColor="transparent" />
                <stop offset="95%" stopColor="hsl(142 71% 45% / 0.08)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <filter id="glowFilter">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="zoneGlow">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="strongGlow">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background — uses themed colors */}
            <circle cx={cx} cy={cy} r={radius + 20} fill="url(#clockGlow)" />
            <circle cx={cx} cy={cy} r={radius} fill="none" className="stroke-border" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={radius - 2} className="fill-card" />

            {/* Entry Zone Arc */}
            {entryZoneArc && (
              <path
                d={entryZoneArc.path}
                fill={isZoomed ? "hsl(142 71% 45% / 0.15)" : "hsl(142 71% 45% / 0.06)"}
                stroke="hsl(142 71% 45% / 0.4)"
                strokeWidth={isZoomed ? 1.5 : 0.5}
                filter={isZoomed ? "url(#zoneGlow)" : undefined}
                className="transition-all duration-300"
              />
            )}

            {/* Hour markers */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * 360 - 90;
              const rad = (angle * Math.PI) / 180;
              const x1 = cx + (radius - 12) * Math.cos(rad);
              const y1 = cy + (radius - 12) * Math.sin(rad);
              const x2 = cx + (radius - 4) * Math.cos(rad);
              const y2 = cy + (radius - 4) * Math.sin(rad);
              const labelX = cx + (radius - 28) * Math.cos(rad);
              const labelY = cy + (radius - 28) * Math.sin(rad);
              const hourLabel = i === 0 ? 12 : i;

              return (
                <g key={i}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-muted-foreground" strokeWidth="2" />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-muted-foreground"
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    {hourLabel}
                  </text>
                </g>
              );
            })}

            {/* Minute markers */}
            {Array.from({ length: 60 }).map((_, i) => {
              if (i % 5 === 0) return null;
              const angle = (i / 60) * 360 - 90;
              const rad = (angle * Math.PI) / 180;
              const x1 = cx + (radius - 6) * Math.cos(rad);
              const y1 = cy + (radius - 6) * Math.sin(rad);
              const x2 = cx + (radius - 2) * Math.cos(rad);
              const y2 = cy + (radius - 2) * Math.sin(rad);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-border" strokeWidth="0.5" />;
            })}

            {/* Trade needles — 30min slots */}
            {Object.entries(tradeSlots).map(([key, data]) => {
              const [h, m] = key.split(":").map(Number);
              const angle = timeToAngle(h, m);
              const rad = (angle * Math.PI) / 180;
              const maxRR = Math.max(...Object.values(tradeSlots).map(s => Math.abs(s.totalRR)), 1);
              const needleLength = 40 + (Math.abs(data.totalRR) / maxRR) * 70;
              const x2 = cx + needleLength * Math.cos(rad);
              const y2 = cy + needleLength * Math.sin(rad);
              const isPositive = data.totalRR >= 0;
              const isHovered = hoveredSlot === key;
              const isSelected = selectedSlot === key;
              const color = isPositive ? "#22c55e" : "#ef4444";

              return (
                <g
                  key={key}
                  className="cursor-pointer"
                  onMouseEnter={(e) => handleNeedleHover(key, e)}
                  onMouseMove={handleNeedleMove}
                  onMouseLeave={() => { setHoveredSlot(null); setTooltipPos(null); }}
                  onClick={() => {
                    setSelectedSlot(key === selectedSlot ? null : key);
                    setSelectedTrade(null);
                    if (key !== selectedSlot) {
                      onSelectTiming?.(key, data.trades);
                    }
                  }}
                >
                  <line
                    x1={cx}
                    y1={cy}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={isHovered || isSelected ? (isZoomed ? 5 : 4) : (isZoomed ? 3.5 : 2)}
                    strokeLinecap="round"
                    opacity={isHovered || isSelected ? 1 : (isZoomed ? 0.8 : 0.5)}
                    filter={isHovered || isSelected ? "url(#strongGlow)" : isZoomed ? "url(#glowFilter)" : undefined}
                  />
                  <circle
                    cx={x2}
                    cy={y2}
                    r={isHovered || isSelected ? (isZoomed ? 6 : 5) : (isZoomed ? 4 : 3)}
                    fill={color}
                    opacity={isHovered || isSelected ? 1 : 0.7}
                    filter={isHovered || isSelected ? "url(#strongGlow)" : isZoomed ? "url(#glowFilter)" : undefined}
                  />
                </g>
              );
            })}

            {/* Hour / Minute / Second hands */}
            {!isZoomed && (
              <>
                <line
                  x1={cx} y1={cy}
                  x2={cx + 80 * Math.cos(((hourAngle - 90) * Math.PI) / 180)}
                  y2={cy + 80 * Math.sin(((hourAngle - 90) * Math.PI) / 180)}
                  className="stroke-foreground" strokeWidth="3" strokeLinecap="round"
                />
                <line
                  x1={cx} y1={cy}
                  x2={cx + 110 * Math.cos(((minuteAngle - 90) * Math.PI) / 180)}
                  y2={cy + 110 * Math.sin(((minuteAngle - 90) * Math.PI) / 180)}
                  className="stroke-muted-foreground" strokeWidth="2" strokeLinecap="round"
                />
                <line
                  x1={cx} y1={cy}
                  x2={cx + 140 * Math.cos(((secondAngle - 90) * Math.PI) / 180)}
                  y2={cy + 140 * Math.sin(((secondAngle - 90) * Math.PI) / 180)}
                  stroke="#22c55e" strokeWidth="1" strokeLinecap="round"
                  className="clock-second-hand"
                />
              </>
            )}

            {/* Center dot */}
            <circle cx={cx} cy={cy} r="5" className="fill-foreground" />
            <circle cx={cx} cy={cy} r="2" fill="#22c55e" />

            {/* Digital time & date — centered under 12 */}
            {!isZoomed && (
              <>
                <text
                  x={cx}
                  y={cy - radius + 55}
                  textAnchor="middle"
                  className="fill-foreground"
                  fontSize="13"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {hours.toString().padStart(2, "0")}:{minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
                </text>
                <text
                  x={cx}
                  y={cy - radius + 68}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="7"
                  fontFamily="monospace"
                >
                  {currentDate}
                </text>
                <text
                  x={cx}
                  y={cy - radius + 78}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="6"
                  fontFamily="monospace"
                  style={{ textTransform: "uppercase" }}
                >
                  PARIS GMT+1
                </text>
              </>
            )}
          </svg>

          {/* HTML Tooltip — rendered outside SVG, always on top */}
          {hoveredSlot && tooltipPos && tradeSlots[hoveredSlot] && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: tooltipPos.x,
                top: tooltipPos.y - 50,
                transform: "translateX(-50%)",
              }}
            >
              <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm">
                <p className="text-xs font-mono text-foreground whitespace-nowrap">
                  {getSlotRangeLabel(hoveredSlot)}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    "text-sm font-bold font-mono",
                    tradeSlots[hoveredSlot].totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {tradeSlots[hoveredSlot].totalRR >= 0 ? "+" : ""}{tradeSlots[hoveredSlot].totalRR.toFixed(1)} RR
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    · {tradeSlots[hoveredSlot].trades.length} trade{tradeSlots[hoveredSlot].trades.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toggle zoom button */}
        <button
          onClick={handleToggleZoom}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 border border-border rounded-md bg-card/80 backdrop-blur-sm hover:bg-accent/50 hover:border-foreground/20 transition-all animate-fade-in"
        >
          {isZoomed ? (
            <>
              <ZoomOut className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">Vue complète</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-mono text-muted-foreground">Voir les timings d'entrée en détail</span>
            </>
          )}
        </button>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-sm bg-emerald-500/30 border border-emerald-500/50" />
            <span className="text-[9px] text-muted-foreground font-mono">Plage horaire d'entrée</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-sm bg-muted/30 border border-border" />
            <span className="text-[9px] text-muted-foreground font-mono">Pas de trading</span>
          </div>
        </div>
      </div>

      {/* ── Trade details BELOW the clock ── */}
      {selectedSlot && selectedTrades.length > 0 && (
        <div className="w-full mt-6 space-y-3 animate-fade-in">
          <div className="border border-border p-4 rounded-md bg-card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Trades de {getSlotRangeLabel(selectedSlot)}
              </h4>
              <span className={cn(
                "text-sm font-mono font-bold",
                tradeSlots[selectedSlot].totalRR >= 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {tradeSlots[selectedSlot].totalRR >= 0 ? "+" : ""}{tradeSlots[selectedSlot].totalRR.toFixed(2)} RR
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedTrades.length} trade{selectedTrades.length > 1 ? "s" : ""} • Moy: {(tradeSlots[selectedSlot].totalRR / selectedTrades.length).toFixed(2)} RR
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedTrades.map(trade => (
              <button
                key={trade.id}
                onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                className={cn(
                  "w-full flex items-center justify-between p-3 border rounded-md transition-all text-left",
                  selectedTrade?.id === trade.id
                    ? "border-foreground/20 bg-accent/50 shadow-lg"
                    : "border-border hover:bg-accent/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded",
                    trade.direction === "Long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {trade.direction}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">#{trade.trade_number}</span>
                  <span className="text-xs text-muted-foreground">{trade.trade_date}</span>
                </div>
                <span className={cn(
                  "text-sm font-mono font-bold",
                  (trade.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {(trade.rr || 0) >= 0 ? "+" : ""}{trade.rr?.toFixed(2)} RR
                </span>
              </button>
            ))}
          </div>

          {/* Expanded trade detail */}
          {selectedTrade && (
            <div className="border border-border rounded-md p-4 bg-card space-y-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center border rounded-md flex-shrink-0",
                  selectedTrade.direction === "Long"
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-red-500/50 bg-red-500/10"
                )}>
                  {selectedTrade.direction === "Long"
                    ? <TrendingUp className="w-5 h-5 text-emerald-500" />
                    : <TrendingDown className="w-5 h-5 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Trade #{selectedTrade.trade_number}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedTrade.setup_type || "—"} • {selectedTrade.entry_model || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-lg font-bold",
                    (selectedTrade.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {(selectedTrade.rr || 0) >= 0 ? "+" : ""}{selectedTrade.rr?.toFixed(2)} RR
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="border border-border p-2 rounded-md">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-mono uppercase">Entrée</span>
                  </div>
                  <p className="text-xs font-mono text-foreground">{selectedTrade.entry_time || "—"}</p>
                </div>
                <div className="border border-border p-2 rounded-md">
                  <div className="flex items-center gap-1 mb-1">
                    <Target className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-mono uppercase">Sortie</span>
                  </div>
                  <p className="text-xs font-mono text-foreground">{selectedTrade.exit_time || "—"}</p>
                </div>
                <div className="border border-border p-2 rounded-md">
                  <div className="flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-mono uppercase">Date</span>
                  </div>
                  <p className="text-xs font-mono text-foreground">{selectedTrade.trade_date}</p>
                </div>
                <div className="border border-border p-2 rounded-md">
                  <span className="text-[9px] text-muted-foreground font-mono uppercase">Durée</span>
                  <p className="text-xs font-mono text-foreground mt-1">{selectedTrade.trade_duration || "—"}</p>
                </div>
              </div>

              {(selectedTrade.entry_timing || selectedTrade.stop_loss_size) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-border p-2 rounded-md">
                    <span className="text-[9px] text-muted-foreground font-mono uppercase">Timing</span>
                    <p className="text-xs font-mono text-foreground mt-1">{selectedTrade.entry_timing || "—"}</p>
                  </div>
                  <div className="border border-border p-2 rounded-md">
                    <span className="text-[9px] text-muted-foreground font-mono uppercase">Stop Loss</span>
                    <p className="text-xs font-mono text-foreground mt-1">{selectedTrade.stop_loss_size || "—"}</p>
                  </div>
                </div>
              )}

              {selectedTrade.news_day && (
                <div className="border border-yellow-500/30 bg-yellow-500/5 p-2 rounded-md">
                  <span className="text-[9px] text-yellow-500 font-mono uppercase">⚡ Jour de News: {selectedTrade.news_label || "Oui"}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
