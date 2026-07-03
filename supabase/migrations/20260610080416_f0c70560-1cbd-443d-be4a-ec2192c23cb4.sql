
-- 1. Subscriptions: add explicit deny for INSERT/UPDATE/DELETE for authenticated users.
-- service_role bypasses RLS so backend can still write.
DROP POLICY IF EXISTS "No client inserts on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "No client updates on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "No client deletes on subscriptions" ON public.subscriptions;

CREATE POLICY "No client inserts on subscriptions"
  ON public.subscriptions FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No client updates on subscriptions"
  ON public.subscriptions FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "No client deletes on subscriptions"
  ON public.subscriptions FOR DELETE TO authenticated, anon
  USING (false);

-- Revoke direct table privileges from anon/authenticated; rely on service_role only.
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- 2. Profiles: require authentication to read.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- 3. has_active_subscription: revoke EXECUTE from public/authenticated/anon.
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO service_role;
