# DB pggk — Schéma de référence vivant

> **Dernière mise à jour : 2026-04-29 17:30**
> **Source** : SQL Editor pggk (project ref `pggkwyhtplxyarctuoze`)
> **Statut** : ce document est LA référence frontend pour l'état de la DB prod.
>
> ⚠️ **Doit être regénéré** :
> - Après chaque migration TYPE A appliquée sur pggk
> - Au minimum 1 fois toutes les 2 semaines
> - Avant tout travail sur Slice A/D (zones critiques)
>
> Procédure de regénération : voir bas de ce fichier.

---

## Légende

| Symbole | Sens |
|---------|------|
| 🅐 🅑 🅒 🅓 🅔 🅕 | Slice (A=Identity, B=Acquisition, C=CRM, D=Cycles, E=Content, F=Analytics) |
| ⚫ | Niveau 0 — SACRÉ (données utilisateurs irremplaçables) |
| 🔴 | Niveau 1 — PROTÉGÉ (business critiques) |
| 🟡 | Niveau 2 — RÉFÉRENCE (statiques, re-seedables) |
| 🟢 | Niveau 3 — ÉPHÉMÈRE (logs, sessions) |
| 🔒 | RLS activée |
| ❌ | Pas de RLS (à corriger ?) |

---

## Tables du schéma `public` (36 tables — audit 2026-04-29)

| Table | Slice | Niveau | RLS | FK auth.users | Notes |
|-------|-------|--------|-----|---------------|-------|
| `admin_trade_notes` | 🅓 | 🔴 | 🔒 | — | Notes admin sur verifications, FK verification_requests CASCADE |
| `bonus_videos` | 🅔 | 🟡 | 🔒 | — | Vidéos bonus EA + admin |
| `custom_setups` | 🅓 | 🔴 | 🔒 | Soft FK | Setups perso users |
| `cycles` | 🅓 | 🟡 | 🔒 | — | 9 cycles Oracle (statique) |
| `ea_activity_tracking` | 🅕 | 🟢 | 🔒 | Soft FK | Heartbeat EA temps réel |
| `ea_featured_trade` | 🅔 | 🟡 | 🔒 | — | Trade du jour EA |
| `ea_global_settings` | 🅔 | 🟡 | 🔒 | — | Config UX EA |
| `ea_lead_notes` | 🅒 | 🔴 | 🔒 | — | Notes legacy leads, FK EAR CASCADE |
| `early_access_requests` | 🅑/🅒 | 🔴 | 🔒 | Soft FK (posé à approbation) | Lead principal — pivot Slice B/C |
| `early_access_settings` | 🅔 | 🟡 | 🔒 | — | Config trial EA |
| `funnel_config` | 🅑 | 🟡 | 🔒 | — | Config UX funnel |
| `funnels` | 🅑 | 🟡 | 🔒 | — | Funnels actifs |
| `lead_comments` | 🅑/🅒 | 🔴 | 🔒 | — | Notes équipe leads, FK EAR CASCADE |
| `lead_events` | 🅑/🅒 | 🔴 | 🔒 | — | Timeline append-only, FK EAR CASCADE |
| `profiles` | 🅐 | ⚫ | 🔒 | Hard FK CASCADE | Identité métier (status, is_client) |
| `quest_step_configs` | 🅕 | 🟡 | 🔒 | — | Définitions étapes quête |
| `results` | 🅔 | 🟡 | 🔒 | — | Galerie résultats Oracle |
| `security_alerts` | 🅐 | 🟢 | 🔒 | Hard FK CASCADE (probable) | Alertes sécurité |
| `trades` | 🅓 | 🟡 | 🔒 | — | 314 trades Oracle (statique) |
| `trading_sessions` | 🅔 | ⚫* | 🔒 | Hard FK CASCADE | Sessions de travail (perd avec user) |
| `user_custom_variables` | 🅔 | 🔴 | 🔒 | Soft FK | Variables persos analyse |
| `user_cycles` | 🅓 | ⚫ | 🔒 | Soft FK | Progression 9 cycles |
| `user_executions` | 🅓 | ⚫ | 🔒 | Soft FK | Trades Oracle saisis (journal) |
| `user_followups` | 🅕 | 🟢 | 🔒 | Soft FK | Suivi engagement |
| `user_login_history` | 🅕 | 🟢 | 🔒 | Hard FK CASCADE | Historique logins |
| `user_notifications` | 🅕 | 🟢 | 🔒 | Soft FK | Notifications in-app |
| `user_personal_trades` | 🅔 | ⚫ | 🔒 | Soft FK | Trades persos (backtest + live) |
| `user_quest_flags` | 🅕 | 🟢 | 🔒 | Soft FK | Flags custom |
| `user_roles` | 🅐 | ⚫ | 🔒 | Hard FK CASCADE | Rôles + expires_at |
| `user_sessions` | 🅐 | 🟢 | 🔒 | Hard FK CASCADE | Anti-partage 5 devices max |
| `user_successes` | 🅔 | 🔴 | 🔒 | Soft FK | Wins postés (mur des wins) |
| `user_trade_analyses` | 🅓 | ⚫ | 🔒 | Soft FK | Cases cochées ébauche |
| `user_variable_types` | 🅔 | 🟡 | 🔒 | — | Types de variables analyse |
| `user_video_views` | 🅔 | 🟢 | 🔒 | À vérifier | Vues vidéos |
| `verification_requests` | 🅓 | ⚫ | 🔒 | Soft FK | Demandes validation cycle |
| `videos` | 🅔 | 🟡 | 🔒 | — | Vidéos formation |

