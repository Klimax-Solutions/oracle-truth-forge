# Déploiement — JWT Custom Claims pour les rôles

## Objectif

Remplacer les RPC `is_admin()` / `is_setter()` / `is_super_admin()` / `is_closer()` par des claims gravés directement dans le JWT à l'émission. Effet : aucun appel réseau pour connaître le rôle au render → fini les bugs « setter voit la vue membre sur réseau lent ».

## Critères de réussite

- 0 erreur côté utilisateur (en cas de souci, fallback RPC reprend automatiquement)
- Un setter voit le panneau CRM dès le 1er render, même sur Slow 4G
- Un admin voit ses panneaux Admin / Gestion / Config dès le 1er render
- Aucun load en boucle (la safety timer 4s déclenche un unblock UI sans toucher aux rôles)
- Un membre voit la vue membre, jamais d'admin tab

## Architecture en 3 couches

```
1. JWT claims (synchrone, instantané)
       ↓ si absent
2. Cache localStorage (rehydrate au reload)
       ↓ si user_id ne match pas
3. RPC fallback (compatibilité legacy, sera retiré post-stabilisation)
```

Tant que la couche 1 n'est pas activée côté Supabase, c'est la couche 3 qui prend le relais — donc rien ne casse même si le hook n'est pas activé.

---

## Étapes de déploiement

### A — TEST (mkog) d'abord

1. **Frontend** : la branche `crm-integration` contient déjà tout. Vérifier que `npm run build` passe :
   ```bash
   npm run build
   ```

2. **Migration SQL sur mkog** : ouvrir le SQL editor de Supabase (projet `mkogljvoqqcnqrgcnfau`) et exécuter le contenu de `supabase/migrations/20260426140000_custom_access_token_hook.sql`.

3. **Activation du hook** :
   - Supabase Dashboard `mkog` → **Authentication** → **Hooks**
   - Section **Custom Access Token Hook** → bouton **Enable**
   - Schema : `public`
   - Function : `custom_access_token_hook`
   - Save

4. **Test** :
   - Logger n'importe quel user qui a un rôle non-trivial (setter, admin)
   - Console browser :
     ```js
     const k = Object.keys(localStorage).find(x => x.startsWith("sb-") && x.includes("auth-token"));
     const v = JSON.parse(localStorage.getItem(k));
     console.log("roles:", v?.user?.app_metadata?.roles);
     ```
   - Doit afficher un tableau type `["setter"]` ou `["admin","super_admin"]`
   - Si vide ou absent : le hook n'est pas actif. Vérifier l'étape 3.

5. **Test bug du jour** :
   - DevTools → Network → throttle **Slow 4G**
   - Hard reload `/dashboard`
   - Doit voir le panneau CRM (pour setter) ou les tabs admin (pour admin) immédiatement, sans flash de la vue membre

6. **Deploy frontend Vercel** :
   ```bash
   vercel --prod
   ```

### B — PROD (Lovable Cloud) — seulement après que TEST soit stable 7 jours

1. **Frontend** : merger `crm-integration` → `main`. Lovable auto-deploy.

2. **Migration SQL sur prod (`pggkwyhtplxyarctuoze`)** :
   - ⚠️ Ne jamais utiliser `supabase db push` (interdit par CLAUDE.md)
   - Passer par l'outil interne de Lovable pour appliquer le fichier `supabase/migrations/20260426140000_custom_access_token_hook.sql`
   - Ou copier-coller manuellement le SQL dans le SQL editor de la prod

3. **Activation du hook sur prod** :
   - Supabase Dashboard prod → **Authentication** → **Hooks** → **Custom Access Token Hook**
   - Enable + select `public.custom_access_token_hook`
   - Save

4. **Force-refresh des sessions actives** :
   - Les JWTs déjà émis (avant l'activation du hook) n'ont PAS les claims tant qu'ils ne sont pas rafraîchis (toutes les heures auto, ou au prochain login).
   - Pendant la période de transition (~1h), le fallback RPC s'occupe d'eux. Aucun bug visible.
   - Pour les staff (toi + setters), tu peux leur demander de se déconnecter / reconnecter pour bénéficier du JWT v2 immédiatement.

---

## Rollback

Si quelque chose part en vrille :

1. **Désactiver le hook** : Supabase Dashboard → Authentication → Hooks → Disable. Les nouveaux JWTs reviennent à vide. Le fallback RPC du frontend prend le relais. Aucun changement de code requis.

2. **En cas extrême** : revert le commit frontend qui modifie `useSidebarRoles`. L'ancien comportement (RPC only) revient.

La migration SQL n'a pas besoin d'être rollback — la fonction PG dort si le hook n'est pas activé.

---

## Validation post-launch

Après 7 jours sans incident en prod, on peut :
1. Retirer le code de fallback RPC dans `useSidebarRoles`
2. Garder les RPCs `is_admin()` etc. côté DB (utilisés par les RLS policies)

---

## Fichiers touchés

- `supabase/migrations/20260426140000_custom_access_token_hook.sql` (nouvelle migration)
- `src/components/dashboard/DashboardSidebar.tsx` (refacto `useSidebarRoles`, suppression du double role-check interne)
- `src/pages/Dashboard.tsx` (lazy-load des panneaux admin, hoist au scope module)

## Bénéfices secondaires

- Bundle initial : 2.29 MB → 1.83 MB (-460 kB raw, -113 kB gzip)
- Suppression d'un système de role-check redondant dans le composant `DashboardSidebar`
- Suppression du safety timer 9s → réduit à 4s, déclenché jamais en pratique
- 1 seul realtime channel sur `user_roles` au lieu de 2
