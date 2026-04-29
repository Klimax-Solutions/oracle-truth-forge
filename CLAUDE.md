# Oracle Truth Forge — Instructions Claude

> **Mis à jour : 2026-04-29**
> ⚠️ Lire d'abord le **[master CLAUDE.md](../CLAUDE.md)** à la racine `/projets/oracle/` — il prime sur ce fichier.
> Ce fichier contient uniquement les règles **spécifiques** à oracle-truth-forge.

---

## ⛔ RÈGLES ABSOLUES — PRIORITÉ MAXIMALE

### 1. Stratégie de branches — CRITIQUE

| Dossier local | Branche active | Push prod |
|--------------|---------------|-----------|
| `/projets/oracle/truth-forge/` | **`main`** | `git push origin main` |
| `/projets/oracle/funnel-clean/` | `funnel-clean` | `git push origin HEAD:main` |

> **⚠️ IMPORTANT — changement de stratégie (2026-04-28)**
> La branche `crm-integration` est **ABANDONNÉE** — 271 commits de retard sur `origin/main`, impossiblee à merger sans régressions.
> **Tous les changements oracle-truth-forge se font désormais directement sur `main`.**
> Réflexe obligatoire avant tout push : `git branch --show-current` → doit afficher `main`.

```bash
# Workflow oracle-truth-forge (branche main)
git branch --show-current     # DOIT afficher "main"
# Coder la feature
npm run build                 # DOIT passer sans erreur
git add <fichiers specifiques>
git commit -m "feat: description"
git push origin main          # Lovable auto-deploy immédiat
```

### 2. Ne JAMAIS `supabase db push` sur le projet Cloud
- Le Supabase `pggkwyhtplxyarctuoze` est géré par Lovable Cloud.
- Les migrations passent par l'outil interne Lovable (pas par CLI).
- Ajouter un fichier SQL dans `supabase/migrations/` ne l'applique PAS automatiquement.
- Pour modifier le schéma : tester sur Supabase séparé (mkog), puis appliquer via Lovable.

### 3. Ne JAMAIS écraser un composant existant
- Tout ajout doit être ADDITIF.
- Composants intouchables : `EarlyAccessCRM`, `AdminVerification`, `EarlyAccessManagement`, tous les fichiers dans `dashboard/admin/` **sauf** `CRMDashboard.tsx`

### 4. Toujours vérifier avant de commit
```bash
npm run build   # DOIT passer sans erreur
git diff --stat # Vérifier les fichiers modifiés
```

