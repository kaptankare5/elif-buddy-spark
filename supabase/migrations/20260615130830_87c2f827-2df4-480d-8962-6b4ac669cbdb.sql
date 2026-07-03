
create or replace function public.honor_list()
returns table(display_name text, since timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(p.display_name, ''), p.pseudonym, 'Destekçi') as display_name,
         s.created_at as since
  from public.subscriptions s
  left join public.profiles p on p.user_id = s.user_id
  where s.status = 'active'
    and s.product_id = 'patron'
    and (s.expires_at is null or s.expires_at > now())
  order by s.created_at asc
  limit 200;
$$;

grant execute on function public.honor_list() to anon, authenticated;
