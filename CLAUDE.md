# Oracle Truth Forge — Instructions Claude

## ⛔ REGLES ABSOLUES — LIRE AVANT TOUTE ACTION

### 1. Ne JAMAIS modifier `main`
- `main` est synchronise avec Lovable Cloud. Lovable deploie depuis `main`.
- Tout dev se fait sur la branche `crm-integration` (ou une feature branch).
- Pour merger dans main : PR reviewee, build OK, test OK.

### 2. Ne JAMAIS `supabase db push` sur le projet Cloud
- Le Supabase `pggkwyhtplxyarctuoze` est gere par Lovable Cloud.
- Les migrations passent par l'outil interne Lovable (pas par CLI).
- Ajouter un fichier SQL dans `supabase/migrations/` ne l'applique PAS automatiquement.
- Pour modifier le schema : tester sur un projet Supabase separe d'abord, puis appliquer via Lovable.

### 3. Ne JAMAIS ecraser un composant existant
- Tout ajout doit etre ADDITIF. On ne refactore pas les composants existants.
- Si un fichier existant doit etre modifie, seules des ADDITIONS sont permises (import, case dans switch, nav item).
- Composants intouchables : EarlyAccessCRM, AdminVerification, EarlyAccessManagement, tous les fichiers dans dashboard/admin/ sauf CRMDashboard.tsx

### 4. Toujours verifier avant de commit
```bash
npm run build  # DOIT passer sans erreur
git diff --stat  # Verifier les fichiers modifies
```

### 5. Framework "Migration" — reflexe obligatoire
Avant TOUTE modification de schema DB ou de structure de donnees, se poser systematiquement :

1. **Qu'est-ce qu'il y a deja en prod ?** — combien d'users, combien de rows impactees
2. **Que devient l'existant ?** — migration automatique ou intervention manuelle
3. **Rupture compatible ?** — peut-on deployer le code avant/apres la migration SQL sans casser l'app
4. **Rollback possible ?** — si ca casse en prod, comment revenir en arriere
5. **Data perdue ?** — on ne doit JAMAIS perdre des donnees utilisateur sans backup explicite

**Exemples concrets** :
- Ajouter une table `user_sessions` ? -> creer session "default" par user existant + rattacher ses trades existants
- Renommer un tab ? -> garder les anciennes URLs qui redirigent
- Changer un role enum ? -> migrer les rows avec l'ancienne valeur

**Toujours ecrire la migration dans le commit qui introduit le changement**, pas plus tard. Sinon c'est oublie.

---

## Architecture

### Projets
| Projet | Role | DB Supabase |
|--------|------|-------------|
| **oracle-truth-forge** (ce repo) | Plateforme trading + Admin unifie | `pggkwyhtplxyarctuoze` (Lovable Cloud) |
| **spike-launch** (`/projets/spike-launch/`) | CRM/Funnel acquisition (reference) | `lcisptkyzgzvzsdkiihj` (Supabase direct) |
| **mercureinstitut** (`/projets/mercureinstitut/`) | Archive backup | `noewzreurtigsqdlgoas` |

### Branches (ce repo)
| Branche | Role | Qui deploie |
|---------|------|-------------|
| `main` | Production Lovable | Lovable Cloud (auto-deploy sur push) |
| `lovable-stable` | Sauvegarde version Lovable | Personne (ne jamais supprimer) |
| `crm-integration` | Dev CRM + ameliorations | Nous (local dev, futur merge dans main) |

### Ports dev
- spike-launch : `localhost:3002`
- oracle-truth-forge : `localhost:3003`

---

## Lovable Cloud — Ce qui est cache (pas dans le repo)

### Secrets backend (injectes auto dans Edge Functions)
- `SUPABASE_SERVICE_ROLE_KEY` — cle admin DB
- `SUPABASE_DB_URL` — connection string directe
- `LOVABLE_API_KEY` — API interne Lovable

### SMTP
- Les emails (magic links, reset password) passent par le SMTP integre de Lovable Cloud
- C'est Supabase Auth qui envoie, pas le frontend
- Si on deploie sur Vercel avec le meme project ID Supabase, les emails continuent de marcher
- MAIS il faut ajouter le nouveau domaine dans les Redirect URLs autorisees de Supabase Auth

### Auth config (geree par Lovable)
- Auto-confirm : desactive
- Signup : active
- Magic link + password login

