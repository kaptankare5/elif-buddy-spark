-- Reset test/garbage data from public tables.
-- Keeps yamik21@itu.edu.tr (3149df99-a9e4-4018-adb8-3a4576d9215c) admin role and active subscription.
TRUNCATE TABLE
  public.answer_events,
  public.game_sessions,
  public.learning_milestones,
  public.letter_stats,
  public.paywall_events,
  public.screen_views
RESTART IDENTITY;

-- Drop any non-admin yamik21 role rows just in case; keep ONLY yamik21's admin role.
DELETE FROM public.user_roles
WHERE NOT (user_id = '3149df99-a9e4-4018-adb8-3a4576d9215c' AND role = 'admin');

-- Drop any subscription not belonging to yamik21; keep his patron-monthly active sub.
DELETE FROM public.subscriptions
WHERE user_id <> '3149df99-a9e4-4018-adb8-3a4576d9215c';

-- Profiles: clear empty/leftover rows for non-yamik21 users
DELETE FROM public.profiles
WHERE user_id <> '3149df99-a9e4-4018-adb8-3a4576d9215c';