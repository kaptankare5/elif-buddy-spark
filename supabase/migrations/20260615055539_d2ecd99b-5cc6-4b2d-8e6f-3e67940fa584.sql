
ALTER TABLE public.letter_stats
  ADD COLUMN IF NOT EXISTS learned_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_to_learn_ms bigint,
  ADD COLUMN IF NOT EXISTS total_response_ms bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE VIEW public.analytics_learning_power AS
SELECT
  count(*)::int AS learned_items,
  count(DISTINCT user_id)::int AS learners,
  round((avg(time_to_learn_ms)/1000.0)::numeric, 1) AS avg_seconds_per_item,
  round((avg(time_to_learn_ms)/60000.0)::numeric, 2) AS avg_minutes_per_item
FROM public.letter_stats
WHERE knew_before IS NOT TRUE
  AND learned_at IS NOT NULL
  AND time_to_learn_ms IS NOT NULL
  AND time_to_learn_ms > 0;

CREATE OR REPLACE VIEW public.analytics_letter_power AS
SELECT
  topic_id,
  letter_id,
  count(*)::int AS learners,
  round((avg(time_to_learn_ms)/1000.0)::numeric, 1) AS avg_seconds,
  count(*) FILTER (WHERE knew_before IS TRUE)::int AS knew_before_count
FROM public.letter_stats
WHERE learned_at IS NOT NULL
  AND time_to_learn_ms IS NOT NULL
  AND time_to_learn_ms > 0
  AND knew_before IS NOT TRUE
GROUP BY topic_id, letter_id
ORDER BY avg_seconds ASC;
