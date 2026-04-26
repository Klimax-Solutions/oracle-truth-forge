// ============================================
// Config Panel V2 — System settings
// Tabs: Rôles (new inline view), Funnel, Quêtes
// DA aligned with CRM/Gestion
// Branch: crm-integration
// ============================================

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings, Crown, Layers, Sparkles, Loader2,
  Users, Search, ChevronDown, CheckCircle, XCircle,
  ShieldCheck, Shield, Award, UserPlus, User, Tag,
  Snowflake, Ban, UserX, RefreshCw, Check, X,
  MoreHorizontal, Clock, Lock,
} from "lucide-react";
import { AccessRulesPanel } from "./AccessRulesPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AdminUserDataViewer } from "./AdminUserDataViewer";

const FunnelEditorPage = lazy(() => import("@/components/dashboard/admin/FunnelEditorPage"));
const QuestStepManager = lazy(() => import("@/components/dashboard/admin/QuestStepManager").then(m => ({ default: m.QuestStepManager })));

// ── Design system ──
const BG = "bg-[hsl(220,15%,8%)]";

function IconBox({ children, color }: { children: React.ReactNode; color: string }) {
  const bg: Record<string, string> = {
    white: "bg-white/[0.06]", violet: "bg-violet-500/[0.12]", emerald: "bg-emerald-500/[0.12]",
    blue: "bg-blue-500/[0.12]", pink: "bg-pink-500/[0.12]", amber: "bg-amber-500/[0.12]",
    red: "bg-red-500/[0.12]", cyan: "bg-cyan-500/[0.12]",
  };
  return <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", bg[color] || bg.white)}>{children}</div>;
}

// ── Types ──
type UserStatus = "active" | "frozen" | "banned";

interface RoleUser {
  user_id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  roles: string[];
  status: UserStatus;
  status_reason: string | null;
  is_client: boolean;
}

// ── Helpers ──
function getRoleLabel(r: string) {
  const m: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", early_access: "Early Access", institute: "Institut", setter: "Setter", closer: "Closer", member: "Membre" };
  return m[r] || r;
}
function getRoleCls(r: string) {
  const m: Record<string, string> = {
    super_admin: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    admin: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    early_access: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    institute: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    setter: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  };
  return m[r] || "bg-white/5 text-white/40 border-white/10";
}
function getRoleIcon(r: string) {
  switch (r) {
    case "super_admin": return <Crown className="w-3 h-3" />;
    case "admin": return <ShieldCheck className="w-3 h-3" />;
    case "early_access": return <Shield className="w-3 h-3" />;
    case "institute": return <Award className="w-3 h-3" />;
    case "setter": return <UserPlus className="w-3 h-3" />;
    default: return <User className="w-3 h-3" />;
  }
}

// ── Tabs ──
const TABS = [
  { id: "roles" as const, label: "Rôles", icon: Crown },
  { id: "funnel" as const, label: "Funnel", icon: Layers },
  { id: "quests" as const, label: "Quêtes", icon: Sparkles },
  { id: "permissions" as const, label: "Permissions", icon: Lock },
  { id: "access-rules" as const, label: "Règles d'accès", icon: Shield },
];
type TabId = (typeof TABS)[number]["id"];