### Storage (4 buckets Supabase)
- `avatars` (public)
- `trade-screenshots` (prive, signed URLs)
- `success-screenshots` (prive)
- `result-screenshots` (prive)
- Les policies RLS sont dans les migrations SQL

### RPC Functions (dans les migrations SQL)
- `is_admin()`, `is_super_admin()`, `is_setter()`, `is_early_access()`
- `is_institute()`, `has_role()`, `activate_ea_timer()`
- `check_cycle_accuracy_and_auto_validate()`
- Toutes definies dans `supabase/migrations/`, pas dans un dashboard separe

### Edge Functions (deploy auto par Lovable)
- `approve-early-access` — deploye auto quand le code change dans `supabase/functions/`
- Si on ajoute une nouvelle function hors Lovable → deploy manuel via `supabase functions deploy`

### Pas de crons ni webhooks externes detectes

### Custom domain
- `oracle-truth-forge.lovable.app` → A record `185.158.133.1` (Lovable Cloud)
- Deployer sur Vercel = safe cote backend (Supabase reste le meme)
- Il faudra ajouter le domaine Vercel dans Supabase Auth Redirect URLs

---

## Safe vs Risque

| Action | Safe ? | Notes |
|--------|--------|-------|
| `npm run dev` en local | ✅ | Lit la DB Lovable en lecture |
| Modifier le frontend sur `crm-integration` | ✅ | Pas de risque |
| `npm run build` | ✅ | Verif compilation |
| Push sur `crm-integration` | ✅ | Pas de deploy auto |
| Push sur `main` | ⚠️ | Lovable auto-deploy ! Faire une PR |
| `supabase db push` depuis local | ❌ INTERDIT | Risque de corrompre la DB prod |
| `supabase functions deploy` | ⚠️ | Ecrase la function en prod. Tester avant |
| Ajouter une migration SQL dans le repo | ✅ | Pas appliquee auto (Lovable gere) |
| Deployer sur Vercel (meme Supabase) | ✅ | Config Redirect URLs |
| Creer des tables via Supabase dashboard | ⚠️ | Pas de migration, difficile a rollback |

---

## Separation CRM / Gestion

| | CRM (nouveau) | Gestion (existant) |
|---|---|---|
| **Quand** | AVANT le closing | APRES le closing |
| **Qui** | Closers, setters | CSM, admins |
| **Quoi** | Pipeline leads, metriques, calendrier | EA management, verif trades, videos, roles |
| **Tables** | early_access_requests, profiles | Memes tables + user_executions, trades, videos |
| **Ou dans l'UI** | Sidebar > CRM | Sidebar > Early Access + Verifications Admin |

Les 2 volets lisent les MEMES tables. Un lead dans le CRM EST un user dans la Gestion.

---

## Structure admin Oracle

```
Sidebar Oracle Admin
────────────────────
[User]
  Execution d'Oracle
  Setup
  Data Analysis
  Video Setup
  Chat / Resultats

[Admin + SuperAdmin]
  CRM                    ← NOUVEAU (branche crm-integration)
    ├─ Pipeline
    ├─ Calendrier (placeholder)
    └─ Metriques (placeholder)

[Admin]
  Verifications Admin    ← EXISTANT (9 sub-tabs, ne pas toucher)

[SuperAdmin]
  Early Access           ← EXISTANT (CRM EA + management, ne pas toucher)
```

---

## Flow lead complet

```
Ads → VSL → Form (join EA) → Early Access (trial) → Sales Call → Close → Client permanent

Pipeline CRM :
1. en_attente      — Form soumis, pas encore review
2. approuvee       — Admin a approuve, compte cree, magic link envoye
3. contacted       — Closer a pris contact (WhatsApp, email, call)
4. call_booked     — Call planifie (Cal.com ou manuel)
5. call_done       — Call effectue
6. closed/paid     — Paiement recu, acces permanent
```

---

## Fichiers cles

### Oracle (ce repo) — NE PAS MODIFIER sauf mention contraire
| Fichier | Role | Modifiable ? |
|---------|------|-------------|
| `src/pages/Dashboard.tsx` | Entry point, state-based tabs | ✅ Additions seulement |
| `src/components/dashboard/DashboardSidebar.tsx` | Sidebar + useSidebarRoles | ✅ Additions seulement |
| `src/components/dashboard/admin/CRMDashboard.tsx` | Volet CRM pipeline | ✅ Notre fichier |
| `src/components/dashboard/admin/EarlyAccessCRM.tsx` | CRM EA existant | ❌ Ne pas toucher |
| `src/components/dashboard/AdminVerification.tsx` | Admin tabs | ❌ Ne pas toucher |
| `src/components/dashboard/EarlyAccessManagement.tsx` | Gestion EA | ❌ Ne pas toucher |
| `supabase/functions/approve-early-access/` | Approbation EA | ❌ Ne pas toucher |
| `src/integrations/supabase/types.ts` | Schema DB auto-genere | ❌ Genere par Lovable |