### 5. Framework "Migration" — réflexe obligatoire
Avant TOUTE modification de schéma DB :
1. Qu'est-ce qu'il y a déjà en prod ? (nb users, nb rows impactées)
2. Que devient l'existant ? (migration automatique ou manuelle)
3. Rupture compatible ? (peut-on déployer avant/après la migration SQL sans casser l'app)
4. Rollback possible ?
5. Data perdue ? (jamais sans backup explicite)

---

## Environnements de déploiement

| Environnement | URL | Branch | DB Supabase | Qui gère |
|--------------|-----|--------|-------------|---------|
| **PROD** | `oracle-truth-forge.lovable.app` | `main` | `pggkwyhtplxyarctuoze` | Lovable Cloud (auto-deploy) |
| **TEST / Staging** | `oracle-truth-forge.vercel.app` | anciennement `crm-integration` | `mkogljvoqqcnqrgcnfau` (mkog) | Nous (deploy manuel `vercel --prod`) |

**Règle** : Vercel = test interne (setters/closers). Lovable = vraie prod (leads réels).
Ne jamais pointer Vercel vers la DB prod (`pggkwyhtplxyarctuoze`).

---

## Architecture

### Projets
| Projet | Rôle | DB Supabase |
|--------|------|-------------|
| **oracle-truth-forge** (ce repo) | Plateforme trading + Admin unifié | `pggkwyhtplxyarctuoze` (Lovable Cloud) |
| **oracle-funnel-clean** (`/projets/oracle/funnel-clean/`) | Funnel acquisition (Landing/Apply/Discovery/Final) | même DB |
| **spike-launch** (`/projets/spike-launch/`) | CRM/Funnel référence (ne pas modifier) | `lcisptkyzgzvzsdkiihj` |

### Branches
| Branche | Rôle | Statut |
|---------|------|--------|
| `main` | Production Lovable — **branche de travail active** | ✅ Active |
| `lovable-stable` | Sauvegarde version Lovable | ⚠️ Ne jamais supprimer |
| `crm-integration` | **ABANDONNÉE** — 271 commits de retard | ❌ Ne plus utiliser |
| `funnel-clean` | Dev funnel (depuis oracle-funnel-clean) | ✅ Active (autre repo) |

### Ports dev
- oracle-truth-forge : `localhost:3003`
- spike-launch : `localhost:3002`

---

## État du projet — Log des features déployées

### ✅ DÉPLOYÉ EN PROD (pggk / Lovable Cloud)

| Date | Feature | Commit | Repo |
|------|---------|--------|------|
| 2026-04-28 | **Notification Slack nouveaux leads** — edge function `notify-funnel-lead`, appelée depuis `funnelLeadQueue.ts` path direct + `submit-funnel-lead` fallback. En attente config `SLACK_WEBHOOK_URL`. | `60fc72f` | oracle-funnel-clean |
| 2026-04-28 | **Badge 📵 "No tel"** — leads sans numéro de téléphone (rouge dans pipeline) | `8285432` | oracle-truth-forge |
| 2026-04-28 | **Setter quick-assign inline** — select natif dans chaque card pipeline, chargé depuis `user_roles` + `profiles`, visible admin/setter uniquement | `8285432` | oracle-truth-forge |
| 2026-04-28 | **staffSetters dynamiques** — chargé depuis `user_roles WHERE role='setter'` + `profiles.display_name/first_name`, merge avec setters déjà sur les leads | `8285432` | oracle-truth-forge |
| 2026-04-26 | CRM Pipeline complet (Pipeline, Agenda, Métriques, Cockpit, Conversions, Leads sans form) | — | oracle-truth-forge |
| 2026-04-26 | Badge "Pré-relance" (leads antérieurs au 26/04 21h30) | — | oracle-truth-forge |
| 2026-04-26 | Point 5 — lead approuvé → stage "Approuvés" dans pipeline (déjà fonctionnel via `approve-early-access`) | — | oracle-truth-forge |

### ⏳ À FAIRE — Priorité

| # | Feature | Statut | Notes |
|---|---------|--------|-------|
| 🔴 | **`SLACK_WEBHOOK_URL`** dans Supabase pggk | **Bloquant** | Settings → Secrets → SLACK_WEBHOOK_URL |
| 🔴 | **12 migrations SQL** sur PROD (pggk) | **Bloquant** | Voir master CLAUDE.md §9 |
| 🟡 | Badge 📵 dans le **detail panel** du lead (champ "Numéro absent") | Nice-to-have | Déjà fait sur crm-integration (stale), à re-appliquer sur main |
| 🟡 | **Agenda tab** — Cal.com webhook sync (CASSÉ — P0 sales pipeline) | Important | Voir `oracle_sales_pipeline_audit.md` |
| 🟡 | **Stripe** — paiement (ABSENT) | Important | Décision : manuel pour l'instant |
| 🟢 | Leads sans form dans pipeline — badge + filtre | Fait | |
| 🟢 | Timeline events CRM (funnel_resubmitted, fallback_recovered) | Fait | |

### 🔒 Migrations SQL — État

| Migration | TEST (mkog) | PROD (pggk) | Notes |
|-----------|------------|------------|-------|
| `notify-funnel-lead` edge fn | ✅ | ❌ **À déployer** | Manuel uniquement |
| Autres migrations | Voir `oracle_pending_migrations.md` | — | |

---

## Objectif du projet

**Oracle V2** — Plateforme trading + funnel d'acquisition + CRM interne.

```
Flow complet :
Ads → VSL → Form (join EA) → Early Access 7j trial → Sales Call → Close → Client permanent

Pipeline CRM :
1. en_attente   — Form soumis, pas encore review
2. approuvee    — Admin approuve, compte créé, magic link envoyé
3. contacted    — Closer a pris contact
4. call_booked  — Call planifié (Cal.com ou manuel)
5. call_done    — Call effectué
6. closed_won   — Paiement reçu, accès permanent

Rôles équipe interne :
- super_admin : tout
- admin : CRM + Gestion + Config
- setter : CRM pipeline (pas closing)
- closer : closing (activer membre payant)
```

---

## Séparation CRM / Gestion / Config — Règle architecturale (dans le marbre)

- **CRM** = personnes qui n'ont PAS encore payé (leads, EA trial, no-shows, perdus)
- **Gestion** = UNIQUEMENT clients ayant payé (`is_client = true`)
- **Config → Rôles** = UNIQUEMENT l'équipe interne (admin, setter, super_admin) — 3-5 personnes

**L'EA n'est PAS un statut produit. C'est un outil de vente.**
Le trial 7j reste dans le CRM. Il n'apparaît PAS dans Gestion.

Ce qui ne doit PAS se produire :
- Afficher un EA dans Gestion → Users : NON
- Gérer un client payé depuis le pipeline CRM : NON
- Assigner des rôles staff depuis Gestion : NON

---

## Fichiers clés

### Oracle (ce repo)
| Fichier | Rôle | Modifiable ? |
|---------|------|-------------|
| `src/pages/Dashboard.tsx` | Entry point, state-based tabs | ✅ Additions seulement |
| `src/components/dashboard/DashboardSidebar.tsx` | Sidebar + useSidebarRoles | ✅ Additions seulement |
| `src/components/dashboard/admin/CRMDashboard.tsx` | CRM pipeline principal | ✅ Notre fichier |
| `src/components/dashboard/admin/EarlyAccessCRM.tsx` | CRM EA existant | ❌ Ne pas toucher |
| `src/components/dashboard/AdminVerification.tsx` | Admin tabs | ❌ Ne pas toucher |
| `src/components/dashboard/EarlyAccessManagement.tsx` | Gestion EA | ❌ Ne pas toucher |
| `supabase/functions/approve-early-access/` | Approbation EA | ❌ Ne pas toucher |
| `src/integrations/supabase/types.ts` | Schéma DB auto-généré | ❌ Généré par Lovable |
| `supabase/functions/notify-funnel-lead/index.ts` | Notification Telegram | ✅ Notre fichier |

### DB Oracle — Tables CRM-relevant
| Table | Champs clés | Usage CRM |
|-------|------------|-----------|
| `early_access_requests` | email, phone, first_name, status, contacted, call_booked, call_done, user_id, setter_name | Source principale du pipeline |
| `profiles` | user_id, first_name, display_name, status, is_client | Identité user |
| `user_roles` | user_id, role, early_access_type, expires_at | Accès + type EA |
| `ea_activity_tracking` | user_id, is_active, active_tab, button_clicks | Activité temps réel |
| `user_sessions` | user_id, session_token, device_fingerprint | Sessions + sécurité |
| `ea_lead_notes` | request_id, note, created_by | Notes closer |
| `lead_events` | request_id, event_type, source, metadata | Timeline événements lead |

---

## Lovable Cloud — Ce qui est caché (pas dans le repo)

### Secrets backend
- `SUPABASE_SERVICE_ROLE_KEY` — clé admin DB
- `SUPABASE_DB_URL` — connection string directe
- `SLACK_WEBHOOK_URL` — ⚠️ à configurer pour activer les notifs leads (remplace Telegram)

### Edge Functions
- `approve-early-access` — deploy auto Lovable
- `notify-funnel-lead` — **deploy manuel requis** : `supabase functions deploy notify-funnel-lead --project-ref pggkwyhtplxyarctuoze`
- `subscribe-to-kit` — séquence email Kit
- `submit-funnel-lead` — fallback lead capture (service_role)

---

## Known issues (localhost)

### Spinner infini sur /dashboard
- **Cause** : `useSidebarRoles` fait des RPC calls qui abort en dev (Vite HMR)
- **Fix appliqué** : try/catch/finally dans `checkRoles` + safety timeout 3s dans Dashboard.tsx
- **Ce problème n'existe pas en production**

### Session token mismatch
- **Fix** : `localStorage.removeItem("oracle_session_token")` puis reload

---

## Commandes utiles

```bash
# Dev
cd /projets/oracle/truth-forge && npm run dev -- --port 3003
cd /projets/oracle/funnel-clean && npm run dev -- --port 3003

# Build check (OBLIGATOIRE avant commit)
npm run build

# Vérifier la branche (OBLIGATOIRE avant push)
git branch --show-current   # doit afficher "main"

# Deploy edge function notify-funnel-lead (action manuelle requise)
supabase functions deploy notify-funnel-lead --project-ref pggkwyhtplxyarctuoze

# Voir diff avant commit
git diff --stat
git log --oneline -10
```

---

## Export des données membre — Règles d'implémentation (dans le marbre)

> Fichier concerné : `src/components/dashboard/UserDataEntry.tsx` → fonction `handleExport`

### Format : ZIP (pas CSV seul)

Le bouton "Export" génère un fichier `.zip` contenant :
```
oracle_trades_YYYY-MM-DD.zip
├── trades.csv              ← toutes les données tabulaires
└── screenshots/
    ├── trade_001_contexte.jpg
    ├── trade_001_entree.png
    ├── trade_002_contexte.jpg
    └── ...
```

**Jamais un CSV seul** — un CSV sans images est inutilisable pour l'analyse.

### Formats d'image supportés

| Extension | Inclus dans ZIP |
|-----------|----------------|
| `.png`    | ✅ |
| `.jpg` / `.jpeg` | ✅ |
| `.webp`   | ✅ |
| `.gif`    | ✅ |
| Autre     | ✅ (inclus, renommé `.jpg` en fallback) |

### Comportement selon le mode de stockage

| Mode screenshot | Comportement dans l'export |
|----------------|---------------------------|
| **Fichier uploadé** (Supabase Storage) | Téléchargé via signed URL (1h) et ajouté dans `screenshots/` |
| **Lien externe** (URL TradingView, etc.) | Impossible à télécharger (CORS navigateur) → URL référencée dans `trades.csv` uniquement |

### Architecture technique

- **JSZip** chargé en import dynamique (lazy) → pas dans le bundle principal
- **`Promise.all`** pour télécharger tous les screenshots en parallèle
- **Signed URLs Supabase** : `supabase.storage.from("trade-screenshots").createSignedUrl(path, 3600)`
- Les erreurs de download sont loguées en `console.error("[Export] ...")` mais ne bloquent pas l'export (les autres images continuent)
- Le **toast** indique le nombre de screenshots réellement inclus dans le ZIP

### Toast de confirmation

- Succès avec images : `"X trades exportés avec Y screenshots."`
- Succès sans images (liens externes) : `"X trades exportés (screenshots en mode lien — non téléchargeables)."`

### Limitation connue à surveiller

`Promise.all` lance tous les téléchargements en parallèle. Jusqu'à ~150 trades (300 images), c'est parfaitement stable. Au-delà, si des lenteurs apparaissent, passer à des batches de 20 (`Promise.all` par tranches de 20 avec une boucle).

---

## SOP Lancement Oracle V2
Voir `spike-launch/SOP_Lancement_Oracle_V2_complete.pdf`
- 5 pôles (Infra/Charles, Marketing/Clément, Proof/Quentin, Tracking/Mimi, Closing/Saram)
- Pôle 0 : 11 tasks, 49 KRs
