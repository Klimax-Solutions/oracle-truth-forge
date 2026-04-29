# Audit DB Prod — 2026-04-29 16:21

> Projet : `pggkwyhtplxyarctuoze` (PROD Lovable Cloud)
> Date audit : 2026-04-29 ~16h21
> Méthode : SQL Editor pggk — requêtes sur `information_schema`

## Tables (public schema)

| Table | Présente |
|-------|---------|
| admin_trade_notes | ✅ |
| bonus_videos | ✅ |
| custom_setups | ✅ |
| cycles | ✅ |
| ea_activity_tracking | ✅ |
| ea_featured_trade | ✅ |
| ea_global_settings | ✅ |
| ea_lead_notes | ✅ |
| early_access_requests | ✅ |
| early_access_settings | ✅ |
| funnel_config | ✅ |
| funnels | ✅ |
| lead_comments | ✅ |
| lead_events | ✅ |
| profiles | ✅ |
| quest_step_configs | ✅ |
| results | ✅ |
| security_alerts | ✅ |
| trades | ✅ |
| trading_sessions | ✅ |
| user_custom_variables | ✅ |
| user_cycles | ✅ |
| user_executions | ✅ |
| user_followups | ✅ |
| user_login_history | ✅ |
| user_notifications | ✅ |
| user_personal_trades | ✅ |
| user_quest_flags | ✅ |
| user_roles | ✅ |
| user_sessions | ✅ |
| user_successes | ✅ |
| user_trade_analyses | ✅ |
| user_variable_types | ✅ |
| user_video_views | ✅ |
| verification_requests | ✅ |
| videos | ✅ |

**Total : 36 tables**

## Fonctions (routines public schema)

| Fonction | Présente | Notes |
|----------|---------|-------|
| activate_ea_timer | ✅ | Désactivée intentionnellement (remplacée par expires_at direct dans approve-early-access) |
| add_complementary_trades_from_cycle | ✅ | |
| can_user_access | ✅ | |
| check_cycle_accuracy_and_auto_validate | ✅ | |
| cleanup_early_access_settings | ✅ | |
| custom_access_token_hook | ✅ | **Activation manuelle requise dans Auth → Hooks** |
| disable_import_triggers | ✅ | |
| enable_import_triggers | ✅ | |
| enforce_pending_status_on_create | ✅ | |
| enforce_role_change_by_admin | ✅ | |
| enforce_role_delete_by_admin | ✅ | |
| enforce_status_update_by_admin | ✅ | |
| get_auth_emails | ✅ | Ajoutée 2026-04-29 (migration #25) |
| get_leaderboard_data | ✅ | |
| get_team_emails | ✅ | |
| get_user_status | ✅ | |
| handle_new_user | ✅ | |
| handle_new_user_role | ✅ | |
| has_role | ✅ | |
| initialize_user_cycles | ✅ | |
| initialize_user_followups | ✅ | |
| is_admin | ✅ | |
| is_early_access | ✅ | |
| is_institute | ✅ | |
| is_setter | ✅ | |
| is_super_admin | ✅ | |
| record_login | ✅ | |
| unlock_next_cycle | ✅ | |
| update_trading_sessions_updated_at | ✅ | |
| update_updated_at_column | ✅ | |
| update_user_cycles_updated_at | ✅ | |
| **is_closer** | ❌ **MANQUANTE** | Enum `closer` existe probablement, mais la fonction RPC n'a pas été créée |

**Total : 31 fonctions présentes, 1 manquante (`is_closer`)**

## Constat clé

Toutes les migrations descriptives (20260410→20260429) sont **appliquées en prod**.
Le migration-tracker précédent indiquait ❌ pour #1-12, c'était une erreur de suivi —
Lovable auto-déploie automatiquement toutes les migrations lors d'un push sur `main`.

## Prochains audits

Pour comparer l'évolution dans le temps :
```sql
-- Tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Fonctions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Colonnes d'une table spécifique
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'early_access_requests'
ORDER BY ordinal_position;

-- Index
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```
