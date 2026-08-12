DROP POLICY IF EXISTS "deney_ses_owner_select" ON storage.objects;
CREATE POLICY "deney_ses_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'deney-ses' AND owner = auth.uid());

DROP POLICY IF EXISTS "deney_ses_owner_insert" ON storage.objects;
CREATE POLICY "deney_ses_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deney-ses' AND owner = auth.uid());

DROP POLICY IF EXISTS "deney_ses_owner_update" ON storage.objects;
CREATE POLICY "deney_ses_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'deney-ses' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'deney-ses' AND owner = auth.uid());

DROP POLICY IF EXISTS "deney_ses_owner_delete" ON storage.objects;
CREATE POLICY "deney_ses_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deney-ses' AND owner = auth.uid());