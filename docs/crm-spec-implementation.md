# Oracle CRM — Implémentation Spec Dev

Référence : `Spec_Dev_Oracle_CRM.pdf` (Avril 2026)

---

## 1. Modèle de données

### Table principale : `early_access_requests`

Tous les champs CRM vivent dans cette table. Pas de table séparée pour les leads.

#### Champs identité (existaient avant la spec)
| Champ | Type | Source | Description |
|-------|------|--------|-------------|
| `id` | uuid | auto | PK |
| `first_name` | text | Form | Prénom |
| `email` | text | Form | Email (unique constraint) |
| `phone` | text | Form | Téléphone avec indicatif pays |
| `status` | text | Admin | 'en_attente' ou 'approuvée' |
| `created_at` | timestamptz | auto | Date de soumission du form |
| `reviewed_at` | timestamptz | Admin | Date d'approbation EA |
| `user_id` | uuid | Système | Lien vers auth.users (set à l'approbation) |

#### Champs pipeline (existaient avant la spec)
| Champ | Type | Source | Description |
|-------|------|--------|-------------|
| `contacted` | boolean | Setter | Lead contacté (WhatsApp ou Email) |
| `contact_method` | text | Setter | 'whatsapp' ou 'email' |
| `form_submitted` | boolean | Form | Le form a été soumis |
| `call_booked` | boolean | Webhook Cal.com | Call réservé |
| `call_done` | boolean | Admin/Closer | Call effectué |
| `setter_name` | text | Admin | Nom du setter assigné |
| `closer_name` | text | Admin | Nom du closer assigné |
| `call_scheduled_at` | timestamptz | Webhook Cal.com | Date/heure du call |
| `call_outcome` | text | Closer | 'contracted', 'closing_in_progress', 'not_closed' |
| `call_debrief` | text | Closer | Notes du closer après le call |
| `offer_amount` | text | Form | Tranche d'investissement (texte brut du form) |
| `paid_amount` | numeric | Admin | Montant payé |
| `paid_at` | timestamptz | Admin | Date de paiement |

#### Champs spec CRM — Form-derived (migration `20260414200000`)
| Champ | Type | Source | Description |
|-------|------|--------|-------------|
| `form_answers` | jsonb | Form | Toutes les réponses au form, clé = question id |
| `budget_amount` | integer | Form (calculé) | Budget en EUR, extrait de `investment_amount` |
| `priorite` | text | Form (calculé) | P1/P2/P3, calculé depuis `budget_amount` |
| `importance_trading` | integer | Form (calculé) | 1-10, extrait de `time_commitment` |
| `difficulte_principale` | text | Form | Réponse à `main_difficulty` |

#### Champs spec CRM — Checklist 6 étapes (migration `20260414200000`)
| Champ | Type | Source | Description |
|-------|------|--------|-------------|
| `videos_en_cours` | boolean | Auto-calculé | `user_video_views` COUNT > 0 |
| `videos_terminees` | boolean | Auto-calculé | `user_video_views` COUNT >= 5 |
| `recolte_demarree` | boolean | Auto-calculé | `user_executions` COUNT > 0 |
| `recolte_terminee` | boolean | Auto-calculé | `user_executions` COUNT >= 10 |
| `trade_execute` | boolean | Auto-calculé | `user_executions` COUNT > 0 |
| `quick_win` | boolean | Auto-calculé | À définir (trade avec RR > 0 ?) |

**Note** : ces booleans existent en DB mais sont **recalculés à chaque fetch** dans `mapRowToCRMLead()` depuis les données d'enrichissement. La valeur DB sert de fallback si l'enrichissement n'est pas disponible (lead sans `user_id`).

#### Champs spec CRM — Setting daily (migration `20260414200000`)
| Champ | Type | Source | Description |
|-------|------|--------|-------------|
| `contacte_aujourdhui` | boolean | Setter | Reset à false chaque jour à minuit |
| `derniere_interaction` | timestamptz | Setter | Date de la dernière interaction setter-lead |
| `brief_closer` | text | Setter | Résumé pour le closer avant le call |
| `date_activation_trial` | timestamptz | Système | Date de début du trial (= `reviewed_at` par défaut) |

#### Champs spec CRM — Post-call / Post-trial (migration `20260414200000`)
| Champ | Type | Source | Description |
|-------|------|--------|-------------|
| `raison_perdu` | text | Closer | Budget / Timing / Pas convaincu / Ghost |
| `statut_trial` | text | Auto | 'actif' ou 'expire' |
| `raison_non_closing` | text | Setter/Closer | Raison si trial expiré sans closing |
| `rappel_date` | timestamptz | Setter/Closer | Date de relance programmée |
| `rappel_note` | text | Setter/Closer | Note pour la relance |

---

## 2. Extraction des données du form

### Flow : Form submit → DB

Fichier : `src/pages/funnel/FunnelApply.tsx` → `handleSubmit()`

```
Lead remplit le form (8 questions à choix multiples + coordonnées)
  ↓
handleSubmit() extrait :
  ↓
  form_answers = { main_objective: "...", time_commitment: "...", ... }  // jsonb complet
  ↓
  investment_amount = "3 000 € - 5 000 €"
    → budget_amount = 3000  (parse le premier nombre)
    → offer_amount = "3 000 € - 5 000 €"  (texte brut)
    → priorite = "P2"  (calculé)
  ↓
  time_commitment = "7-9"
    → importance_trading = 7  (parse le premier nombre)
  ↓
  main_difficulty = "Gestion du risque (Risk Management)"
    → difficulte_principale = "Gestion du risque (Risk Management)"
  ↓
  INSERT into early_access_requests (ou UPDATE si email dupliqué)
```

### Règle de priorité (spec section 1)

```
if budget_amount >= 5000 → priorite = 'P1'
if budget_amount >= 3000 → priorite = 'P2'
if budget_amount >= 1000 → priorite = 'P3'
sinon → null (disqualifié par le form avant d'arriver ici)
```

### Questions du form et leur mapping

| Question ID | Question | Champ DB | Transformation |
|---|---|---|---|
| `main_objective` | Objectif principal | `form_answers.main_objective` | Aucune |
| `time_commitment` | Prêt à consacrer du temps (1-10) | `importance_trading` | Parse premier chiffre |
| `experience_level` | Niveau d'expérience | `form_answers.experience_level` | Aucune |
| `is_profitable` | Actuellement rentable ? | `form_answers.is_profitable` | Aucune |
| `main_difficulty` | Plus grande difficulté | `difficulte_principale` | Direct |
| `ultimate_goal` | But ultime | `form_answers.ultimate_goal` | Aucune |
| `work_status` | Situation actuelle | `form_answers.work_status` | Aucune |
| `investment_amount` | Montant à investir | `budget_amount` + `priorite` + `offer_amount` | Parse + calcul |

---

## 3. Checklist 6 étapes — Auto-calcul

### Architecture

Les 6 étapes sont **auto-calculées** à chaque chargement du CRM, pas cochées manuellement.

Fichier : `src/lib/admin/types.ts` → `mapRowToCRMLead()`

### Sources de données

| Table | Requête | Ce qu'on en tire |
|---|---|---|
| `user_video_views` | `SELECT user_id WHERE user_id IN (...)` | COUNT par user_id → `videoViewMap` |
| `user_executions` | `SELECT user_id WHERE user_id IN (...)` | COUNT par user_id → `execMap` |

Ces requêtes sont exécutées en parallèle dans `CRMDashboard.tsx` → `loadLeads()`.

### Logique de calcul

```
videos_en_cours    = videoViewMap[user_id] > 0    || DB fallback
videos_terminees   = videoViewMap[user_id] >= 5   || DB fallback
recolte_demarree   = execMap[user_id] > 0         || DB fallback
recolte_terminee   = execMap[user_id] >= 10       || DB fallback
trade_execute      = execMap[user_id] > 0         || DB fallback
quick_win          = DB value only                 (pas encore auto-détecté)
```

### Seuils

| Étape | Seuil | Justification |
|---|---|---|
| Videos en cours | ≥ 1 vue | Le lead a ouvert au moins une vidéo |
| Videos terminées | ≥ 5 vues | 5 vidéos = parcours Setup Oracle complet |
| Récolte démarrée | ≥ 1 execution | Le lead a commencé à remplir le tableau |
| Récolte terminée | ≥ 10 executions | Seuil à affiner selon le cycle 1 |
| Trade exécuté | ≥ 1 execution | Même source que récolte (à distinguer si possible) |
| Quick win | À définir | Trade avec RR > 0 ? Ou entrée dans `user_successes` ? |

### Points à affiner

1. **Récolte vs Trade** : actuellement `recolte_demarree` et `trade_execute` utilisent la même source (`user_executions`). Si "récolte" = observer le marché sans trader et "trade" = prendre une position réelle, il faudrait distinguer via `user_personal_trades` pour les trades réels.

2. **Quick win** : pas de détection auto pour le moment. Options possibles :
   - `user_personal_trades` avec `rr > 0`
   - `user_successes` COUNT > 0
   - Un flag manuel du setter

3. **Seuil récolte terminée** : 10 est arbitraire. Idéalement = `cycles.total_trades` du cycle 1.

---

## 4. Enrichissement CRM

### Flow de chargement

Fichier : `src/components/dashboard/admin/CRMDashboard.tsx` → `loadLeads()`

```
1. SELECT * FROM early_access_requests ORDER BY created_at DESC
   → Affichage immédiat avec les données brutes

2. En parallèle (5 requêtes) :
   ├── user_roles        → expires_at, early_access_type
   ├── ea_activity_tracking → is_active, active_tab, last_heartbeat
   ├── user_sessions     → COUNT par user_id
   ├── user_executions   → COUNT par user_id
   └── user_video_views  → COUNT par user_id    ← NOUVEAU

3. Re-map tous les leads avec les données enrichies
   → Checklist auto-calculée
   → Statut online/offline
   → Compteurs sessions/executions/vidéos
```

### Rafraîchissement
- **Realtime** : subscription Supabase sur INSERT/UPDATE de `early_access_requests`
- **Polling** : toutes les 10 secondes
- **Manuel** : bouton refresh en haut à droite

---

## 5. Type CRMLead

Fichier : `src/lib/admin/types.ts`

C'est la **source de vérité unique** pour la forme d'un lead dans le frontend. Tous les composants CRM importent ce type.

### Fonction `mapRowToCRMLead(row, enrich?)`

Prend une row brute de Supabase + les maps d'enrichissement optionnelles, retourne un `CRMLead` avec :
- Tous les champs DB avec des defaults safe (pas de null non géré)
- Les 6 étapes checklist recalculées depuis l'enrichissement
- `date_activation_trial` qui fallback sur `reviewed_at`
- `statut_trial` qui fallback sur 'actif'

---

## 6. Migrations SQL

Toutes dans `supabase/migrations/`, à appliquer via SQL Editor sur le projet Supabase (jamais `supabase db push`).

| Migration | Contenu |
|---|---|
| `20260414000000_add_vsl_cta_delay.sql` | `vsl_cta_delay_seconds` sur `funnel_config` |
| `20260414100000_add_form_answers.sql` | `form_answers` jsonb sur `early_access_requests` |
| `20260414200000_add_setting_spec_fields.sql` | 20 champs spec CRM (budget, priorité, checklist, setting, post-trial) |

### À appliquer sur la DB test (`mkogljvoqqcnqrgcnfau`)

```sql
-- Migration 1
ALTER TABLE funnel_config ADD COLUMN IF NOT EXISTS vsl_cta_delay_seconds integer DEFAULT 0;

-- Migration 2
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS form_answers jsonb DEFAULT '{}';

-- Migration 3 (tout le contenu de 20260414200000)
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS budget_amount integer;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS importance_trading integer;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS difficulte_principale text;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS priorite text;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS videos_en_cours boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS videos_terminees boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS recolte_demarree boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS recolte_terminee boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS trade_execute boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS quick_win boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS contacte_aujourdhui boolean DEFAULT false;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS derniere_interaction timestamptz;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS brief_closer text;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS raison_perdu text;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS statut_trial text DEFAULT 'actif';
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS raison_non_closing text;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS rappel_date timestamptz;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS rappel_note text;
ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS date_activation_trial timestamptz;
```

---

## 7. Ce qui reste à implémenter

### Étape 2 — Fiche Setting (UI)
Barre 3 blocs (J/7, indicateur couleur, dernière interaction) + checklist visuelle + cartes info + brief closer.

### Étape 3 — Algorithme indicateur couleur
Fonction `getColor(jour, checklist_step, heures_interaction)` → rouge/orange/vert + raison. Seuils paramétrables.

### Étape 4 — Pipeline refactor
Nouvelles colonnes (JOUR, PROGRESSION, STATUT, PRIORITÉ, CONTACTÉ). Tri : non contactés > rouge > orange > vert. Vues pré-configurées.

### Étape 5 — Call view
Issue : Vendu/Pas vendu/Rappel. `raison_perdu` si pas vendu. `brief_closer` en lecture seule.

### Étape 6 — Post-J7 + Export CSV
Auto-expiration. Raison non-closing. Rappels. Bouton export CSV.
