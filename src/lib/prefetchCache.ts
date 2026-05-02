// ─────────────────────────────────────────────────────────────────────────────
// prefetchCache — Cache module-level pour le prefetch pendant l'animation login
//
// Principe : dès que signInWithPassword réussit (Auth.tsx), on lance un fetch
// des données critiques du Dashboard en parallèle avec la LoginProgressBar
// (~3.5s d'animation). Quand le Dashboard monte, il consomme le cache au lieu
// de relancer des fetches → 0 latence visible post-animation.
//
// TTL : 30s — couvre largement les ~6.7s d'animation + transition.
// Après consommation : l'entrée est invalidée (le Dashboard prend le relais
// avec ses subscriptions realtime normales).
//
// Sécurité :
//   - Jamais de throw : toutes les erreurs sont silencieuses (fallback → fetch normal)
//   - Le cache n'impacte AUCUNE donnée persistante — lecture seule
//   - En cas de cache miss : Dashboard fonctionne exactement comme avant
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

const TTL_MS = 30_000; // 30 secondes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, fetchedAt: Date.now() });
}

function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheInvalidate(key: string): void {
  store.delete(key);
}

// ─── Clés de cache ────────────────────────────────────────────────────────────

export const CACHE_KEY_TRADES = "trades";
export const cacheKeyUserExecutions = (userId: string) => `user_executions:${userId}`;

// ─── Accesseurs publics ───────────────────────────────────────────────────────

/** Lit les trades depuis le cache (null si absent ou expiré). Invalide l'entrée après lecture. */
export function consumeCachedTrades<T = unknown>(): T[] | null {
  const data = cacheGet<T[]>(CACHE_KEY_TRADES);
  if (data !== null) cacheInvalidate(CACHE_KEY_TRADES);
  return data;
}

/** Lit les trade_numbers de l'user depuis le cache (null si absent ou expiré). Invalide après lecture. */
export function consumeCachedUserExecutionNumbers(userId: string): number[] | null {
  const key = cacheKeyUserExecutions(userId);
  const data = cacheGet<number[]>(key);
  if (data !== null) cacheInvalidate(key);
  return data;
}

// ─── Prefetch principal ───────────────────────────────────────────────────────

/**
 * Lance le prefetch des données critiques du Dashboard en arrière-plan.
 * Appelé depuis Auth.tsx juste après setIsProgressActive(true).
 *
 * Fire-and-forget : ne jamais await cette fonction depuis l'UI.
 * Toutes les erreurs sont silencieuses — le Dashboard fonctionne sans le cache.
 */
export async function prefetchDashboardData(userId: string): Promise<void> {
  try {
    const [tradesResult, executionsResult] = await Promise.all([
      supabase
        .from("trades")
        .select("*")
        .order("trade_number", { ascending: true }),
      supabase
        .from("user_executions")
        .select("trade_number")
        .eq("user_id", userId),
    ]);

    if (!tradesResult.error && tradesResult.data) {
      cacheSet(CACHE_KEY_TRADES, tradesResult.data);
    }

    if (!executionsResult.error && executionsResult.data) {
      const numbers = (executionsResult.data as any[])
        .map((r) => r.trade_number)
        .filter((n) => n != null) as number[];
      cacheSet(cacheKeyUserExecutions(userId), numbers);
    }
  } catch {
    // Silencieux — le Dashboard fera ses propres fetches normalement
  }
}
