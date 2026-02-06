import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

interface Trade {
  id: string;
  entry_time: string;
  rr: number;
  trade_number: number;
  direction: string;
  trade_date: string;
}

interface AnalogClockProps {
  trades: Trade[];
  onSelectTiming?: (hour: string, trades: Trade[]) => void;
}

export const AnalogClock = ({ trades, onSelectTiming }: AnalogClockProps) => {
  const [now, setNow] = useState(new Date());
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Paris time (Europe/Paris)
  const parisTime = useMemo(() => {
    return new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  }, [now]);

  const hours = parisTime.getHours();
  const minutes = parisTime.getMinutes();
  const seconds = parisTime.getSeconds();

  // Clock hand angles
  const secondAngle = (seconds / 60) * 360;
  const minuteAngle = ((minutes + seconds / 60) / 60) * 360;
  const hourAngle = (((hours % 12) + minutes / 60) / 12) * 360;

  // Group trades by 10-minute slots (0-23h, every 10 min = 144 slots, but we use 24h format mapped to 12h clock)
  const tradeSlots = useMemo(() => {
    const slots: Record<string, { trades: Trade[]; totalRR: number }> = {};
    
    trades.forEach(t => {
      if (!t.entry_time) return;
      const [h, m] = t.entry_time.split(":").map(Number);
      const slotMin = Math.floor(m / 10) * 10;
      const key = `${h.toString().padStart(2, "0")}:${slotMin.toString().padStart(2, "0")}`;
      if (!slots[key]) slots[key] = { trades: [], totalRR: 0 };
      slots[key].trades.push(t);
      slots[key].totalRR += t.rr || 0;
    });

    return slots;
  }, [trades]);

  // Convert time to angle on 12h clock face
  const timeToAngle = (h: number, m: number) => {
    const h12 = h % 12;
    return ((h12 + m / 60) / 12) * 360 - 90; // -90 because 12 o'clock is at top
  };

  const cx = 200;
  const cy = 200;
  const radius = 170;

  const selectedTrades = selectedSlot ? tradeSlots[selectedSlot]?.trades || [] : [];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Clock */}
      <div className="relative flex-shrink-0 mx-auto">
        <svg width="400" height="400" viewBox="0 0 400 400" className="clock-glow">
          {/* Outer glow ring */}
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
          </defs>

          {/* Background */}
          <circle cx={cx} cy={cy} r={radius + 20} fill="url(#clockGlow)" />
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="hsl(0 0% 20%)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={radius - 2} fill="hsl(0 0% 4%)" />

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
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(0 0% 60%)" strokeWidth="2" />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="hsl(0 0% 50%)"
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
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(0 0% 15%)" strokeWidth="0.5" />;
          })}

          {/* Trade needles */}
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
                onMouseEnter={() => setHoveredSlot(key)}
                onMouseLeave={() => setHoveredSlot(null)}
                onClick={() => {
                  setSelectedSlot(key === selectedSlot ? null : key);
                  if (key !== selectedSlot) {
                    onSelectTiming?.(key, data.trades);
                  }
                }}
              >
                {/* Hover/select highlight zone */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={x2}
                  y2={y2}
                  stroke={color}
                  strokeWidth={isHovered || isSelected ? 4 : 2}
                  strokeLinecap="round"
                  opacity={isHovered || isSelected ? 1 : 0.5}
                  filter={isHovered || isSelected ? "url(#glowFilter)" : undefined}
                />
                {/* Dot at end */}
                <circle
                  cx={x2}
                  cy={y2}
                  r={isHovered || isSelected ? 5 : 3}
                  fill={color}
                  opacity={isHovered || isSelected ? 1 : 0.7}
                  filter={isHovered || isSelected ? "url(#glowFilter)" : undefined}
                />
                {/* Tooltip on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={x2 - 40}
                      y={y2 - 30}
                      width="80"
                      height="24"
                      rx="4"
                      fill="hsl(0 0% 10%)"
                      stroke="hsl(0 0% 20%)"
                      strokeWidth="0.5"
                    />
                    <text
                      x={x2}
                      y={y2 - 15}
                      textAnchor="middle"
                      fill="white"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {key} · {data.totalRR >= 0 ? "+" : ""}{data.totalRR.toFixed(1)}RR · {data.trades.length}t
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Hour hand */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + 80 * Math.cos(((hourAngle - 90) * Math.PI) / 180)}
            y2={cy + 80 * Math.sin(((hourAngle - 90) * Math.PI) / 180)}
            stroke="hsl(0 0% 85%)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Minute hand */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + 110 * Math.cos(((minuteAngle - 90) * Math.PI) / 180)}
            y2={cy + 110 * Math.sin(((minuteAngle - 90) * Math.PI) / 180)}
            stroke="hsl(0 0% 70%)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Second hand (trotteuse) */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + 140 * Math.cos(((secondAngle - 90) * Math.PI) / 180)}
            y2={cy + 140 * Math.sin(((secondAngle - 90) * Math.PI) / 180)}
            stroke="#22c55e"
            strokeWidth="1"
            strokeLinecap="round"
            className="clock-second-hand"
          />

          {/* Center dot */}
          <circle cx={cx} cy={cy} r="5" fill="hsl(0 0% 85%)" />
          <circle cx={cx} cy={cy} r="2" fill="#22c55e" />
        </svg>

        {/* Digital time display */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
          <p className="text-lg font-mono font-bold text-foreground tabular-nums">
            {hours.toString().padStart(2, "0")}:{minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Paris GMT+1</p>
        </div>
      </div>

      {/* Selected timing details */}
      <div className="flex-1 min-w-0">
        {selectedSlot && selectedTrades.length > 0 ? (
          <div className="space-y-3">
            <div className="border border-border p-4 rounded-md bg-card">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Trades à {selectedSlot}
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

            <div className="space-y-1.5 max-h-[300px] overflow-auto scrollbar-hide">
              {selectedTrades.map(trade => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-accent/30 transition-colors"
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
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-mono text-center">
              Cliquez sur une aiguille<br />pour voir les trades
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
