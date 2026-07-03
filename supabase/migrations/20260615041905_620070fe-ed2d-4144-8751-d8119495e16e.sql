
-- profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_band text,
  ADD COLUMN IF NOT EXISTS gender text DEFAULT 'x',
  ADD COLUMN IF NOT EXISTS analytics_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS pseudonym text,
  ADD COLUMN IF NOT EXISTS platform text;

-- classrooms
CREATE TABLE IF NOT EXISTS public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classrooms TO authenticated;
GRANT ALL ON public.classrooms TO service_role;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own classrooms" ON public.classrooms
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Admins view all classrooms" ON public.classrooms
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone view classroom by code lookup" ON public.classrooms
  FOR SELECT TO authenticated USING (true);

-- classroom_members
CREATE TABLE IF NOT EXISTS public.classroom_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  child_user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, child_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.classroom_members TO authenticated;
GRANT ALL ON public.classroom_members TO service_role;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_in_classroom_of(_teacher_id uuid, _child_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_members cm
    JOIN public.classrooms c ON c.id = cm.classroom_id
    WHERE c.teacher_id = _teacher_id AND cm.child_user_id = _child_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_in_classroom_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_in_classroom_of(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "Children join self" ON public.classroom_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = child_user_id);
CREATE POLICY "Children view own membership" ON public.classroom_members
  FOR SELECT TO authenticated USING (auth.uid() = child_user_id);
CREATE POLICY "Children leave own" ON public.classroom_members
  FOR DELETE TO authenticated USING (auth.uid() = child_user_id);
CREATE POLICY "Teachers view own classroom members" ON public.classroom_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.teacher_id = auth.uid()));
CREATE POLICY "Admins view all members" ON public.classroom_members
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- game_sessions
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  topic_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms integer,
  score integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  wrong integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  age_band text,
  gender text,
  platform text
);
GRANT SELECT, INSERT, UPDATE ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own sessions" ON public.game_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.game_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own sessions" ON public.game_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Teachers view classroom sessions" ON public.game_sessions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') AND public.is_in_classroom_of(auth.uid(), user_id));
CREATE POLICY "Admins view all sessions" ON public.game_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON public.game_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game ON public.game_sessions(game_id, started_at DESC);

-- screen_views
CREATE TABLE IF NOT EXISTS public.screen_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  path text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  age_band text,
  platform text
);
GRANT SELECT, INSERT, UPDATE ON public.screen_views TO authenticated;
GRANT ALL ON public.screen_views TO service_role;
ALTER TABLE public.screen_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own views" ON public.screen_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own views" ON public.screen_views
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own views" ON public.screen_views
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all views" ON public.screen_views
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_screen_views_user ON public.screen_views(user_id, opened_at DESC);

-- learning_milestones
CREATE TABLE IF NOT EXISTS public.learning_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id text NOT NULL,
  letter_id text NOT NULL,
  level smallint NOT NULL,
  reached_at timestamptz NOT NULL DEFAULT now(),
  age_band text,
  UNIQUE (user_id, topic_id, letter_id, level)
);
GRANT SELECT, INSERT ON public.learning_milestones TO authenticated;
GRANT ALL ON public.learning_milestones TO service_role;
ALTER TABLE public.learning_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own milestones" ON public.learning_milestones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own milestones" ON public.learning_milestones
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Teachers view classroom milestones" ON public.learning_milestones
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') AND public.is_in_classroom_of(auth.uid(), user_id));
CREATE POLICY "Admins view all milestones" ON public.learning_milestones
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_milestones_user ON public.learning_milestones(user_id, topic_id, letter_id);

-- paywall_events
CREATE TABLE IF NOT EXISTS public.paywall_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  step text NOT NULL,
  plan_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  age_band text,
  platform text
);
GRANT SELECT, INSERT ON public.paywall_events TO authenticated;
GRANT ALL ON public.paywall_events TO service_role;
ALTER TABLE public.paywall_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own paywall" ON public.paywall_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own paywall" ON public.paywall_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all paywall" ON public.paywall_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Analytics views (admin)
CREATE OR REPLACE VIEW public.analytics_game_popularity AS
SELECT
  game_id,
  COUNT(*)::int AS session_count,
  COUNT(DISTINCT user_id)::int AS unique_users,
  ROUND(AVG(NULLIF(duration_ms, 0))::numeric / 1000, 1) AS avg_seconds,
  ROUND(100.0 * SUM(CASE WHEN completed THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS completion_pct,
  ROUND(100.0 * SUM(correct) / NULLIF(SUM(correct + wrong), 0), 1) AS accuracy_pct
FROM public.game_sessions
GROUP BY game_id;

CREATE OR REPLACE VIEW public.analytics_letter_learn_time AS
WITH first_seen AS (
  SELECT user_id, topic_id, letter_id, MIN(reached_at) AS first_at
  FROM public.learning_milestones WHERE level = 1
  GROUP BY user_id, topic_id, letter_id
),
mastered AS (
  SELECT user_id, topic_id, letter_id, MIN(reached_at) AS mastered_at
  FROM public.learning_milestones WHERE level >= 4
  GROUP BY user_id, topic_id, letter_id
)
SELECT m.topic_id, m.letter_id,
  COUNT(*)::int AS learners,
  ROUND(AVG(EXTRACT(EPOCH FROM (m.mastered_at - f.first_at)) / 60)::numeric, 1) AS avg_minutes
FROM mastered m JOIN first_seen f USING (user_id, topic_id, letter_id)
GROUP BY m.topic_id, m.letter_id;

CREATE OR REPLACE VIEW public.analytics_daily_active AS
SELECT date_trunc('day', started_at)::date AS day,
  COUNT(DISTINCT user_id)::int AS dau,
  COUNT(*)::int AS sessions
FROM public.game_sessions GROUP BY 1 ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.analytics_paywall_funnel AS
SELECT step, COUNT(*)::int AS events, COUNT(DISTINCT user_id)::int AS users
FROM public.paywall_events GROUP BY step;

CREATE OR REPLACE VIEW public.analytics_age_breakdown AS
SELECT
  COALESCE(age_band, 'unknown') AS age_band,
  COALESCE(gender, 'x') AS gender,
  COUNT(DISTINCT user_id)::int AS users,
  COUNT(*)::int AS sessions,
  ROUND(100.0 * SUM(correct) / NULLIF(SUM(correct + wrong), 0), 1) AS accuracy_pct
FROM public.game_sessions GROUP BY 1, 2;

ALTER VIEW public.analytics_game_popularity   SET (security_invoker = on);
ALTER VIEW public.analytics_letter_learn_time SET (security_invoker = on);
ALTER VIEW public.analytics_daily_active      SET (security_invoker = on);
ALTER VIEW public.analytics_paywall_funnel    SET (security_invoker = on);
ALTER VIEW public.analytics_age_breakdown     SET (security_invoker = on);

GRANT SELECT ON public.analytics_game_popularity     TO authenticated;
GRANT SELECT ON public.analytics_letter_learn_time   TO authenticated;
GRANT SELECT ON public.analytics_daily_active        TO authenticated;
GRANT SELECT ON public.analytics_paywall_funnel      TO authenticated;
GRANT SELECT ON public.analytics_age_breakdown       TO authenticated;
