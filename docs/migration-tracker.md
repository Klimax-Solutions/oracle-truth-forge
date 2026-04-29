# Migration Tracker

Suivi des migrations appliquées sur chaque environnement.
Fichiers source : `supabase/migrations/`

> **⚠️ Règle clé** : Lovable auto-déploie **toutes** les migrations dans `supabase/migrations/` à chaque push sur `main`.
> Les UUID-named (générés par Lovable) ET les descriptives (créées manuellement) sont déployées automatiquement.
> Ce tracker couvre uniquement les migrations **descriptives** (les UUID sont gérées par Lovable sans intervention).

## Environnements

| Env | Project ref | URL | Méthode d'application |
|-----|-------------|-----|----------------------|
| **Test** | `mkogljvoqqcnqrgcnfau` | mkogljvoqqcnqrgcnfau.supabase.co | SQL Editor manuellement (obsolète, peu utilisé) |
| **Prod** (Lovable Cloud) | `pggkwyhtplxyarctuoze` | pggkwyhtplxyarctuoze.supabase.co | **Auto-deploy via Lovable à chaque push `main`** |

## État des migrations — AUDITÉ 2026-04-29

> Audit prod réalisé le **2026-04-29 16:21** via SQL Editor pggk.
> Source : `docs/db-audit/2026-04-29_prod_state.md`

| # | Fichier | Description | Prod (pggk) | Notes |
|---|---------|-------------|------------|-------|
| 1 | `20260410180000_add_funnels_and_funnel_config.sql` | Tables funnels + funnel_config + seed | ✅ | Tables `funnels`, `funnel_config` présentes |
| 2 | `20260411000000_add_crm_fields.sql` | 8 colonnes CRM (setter, outcome, paid...) | ✅ | Colonnes présentes, app fonctionnelle |
| 3 | `20260411100000_add_call_scheduling_fields.sql` | 5 colonnes call scheduling | ✅ | |
| 4 | `20260412000000_add_booking_event_id.sql` | booking_event_id pour Cal.com | ✅ | |
| 5 | `20260412100000_fix_is_early_access_check_expiry.sql` | Fix is_early_access() expires_at | ✅ | `is_early_access()` présente |
| 6 | `20260412110000_add_precall_question.sql` | precall_question | ✅ | |
| 7 | `20260412120000_add_timeline_dates.sql` | contacted_at, call_done_at | ✅ | Même colonnes ajoutées de façon idempotente par #16 et #17 |
| 8 | `20260412130000_add_lead_events_and_comments.sql` | Tables lead_events + lead_comments | ✅ | Tables `lead_events`, `lead_comments` présentes |
| 9 | `20260413000000_add_apply_subtitle.sql` | apply_subtitle sur funnel_config | ✅ | |
| 10 | `20260414000000_add_vsl_cta_delay.sql` | vsl_cta_delay_seconds | ✅ | |
| 11 | `20260414100000_add_form_answers.sql` | form_answers jsonb | ✅ | |
| 12 | `20260414200000_add_setting_spec_fields.sql` | 20 colonnes spec CRM (budget, priorité, checklist...) | ✅ | |
| 13 | `20260422000000_add_trading_sessions.sql` | Table `trading_sessions` | ✅ | Table présente, `update_trading_sessions_updated_at` function présente |
| 14 | `20260422100000_add_closer_role.sql` | Enum `closer` + `is_closer()` RPC | ⚠️ **PARTIEL** | Enum probablement appliqué. **`is_closer()` MANQUANTE** en prod — voir note |
| 15 | `20260423000000_add_contacted_at.sql` | contacted_at sur early_access_requests | ✅ | Idempotent avec #7 (IF NOT EXISTS) |
| 16 | `20260423100000_add_call_done_at.sql` | call_done_at sur early_access_requests | ✅ | Idempotent avec #7 (IF NOT EXISTS) |
| 17 | `20260423200000_backfill_ea_expires_at.sql` | Backfill expires_at EA → created_at + 7j | ✅ | Data-only, pas de schéma |
| 18 | `20260425100000_add_imported_from_prod_flag.sql` | imported_from_prod sur profiles | ✅ | Colonnes présentes (auto-deploy Lovable) |
| 19 | `20260425110000_ensure_institute_role_in_enum.sql` | Enum `institute` dans app_role | ✅ | `is_institute()` présente |
| 20 | `20260425120000_add_import_trigger_rpcs.sql` | RPCs disable/enable import triggers | ✅ | `disable_import_triggers`, `enable_import_triggers` présentes |
| 21 | `20260426100000_add_archive_lead.sql` | archived_at, archived_by, archive_reason sur early_access_requests | ✅ | Auto-deploy Lovable |
| 22 | `20260426120000_ensure_funnel_anon_insert.sql` | RLS policy insert anon funnel | ✅ | Funnel soumissions fonctionnelles |
| 23 | `20260426140000_custom_access_token_hook.sql` | JWT hook — rôles dans les claims | ✅ | `custom_access_token_hook` function présente. **⚠️ Activation manuelle requise dans Auth → Hooks** |
| 24 | `20260427120000_last_login_tracking.sql` | last_login_at + user_login_history | ✅ | Table `user_login_history` + function `record_login` présentes |
| 25 | `20260429100000_fix_verification_unique_and_email_rpc.sql` | Index unique partiel verification_requests + RPC get_auth_emails | ✅ **Appliqué manuellement 2026-04-29** | `get_auth_emails` présente. Audit pré-migration : 0 doublons pending |
| 26 | `20260429200000_fix_user_logic_rls_and_closer.sql` | `is_closer()` + policies closers sur early_access_requests + fix policies user_executions | ✅ **Appliqué manuellement 2026-04-29 17:11** | Lovable n'avait pas auto-déployé (~20min après push). CSV vérifié : "Setters and closers can view crm lead executions" présente, orphelines supprimées. |

