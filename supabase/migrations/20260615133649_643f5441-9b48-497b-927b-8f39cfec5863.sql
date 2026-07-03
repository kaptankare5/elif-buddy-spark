CREATE OR REPLACE FUNCTION public.honor_list()
 RETURNS TABLE(display_name text, since timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(nullif(p.display_name, ''), p.pseudonym, 'Destekçi') as display_name,
         s.created_at as since
  from public.subscriptions s
  left join public.profiles p on p.user_id = s.user_id
  where s.status = 'active'
    and s.product_id like 'patron%'
    and (s.expires_at is null or s.expires_at > now())
  order by s.created_at asc
  limit 200;
$function$;