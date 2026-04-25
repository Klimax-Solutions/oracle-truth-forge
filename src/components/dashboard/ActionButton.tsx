/**
 * ActionButton — bouton "artefact" premium, cohérent avec OracleHomePage.
 * Gradient + inner-highlight + glow shadow + hover lift.
 */

import { useState } from "react";

interface ActionButtonProps {
  onClick?: () => void;
  label: string;
  icon?: React.ReactNode;
  bg: string;           // ex: "#158A7E"
  shadow: string;       // ex: "rgba(21,138,126,0.50)"
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md";
}

export const ActionButton = ({
  onClick, label, icon, bg, shadow, disabled = false, fullWidth = false, size = "md",
}: ActionButtonProps) => {
  const [hovered, setHovered] = useState(false);

  const pad = size === "sm" ? "10px 18px" : "13px 22px";
  const fz  = size === "sm" ? "13px" : "14px";
  const br  = size === "sm" ? "12px" : "14px";

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: pad,
        borderRadius: br,
        fontSize: fz,
        fontWeight: 700,
        fontFamily: "'Inter', system-ui, sans-serif",
        letterSpacing: "-0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        border: "none",
        outline: "none",
        width: fullWidth ? "100%" : undefined,
        justifyContent: fullWidth ? "center" : undefined,
        // Colors
        background: disabled
          ? "rgba(255,255,255,0.05)"
          : `linear-gradient(135deg, ${bg} 0%, ${bg}cc 100%)`,
        color: disabled ? "rgba(255,255,255,0.30)" : "#fff",
        // Border
        boxShadow: disabled ? "0 0 0 1px rgba(255,255,255,0.08)" : [
          `0 0 0 1px rgba(255,255,255,0.06)`,
          `0 ${hovered ? "10px" : "8px"} 32px -6px ${shadow}`,
          `0 2px 0 0 rgba(255,255,255,0.10) inset`,
        ].join(", "),
        // Hover lift
        transform: !disabled && hovered ? "translateY(-1px) scale(1.02)" : "none",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      {icon}
      {label}
    </button>
  );
};