## ✅ is_closer() — CORRIGÉ (2026-04-29)

`is_closer()` est maintenant présente en prod (migration #26 appliquée manuellement).
Les policies RLS closers sur `early_access_requests` sont actives.

## ⚠️ custom_access_token_hook — activation BLOQUÉE (Lovable ownership)

La fonction `custom_access_token_hook` est déployée en prod **mais ne peut pas être activée** depuis le dashboard Supabase — Lovable Cloud détient les droits admin sur le projet `pggkwyhtplxyarctuoze`.

**Options :**
1. **Lovable support** — demander à l'équipe Lovable d'activer Auth → Hooks → Custom Access Token
2. **Supabase Management API** — si un PAT est disponible : `PATCH /v1/projects/pggkwyhtplxyarctuoze/config/auth` avec `hook_custom_access_token_enabled: true`
3. **Accepter le fallback RPC** — `useSidebarRoles` a déjà un fallback 3 couches (JWT → cache localStorage → RPCs individuels). Le produit fonctionne, juste légèrement plus lent sur le chargement des rôles.

**Impact sans hook** : spinner potentiel de ~1-2s sur le dashboard au premier chargement (couvert par le safety timeout 3s déjà en place). Pas bloquant pour le launch.
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'closer'
  )
$$;
```
> **OBSOLÈTE** — is_closer() est maintenant présente (migration #26, 2026-04-29).

## Procédure pour créer et appliquer une migration

1. Créer le fichier SQL dans `supabase/migrations/` avec format `YYYYMMDDHHMMSS_description.sql`
2. La migration sera **auto-déployée par Lovable** au prochain `git push origin main`
3. Pour les migrations urgentes (ex: fix prod critique) → appliquer manuellement via SQL Editor pggk
4. Toujours utiliser `IF NOT EXISTS` / `CREATE OR REPLACE` pour l'idempotence
5. Mettre à jour ce fichier avec la date et le statut

## Règles

- **JAMAIS** `supabase db push` sur Prod (Lovable Cloud gère le schema via auto-deploy)
- **Auto-deploy Lovable** : toutes les migrations dans `supabase/migrations/` sont déployées automatiquement sur push `main`
- Toutes les migrations sont **IF NOT EXISTS** / **CREATE OR REPLACE** → safe à rejouer
- Pas de **DROP** dans aucune migration → pas de perte de données
- Appliquer **dans l'ordre chronologique** (le timestamp du fichier = l'ordre)
- Le seed data (tables de test, données fictives) **ne doit PAS** être dans les migrations prod
