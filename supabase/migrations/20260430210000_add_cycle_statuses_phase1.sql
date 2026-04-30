-- Phase 1.A — Nouveaux statuts Slice D
-- Date : 2026-04-30
-- Safe : OUI — purement additif
--
-- 1. Enum cycle_status : ajoute 'in_review' et 'on_hold'
--    ALTER TYPE ADD VALUE = non-destructif, ne modifie pas les données existantes
--
-- 2. verification_requests.status CHECK constraint :
--    Étend pour inclure : cancelled, in_review, on_hold
--    (cancelled manquait — retract_verification_request échouait silencieusement)
--
-- Impact data : ZÉRO — aucune ligne modifiée, aucune donnée supprimée

-- ─── 1. Enum cycle_status ───────────────────────────────────────────────────
-- in_review  : admin a commencé à noter (retract bloqué)
-- on_hold    : admin a mis en pause (retract bloqué, timeout 48h/7j)

ALTER TYPE public.cycle_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE public.cycle_status ADD VALUE IF NOT EXISTS 'on_hold';

-- ─── 2. verification_requests.status CHECK constraint ───────────────────────
-- Drop + recreate avec la liste complète
-- Valeurs ajoutées :
--   cancelled : user a rétracté sa demande (retract_verification_request RPC)
--   in_review : admin a commencé la review
--   on_hold   : admin a mis en pause

ALTER TABLE public.verification_requests
  DROP CONSTRAINT IF EXISTS verification_requests_status_check;

ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'in_review', 'on_hold'));
