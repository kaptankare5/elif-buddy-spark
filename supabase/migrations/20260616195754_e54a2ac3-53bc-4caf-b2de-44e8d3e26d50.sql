CREATE OR REPLACE FUNCTION public.honor_list()
RETURNS TABLE(display_name text, since timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT 'Destekçi'::text AS display_name,
         s.created_at AS since
  FROM public.subscriptions s
  WHERE s.status = 'active'
    AND s.product_id LIKE 'patron%'
    AND (s.expires_at IS NULL OR s.expires_at > now())
  ORDER BY s.created_at ASC
  LIMIT 200;
$function$;

REVOKE ALL ON FUNCTION public.honor_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.honor_list() TO anon;
GRANT EXECUTE ON FUNCTION public.honor_list() TO authenticated;