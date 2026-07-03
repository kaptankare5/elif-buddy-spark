
-- Restrict answer_events and letter_stats policies to authenticated role
DROP POLICY IF EXISTS "Users insert own events" ON public.answer_events;
CREATE POLICY "Users insert own events" ON public.answer_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- letter_stats: recreate all policies scoped to authenticated
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='letter_stats' LOOP
    EXECUTE format('DROP POLICY %I ON public.letter_stats', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users select own letter stats" ON public.letter_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own letter stats" ON public.letter_stats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own letter stats" ON public.letter_stats
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own letter stats" ON public.letter_stats
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
