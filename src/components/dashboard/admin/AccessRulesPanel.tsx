/**
 * AccessRulesPanel — Documentation exhaustive de toutes les règles d'accès Oracle
 * =================================================================================
 * Référence unique pour :
 *   1. Modèle de données (rôles, statuts, attributs)
 *   2. Combinaisons de rôles valides / comportements
 *   3. Accès pages & fonctionnalités par rôle
 *   4. Progression Oracle — qu'est-ce qui débloque quoi
 *   5. Règles de saisie des trades (lien vers oracle-cycle-windows.ts)
 *   6. Early Access — timer et états
 *
 * Ce fichier est documentaire, pas fonctionnel. Il ne modifie rien.
 * Pour modifier une règle : chercher la source indiquée en annotation.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Shield, Users, Lock, Unlock, Clock, ChevronDown, ChevronRight,
  CheckCircle, XCircle, AlertTriangle, ArrowRight, BookOpen,
  Database, Eye, EyeOff, Zap, Crown, User, Timer, Star, Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type BadgeVariant = "ok" | "no" | "partial" | "admin" | "warn" | "info";

function Badge({ v, children }: { v: BadgeVariant; children?: React.ReactNode }) {
  const map: Record<BadgeVariant, string> = {
    ok:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    no:      "bg-red-500/10 text-red-400/70 border-red-500/15",
    partial: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    admin:   "bg-violet-500/15 text-violet-400 border-violet-500/25",
    warn:    "bg-orange-500/15 text-orange-400 border-orange-500/25",
    info:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const icons: Record<BadgeVariant, React.ReactNode> = {
    ok:      <CheckCircle className="w-3 h-3" />,
    no:      <XCircle className="w-3 h-3" />,
    partial: <AlertTriangle className="w-3 h-3" />,
    admin:   <Crown className="w-3 h-3" />,
    warn:    <AlertTriangle className="w-3 h-3" />,
    info:    <Info className="w-3 h-3" />,
  };
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap",
      map[v]
    )}>
      {icons[v]}
      {children}
    </span>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Collapsible({ title, defaultOpen = false, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[.02] transition-colors"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
               : <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-border">{children}</div>}
    </div>
  );
}

// ── Données ────────────────────────────────────────────────────────────────────

const ROLES = [
  {
    id: "super_admin",
    label: "Super Admin",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/30",
    desc: "Contrôle total du système. Assigne tous les rôles, modifie funnel/quêtes, simule n'importe quel rôle.",
    permanent: false,
    auto: false,
    source: "user_roles table + is_super_admin() RPC",
  },
  {
    id: "admin",
    label: "Admin",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    desc: "Gère les membres, vérifie les trades, accède au CRM. Ne peut PAS modifier funnel/quêtes/rôles.",
    permanent: false,
    auto: false,
    source: "user_roles table + is_admin() RPC (inclut super_admin)",
  },
  {
    id: "setter",
    label: "Setter",
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/30",
    desc: "Voit le CRM filtré à ses leads. Peut éditer vue Setting, assigner un closer.",
    permanent: false,
    auto: false,
    source: "user_roles table + is_setter() RPC",
  },
  {
    id: "closer",
    label: "Closer",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    desc: "Voit le CRM. Peut éditer la vue Call, commenter les leads.",
    permanent: false,
    auto: false,
    source: "user_roles table + is_closer() RPC",
  },
  {
    id: "early_access",
    label: "Early Access",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/30",
    desc: "Accès trial au produit Oracle. Avec ou sans timer. Timer démarre au 1er login (activate_ea_timer).",
    permanent: false,
    auto: false,
    source: "user_roles table + is_early_access() RPC (vérifie expires_at)",
  },
  {
    id: "member",
    label: "Membre",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    desc: "Rôle de base auto-assigné à l'inscription. TOUS les users l'ont. Ne confère pas d'accès spécial seul.",
    permanent: true,
    auto: true,
    source: "user_roles table — assigné automatiquement à l'inscription, jamais retiré",
  },
  {
    id: "institute",
    label: "Institut",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/30",
    desc: "Tag pour les clients école/institut. Cumulatif avec tout autre rôle. Ne modifie pas l'accès.",
    permanent: false,
    auto: false,
    source: "user_roles table + is_institute() RPC",
  },
] as const;

const STATUSES = [
  {
    id: "active",
    label: "Actif",
    color: "text-emerald-400",
    desc: "État normal. Le user peut se connecter et utiliser l'app selon ses rôles.",
    overrides: "Aucun",
    isDefault: true,
  },
  {
    id: "frozen",
    label: "Gelé",
    color: "text-blue-400",
    desc: "Bloqué temporairement. Le user voit un écran d'accès bloqué. Peut être dégeler.",
    overrides: "Tous les accès produit",
    isDefault: false,
  },
  {
    id: "banned",
    label: "Banni",
    color: "text-red-400",
    desc: "Bloqué définitivement. Même effet que gelé mais signal sémantiquement permanent.",
    overrides: "Tous les accès produit",
    isDefault: false,
  },
] as const;

// Page access matrix
const PAGE_ACCESS = [
  {
    page: "Exécution d'Oracle",
    path: "tab=execution",
    member: "ok",
    early_access: "ok",
    admin: "ok",
    super_admin: "ok",
    setter: "no",
    closer: "no",
    note: "Vue principale des cycles et progression",
  },
  {
    page: "Vidéo Setup Oracle",
    path: "tab=setup",
    member: "ok",
    early_access: "ok",
    admin: "ok",
    super_admin: "ok",
    setter: "no",
    closer: "no",
    note: "5 vidéos de setup Oracle",
  },
  {
    page: "Récolte de données",
    path: "tab=recolte",
    member: "ok",
    early_access: "ok",
    admin: "ok",
    super_admin: "ok",
    setter: "no",
    closer: "no",
    note: "OracleVérif + Saisie des trades",
  },
  {
    page: "Data Analysis",
    path: "tab=analysis",
    member: "ok",
    early_access: "ok",
    admin: "ok",
    super_admin: "ok",
    setter: "no",
    closer: "no",
    note: "",
  },
  {
    page: "Chat / Résultats",
    path: "tab=chat",
    member: "ok",
    early_access: "ok",
    admin: "ok",
    super_admin: "ok",
    setter: "no",
    closer: "no",
    note: "",
  },
  {
    page: "CRM",
    path: "tab=crm",
    member: "no",
    early_access: "no",
    admin: "ok",
    super_admin: "ok",
    setter: "partial",
    closer: "partial",
    note: "Setter/Closer : vue restreinte à leurs leads",
  },
  {
    page: "Gestion",
    path: "tab=gestion",
    member: "no",
    early_access: "no",
    admin: "ok",
    super_admin: "ok",
    setter: "no",
    closer: "no",
    note: "Gestion membres, vérifications, EA management",
  },
  {
    page: "Configuration",
    path: "tab=config",
    member: "no",
    early_access: "no",
    admin: "ok",
    super_admin: "ok",
    setter: "no",
    closer: "no",
    note: "Rôles, Funnel (SA seulement), Quêtes (SA seulement)",
  },
] as const;

type AccessValue = "ok" | "no" | "partial";

const COMBO_RULES = [
  {
    combo: "member",
    label: "member seul",
    valid: true,
    desc: "Utilisateur inscrit mais sans accès produit actif. État par défaut après signup.",
    example: "Lead en attente d'approbation EA",
    color: "border-white/[.08]",
  },
  {
    combo: "member + early_access",
    label: "member + early_access",
    valid: true,
    desc: "Standard pour un utilisateur en trial. Le member est toujours là (base), early_access ajoute l'accès produit + timer.",
    example: "User EA pendant la période trial",
    color: "border-violet-500/20",
  },
  {
    combo: "member + early_access (expired)",
    label: "member + early_access expiré",
    valid: true,
    desc: "Timer expiré. is_early_access() retourne false. Le user voit un écran d'expiration. Le rôle reste en DB mais inactif.",
    example: "User dont le timer est terminé, en attente de closing",
    color: "border-orange-500/20",
  },
  {
    combo: "member + is_client",
    label: "member + is_client=true",
    valid: true,
    desc: "Client payant. is_client est un booléen sur profiles, indépendant des rôles. Accès produit permanent sans timer.",
    example: "Client fermé après paiement",
    color: "border-emerald-500/20",
  },
  {
    combo: "member + early_access + is_client",
    label: "member + early_access + is_client",
    valid: false,
    desc: "⚠ Combinaison incohérente. Un client payant n'a plus besoin d'early_access. À éviter — le rôle EA devrait être retiré lors du closing.",
    example: "Transition non nettoyée après paiement",
    color: "border-red-500/20",
  },
  {
    combo: "member + admin",
    label: "member + admin",
    valid: true,
    desc: "Staff admin standard. member est toujours là (base).",
    example: "Admin de l'équipe Oracle",
    color: "border-amber-500/20",
  },
  {
    combo: "member + super_admin",
    label: "member + super_admin",
    valid: true,
    desc: "Accès total. is_admin() retourne true pour super_admin aussi.",
    example: "Charles",
    color: "border-primary/20",
  },
  {
    combo: "member + setter",
    label: "member + setter",
    valid: true,
    desc: "Setter sans accès produit Oracle. Voit uniquement le CRM.",
    example: "Setter de l'équipe commerciale",
    color: "border-pink-500/20",
  },
  {
    combo: "member + closer",
    label: "member + closer",
    valid: true,
    desc: "Closer sans accès produit Oracle. Voit uniquement le CRM.",
    example: "Closer de l'équipe commerciale",
    color: "border-blue-500/20",
  },
  {
    combo: "member + early_access + institute",
    label: "member + early_access + institute",
    valid: true,
    desc: "User EA venant d'une école partenaire. institute est un tag qui ne modifie pas l'accès.",
    example: "Étudiant école X en trial Oracle",
    color: "border-cyan-500/20",
  },
] as const;

// Oracle progression steps
const ORACLE_PROGRESSION = [
  {
    step: "Ébauche (Cycle 0)",
    phase: 0,
    color: "text-amber-400 border-amber-500/30 bg-amber-500/5",
    unlock_condition: "Compte créé (EA et Member) — accès direct §0.3a",
    user_action: "Saisir 15 trades dans Récolte Oracle (recopie des 15 trades de référence)",
    completion: "COUNT(user_executions WHERE trade_number BETWEEN 1 AND 15) >= 15",
    validation: "AUCUNE — Ébauche est un sas, pas un cycle de validation §0.3a",
    next_unlock: "Member : AUTO si 15/15 saisis (RPC auto_unlock_cycle_one_if_eligible) | EA : bloqué → CTA upgrade /vip/discovery",
    oracle_access: "Database/Setup Oracle : 15 trades Oracle visibles dès J1 (EA + Member)",
    notes: "Sas d'apprentissage de l'interface. user_cycles[0].status reste 'in_progress' indéfiniment. Aucune VR créée. Jamais de transition vers validated/rejected (guardé en code).",
  },
  {
    step: "Cycle 1 (Phase 1)",
    phase: 1,
    color: "text-primary border-primary/30 bg-primary/5",
    unlock_condition: "Member : auto-unlock dès 15/15 trades Ébauche §0.3a | Admin : unlock manuel possible (cas reset)",
    user_action: "Saisir 25 trades (trades 16–40) avec screenshots",
    completion: "user_executions.length >= 25 (sur la fenêtre 16-40)",
    validation: "Soumission VR par user → admin valide ou rejette",
    next_unlock: "Validation admin → unlock_next_cycle() → Cycle 2 in_progress",
    oracle_access: "Oracle Ébauche visible (trades 1-15) après unlock Cycle 1 : trades 1-40 visibles",
    notes: "Premier cycle avec validation. Règles de temporalité actives. EA n'a jamais accès même via auto-unlock.",
  },
  {
    step: "Cycle 2–4 (Phase 1)",
    phase: 1,
    color: "text-primary border-primary/30 bg-primary/5",
    unlock_condition: "Cycle précédent validé",
    user_action: "Saisir 25 trades par cycle avec screenshots",
    completion: "user_executions.length >= cycle.total_trades (cumulé)",
    validation: "Auto si précision ≥ 90% | Admin si < 90%",
    next_unlock: "Validation → cycle suivant in_progress",
    oracle_access: "Oracle jusqu'au cycle N-1 visible",
    notes: "",
  },
  {
    step: "Cycles 5–8 (Phase 2)",
    phase: 2,
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    unlock_condition: "Cycle précédent validé",
    user_action: "Saisir 50–64 trades par cycle avec screenshots",
    completion: "user_executions.length >= cycle.total_trades (cumulé)",
    validation: "Auto si précision ≥ 90% | Admin si < 90%",
    next_unlock: "Validation → cycle suivant in_progress",
    oracle_access: "Oracle jusqu'au cycle N-1 visible",
    notes: "Cycles plus longs (50 à 64 trades). Mêmes règles de validation.",
  },
] as const;

// ── Composant principal ────────────────────────────────────────────────────────

export function AccessRulesPanel() {
  return (
    <div className="space-y-4 md:space-y-6 px-3 md:px-6 py-4 md:py-5 max-w-5xl mx-auto">

      {/* ═══ INTRO ═══ */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/[.04]">
        <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-foreground mb-1">Référence des règles d'accès Oracle</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ce panneau documente l'ensemble des règles d'accès, de permissions et de progression du produit Oracle.
            Il est documentaire — pour modifier une règle, utiliser la source indiquée dans chaque section.
            Les règles de saisie des trades sont dans{" "}
            <code className="text-[11px] bg-white/[.06] px-1 py-0.5 rounded">src/lib/oracle-cycle-windows.ts</code>.
          </p>
        </div>
      </div>

      {/* ═══ 1. MODÈLE DE DONNÉES ═══ */}
      <Collapsible title="1 — Modèle de données : rôles, statuts, attributs" defaultOpen>
        <div className="space-y-5 mt-2">

          {/* Rôles */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Rôles (cumulatifs — un user peut en avoir plusieurs)
            </p>
            <div className="space-y-2">
              {ROLES.map(r => (
                <div key={r.id} className={cn("flex items-start gap-3 p-3 rounded-lg border", r.bg)}>
                  <span className={cn("text-xs font-black font-mono min-w-[100px]", r.color)}>{r.label}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80">{r.desc}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <code className="text-[10px] bg-white/[.04] px-1.5 py-0.5 rounded text-muted-foreground/60">{r.source}</code>
                      {r.auto && <Badge v="info">auto-assigné</Badge>}
                      {r.permanent && <Badge v="warn">jamais retiré</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statuts */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Statuts (exclusifs — un seul à la fois sur profiles.status)
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Statut</th>
                    <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Description</th>
                    <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Override</th>
                    <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Défaut</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUSES.map(s => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0">
                      <td className={cn("px-3 py-2 font-bold font-mono", s.color)}>{s.label}</td>
                      <td className="px-3 py-2 text-foreground/70">{s.desc}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.overrides}</td>
                      <td className="px-3 py-2">{s.isDefault ? <Badge v="ok">oui</Badge> : <Badge v="no">non</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-2 italic">
              Source : <code>profiles.status</code> — modifiable via Gestion → fiche user ou Config → Rôles
            </p>
          </div>

          {/* Attributs spéciaux */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Attributs spéciaux (distincts des rôles)
            </p>
            <div className="space-y-2">
              {[
                {
                  field: "profiles.is_client",
                  type: "boolean",
                  desc: "Client payant avec accès permanent au produit. Indépendant des rôles. Ne déclenche pas de timer.",
                  source: "profiles table — à passer à true lors du closing",
                },
                {
                  field: "user_roles.expires_at",
                  type: "TIMESTAMPTZ | NULL",
                  desc: "Date d'expiration du rôle early_access. NULL = timer non démarré. Passé = expiré.",
                  source: "Déclenché par activate_ea_timer() RPC au 1er login",
                },
                {
                  field: "user_roles.early_access_type",
                  type: "'precall' | 'postcall'",
                  desc: "Détermine si l'EA utilise les paramètres globaux (precall) ou personnalisés (postcall).",
                  source: "Assigné manuellement par admin lors de l'approbation EA",
                },
                {
                  field: "user_roles.ea_timer_duration_minutes",
                  type: "integer | NULL",
                  desc: "Durée du timer EA en minutes. NULL = pas de timer. Configuré dans les settings EA.",
                  source: "ea_global_settings ou early_access_settings (selon type)",
                },
              ].map(a => (
                <div key={a.field} className="flex items-start gap-3 p-3 rounded-lg border border-white/[.07] bg-white/[.02]">
                  <code className="text-[11px] font-mono text-primary/70 min-w-[200px] leading-relaxed">{a.field}</code>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground/60 bg-white/[.04] px-1.5 py-0.5 rounded">{a.type}</span>
                    </div>
                    <p className="text-xs text-foreground/70">{a.desc}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1 italic">Source : {a.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Collapsible>

      {/* ═══ 2. COMBINAISONS DE RÔLES ═══ */}
      <Collapsible title="2 — Combinaisons de rôles valides / invalides" defaultOpen>
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/[.05] border border-amber-500/20 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400/80">
              <strong>Note :</strong> le rôle <code>member</code> est TOUJOURS présent (base). Les combinaisons
              ci-dessous montrent les rôles additionnels. Il n'existe actuellement AUCUN fireguard en DB —
              toutes les combinaisons sont techniquement possibles. Les règles "invalides" sont des conventions
              à respecter manuellement.
            </p>
          </div>

          {COMBO_RULES.map(c => (
            <div key={c.combo} className={cn("flex items-start gap-3 p-3 rounded-lg border", c.color)}>
              <div className="shrink-0 mt-0.5">
                {c.valid
                  ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                  : <XCircle className="w-4 h-4 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-[11px] font-mono font-bold text-foreground">{c.label}</code>
                  {c.valid ? <Badge v="ok">valide</Badge> : <Badge v="warn">à éviter</Badge>}
                </div>
                <p className="text-xs text-foreground/70">{c.desc}</p>
                <p className="text-[11px] text-muted-foreground/50 mt-1 italic">Exemple : {c.example}</p>
              </div>
            </div>
          ))}

          <div className="mt-3 p-3 rounded-lg border border-white/[.07] bg-white/[.02]">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">À implémenter (fireguards recommandés)</p>
            <ul className="space-y-1 text-xs text-muted-foreground/70">
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-primary/50 shrink-0" />
                Lors du closing (is_client → true) : retirer automatiquement le rôle <code>early_access</code>
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-primary/50 shrink-0" />
                Un user frozen/banned ne devrait pas déclencher activate_ea_timer
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-primary/50 shrink-0" />
                Avertissement admin si on tente d'assigner early_access à un is_client=true
              </li>
            </ul>
          </div>
        </div>
      </Collapsible>

      {/* ═══ 3. ACCÈS PAGES PAR RÔLE ═══ */}
      <Collapsible title="3 — Accès pages & onglets par rôle" defaultOpen>
        <div className="mt-2">
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Page</th>
                  <th className="text-center px-2 py-2 font-bold text-emerald-400/60 uppercase tracking-wider text-[10px]">Mbr</th>
                  <th className="text-center px-2 py-2 font-bold text-violet-400/60 uppercase tracking-wider text-[10px]">EA</th>
                  <th className="text-center px-2 py-2 font-bold text-amber-400/60 uppercase tracking-wider text-[10px]">Admin</th>
                  <th className="text-center px-2 py-2 font-bold text-primary/60 uppercase tracking-wider text-[10px]">SA</th>
                  <th className="text-center px-2 py-2 font-bold text-pink-400/60 uppercase tracking-wider text-[10px]">Set.</th>
                  <th className="text-center px-2 py-2 font-bold text-blue-400/60 uppercase tracking-wider text-[10px]">Clo.</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Note</th>
                </tr>
              </thead>
              <tbody>
                {PAGE_ACCESS.map(p => {
                  const cell = (v: string) => {
                    if (v === "ok") return <Badge v="ok">✓</Badge>;
                    if (v === "no") return <span className="text-muted-foreground/25 text-lg leading-none">–</span>;
                    if (v === "partial") return <Badge v="partial">↗</Badge>;
                    return null;
                  };
                  return (
                    <tr key={p.page} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground/80">{p.page}</td>
                      <td className="px-2 py-2 text-center">{cell(p.member)}</td>
                      <td className="px-2 py-2 text-center">{cell(p.early_access)}</td>
                      <td className="px-2 py-2 text-center">{cell(p.admin)}</td>
                      <td className="px-2 py-2 text-center">{cell(p.super_admin)}</td>
                      <td className="px-2 py-2 text-center">{cell(p.setter)}</td>
                      <td className="px-2 py-2 text-center">{cell(p.closer)}</td>
                      <td className="px-3 py-2 text-muted-foreground/60 italic">{p.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground/60">
            <span className="flex items-center gap-1"><Badge v="ok">✓</Badge> Accès total</span>
            <span className="flex items-center gap-1"><Badge v="partial">↗</Badge> Accès partiel</span>
            <span>– Aucun accès</span>
          </div>
          <p className="text-[11px] text-muted-foreground/50 mt-2 italic">
            Source : <code>src/components/dashboard/DashboardSidebar.tsx</code> — logique <code>useSidebarRoles</code>
          </p>
          <div className="mt-3 p-3 rounded-lg border border-white/[.07] bg-white/[.02]">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Cas particuliers</p>
            <ul className="space-y-1 text-xs text-muted-foreground/70">
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-primary/50 shrink-0" />
                <strong>EA expiré :</strong> voit les pages mais est redirigé vers l'écran d'expiration. Accès produit bloqué.
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-primary/50 shrink-0" />
                <strong>Frozen/Banned :</strong> bloqué dès le login, peu importe les rôles.
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-primary/50 shrink-0" />
                <strong>Admin simulant un rôle :</strong> super_admin peut simuler n'importe quel rôle via Config.
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-primary/50 shrink-0" />
                <strong>Oracle Vérif (R1) :</strong> les trades Oracle du cycle N sont masqués jusqu'à completion du cycle N côté user.
              </li>
            </ul>
          </div>
        </div>
      </Collapsible>

      {/* ═══ 4. PROGRESSION ORACLE ═══ */}
      <Collapsible title="4 — Progression Oracle — ce qui débloque quoi" defaultOpen>
        <div className="mt-2 space-y-3">
          {ORACLE_PROGRESSION.map((step, i) => (
            <div key={i} className={cn("rounded-xl border p-4", step.color)}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border border-current">
                  {i}
                </div>
                <span className="font-bold text-sm">{step.step}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Condition d'accès", value: step.unlock_condition },
                  { label: "Action utilisateur", value: step.user_action },
                  { label: "Complétion détectée quand", value: step.completion, mono: true },
                  { label: "Validation requise", value: step.validation },
                  { label: "Ce que ça débloque", value: step.next_unlock },
                  { label: "Oracle visible (R1)", value: step.oracle_access },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="bg-white/[.03] rounded-lg p-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-current opacity-50 mb-1">{label}</p>
                    <p className={cn("text-current opacity-80 leading-snug", mono && "font-mono text-[11px]")}>{value}</p>
                  </div>
                ))}
              </div>
              {step.notes && (
                <p className="mt-3 text-xs opacity-60 italic border-t border-current/20 pt-2">{step.notes}</p>
              )}
            </div>
          ))}

          <div className="p-4 rounded-xl border border-white/[.08] bg-white/[.02]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Flux technique de validation
            </p>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {[
                { label: "User complète trades", color: "bg-blue-500/15 text-blue-400" },
                { label: "→" },
                { label: "Demande de vérif", color: "bg-blue-500/15 text-blue-400" },
                { label: "→" },
                { label: "check_accuracy() ≥ 90%", color: "bg-emerald-500/15 text-emerald-400" },
                { label: "→" },
                { label: "Auto-validé ✓", color: "bg-emerald-500/20 text-emerald-400 font-bold" },
              ].map((item, i) => (
                item.label === "→"
                  ? <ArrowRight key={i} className="w-3 h-3 text-muted-foreground/40" />
                  : <span key={i} className={cn("px-2 py-1 rounded-lg", item.color)}>{item.label}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs mt-2">
              {[
                { label: "check_accuracy() < 90%", color: "bg-orange-500/15 text-orange-400" },
                { label: "→" },
                { label: "pending_review", color: "bg-orange-500/15 text-orange-400" },
                { label: "→" },
                { label: "Admin valide/rejette", color: "bg-violet-500/15 text-violet-400" },
                { label: "→" },
                { label: "unlock_next_cycle()", color: "bg-emerald-500/15 text-emerald-400 font-mono" },
              ].map((item, i) => (
                item.label === "→"
                  ? <ArrowRight key={i} className="w-3 h-3 text-muted-foreground/40" />
                  : <span key={i} className={cn("px-2 py-1 rounded-lg", item.color)}>{item.label}</span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-2 italic">
              Source : <code>supabase/migrations/</code> — RPC <code>check_cycle_accuracy_and_auto_validate()</code> + <code>unlock_next_cycle()</code>
            </p>
          </div>
        </div>
      </Collapsible>

      {/* ═══ 5. EARLY ACCESS TIMER ═══ */}
      <Collapsible title="5 — Early Access : timer et états">
        <div className="mt-2 space-y-3">
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">État</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">expires_at</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">is_early_access()</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Ce que voit l'user</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { state: "Timer non démarré", expires: "NULL", rpc: "true", view: "Accès complet (timer n'a pas encore tourné)" },
                  { state: "Timer en cours", expires: "future", rpc: "true", view: "Accès complet + bandeau timer visible" },
                  { state: "Timer expiré", expires: "passé", rpc: "false", view: "Écran d'expiration, plus d'accès produit" },
                  { state: "EA sans timer", expires: "NULL, ea_timer_duration = NULL", rpc: "true", view: "Accès illimité (EA permanent sans countdown)" },
                ].map(r => (
                  <tr key={r.state} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground/80">{r.state}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{r.expires}</td>
                    <td className="px-3 py-2">{r.rpc === "true" ? <Badge v="ok">true</Badge> : <Badge v="no">false</Badge>}</td>
                    <td className="px-3 py-2 text-muted-foreground/70">{r.view}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-lg border border-white/[.07] bg-white/[.02]">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Types EA : precall vs postcall</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2 rounded bg-white/[.03]">
                <p className="font-bold text-violet-400 mb-1">precall</p>
                <p className="text-muted-foreground/70">Paramètres EA pris dans <code>ea_global_settings</code> (durée timer globale, features actives). Assigné avant l'appel commercial.</p>
              </div>
              <div className="p-2 rounded bg-white/[.03]">
                <p className="font-bold text-emerald-400 mb-1">postcall</p>
                <p className="text-muted-foreground/70">Paramètres EA pris dans <code>early_access_settings</code> (par user). Assigné après l'appel, paramètres personnalisés.</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-2 italic">
              Source : <code>src/hooks/useEarlyAccessSettings.ts</code>
            </p>
          </div>
        </div>
      </Collapsible>

      {/* ═══ 6. RÈGLES DE SAISIE DES TRADES ═══ */}
      <Collapsible title="6 — Règles de saisie des trades (R1–R4)">
        <div className="mt-2 space-y-2">
          {[
            {
              id: "R1", type: "hard", color: "border-red-500/20 bg-red-500/[.04]",
              title: "Accès Oracle limité au cycle précédent",
              desc: "Un user en Cycle N ne voit les trades Oracle que jusqu'au Cycle N-1. Filtrage automatique dans OracleDatabase.",
            },
            {
              id: "R2", type: "hard", color: "border-red-500/20 bg-red-500/[.04]",
              title: "Ordre chronologique strict",
              desc: "Chaque trade ≥ trade précédent. Date minimale imposée dans le formulaire et à la sauvegarde.",
            },
            {
              id: "R3", type: "hard", color: "border-red-500/20 bg-red-500/[.04]",
              title: "Continuité inter-cycles",
              desc: "1er trade du Cycle N ≥ dernier trade du Cycle N-1. Même mécanisme que R2.",
            },
            {
              id: "R4", type: "soft", color: "border-amber-500/20 bg-amber-500/[.04]",
              title: "Fenêtre temporelle Oracle (guidage doux)",
              desc: "Fenêtre recommandée = Oracle window + offset personnel. Tolérance ±30%. Warning si dépassé, pas de blocage.",
            },
          ].map(r => (
            <div key={r.id} className={cn("flex items-start gap-3 p-3 rounded-lg border", r.color)}>
              <span className={cn(
                "w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0",
                r.type === "hard" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
              )}>{r.id}</span>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-foreground">{r.title}</span>
                  <Badge v={r.type === "hard" ? "no" : "warn"}>{r.type === "hard" ? "strict" : "guidage"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground/70">{r.desc}</p>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground/50 italic mt-2">
            Source complète : <code>src/lib/oracle-cycle-windows.ts</code> — toute modification des règles passe par ce fichier.
          </p>
        </div>
      </Collapsible>

    </div>
  );
}