**Total : 36 tables** — toutes RLS activées.

---

## Fonctions du schéma `public` (32 fonctions au 2026-04-29)

| Fonction | Slice | Sens | Sécurité | Notes |
|----------|-------|------|----------|-------|
| `activate_ea_timer` | 🅒 | Désactivée intentionnellement | DEFINER | Remplacée par expires_at direct |
| `add_complementary_trades_from_cycle` | 🅓 | Auto-complétion trades | DEFINER | |
| `can_user_access` | 🅐 | Vérif accès générique | DEFINER | |
| `check_cycle_accuracy_and_auto_validate` | 🅓 | Auto-validation 90%+ | DEFINER | |
| `cleanup_early_access_settings` | 🅔 | Nettoyage settings EA | DEFINER | |
| `custom_access_token_hook` | 🅐 | Inject rôles dans JWT | DEFINER | ⚠️ NON ACTIVÉ (Lovable bloque Auth Hooks) |
| `disable_import_triggers` | 🅔 | Désactive triggers (import batch) | DEFINER | |
| `enable_import_triggers` | 🅔 | Réactive triggers | DEFINER | |
| `enforce_pending_status_on_create` | 🅒 | Trigger : EA créés en pending | INVOKER | |
| `enforce_role_change_by_admin` | 🅐 | Trigger : seuls admins changent rôles | INVOKER | |
| `enforce_role_delete_by_admin` | 🅐 | Trigger : seuls admins suppriment rôles | INVOKER | |
| `enforce_status_update_by_admin` | 🅐 | Trigger : seuls admins changent status | INVOKER | |
| `get_auth_emails` | 🅐/🅒 | Lookup emails auth.users | DEFINER | Ajoutée 2026-04-29 |
| `get_leaderboard_data` | 🅕 | Classement public | DEFINER | |
| `get_team_emails` | 🅐 | Liste emails équipe | DEFINER | |
| `get_user_status` | 🅐 | Status user (active/frozen…) | DEFINER | |
| `handle_new_user` | 🅐→🅓 | Trigger auth.users INSERT → init cycles | DEFINER | Bridge A→D |
| `handle_new_user_role` | 🅐 | Trigger user_roles INSERT | DEFINER | |
| `has_role(role)` | 🅐 | Check générique de rôle | DEFINER | |
| `initialize_user_cycles` | 🅓 | Crée 9 user_cycles | DEFINER | Appelé par handle_new_user |
| `initialize_user_followups` | 🅕 | Init followups au signup | DEFINER | |
| `is_admin` | 🅐 | Guard admin | DEFINER | |
| `is_closer` | 🅐 | Guard closer | DEFINER | ✅ Ajoutée 2026-04-29 (Module 1) |
| `is_early_access` | 🅐 | Vérif EA + expires_at | DEFINER | |
| `is_institute` | 🅐 | Guard institute | DEFINER | |
| `is_setter` | 🅐 | Guard setter | DEFINER | |
| `is_super_admin` | 🅐 | Guard super_admin | DEFINER | |
| `record_login` | 🅕 | Log login + update last_login_at | DEFINER | |
| `retract_verification_request` | 🅓 | Annule demande vérif (Module 3) | DEFINER | ✅ Ajoutée 2026-04-29 |
| `unlock_next_cycle` | 🅓 | Débloque cycle suivant après validation | DEFINER | |
| `update_trading_sessions_updated_at` | 🅔 | Trigger updated_at | INVOKER | |
| `update_updated_at_column` | — | Trigger générique updated_at | INVOKER | |
| `update_user_cycles_updated_at` | 🅓 | Trigger updated_at user_cycles | INVOKER | |