### Spike-launch (reference CRM — ne pas modifier)
| Fichier | Ce qu'on peut en tirer |
|---------|----------------------|
| `src/components/admin/PipelineView.tsx` | Pattern pipeline table |
| `src/components/admin/CalendarView.tsx` | Pattern calendrier Cal.com |
| `src/components/admin/ConversionsTab.tsx` | Pattern metriques |
| `src/components/admin/CallDetailSheet.tsx` | Pattern detail call closer |
| `src/hooks/admin/useLeadOperations.ts` | Pattern operations lead |

---

## DB Oracle — Tables principales (30 tables)

### Tables CRM-relevant (deja existantes)
| Table | Champs cles | Usage CRM |
|-------|------------|-----------|
| `early_access_requests` | email, phone, first_name, status, contacted, call_booked, call_done, user_id | Source principale du pipeline |
| `profiles` | user_id, first_name, display_name, status, is_client | Identite user |
| `user_roles` | user_id, role, early_access_type, expires_at | Acces + type EA |
| `ea_activity_tracking` | user_id, is_active, active_tab, button_clicks | Activite temps reel |
| `user_sessions` | user_id, session_token, device_fingerprint | Sessions + securite |
| `ea_lead_notes` | request_id, note, created_by | Notes closer |

### Tables produit (ne pas toucher pour le CRM)
| Table | Usage |
|-------|-------|
| `trades`, `user_executions`, `user_personal_trades` | Trading data |
| `videos`, `bonus_videos`, `user_video_views` | Contenu video |
| `cycles`, `user_cycles`, `results`, `user_successes` | Cycles + resultats |
| `custom_setups`, `user_custom_variables` | Config trading |
| `quest_step_configs`, `user_quest_flags` | Gamification |
| `verification_requests`, `admin_trade_notes` | Verification admin |

---

## Known issues (localhost)

### Spinner infini sur /dashboard
- **Cause** : `useSidebarRoles` hook fait des RPC calls qui abort en dev (Vite HMR detruit/recree les channels WebSocket)
- **Fix applique** : try/catch/finally dans `checkRoles` + safety timeout 3s dans Dashboard.tsx
- **Ce probleme n'existe pas en production** (Lovable Cloud)

### Session token mismatch
- **Cause** : `oracle_session_token` en localStorage ne matche pas `user_sessions` en DB (session creee sur un autre domaine)
- **Fix** : `localStorage.removeItem("oracle_session_token")` puis reload

### AbortError: signal is aborted without reason
- **Cause** : Supabase realtime channels abort quand Vite HMR reload les modules
- **Impact** : Benin en dev, les requetes sont refaites au remount
- **Ce probleme n'existe pas en production**

---

## Workflow de developpement

### Pour ajouter une feature
```bash
git checkout crm-integration
# Coder la feature
npm run build                    # Verifier compilation
git add <fichiers specifiques>   # PAS git add -A
git commit -m "feat: description"
# Tester en local sur localhost:3003
```

### Pour deployer en production
```bash
git checkout main
git merge crm-integration       # Ou PR sur GitHub
git push origin main             # Lovable auto-deploy
```

### Pour creer une nouvelle feature branch
```bash
git checkout crm-integration
git checkout -b feature/nom-feature
# Coder
git checkout crm-integration
git merge feature/nom-feature
```

### Commandes utiles
```bash
# Dev servers
cd /projets/spike-launch && npm run dev -- --port 3002
cd /projets/oracle-truth-forge && npm run dev -- --port 3003

# Build check
npm run build

# Voir les changements
git diff --stat

# Revenir a la version Lovable
git checkout main

# Travailler sur le CRM
git checkout crm-integration
```

---

## SOP Lancement Oracle V2
Voir `spike-launch/SOP_Lancement_Oracle_V2_complete.pdf`
- 5 poles (Infra/Charles, Marketing/Clement, Proof/Quentin, Tracking/Mimi, Closing/Saram)
- Pole 0 : 11 tasks, 49 KRs
