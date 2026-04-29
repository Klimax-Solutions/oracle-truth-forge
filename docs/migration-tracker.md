# Migration Tracker

Suivi des migrations appliquées sur chaque environnement.
Fichiers source : `supabase/migrations/`

## Environnements

| Env | Project ref | URL | Méthode d'application |
|-----|-------------|-----|----------------------|
| **Test** | `mkogljvoqqcnqrgcnfau` | mkogljvoqqcnqrgcnfau.supabase.co | SQL Editor manuellement |
| **Prod** (Lovable Cloud) | `pggkwyhtplxyarctuoze` | pggkwyhtplxyarctuoze.supabase.co | SQL Editor manuellement (JAMAIS db push) |

## État des migrations

| # | Fichier | Description | Test | Prod |
|---|---------|-------------|------|------|
| 1 | `20260410180000_add_funnels_and_funnel_config.sql` | Tables funnels + funnel_config + seed | ✅ | ❌ |
| 2 | `20260411000000_add_crm_fields.sql` | 8 colonnes CRM (setter, outcome, paid...) | ✅ | ❌ |
| 3 | `20260411100000_add_call_scheduling_fields.sql` | 5 colonnes call scheduling | ✅ | ❌ |
| 4 | `20260412000000_add_booking_event_id.sql` | booking_event_id pour Cal.com | ✅ | ❌ |
| 5 | `20260412100000_fix_is_early_access_check_expiry.sql` | Fix is_early_access() expires_at | ✅ | ❌ |
| 6 | `20260412110000_add_precall_question.sql` | precall_question | ✅ | ❌ |
| 7 | `20260412120000_add_timeline_dates.sql` | contacted_at, call_done_at | ✅ | ❌ |
| 8 | `20260412130000_add_lead_events_and_comments.sql` | Tables lead_events + lead_comments | ✅ | ❌ |
| 9 | `20260413000000_add_apply_subtitle.sql` | apply_subtitle sur funnel_config | ✅ | ❌ |
| 10 | `20260414000000_add_vsl_cta_delay.sql` | vsl_cta_delay_seconds | ✅ | ❌ |
| 11 | `20260414100000_add_form_answers.sql` | form_answers jsonb | ✅ | ❌ |
| — | Seed test env | 5 vidéos + 8 leads réalistes | ✅ | N/A |
| 12 | `20260414200000_add_setting_spec_fields.sql` | 20 colonnes spec CRM | ✅ | ❌ |
| 13 | `20260429100000_fix_verification_unique_and_email_rpc.sql` | Index unique partiel `verification_requests` (WHERE status='pending') + RPC `get_auth_emails` | ❌ **À appliquer** | ❌ **À appliquer** |

## Procédure pour appliquer une migration

1. Ouvrir le SQL Editor du bon projet Supabase
2. Coller le contenu du fichier SQL
3. Exécuter
4. Si "Success" → mettre à jour ce fichier (❌ → ✅)
5. Commit ce fichier

## Procédure pour migrer en prod

1. Vérifier que TOUTES les migrations sont ✅ sur Test
2. Tester le CRM complet sur l'env test
3. Appliquer les migrations **dans l'ordre** sur Prod (SQL Editor)
4. Cocher ✅ dans la colonne Prod
5. Merger `crm-integration` → `main`
6. Push `main` → Lovable auto-deploy

## Règles

- **JAMAIS** `supabase db push` sur Prod (Lovable Cloud gère le schema)
- Toutes les migrations sont **IF NOT EXISTS** / **CREATE OR REPLACE** → safe à rejouer
- Pas de **DROP** dans aucune migration → pas de perte de données
- Appliquer **dans l'ordre chronologique** (le timestamp du fichier = l'ordre)
- Le seed data (migration 0411) ne doit PAS être appliqué sur Prod
