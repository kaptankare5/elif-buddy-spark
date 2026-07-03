
CREATE POLICY "Users self-assign parent or teacher" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role IN ('parent'::app_role, 'teacher'::app_role));
