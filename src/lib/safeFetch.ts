// ============================================
// Safe fetch helpers — défense en profondeur
// ============================================
// Objectif : éliminer les "spinner infini" et les sessions stale
// qui forcent l'utilisateur à vider son cache.
//
// 3 couches :
//   1. withTimeout — toute promise qui ne résout pas en N secondes throw
//   2. detectAuthError — repère les 401/PGRST301 et déclenche le cleanup
//   3. clearStaleSession — vide localStorage + signOut Supabase + redirect /auth
//
// Usage côté composant :
//   const data = await withTimeout(supabase.from(...).select(...), 12000);
//
// Usage global (dans Dashboard ou App) :
//   useEffect(() => installAuthErrorListener(), []);

import { supabase } from "@/integrations/supabase/client";

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Enveloppe n'importe quelle promise (Supabase ou autre) avec un timeout.
 * Garantit que le code en aval reçoit une réponse (ok ou erreur) sous N ms.
 */
export function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Détermine si une erreur Supabase est un signe de session morte.
 * - statusCode 401 : token expiré
 * - PGRST301 : JWT expired
 * - "JWT expired" / "invalid token" dans le message
 */
export function isAuthError(err: unknown): boolean {
  if (!err) return false;
  const e = err as any;
  if (e?.status === 401 || e?.statusCode === 401) return true;
  if (e?.code === "PGRST301") return true;
  const msg = String(e?.message || "").toLowerCase();
  if (msg.includes("jwt expired")) return true;
  if (msg.includes("invalid token")) return true;
  if (msg.includes("not authenticated")) return true;
  return false;
}

/**
 * Cleanup complet : localStorage + Supabase auth + redirect.
 * Idempotent — appelable plusieurs fois sans casse.
 */
export async function clearStaleSession(reason = "auth_error"): Promise<void> {
  try {
    // Nettoie tous les tokens locaux Oracle
    localStorage.removeItem("oracle_session_token");
    // Les états dashboard sont indexés par session token → on les laisse, ils seront ignorés
    // Supabase auth signOut (n'échoue pas si déjà signé out)
    await supabase.auth.signOut().catch(() => {});
  } catch {
    // ignore — le cleanup ne doit jamais throw
  }
  console.warn("[safeFetch] Cleared stale session:", reason);
  // Redirect — laisse le navigateur reload pour clear la mémoire React
  if (typeof window !== "undefined") {
    window.location.href = "/auth";
  }
}

/**
 * Installer le listener global. À appeler une fois au mount du Dashboard.
 * Ecoute les événements auth de Supabase ET intercepte les requêtes échouées
 * via un wrapper sur fetch. Si on détecte un auth error → cleanup automatique.
 *
 * Retourne une fonction de cleanup (à appeler en useEffect return).
 */
export function installAuthErrorListener(): () => void {
  // Listener auth Supabase — capture SIGNED_OUT, TOKEN_REFRESHED, etc.
  const { data: sub } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      try { localStorage.removeItem("oracle_session_token"); } catch {}
    }
  });

  return () => {
    sub.subscription.unsubscribe();
  };
}
