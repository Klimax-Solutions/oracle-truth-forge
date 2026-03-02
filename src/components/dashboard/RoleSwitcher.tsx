import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

export type SimulatedRole = "none" | "admin" | "member" | "early_access" | "setter";

const roles: { id: SimulatedRole; label: string; color: string }[] = [
  { id: "none", label: "Super Admin", color: "bg-primary text-primary-foreground" },
  { id: "admin", label: "Admin", color: "bg-amber-600 text-white" },
  { id: "member", label: "Membre", color: "bg-emerald-600 text-white" },
  { id: "early_access", label: "Early Access", color: "bg-violet-600 text-white" },
  { id: "setter", label: "Setter", color: "bg-pink-600 text-white" },
];

interface RoleSwitcherProps {
  current: SimulatedRole;
  onChange: (role: SimulatedRole) => void;
}

export const RoleSwitcher = ({ current, onChange }: RoleSwitcherProps) => {
  return (
    <div className="flex items-center gap-1.5">
      <Eye className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      {roles.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-all",
            current === r.id
              ? r.color
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Given the real roles and a simulated role, compute effective flags.
 */
export const getEffectiveRoles = (
  realIsSuperAdmin: boolean,
  simulatedRole: SimulatedRole,
  realIsSetter: boolean = false
) => {
  if (!realIsSuperAdmin || simulatedRole === "none") {
    return { effectiveIsAdmin: realIsSuperAdmin, effectiveIsSuperAdmin: realIsSuperAdmin, effectiveIsEarlyAccess: false, effectiveIsSetter: realIsSetter, effectiveIsMember: true };
  }

  switch (simulatedRole) {
    case "admin":
      return { effectiveIsAdmin: true, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: false, effectiveIsSetter: false, effectiveIsMember: true };
    case "member":
      return { effectiveIsAdmin: false, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: false, effectiveIsSetter: false, effectiveIsMember: true };
    case "early_access":
      return { effectiveIsAdmin: false, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: true, effectiveIsSetter: false, effectiveIsMember: false };
    case "setter":
      return { effectiveIsAdmin: false, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: false, effectiveIsSetter: true, effectiveIsMember: false };
    default:
      return { effectiveIsAdmin: true, effectiveIsSuperAdmin: true, effectiveIsEarlyAccess: false, effectiveIsSetter: false, effectiveIsMember: true };
  }
};
