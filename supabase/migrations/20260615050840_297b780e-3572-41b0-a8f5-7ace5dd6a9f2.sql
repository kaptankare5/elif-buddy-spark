
DROP POLICY IF EXISTS "Teachers view classroom sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Teachers view classroom milestones" ON public.learning_milestones;

DROP FUNCTION IF EXISTS public.join_classroom_by_code(text);
DROP FUNCTION IF EXISTS public.is_in_classroom_of(uuid, uuid) CASCADE;
DROP TABLE IF EXISTS public.classroom_members CASCADE;
DROP TABLE IF EXISTS public.classrooms CASCADE;

GRANT DELETE ON public.game_sessions TO authenticated;
GRANT DELETE ON public.screen_views TO authenticated;
GRANT DELETE ON public.learning_milestones TO authenticated;
GRANT DELETE ON public.paywall_events TO authenticated;
GRANT DELETE ON public.answer_events TO authenticated;
GRANT DELETE ON public.letter_stats TO authenticated;

CREATE POLICY "Users delete own game sessions" ON public.game_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own screen views" ON public.screen_views
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own milestones" ON public.learning_milestones
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own paywall events" ON public.paywall_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own answer events" ON public.answer_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own letter stats" ON public.letter_stats
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
