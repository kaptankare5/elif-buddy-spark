
-- Drop existing view that's not useful standalone
DROP VIEW IF EXISTS public.analytics_known_letters;

-- 1) Per-profile aggregate progress
CREATE OR REPLACE VIEW public.analytics_user_progress
WITH (security_invoker=on) AS
WITH learned AS (
  SELECT ls.user_id,
         count(*) FILTER (WHERE ls.learned_at IS NOT NULL AND coalesce(ls.knew_before, false) = false) AS learned_items,
         count(*) FILTER (WHERE ls.knew_before = true) AS known_items,
         count(*) AS total_items_seen,
         sum(ls.shown_count) AS total_shown,
         sum(ls.correct_count) AS total_correct,
         sum(ls.time_to_learn_ms) FILTER (WHERE ls.learned_at IS NOT NULL AND coalesce(ls.knew_before, false) = false) AS learn_ms,
         max(ls.last_seen_at) AS last_active
  FROM public.letter_stats ls
  GROUP BY ls.user_id
),
mode_mix AS (
  SELECT user_id,
         mode,
         count(*) AS n,
         row_number() OVER (PARTITION BY user_id ORDER BY count(*) DESC) AS rn
  FROM public.answer_events
  WHERE mode IS NOT NULL
  GROUP BY user_id, mode
)
SELECT l.user_id,
       coalesce(nullif(p.pseudonym, ''), 'Öğrenci #' || substring(l.user_id::text, 1, 6)) AS pseudonym,
       p.age_band,
       p.gender,
       coalesce((SELECT mode FROM mode_mix m WHERE m.user_id = l.user_id AND m.rn = 1), 'normal') AS primary_mode,
       l.learned_items,
       l.known_items,
       l.total_items_seen,
       CASE WHEN l.learned_items > 0 THEN round((l.learn_ms / l.learned_items / 1000.0)::numeric, 1) END AS avg_seconds_per_learned_item,
       CASE WHEN l.learn_ms > 0 AND l.learned_items > 0 THEN round((l.learned_items::numeric / (l.learn_ms / 3600000.0))::numeric, 2) END AS items_per_active_hour,
       l.last_active,
       CASE WHEN l.total_shown > 0 THEN round((l.total_correct::numeric / l.total_shown * 100)::numeric, 1) END AS accuracy_pct
FROM learned l
LEFT JOIN public.profiles p ON p.user_id = l.user_id
WHERE coalesce(p.analytics_consent, false) = true OR p.user_id IS NULL;

-- 2) Per-profile letter breakdown
CREATE OR REPLACE VIEW public.analytics_user_letter_breakdown
WITH (security_invoker=on) AS
SELECT ls.user_id,
       ls.topic_id,
       ls.letter_id,
       ls.level,
       ls.knew_before,
       ls.learned_at,
       ls.shown_count,
       ls.correct_count,
       CASE WHEN ls.time_to_learn_ms IS NOT NULL THEN round((ls.time_to_learn_ms / 1000.0)::numeric, 1) END AS seconds_to_learn,
       ls.last_seen_at
FROM public.letter_stats ls
LEFT JOIN public.profiles p ON p.user_id = ls.user_id
WHERE coalesce(p.analytics_consent, false) = true OR p.user_id IS NULL;

-- 3) Super vs Normal per user
CREATE OR REPLACE VIEW public.analytics_super_vs_normal_per_user
WITH (security_invoker=on) AS
SELECT ae.user_id,
       coalesce(nullif(p.pseudonym, ''), 'Öğrenci #' || substring(ae.user_id::text, 1, 6)) AS pseudonym,
       ae.mode,
       count(*) AS events,
       count(*) FILTER (WHERE ae.correct) AS correct,
       round((avg(ae.response_ms)/1000.0)::numeric, 2) AS avg_seconds,
       CASE WHEN count(*) > 0 THEN round((count(*) FILTER (WHERE ae.correct)::numeric / count(*) * 100)::numeric, 1) END AS accuracy_pct
FROM public.answer_events ae
LEFT JOIN public.profiles p ON p.user_id = ae.user_id
WHERE ae.mode IS NOT NULL AND coalesce(p.analytics_consent, false) = true
GROUP BY ae.user_id, p.pseudonym, ae.mode;

-- Grants: admin-only (views are security_invoker so policies of base tables apply;
-- letter_stats and answer_events have admin SELECT policies)
GRANT SELECT ON public.analytics_user_progress TO authenticated;
GRANT SELECT ON public.analytics_user_letter_breakdown TO authenticated;
GRANT SELECT ON public.analytics_super_vs_normal_per_user TO authenticated;
GRANT ALL ON public.analytics_user_progress TO service_role;
GRANT ALL ON public.analytics_user_letter_breakdown TO service_role;
GRANT ALL ON public.analytics_super_vs_normal_per_user TO service_role;
