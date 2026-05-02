-- Fix: My Oracle datasource shows 0 trades after saving in the same session
--
-- Root cause: user_executions n'était PAS dans la publication supabase_realtime.
-- Le channel 'user_executions_my_oracle' dans Dashboard.tsx s'abonnait à
-- postgres_changes sur cette table, mais sans publication → les événements
-- n'étaient jamais émis → userExecutionTradeIds restait vide dans la session.
--
-- Fix complémentaire côté frontend (Dashboard.tsx) :
--   if (cached !== null && cached.length > 0) — évite le faux positif sur cache []

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_executions;