// ── Permissions Matrix ──────────────────────────────────────────────────────
const ROLE_COLS = [
  { id: "super_admin", label: "Super Admin", color: "text-primary", bg: "bg-primary/10 border-primary/30" },
  { id: "admin",       label: "Admin",       color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  { id: "setter",      label: "Setter",      color: "text-pink-400",  bg: "bg-pink-500/10 border-pink-500/30" },
  { id: "closer",      label: "Closer",      color: "text-blue-400",  bg: "bg-blue-500/10 border-blue-500/30" },
  { id: "early_access",label: "Early Access",color: "text-violet-400",bg: "bg-violet-500/10 border-violet-500/30" },
  { id: "member",      label: "Membre",      color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/30" },
] as const;

type RoleId = (typeof ROLE_COLS)[number]["id"];

type PermissionRow = {
  section?: string; // section header si présent
  label: string;
  desc?: string;
  access: Partial<Record<RoleId, boolean | "read">>;
};

const PERMISSION_MATRIX: PermissionRow[] = [
  // ── CRM ──
  { section: "CRM", label: "" , access: {} },
  { label: "Voir le pipeline",        desc: "Accès à l'onglet CRM / liste des leads",                 access: { super_admin: true, admin: true, setter: true, closer: true } },
  { label: "Éditer la vue Setting",   desc: "Checklist, contact, brief closer",                        access: { super_admin: true, admin: true, setter: true } },
  { label: "Éditer la vue Call",      desc: "Issue, débrief, paiement, no-show",                       access: { super_admin: true, admin: true, closer: true } },
  { label: "Assigner un setter",      desc: "Changer le setter d'un lead",                             access: { super_admin: true, admin: true, setter: true } },
  { label: "Approuver un lead EA",    desc: "Passer un lead de en_attente → approuvée",                access: { super_admin: true, admin: true } },
  { label: "Supprimer un lead",       desc: "Suppression définitive d'un early_access_request",        access: { super_admin: true } },
  { label: "Voir métriques CRM",      desc: "Onglets Conversions, Cockpit, Agenda",                   access: { super_admin: true, admin: true, setter: true, closer: true } },

  // ── Gestion produit ──
  { section: "Gestion produit", label: "", access: {} },
  { label: "Voir les membres",        desc: "Liste users, statuts, activité",                          access: { super_admin: true, admin: true } },
  { label: "Modifier les rôles",      desc: "Attribuer / révoquer setter, closer, admin, EA…",         access: { super_admin: true, admin: true } },
  { label: "Geler / bannir un user",  desc: "Actions disciplinaires sur un compte",                    access: { super_admin: true, admin: true } },
  { label: "Voir les vérifications",  desc: "Onglet Vérif. Admin — trades, screenshots",               access: { super_admin: true, admin: true } },
  { label: "Valider / rejeter trade", desc: "Approuver ou refuser une vérification",                   access: { super_admin: true, admin: true } },

  // ── Contenu ──
  { section: "Contenu", label: "", access: {} },
  { label: "Voir les vidéos Oracle",  desc: "5 vidéos du Setup Oracle",                               access: { super_admin: true, admin: true, early_access: true, member: true } },
  { label: "Voir les vidéos bonus",   desc: "Vidéos Mercure Institut",                                 access: { super_admin: true, admin: true, early_access: true, member: true } },
  { label: "Gérer les vidéos",        desc: "Ajouter / modifier / réordonner les vidéos",              access: { super_admin: true, admin: true } },
  { label: "Accès Oracle (produit)",  desc: "Exécution, data analysis, résultats",                     access: { super_admin: true, admin: true, early_access: true, member: true } },

  // ── Configuration ──
  { section: "Configuration", label: "", access: {} },
  { label: "Onglet Config",           desc: "Rôles, Funnel, Quêtes, Permissions",                      access: { super_admin: true, admin: true } },
  { label: "Modifier le funnel",      desc: "Landing, Apply, VSL, emails, boutons",                    access: { super_admin: true, admin: true } },
  { label: "Modifier les quêtes",     desc: "Steps, labels, logique de progression",                   access: { super_admin: true, admin: true } },
  { label: "Simuler un rôle",         desc: "Barre Vue en haut — tester la vue d'un rôle",             access: { super_admin: true } },
];

// Cell colors per role when access = true
const ROLE_CELL_BG: Record<RoleId, string> = {
  super_admin:  "bg-yellow-500/10",
  admin:        "bg-amber-500/10",
  setter:       "bg-pink-500/10",
  closer:       "bg-blue-500/10",
  early_access: "bg-violet-500/10",
  member:       "bg-emerald-500/10",
};
const ROLE_CHECK_COLOR: Record<RoleId, string> = {
  super_admin:  "text-yellow-400",
  admin:        "text-amber-400",
  setter:       "text-pink-400",
  closer:       "text-blue-400",
  early_access: "text-violet-400",
  member:       "text-emerald-400",
};

function PermissionsTab() {
  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">

      {/* Règle fondamentale */}
      <div className="rounded-2xl border border-white/[0.10] bg-gradient-to-br from-white/[0.04] to-transparent p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-display font-bold text-white mb-1">Rôles additifs — règle fondamentale</p>
            <p className="text-xs text-white/50 leading-relaxed max-w-2xl">
              Les rôles se cumulent. Un setter peut aussi être admin et bénéficier des deux scopes.
              Le tableau ci-dessous indique les droits de chaque rôle <span className="text-white/70 font-semibold">pris individuellement</span> — un user cumule les droits de tous ses rôles actifs.
            </p>
          </div>
        </div>
        {/* Badges rôles */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {ROLE_COLS.map(r => (
            <span key={r.id} className={cn("px-3 py-1.5 rounded-lg text-xs font-display font-bold border", r.bg, r.color)}>
              {r.label}
            </span>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.10]">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0e0f15] border-b border-white/[0.10]">
              <th className="text-left px-5 py-4 text-[11px] font-display uppercase tracking-widest text-white/40 w-72">
                Action
              </th>
              {ROLE_COLS.map(r => (
                <th key={r.id} className="px-4 py-4 text-center min-w-[90px]">
                  <span className={cn("inline-block px-2.5 py-1.5 rounded-lg text-[11px] font-display font-bold border", r.bg, r.color)}>
                    {r.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MATRIX.map((row, i) => {
              if (row.section) return (
                <tr key={`section-${i}`} className="border-t-2 border-white/[0.08] bg-white/[0.02]">
                  <td colSpan={ROLE_COLS.length + 1} className="px-5 py-3">
                    <span className="text-[10px] font-display font-bold uppercase tracking-[0.25em] text-white/40">
                      {row.section}
                    </span>
                  </td>
                </tr>
              );
              return (
                <tr key={i} className="border-t border-white/[0.05] hover:bg-white/[0.02] transition-colors group">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-display font-medium text-white/90">{row.label}</p>
                    {row.desc && <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed">{row.desc}</p>}
                  </td>
                  {ROLE_COLS.map(r => {
                    const val = row.access[r.id];
                    return (
                      <td key={r.id} className={cn(
                        "px-4 py-3.5 text-center transition-colors",
                        val === true && ROLE_CELL_BG[r.id]
                      )}>
                        {val === true ? (
                          <span className={cn("text-lg font-bold leading-none", ROLE_CHECK_COLOR[r.id])}>✓</span>
                        ) : val === "read" ? (
                          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">R</span>
                        ) : (
                          <span className="text-white/15 text-base">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-white/20 font-mono">
        Mis à jour le 22 avr. 2026 · <code className="opacity-60">ConfigPanel.tsx → PERMISSION_MATRIX</code>
      </p>
    </div>
  );
}

// ============================================
// ── Main ──
// ============================================

export default function ConfigPanel() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("roles");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Roles data
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Editing
  const [editingFirstName, setEditingFirstName] = useState<string | null>(null);
  const [editingFirstNameValue, setEditingFirstNameValue] = useState("");

  // Action dialog (freeze/ban/remove/unfreeze/unban)
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"freeze" | "ban" | "unfreeze" | "unban" | "remove" | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);

  // Role change dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogUserId, setRoleDialogUserId] = useState<string | null>(null);
  const [roleDialogSelected, setRoleDialogSelected] = useState<string[]>([]);
  const [roleDialogEaType, setRoleDialogEaType] = useState("precall");
  const [roleDialogEaHours, setRoleDialogEaHours] = useState("");
  const [roleDialogProcessing, setRoleDialogProcessing] = useState(false);

  // Data viewer
  const [dataViewerUserId, setDataViewerUserId] = useState<string | null>(null);
  const [dataViewerUserName, setDataViewerUserName] = useState("");

  // ── Check admin / super admin ──
  // Le pannel Config est accessible aux admins ET super_admins (pas seulement super).
  useEffect(() => {
    supabase.rpc("is_super_admin").then(({ data }) => { if (data) setIsSuperAdmin(true); });
    supabase.rpc("is_admin").then(({ data }) => { if (data) setIsAdmin(true); });
  }, []);

  const canAccessConfig = isAdmin || isSuperAdmin;

  // ── Fetch users ──
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: roles }, { data: emails }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, first_name, status, status_reason, is_client"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.rpc("get_team_emails" as any),
      ]);
      const emailMap = new Map<string, string>();
      (emails as any[] || []).forEach((e: any) => emailMap.set(e.user_id, e.email));
      const map = new Map<string, RoleUser>();
      (profiles || []).forEach((p: any) => {
        map.set(p.user_id, {
          user_id: p.user_id, email: emailMap.get(p.user_id) || p.display_name || "?", display_name: p.display_name,
          first_name: p.first_name || null, roles: [], status: p.status || "active",
          status_reason: p.status_reason, is_client: p.is_client || false,
        });
      });
      (roles || []).forEach((r: any) => { const u = map.get(r.user_id); if (u) u.roles.push(r.role); });
      setUsers(Array.from(map.values()));
    } catch (err) {
      console.warn("[ConfigPanel] fetchUsers error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Config → Rôles: équipe uniquement (super_admin, admin, setter) ──
  // Seuls les membres de l'équipe interne apparaissent ici (3-5 personnes max).
  // Les membres/EA/clients sont dans Gestion, pas dans Config.
  const TEAM_ROLES = ["super_admin", "admin", "setter", "closer"];
  const teamUsers = useMemo(() => users.filter((u) => u.roles.some((r) => TEAM_ROLES.includes(r))), [users]);

  const filterCounts = useMemo(() => ({
    all: teamUsers.length,
    super_admin: teamUsers.filter((u) => u.roles.includes("super_admin")).length,
    admin: teamUsers.filter((u) => u.roles.includes("admin")).length,
    setter: teamUsers.filter((u) => u.roles.includes("setter")).length,
    closer: teamUsers.filter((u) => u.roles.includes("closer")).length,
  }), [teamUsers]);

  const filteredUsers = useMemo(() => {
    let list = teamUsers;
    if (roleFilter !== "all") {
      list = list.filter((u) => u.roles.includes(roleFilter));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => (u.display_name || "").toLowerCase().includes(q) || (u.first_name || "").toLowerCase().includes(q) || u.user_id.includes(q));
    }
    return list.sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));
  }, [teamUsers, search, roleFilter]);

  // ── Save first name ──
  const saveFirstName = async (userId: string) => {
    const val = editingFirstNameValue.trim();
    if (!val) return;
    await supabase.from("profiles").update({ first_name: val } as any).eq("user_id", userId);
    setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, first_name: val } : u));
    setEditingFirstName(null);
    toast({ title: "Prénom mis à jour" });
  };

  // ── Toggle client ──
  const toggleClient = async (userId: string) => {
    const u = users.find((x) => x.user_id === userId);
    if (!u) return;
    const newVal = !u.is_client;
    await supabase.from("profiles").update({ is_client: newVal } as any).eq("user_id", userId);
    setUsers((prev) => prev.map((x) => x.user_id === userId ? { ...x, is_client: newVal } : x));
    toast({ title: newVal ? "Tag Client ajouté" : "Tag Client retiré" });
  };

  // ── Action dialog ──
  const openAction = (userId: string, action: "freeze" | "ban" | "unfreeze" | "unban" | "remove") => {
    setActionUserId(userId); setActionType(action); setActionReason(""); setActionDialogOpen(true);
  };

  const executeAction = async () => {
    if (!actionUserId || !actionType) return;
    setActionProcessing(true);
    const { data: { user: me } } = await supabase.auth.getUser();
    try {
      if (actionType === "freeze") await supabase.from("profiles").update({ status: "frozen" as any, frozen_at: new Date().toISOString(), frozen_by: me?.id, status_reason: actionReason || null }).eq("user_id", actionUserId);
      else if (actionType === "ban") await supabase.from("profiles").update({ status: "banned" as any, banned_at: new Date().toISOString(), banned_by: me?.id, status_reason: actionReason || null }).eq("user_id", actionUserId);
      else if (actionType === "unfreeze" || actionType === "unban") await supabase.from("profiles").update({ status: "active" as any, frozen_at: null, banned_at: null, frozen_by: null, banned_by: null, status_reason: null }).eq("user_id", actionUserId);
      else if (actionType === "remove") {
        for (const t of ["verification_requests", "user_followups", "user_executions", "user_personal_trades", "user_custom_variables", "user_variable_types", "user_cycles", "user_roles"]) await (supabase.from(t as any) as any).delete().eq("user_id", actionUserId);
        await supabase.from("profiles").delete().eq("user_id", actionUserId);
      }
      toast({ title: actionType === "remove" ? "Utilisateur supprimé" : "Statut modifié" });
      setActionDialogOpen(false);
      fetchUsers();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
    finally { setActionProcessing(false); }
  };

  // ── Role change dialog ──
  const openRoleDialog = async (userId: string) => {
    const u = users.find((x) => x.user_id === userId);
    if (!u) return;
    setRoleDialogUserId(userId);
    setRoleDialogSelected([...u.roles]);
    setRoleDialogEaHours("");
    if (u.roles.includes("early_access")) {
      const { data } = await supabase.from("user_roles").select("early_access_type" as any).eq("user_id", userId).eq("role", "early_access").maybeSingle();
      setRoleDialogEaType((data as any)?.early_access_type || "precall");
    } else setRoleDialogEaType("precall");
    setRoleDialogOpen(true);
  };

  const toggleRole = (role: string) => {
    if (role === "member") return;
    setRoleDialogSelected((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  const executeRoleChange = async () => {
    if (!roleDialogUserId) return;
    setRoleDialogProcessing(true);
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      const target = users.find((u) => u.user_id === roleDialogUserId);
      if (!target) throw new Error("User not found");
      const current = target.roles.filter((r) => r !== "member");
      const desired = roleDialogSelected.filter((r) => r !== "member");
      // Remove
      for (const r of current.filter((r) => !desired.includes(r))) {
        await supabase.from("user_roles").delete().eq("user_id", roleDialogUserId).eq("role", r as any);
      }
      // Add
      for (const r of desired.filter((r) => !current.includes(r))) {
        const d: any = { user_id: roleDialogUserId, role: r as any, assigned_by: me?.id };
        if (r === "early_access") {
          if (roleDialogEaHours) d.ea_timer_duration_minutes = Math.round(parseFloat(roleDialogEaHours) * 60);
          d.early_access_type = roleDialogEaType;
        }
        const { error } = await supabase.from("user_roles").insert(d);
        if (error && error.code !== "23505") throw error;
      }
      // Update EA type if already exists
      if (desired.includes("early_access") && current.includes("early_access")) {
        await supabase.from("user_roles").update({ early_access_type: roleDialogEaType } as any).eq("user_id", roleDialogUserId).eq("role", "early_access" as any);
      }
      toast({ title: "Rôles mis à jour" });
      setRoleDialogOpen(false);
      fetchUsers();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
    finally { setRoleDialogProcessing(false); }
  };

  const actionMeta = useMemo(() => {
    const u = users.find((x) => x.user_id === actionUserId);
    const name = u?.first_name || u?.display_name || "cet utilisateur";
    const m: Record<string, { title: string; desc: string; icon: JSX.Element; btn: string; variant: "default" | "destructive" }> = {
      freeze: { title: "Geler", desc: `Geler ${name} ?`, icon: <Snowflake className="w-6 h-6 text-blue-500" />, btn: "Geler", variant: "default" },
      ban: { title: "Bannir", desc: `Bannir ${name} ?`, icon: <Ban className="w-6 h-6 text-destructive" />, btn: "Bannir", variant: "destructive" },
      unfreeze: { title: "Réactiver", desc: `Réactiver ${name} ?`, icon: <CheckCircle className="w-6 h-6 text-green-500" />, btn: "Réactiver", variant: "default" },
      unban: { title: "Réactiver", desc: `Réactiver ${name} ?`, icon: <CheckCircle className="w-6 h-6 text-green-500" />, btn: "Réactiver", variant: "default" },
      remove: { title: "Supprimer", desc: `Supprimer ${name} définitivement ?`, icon: <UserX className="w-6 h-6 text-destructive" />, btn: "Supprimer", variant: "destructive" },
    };
    return m[actionType || "freeze"];
  }, [actionType, actionUserId, users]);

  if (!canAccessConfig && activeTab === "roles") {
    // Show tabs but block roles content
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.10]">
        <div className="px-3 md:px-6 flex items-center justify-between h-14 gap-2">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 min-w-0">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn(
                "shrink-0 flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all border",
                activeTab === t.id
                  ? "bg-violet-500/20 text-white border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                  : "border-transparent text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              )}>
                <t.icon className="w-4 h-4 opacity-80" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <IconBox color="violet"><Settings className="w-3 h-3 text-violet-400/80" /></IconBox>
            <span className="text-xs text-white/40 uppercase tracking-wider">Configuration</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">

        {/* ═══ RÔLES ═══ */}
        {activeTab === "roles" && (
          !canAccessConfig ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Shield className="w-12 h-12 text-white/10 mb-4" />
              <p className="text-white/40">Accès réservé aux administrateurs</p>
            </div>
          ) : (
            <div className="px-3 md:px-6 py-4 space-y-3">
              {/* Search */}
              <div className="relative md:max-w-lg">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par nom, prénom ou ID..."
                  className="pl-10 h-10 bg-white/[0.04] border-white/[0.08] rounded-xl text-sm text-white placeholder:text-white/30 focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>}
              </div>

              {/* Filters bar — équipe uniquement */}
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 md:px-4 py-2 gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                <div className="flex items-center gap-2 overflow-x-auto shrink-0">
                  {([
                    { key: "all", label: "Équipe", count: filterCounts.all },
                    { key: "super_admin", label: "Super Admin", count: filterCounts.super_admin },
                    { key: "admin", label: "Admin", count: filterCounts.admin },
                    { key: "setter", label: "Setter", count: filterCounts.setter },
                    { key: "closer", label: "Closer", count: filterCounts.closer },
                  ] as const).map((f) => (
                    <button key={f.key} onClick={() => setRoleFilter(roleFilter === f.key ? "all" : f.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                        roleFilter === f.key
                          ? "bg-violet-500/20 text-white border border-violet-500/30"
                          : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]",
                        f.count === 0 && roleFilter !== f.key && "opacity-25"
                      )}>
                      {f.label}
                      <span className={cn("font-mono text-[11px]", roleFilter === f.key ? "text-white/70" : "text-white/30")}>{f.count}</span>
                    </button>
                  ))}
                </div>
                <div className="hidden md:flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-lg font-bold text-white tabular-nums">{filteredUsers.length}</span>
                  <span className="text-white/30 text-[10px] uppercase">membres équipe</span>
                  <Button variant="ghost" size="sm" onClick={fetchUsers} className="text-white/40 hover:text-white/70 h-8 w-8 p-0 ml-1"><RefreshCw className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {/* Table */}
              <div className={cn("rounded-xl border border-white/[0.10] overflow-x-auto", BG)}>
                {/* Headers */}
                <div className={cn("flex items-center gap-4 px-5 py-3 border-b border-white/[0.08] min-w-max", BG)}>
                  <div className="w-8 shrink-0" />
                  <div className="w-[160px] shrink-0 flex items-center gap-2">
                    <IconBox color="white"><Users className="w-3 h-3 text-white/50" /></IconBox>
                    <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Nom</span>
                  </div>
                  <div className="w-[120px] shrink-0 text-white/70 text-xs font-medium uppercase tracking-wider">Prénom</div>
                  <div className="w-[220px] shrink-0 flex items-center gap-2">
                    <IconBox color="cyan"><Mail className="w-3 h-3 text-cyan-400/80" /></IconBox>
                    <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Email</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <IconBox color="violet"><Crown className="w-3 h-3 text-violet-400/80" /></IconBox>
                    <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Rôles</span>
                  </div>
                  <div className="w-[80px] shrink-0 text-center text-white/70 text-xs font-medium uppercase tracking-wider">Statut</div>
                  <div className="w-[100px] shrink-0 text-right text-white/70 text-xs font-medium uppercase tracking-wider">Actions</div>
                </div>

                {/* Rows */}
                {loading ? (
                  <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-white/30 mx-auto" /></div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-12 text-center text-white/30 text-sm">Aucun résultat</div>
                ) : filteredUsers.map((u) => {
                  const isExpanded = expandedUser === u.user_id;
                  return (
                    <div key={u.user_id} className={cn("border-b border-white/[0.06] transition-colors", isExpanded && "bg-white/[0.03]")}>
                      <button onClick={() => setExpandedUser(isExpanded ? null : u.user_id)} className="w-full min-w-max flex items-center gap-4 px-5 py-2.5 hover:bg-white/[0.04] transition-colors text-left">
                        {/* Avatar */}
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0",
                          u.status === "frozen" ? "bg-blue-500" : u.status === "banned" ? "bg-red-500" : "bg-violet-500/60"
                        )}>{(u.display_name || "?")[0]?.toUpperCase()}</div>

                        {/* Name */}
                        <div className="w-[160px] shrink-0 truncate">
                          <span className="text-sm font-semibold text-white">{u.display_name || "Sans nom"}</span>
                        </div>

                        {/* First name */}
                        <div className="w-[120px] shrink-0">
                          <span className="text-sm text-white/60">{u.first_name || <span className="text-white/20">—</span>}</span>
                        </div>

                        {/* Roles */}
                        <div className="flex-1 flex gap-1 flex-wrap">
                          {u.roles.filter((r) => r !== "member").map((r) => (
                            <span key={r} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border", getRoleCls(r))}>{getRoleIcon(r)}{getRoleLabel(r)}</span>
                          ))}
                          {u.roles.filter((r) => r !== "member").length === 0 && <span className="text-white/20 text-xs">Membre</span>}
                        </div>

                        {/* Status */}
                        <div className="w-[80px] shrink-0 text-center">
                          {u.status === "active" && <span className="text-emerald-400 text-xs">Actif</span>}
                          {u.status === "frozen" && <span className="inline-flex items-center gap-1 text-blue-400 text-xs"><Snowflake className="w-3 h-3" />Gelé</span>}
                          {u.status === "banned" && <span className="inline-flex items-center gap-1 text-red-400 text-xs"><Ban className="w-3 h-3" />Banni</span>}
                        </div>

                        {/* Actions */}
                        <div className="w-[100px] shrink-0 flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/40 hover:text-violet-400" onClick={() => openRoleDialog(u.user_id)}>
                              <Crown className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger><TooltipContent className="text-[10px]">Modifier rôles</TooltipContent></Tooltip>

                          {u.status === "active" && <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/40 hover:text-blue-400" onClick={() => openAction(u.user_id, "freeze")}><Snowflake className="w-3.5 h-3.5" /></Button>
                          </TooltipTrigger><TooltipContent className="text-[10px]">Geler</TooltipContent></Tooltip>}
                          {u.status === "frozen" && <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-400 hover:text-emerald-400" onClick={() => openAction(u.user_id, "unfreeze")}><CheckCircle className="w-3.5 h-3.5" /></Button>
                          </TooltipTrigger><TooltipContent className="text-[10px]">Dégeler</TooltipContent></Tooltip>}
                          {u.status === "banned" && <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-emerald-400" onClick={() => openAction(u.user_id, "unban")}><CheckCircle className="w-3.5 h-3.5" /></Button>
                          </TooltipTrigger><TooltipContent className="text-[10px]">Réactiver</TooltipContent></Tooltip>}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-5 pb-3 pt-1 border-t border-white/[0.04] animate-in fade-in-0 duration-200">
                          <div className="flex items-center gap-6 text-xs text-white/40 font-mono">
                            <span>ID: {u.user_id.slice(0, 12)}...</span>
                            <span>Email: {u.email}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            {/* First name edit */}
                            {editingFirstName === u.user_id ? (
                              <div className="flex items-center gap-1">
                                <Input value={editingFirstNameValue} onChange={(e) => setEditingFirstNameValue(e.target.value)}
                                  className="h-7 text-xs w-40 bg-white/[0.04] border-white/[0.08]" placeholder="Prénom..."
                                  autoFocus onKeyDown={(e) => { if (e.key === "Enter") saveFirstName(u.user_id); if (e.key === "Escape") setEditingFirstName(null); }} />
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-400" onClick={() => saveFirstName(u.user_id)}><Check className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/40" onClick={() => setEditingFirstName(null)}><X className="w-3 h-3" /></Button>
                              </div>
                            ) : (
                              <button className="text-xs text-white/50 hover:text-violet-400 transition-colors" onClick={() => { setEditingFirstName(u.user_id); setEditingFirstNameValue(u.first_name || ""); }}>
                                Prénom: {u.first_name || "Non défini"} — Modifier
                              </button>
                            )}
                            {u.status_reason && <span className="text-xs text-amber-400/60 italic">Raison: {u.status_reason}</span>}
                            <button className="text-xs text-violet-400 hover:text-violet-300 ml-auto" onClick={() => { setDataViewerUserId(u.user_id); setDataViewerUserName(u.first_name || u.display_name || "User"); }}>
                              Voir toutes les données →
                            </button>
                          </div>
                          {/* Danger zone */}
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                            {u.status === "active" && <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-400/60 hover:text-red-400" onClick={() => openAction(u.user_id, "ban")}><Ban className="w-3 h-3 mr-1" />Bannir</Button>}
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-400/60 hover:text-red-400" onClick={() => openAction(u.user_id, "remove")}><UserX className="w-3 h-3 mr-1" />Supprimer</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ═══ FUNNEL ═══ */}
        {activeTab === "funnel" && (
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>}>
            <FunnelEditorPage />
          </Suspense>
        )}

        {/* ═══ QUÊTES ═══ */}
        {activeTab === "quests" && (
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>}>
            <QuestStepManager />
          </Suspense>
        )}

        {/* ═══ PERMISSIONS ═══ */}
        {activeTab === "permissions" && <PermissionsTab />}

        {/* ═══ RÈGLES D'ACCÈS ═══ */}
        {activeTab === "access-rules" && <AccessRulesPanel />}
      </div>

      {/* ── Dialogs ── */}

      {/* Action dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {actionMeta?.icon}
              <div><DialogTitle>{actionMeta?.title}</DialogTitle><DialogDescription className="mt-1">{actionMeta?.desc}</DialogDescription></div>
            </div>
          </DialogHeader>
          {(actionType === "freeze" || actionType === "ban") && (
            <div className="py-2">
              <Label className="text-xs">Raison (optionnel)</Label>
              <Input value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Raison..." className="mt-1 text-sm" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>Annuler</Button>
            <Button variant={actionMeta?.variant} onClick={executeAction} disabled={actionProcessing}>
              {actionProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{actionMeta?.btn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role change dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crown className="w-5 h-5" />Modifier les rôles</DialogTitle>
            <DialogDescription>{users.find((u) => u.user_id === roleDialogUserId)?.first_name || users.find((u) => u.user_id === roleDialogUserId)?.display_name || "Utilisateur"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {[
              { value: "member", label: "Membre", disabled: true },
              { value: "admin", label: "Admin" },
              { value: "early_access", label: "Early Access" },
              { value: "institute", label: "Institut" },
              { value: "setter", label: "Setter" },
              { value: "closer", label: "Closer" },
              { value: "super_admin", label: "Super Admin" },
            ].map((r) => {
              const sel = roleDialogSelected.includes(r.value);
              return (
                <button key={r.value} type="button" disabled={r.disabled} onClick={() => toggleRole(r.value)}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-md border text-sm transition-all text-left",
                    sel ? "border-violet-500 bg-violet-500/10 text-white" : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:bg-white/[0.06]",
                    r.disabled && "opacity-50 cursor-not-allowed"
                  )}>
                  {getRoleIcon(r.value)}<span className="flex-1">{r.label}</span>{sel && <Check className="w-4 h-4 text-violet-400" />}
                </button>
              );
            })}

            {roleDialogSelected.includes("early_access") && (
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <div className="flex gap-2">
                  {(["precall", "postcall"] as const).map((t) => (
                    <button key={t} onClick={() => setRoleDialogEaType(t)}
                      className={cn("flex-1 px-3 py-2 rounded-md border text-xs font-semibold transition-all text-center",
                        roleDialogEaType === t ? t === "precall" ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-white/[0.08] text-white/40 hover:bg-white/[0.06]"
                      )}>{t === "precall" ? "Pré-call" : "Post-call"}</button>
                  ))}
                </div>
                <div>
                  <Label className="text-xs text-white/50">Durée du timer (heures)</Label>
                  <Input type="number" min="1" placeholder="Ex: 48" value={roleDialogEaHours} onChange={(e) => setRoleDialogEaHours(e.target.value)} className="mt-1 h-8 text-sm bg-white/[0.04] border-white/[0.08]" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Annuler</Button>
            <Button onClick={executeRoleChange} disabled={roleDialogProcessing}>
              {roleDialogProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data viewer */}
      <AdminUserDataViewer userId={dataViewerUserId} userName={dataViewerUserName} open={!!dataViewerUserId} onOpenChange={(o) => { if (!o) setDataViewerUserId(null); }} />
    </div>
  );
}
