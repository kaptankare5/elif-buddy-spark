
-- 1) Classrooms: remove blanket-read policy
DROP POLICY IF EXISTS "Anyone view classroom by code lookup" ON public.classrooms;

-- Ensure members can read the classrooms they belong to
DROP POLICY IF EXISTS "Members can view their classroom" ON public.classrooms;
CREATE POLICY "Members can view their classroom"
  ON public.classrooms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members cm
      WHERE cm.classroom_id = classrooms.id
        AND cm.child_user_id = auth.uid()
    )
  );

-- 2) Secure RPC to join by invite code (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.join_classroom_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _classroom_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _classroom_id
  FROM public.classrooms
  WHERE invite_code = upper(trim(_code))
  LIMIT 1;

  IF _classroom_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.classroom_members (classroom_id, child_user_id)
  VALUES (_classroom_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN _classroom_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_classroom_by_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_classroom_by_code(text) TO authenticated;

-- 3) user_roles: prevent self-assigning 'teacher'
DROP POLICY IF EXISTS "Users self-assign parent or teacher" ON public.user_roles;

CREATE POLICY "Users self-assign parent role only"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND role = 'parent'::app_role
  );
