import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

export type SimulatedRole = "none" | "admin" | "member" | "early_access" | "setter" | "closer" | "setter+closer";

const roles: { id: SimulatedRole; label: string; color: string }[] = [
  { id: "none", label: "Super Admin", color: "bg-primary text-primary-foreground" },
  { id: "admin", label: "Admin", color: "bg-amber-600 text-white" },
  { id: "member", label: "Membre", color: "bg-emerald-600 text-white" },
  { id: "early_access", label: "Early Access", color: "bg-violet-600 text-white" },
  { id: "setter", label: "Setter", color: "bg-pink-600 text-white" },
  { id: "closer", label: "Closer", color: "bg-blue-600 text-white" },
  { id: "setter+closer", label: "Setter+Closer", color: "bg-indigo-600 text-white" },
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
  realIsSetter: boolean = false,
  realIsCloser: boolean = false,
  realIsAdmin: boolean = false,
) => {
  if (!realIsSuperAdmin || simulatedRole === "none") {
    // Admin (non-super) doit avoir effectiveIsAdmin=true.
    // Sans ça, les guards de panel (CRM, Vérifications, Gestion, Config)
    // bloquent les admins même s'ils voient l'onglet en sidebar.
    return { effectiveIsAdmin: realIsAdmin || realIsSuperAdmin, effectiveIsSuperAdmin: realIsSuperAdmin, effectiveIsEarlyAccess: false, effectiveIsSetter: realIsSetter, effectiveIsCloser: realIsCloser, effectiveIsMember: true };
  }

  switch (simulatedRole) {
    case "admin":
      return { effectiveIsAdmin: true, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: false, effectiveIsSetter: false, effectiveIsCloser: false, effectiveIsMember: true };
    case "member":
      return { effectiveIsAdmin: false, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: false, effectiveIsSetter: false, effectiveIsCloser: false, effectiveIsMember: true };
    case "early_access":
      return { effectiveIsAdmin: false, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: true, effectiveIsSetter: false, effectiveIsCloser: false, effectiveIsMember: false };
    case "setter":
      return { effectiveIsAdmin: false, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: false, effectiveIsSetter: true, effectiveIsCloser: false, effectiveIsMember: false };
    case "closer":
      return { effectiveIsAdmin: false, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: false, effectiveIsSetter: false, effectiveIsCloser: true, effectiveIsMember: false };
    case "setter+closer":
      return { effectiveIsAdmin: false, effectiveIsSuperAdmin: false, effectiveIsEarlyAccess: false, effectiveIsSetter: true, effectiveIsCloser: true, effectiveIsMember: false };
    default:
      return { effectiveIsAdmin: true, effectiveIsSuperAdmin: true, effectiveIsEarlyAccess: false, effectiveIsSetter: false, effectiveIsCloser: false, effectiveIsMember: true };
  }
};
