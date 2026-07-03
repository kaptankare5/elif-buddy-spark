
ALTER TABLE public.answer_events ADD COLUMN IF NOT EXISTS mode text;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS mode text;

DROP POLICY IF EXISTS "Admins view all letter stats" ON public.letter_stats;
CREATE POLICY "Admins view all letter stats" ON public.letter_stats
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view all answer events" ON public.answer_events;
CREATE POLICY "Admins view all answer events" ON public.answer_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP VIEW IF EXISTS public.analytics_learning_rate;
CREATE VIEW public.analytics_learning_rate WITH (security_invoker=on) AS
WITH learned AS (
  SELECT ls.user_id,
         COALESCE(NULLIF(mode_g.mode,''),'normal') AS mode,
         count(*) AS learned_items,
         sum(ls.time_to_learn_ms) AS learn_ms
  FROM public.letter_stats ls
  LEFT JOIN LATERAL (
    SELECT mode FROM public.answer_events ae
    WHERE ae.user_id = ls.user_id AND ae.topic_id = ls.topic_id AND ae.letter_id = ls.letter_id
    ORDER BY ae.created_at DESC LIMIT 1
  ) mode_g ON true
  WHERE ls.knew_before IS NOT TRUE AND ls.learned_at IS NOT NULL
    AND ls.time_to_learn_ms IS NOT NULL AND ls.time_to_learn_ms > 0
  GROUP BY ls.user_id, COALESCE(NULLIF(mode_g.mode,''),'normal')
)
SELECT mode,
       count(DISTINCT user_id)::int AS learners,
       sum(learned_items)::int AS learned_items,
       round(sum(learn_ms) / 60000.0, 1) AS active_minutes,
       round(sum(learned_items)::numeric / NULLIF(sum(learn_ms) / 60000.0, 0), 2) AS items_per_minute,
       round(sum(learned_items)::numeric * 60.0 / NULLIF(sum(learn_ms) / 60000.0, 0), 1) AS items_per_hour
FROM learned
GROUP BY mode;

DROP VIEW IF EXISTS public.analytics_game_engagement;
CREATE VIEW public.analytics_game_engagement WITH (security_invoker=on) AS
SELECT game_id,
       COALESCE(NULLIF(mode,''),'normal') AS mode,
       count(*)::int AS sessions,
       count(DISTINCT user_id)::int AS unique_users,
       round(sum(COALESCE(duration_ms,0)) / 60000.0, 1) AS total_minutes,
       round(avg(NULLIF(duration_ms,0)) / 1000.0, 1) AS avg_seconds,
       round(100.0 * sum(CASE WHEN completed THEN 1 ELSE 0 END)::numeric / NULLIF(count(*),0)::numeric, 1) AS completion_pct,
       round(100.0 * sum(correct)::numeric / NULLIF(sum(correct + wrong),0)::numeric, 1) AS accuracy_pct
FROM public.game_sessions
GROUP BY game_id, COALESCE(NULLIF(mode,''),'normal')
ORDER BY total_minutes DESC NULLS LAST;

DROP VIEW IF EXISTS public.analytics_retention;
CREATE VIEW public.analytics_retention WITH (security_invoker=on) AS
WITH signups AS (
  SELECT p.user_id, date_trunc('week', p.created_at)::date AS cohort_week, p.created_at::date AS signup_day
  FROM public.profiles p
),
activity AS (
  SELECT user_id, started_at::date AS day FROM public.game_sessions
  UNION
  SELECT user_id, opened_at::date AS day FROM public.screen_views
)
SELECT s.cohort_week,
       count(DISTINCT s.user_id)::int AS cohort_size,
       round(100.0 * count(DISTINCT CASE WHEN a.day = s.signup_day + 1 THEN s.user_id END)::numeric
             / NULLIF(count(DISTINCT s.user_id),0), 1) AS d1_pct,
       round(100.0 * count(DISTINCT CASE WHEN a.day BETWEEN s.signup_day + 7 AND s.signup_day + 8 THEN s.user_id END)::numeric
             / NULLIF(count(DISTINCT s.user_id),0), 1) AS d7_pct,
       round(100.0 * count(DISTINCT CASE WHEN a.day BETWEEN s.signup_day + 30 AND s.signup_day + 31 THEN s.user_id END)::numeric
             / NULLIF(count(DISTINCT s.user_id),0), 1) AS d30_pct
FROM signups s
LEFT JOIN activity a ON a.user_id = s.user_id
GROUP BY s.cohort_week
ORDER BY s.cohort_week DESC;

DROP VIEW IF EXISTS public.analytics_super_vs_normal;
CREATE VIEW public.analytics_super_vs_normal WITH (security_invoker=on) AS
SELECT COALESCE(NULLIF(mode,''),'normal') AS mode,
       count(DISTINCT user_id)::int AS users,
       count(*)::int AS sessions,
       round(avg(NULLIF(duration_ms,0)) / 1000.0, 1) AS avg_seconds,
       round(100.0 * sum(CASE WHEN completed THEN 1 ELSE 0 END)::numeric / NULLIF(count(*),0), 1) AS completion_pct,
       round(100.0 * sum(correct)::numeric / NULLIF(sum(correct + wrong),0), 1) AS accuracy_pct
FROM public.game_sessions
GROUP BY COALESCE(NULLIF(mode,''),'normal');

DROP VIEW IF EXISTS public.analytics_known_letters;
CREATE VIEW public.analytics_known_letters WITH (security_invoker=on) AS
SELECT count(*)::int AS already_known_items,
       count(DISTINCT user_id)::int AS users
FROM public.letter_stats
WHERE knew_before IS TRUE;

GRANT SELECT ON public.analytics_learning_rate TO authenticated;
GRANT SELECT ON public.analytics_game_engagement TO authenticated;
GRANT SELECT ON public.analytics_retention TO authenticated;
GRANT SELECT ON public.analytics_super_vs_normal TO authenticated;
GRANT SELECT ON public.analytics_known_letters TO authenticated;