---

## Policies RLS critiques (post-Module 1, 2026-04-29)

### `early_access_requests` (Slice C)
- Admins peuvent tout voir/éditer
- Setters peuvent voir tous les leads + éditer Setting
- **Closers peuvent voir tous les leads + éditer Call** ← ✅ ajouté Module 1
- Super admin peut supprimer

### `user_executions` (Slice D)
- Users voient/écrivent les leurs
- Admins voient tout
- **Setters et closers : voient les exécutions des users qui ont un lead EAR** ← ✅ Module 1
- ❌ ~~"Early access can view all executions"~~ supprimée Module 1
- ❌ ~~"Setters can view all executions"~~ remplacée Module 1

### `verification_requests` (Slice D)
- Users voient les leurs
- Admins voient tout
- Index unique partiel : 1 seul `pending` par (user_id, cycle_id) — Bug #2 fixé

---

## Contraintes / Index critiques

| Contrainte | Table | Effet |
|------------|-------|-------|
| `uniq_verification_requests_pending` | verification_requests | 1 seul pending par (user_id, cycle_id) — anti double-clic |
| `early_access_requests_email_unique` (à vérifier) | early_access_requests | Pas de doublon email actif |

---

## ⚠️ Points d'alerte connus

| Sujet | Risque | Action |
|-------|--------|--------|
| `custom_access_token_hook` non activé | Spinner +200-500ms au login | Bloqué Lovable — accepter |
| `user_video_views.user_id` FK incertaine | Comportement orphan inconnu | Audit à faire |
| `security_alerts.user_id` FK probable mais pas confirmée | Cleanup user partiel | Audit à faire |

---

## Procédure de regénération de ce document

> Quand : après toute migration TYPE A, ou tous les 14 jours minimum.

### Étape 1 — Lancer ces 4 requêtes dans SQL Editor pggk

```sql
-- 1. Tables présentes
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Fonctions présentes
SELECT routine_name, security_type FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 3. Policies actives
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Tables avec RLS active
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Étape 2 — Comparer avec ce document

- Nouveau dans la DB qui n'est pas ici → l'ajouter avec slice + niveau
- Présent ici mais plus dans la DB → enquêter (drop ?), supprimer la ligne
- Compteur en haut du document : mettre à jour la date + l'horaire

### Étape 3 — Sauvegarder un snapshot horodaté

```bash
cp docs/db-audit/CURRENT_SCHEMA.md docs/db-audit/$(date +%Y-%m-%d_%H%M)_snapshot.md
```

Permet de comparer l'évolution dans le temps.

### Étape 4 — Commit

```bash
git add docs/db-audit/CURRENT_SCHEMA.md docs/db-audit/*_snapshot.md
git commit -m "docs(db-audit): refresh schema reference YYYY-MM-DD"
git push origin main
```
