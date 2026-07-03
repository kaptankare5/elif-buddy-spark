REVOKE ALL ON FUNCTION public.honor_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.honor_list() FROM anon;
REVOKE ALL ON FUNCTION public.honor_list() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.honor_list() TO service_role;