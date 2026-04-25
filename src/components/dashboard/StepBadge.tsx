/**
 * StepBadge — badge étape cohérent sur toutes les pages dédiées Oracle.
 * Pill + pulse dot + "Étape 01 — Fondations" (identique OracleHomePage).
 *
 * Couleurs par étape (source : OracleHomePage SLIDES config) :
 *   01 Fondations  → accent #4F78CC
 *   02 Récolte     → accent #1AAFA0
 *   03 Vérification→ accent #C8882A
 */

interface StepBadgeProps {
  /** "01", "02", "03" */
  index: string;
  /** "Fondations", "Récolte", "Vérification" */
  label: string;
  /** Accent color hex */
  accent: string;
  /** Optional subtitle shown after the pill (ex: "· Chapitre 02") */
  sub?: string;
}

export const StepBadge = ({ index, label, accent, sub }: StepBadgeProps) => {
  const bg     = `${accent}12`;
  const border = `${accent}30`;
  const text   = `${accent}ee`;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
      {/* Pill */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "5px 11px",
          borderRadius: "999px",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          background: bg,
          color: text,
          border: `1px solid ${border}`,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Pulse dot */}
        <span style={{ position: "relative", display: "flex", width: "6px", height: "6px", flexShrink: 0 }}>
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: accent,
              opacity: 0.5,
              animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
          <span
            style={{
              position: "relative",
              borderRadius: "50%",
              width: "6px",
              height: "6px",
              background: accent,
            }}
          />
        </span>
        Étape {index} — {label}
      </span>

      {/* Sous-titre optionnel (chapitre, etc.) */}
      {sub && (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            color: `${accent}80`,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
};
