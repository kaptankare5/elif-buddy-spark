-- ============================================================================
-- ELİFBÂ — YENİ SUPABASE PROJESİ TAM KURULUM
-- Eski (Lovable) projedeki 33 migration'ın konsolide son hali + yeni
-- "öğrenci bulut senkronu" tabloları. Yeni ve boş bir Supabase projesinde
-- SQL Editor'e yapıştırıp çalıştırman yeterli (veya `supabase db push`).
-- Ayrıntılar: docs/supabase-kurulum.md
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Ortak yardımcılar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ---------------------------------------------------------------------------
-- 1) Profiller (auth.users'a 1-1) — kayıt olunca otomatik oluşur
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  age_band TEXT,
  gender TEXT DEFAULT 'x',
  analytics_consent BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  pseudonym TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Roller (admin / user / parent / teacher)
-- ---------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'parent', 'teacher');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users self-assign parent role only" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'parent'::app_role);

-- ---------------------------------------------------------------------------
-- 3) Abonelikler (istemci yalnız okur; yazma service_role/backend işi)
-- ---------------------------------------------------------------------------
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'inactive',
  platform TEXT NOT NULL DEFAULT 'manual',
  product_id TEXT,
  original_transaction_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "No client inserts on subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No client updates on subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on subscriptions" ON public.subscriptions
  FOR DELETE TO authenticated, anon USING (false);
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.honor_list()
RETURNS TABLE(display_name text, since timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT 'Destekçi'::text AS display_name,
         s.created_at AS since
  FROM public.subscriptions s
  WHERE s.status = 'active'
    AND s.product_id LIKE 'patron%'
    AND (s.expires_at IS NULL OR s.expires_at > now())
  ORDER BY s.created_at ASC
  LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.honor_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.honor_list() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Hesap bazlı öğrenme verisi: letter_stats + answer_events
--    (giriş yapan kullanıcının kendi ilerlemesinin bulut yedeği + istatistik)
-- ---------------------------------------------------------------------------
CREATE TABLE public.letter_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  letter_id TEXT NOT NULL,
  shown_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  level SMALLINT NOT NULL DEFAULT 1,
  knew_before BOOLEAN,
  learned_at TIMESTAMPTZ,
  time_to_learn_ms BIGINT,
  total_response_ms BIGINT NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic_id, letter_id)
);
CREATE INDEX idx_letter_stats_user ON public.letter_stats(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_stats TO authenticated;
GRANT ALL ON public.letter_stats TO service_role;
ALTER TABLE public.letter_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own letter stats" ON public.letter_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own letter stats" ON public.letter_stats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own letter stats" ON public.letter_stats
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own letter stats" ON public.letter_stats
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all letter stats" ON public.letter_stats
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.answer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  letter_id TEXT NOT NULL,
  game_id TEXT,
  correct BOOLEAN NOT NULL,
  response_ms INTEGER,
  mode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_answer_events_user_created ON public.answer_events(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answer_events TO authenticated;
GRANT ALL ON public.answer_events TO service_role;
ALTER TABLE public.answer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own events" ON public.answer_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own events" ON public.answer_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own answer events" ON public.answer_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all answer events" ON public.answer_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Tek RPC ile cevap kaydı: answer_events'e olay + letter_stats'te SRS güncellemesi
CREATE OR REPLACE FUNCTION public.record_letter_answer(
  _topic_id text,
  _letter_id text,
  _correct boolean,
  _game_id text DEFAULT NULL,
  _response_ms integer DEFAULT NULL,
  _mode text DEFAULT NULL
)
RETURNS public.letter_stats
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing public.letter_stats%ROWTYPE;
  _result public.letter_stats%ROWTYPE;
  _add_ms bigint := 0;
  _new_shown integer;
  _new_correct integer;
  _new_wrong integer;
  _new_level smallint;
  _new_total_ms bigint;
  _new_knew_before boolean;
  _learned_now boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _topic_id IS NULL OR length(trim(_topic_id)) = 0
     OR _letter_id IS NULL OR length(trim(_letter_id)) = 0 THEN
    RAISE EXCEPTION 'invalid_answer_target';
  END IF;

  IF _response_ms IS NOT NULL AND _response_ms > 0 THEN
    _add_ms := LEAST(_response_ms, 60000)::bigint;
  END IF;

  INSERT INTO public.answer_events (user_id, topic_id, letter_id, game_id, correct, response_ms, mode)
  VALUES (_uid, _topic_id, _letter_id, _game_id, COALESCE(_correct, false), _response_ms, _mode);

  LOOP
    SELECT * INTO _existing
    FROM public.letter_stats
    WHERE user_id = _uid AND topic_id = _topic_id AND letter_id = _letter_id
    FOR UPDATE;

    IF FOUND THEN
      _new_shown := COALESCE(_existing.shown_count, 0) + 1;
      _new_correct := COALESCE(_existing.correct_count, 0) + CASE WHEN COALESCE(_correct, false) THEN 1 ELSE 0 END;
      _new_wrong := COALESCE(_existing.wrong_count, 0) + CASE WHEN COALESCE(_correct, false) THEN 0 ELSE 1 END;
      _new_level := CASE WHEN COALESCE(_correct, false)
        THEN LEAST(4, GREATEST(1, COALESCE(_existing.level, 1)) + 1)
        ELSE GREATEST(1, GREATEST(1, COALESCE(_existing.level, 1)) - 1)
      END;
      _new_total_ms := COALESCE(_existing.total_response_ms, 0) + _add_ms;
      _new_knew_before := _existing.knew_before;

      IF _new_shown <= 2 THEN
        IF _new_shown = 2 THEN
          _new_knew_before := (_new_correct = 2);
        END IF;
      ELSIF NOT COALESCE(_correct, false) AND _new_level < 3 THEN
        _new_knew_before := false;
      END IF;

      _learned_now := (_new_level >= 3 AND _existing.learned_at IS NULL AND _new_knew_before IS DISTINCT FROM true);

      UPDATE public.letter_stats
      SET shown_count = _new_shown,
          correct_count = _new_correct,
          wrong_count = _new_wrong,
          level = _new_level,
          knew_before = _new_knew_before,
          learned_at = CASE WHEN _learned_now THEN now() ELSE _existing.learned_at END,
          time_to_learn_ms = CASE WHEN _learned_now THEN _new_total_ms ELSE _existing.time_to_learn_ms END,
          total_response_ms = _new_total_ms,
          last_seen_at = now()
      WHERE id = _existing.id AND user_id = _uid
      RETURNING * INTO _result;
      RETURN _result;
    END IF;

    BEGIN
      _new_shown := 1;
      _new_correct := CASE WHEN COALESCE(_correct, false) THEN 1 ELSE 0 END;
      _new_wrong := CASE WHEN COALESCE(_correct, false) THEN 0 ELSE 1 END;
      _new_level := CASE WHEN COALESCE(_correct, false) THEN 2 ELSE 1 END;
      _new_total_ms := _add_ms;

      INSERT INTO public.letter_stats (
        user_id, topic_id, letter_id, shown_count, correct_count, wrong_count, level,
        knew_before, learned_at, time_to_learn_ms, total_response_ms, first_seen_at, last_seen_at
      ) VALUES (
        _uid, _topic_id, _letter_id, _new_shown, _new_correct, _new_wrong, _new_level,
        NULL, NULL, NULL, _new_total_ms, now(), now()
      )
      RETURNING * INTO _result;
      RETURN _result;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_letter_answer(text, text, boolean, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_letter_answer(text, text, boolean, text, integer, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) Anonim analitik: game_sessions, screen_views, learning_milestones,
--    paywall_events (yalnız analitik izni veren kullanıcılar yazar)
-- ---------------------------------------------------------------------------
CREATE TABLE public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  game_id TEXT NOT NULL,
  topic_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  score INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  age_band TEXT,
  gender TEXT,
  platform TEXT,
  mode TEXT
);
CREATE INDEX idx_game_sessions_user ON public.game_sessions(user_id, started_at DESC);
CREATE INDEX idx_game_sessions_game ON public.game_sessions(game_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own sessions" ON public.game_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.game_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own sessions" ON public.game_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own game sessions" ON public.game_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all sessions" ON public.game_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.screen_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  path TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER,
  age_band TEXT,
  platform TEXT
);
CREATE INDEX idx_screen_views_user ON public.screen_views(user_id, opened_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screen_views TO authenticated;
GRANT ALL ON public.screen_views TO service_role;
ALTER TABLE public.screen_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own views" ON public.screen_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own views" ON public.screen_views
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users view own views" ON public.screen_views
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own screen views" ON public.screen_views
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all views" ON public.screen_views
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.learning_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id TEXT NOT NULL,
  letter_id TEXT NOT NULL,
  level SMALLINT NOT NULL,
  reached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  age_band TEXT,
  UNIQUE (user_id, topic_id, letter_id, level)
);
CREATE INDEX idx_milestones_user ON public.learning_milestones(user_id, topic_id, letter_id);
GRANT SELECT, INSERT, DELETE ON public.learning_milestones TO authenticated;
GRANT ALL ON public.learning_milestones TO service_role;
ALTER TABLE public.learning_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own milestones" ON public.learning_milestones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own milestones" ON public.learning_milestones
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own milestones" ON public.learning_milestones
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all milestones" ON public.learning_milestones
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.paywall_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  step TEXT NOT NULL,
  plan_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  age_band TEXT,
  platform TEXT
);
GRANT SELECT, INSERT, DELETE ON public.paywall_events TO authenticated;
GRANT ALL ON public.paywall_events TO service_role;
ALTER TABLE public.paywall_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own paywall" ON public.paywall_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own paywall" ON public.paywall_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own paywall events" ON public.paywall_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all paywall" ON public.paywall_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 6) ÖĞRENCİ BULUT SENKRONU (yeni)
--    Hoca/veli hesabına bağlı öğrenci profilleri + harf ilerlemeleri.
--    Bağlantı kodu ile başka cihaz/hesap aynı öğrenciye "veli" olarak
--    bağlanır → camide hocanın telefonunda başlayan ders, evde annenin
--    telefonunda kaldığı yerden devam eder.
-- ---------------------------------------------------------------------------
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🦁',
  link_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_owner ON public.students(owner_id);

-- Karışması zor bir 6 haneli kod üret (0/O/1/I gibi karakterler yok)
CREATE OR REPLACE FUNCTION public.generate_student_link_code()
RETURNS TRIGGER AS $$
DECLARE
  _alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVYZ23456789';
  _code TEXT;
  _i INT;
BEGIN
  IF NEW.link_code IS NOT NULL AND length(trim(NEW.link_code)) > 0 THEN
    NEW.link_code := upper(trim(NEW.link_code));
    RETURN NEW;
  END IF;
  LOOP
    _code := '';
    FOR _i IN 1..6 LOOP
      _code := _code || substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE link_code = _code);
  END LOOP;
  NEW.link_code := _code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER students_link_code BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.generate_student_link_code();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
REVOKE EXECUTE ON FUNCTION public.generate_student_link_code() FROM PUBLIC, anon, authenticated;

-- Kod ile bağlanan hesaplar (veli/ikinci cihaz)
CREATE TABLE public.student_guardians (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, guardian_id)
);

-- Erişim kontrolü: sahibi veya bağlı veli
CREATE OR REPLACE FUNCTION public.can_access_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id
      AND (s.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.student_guardians g
                      WHERE g.student_id = s.id AND g.guardian_id = auth.uid()))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_student(uuid) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own students" ON public.students
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Guardians view linked students" ON public.students
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_guardians g
                 WHERE g.student_id = id AND g.guardian_id = auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.student_guardians TO authenticated;
GRANT ALL ON public.student_guardians TO service_role;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guardians view own links" ON public.student_guardians
  FOR SELECT TO authenticated USING (auth.uid() = guardian_id);
CREATE POLICY "Owners view student guardians" ON public.student_guardians
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.owner_id = auth.uid()));
CREATE POLICY "Guardians remove own link" ON public.student_guardians
  FOR DELETE TO authenticated USING (auth.uid() = guardian_id);
CREATE POLICY "Owners remove guardians" ON public.student_guardians
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.owner_id = auth.uid()));

-- Bağlantı kodu ile öğrenciye bağlan (SECURITY DEFINER: kod doğruysa
-- öğrenciyi bulur, çağıranı veli olarak ekler ve öğrenciyi döndürür).
CREATE OR REPLACE FUNCTION public.claim_student_by_code(_code text)
RETURNS TABLE(id uuid, name text, emoji text, link_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _student public.students%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _student
  FROM public.students s
  WHERE s.link_code = upper(trim(_code))
  LIMIT 1;

  IF _student.id IS NULL THEN
    RAISE EXCEPTION 'invalid_link_code';
  END IF;

  IF _student.owner_id <> auth.uid() THEN
    INSERT INTO public.student_guardians (student_id, guardian_id)
    VALUES (_student.id, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT _student.id, _student.name, _student.emoji, _student.link_code;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_student_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_student_by_code(text) TO authenticated;

-- Öğrenci harf ilerlemesi (cihazdaki SRS ile aynı alanlar; ns = quiz/games)
CREATE TABLE public.student_letter_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  ns TEXT NOT NULL DEFAULT 'quiz',
  topic_id TEXT NOT NULL,
  letter_id TEXT NOT NULL,
  level SMALLINT NOT NULL DEFAULT 1,
  shown_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  consecutive_correct INTEGER NOT NULL DEFAULT 0,
  knew_before BOOLEAN,
  learned_at TIMESTAMPTZ,
  time_to_learn_ms BIGINT,
  total_response_ms BIGINT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, ns, topic_id, letter_id)
);
CREATE INDEX idx_student_letter_stats ON public.student_letter_stats(student_id, ns);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_letter_stats TO authenticated;
GRANT ALL ON public.student_letter_stats TO service_role;
ALTER TABLE public.student_letter_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Linked users manage student stats" ON public.student_letter_stats
  FOR ALL TO authenticated
  USING (public.can_access_student(student_id))
  WITH CHECK (public.can_access_student(student_id));
CREATE TRIGGER update_student_letter_stats_updated_at BEFORE UPDATE ON public.student_letter_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 7) İstatistik view'ları (Admin paneli — pazarlama + geliştirme metrikleri)
-- ---------------------------------------------------------------------------
CREATE VIEW public.analytics_game_popularity WITH (security_invoker=on) AS
SELECT
  game_id,
  COUNT(*)::int AS session_count,
  COUNT(DISTINCT user_id)::int AS unique_users,
  ROUND(AVG(NULLIF(duration_ms, 0))::numeric / 1000, 1) AS avg_seconds,
  ROUND(100.0 * SUM(CASE WHEN completed THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS completion_pct,
  ROUND(100.0 * SUM(correct) / NULLIF(SUM(correct + wrong), 0), 1) AS accuracy_pct
FROM public.game_sessions
GROUP BY game_id;

CREATE VIEW public.analytics_letter_learn_time WITH (security_invoker=on) AS
WITH first_seen AS (
  SELECT user_id, topic_id, letter_id, MIN(reached_at) AS first_at
  FROM public.learning_milestones WHERE level = 1
  GROUP BY user_id, topic_id, letter_id
),
mastered AS (
  SELECT user_id, topic_id, letter_id, MIN(reached_at) AS mastered_at
  FROM public.learning_milestones WHERE level >= 4
  GROUP BY user_id, topic_id, letter_id
)
SELECT m.topic_id, m.letter_id,
  COUNT(*)::int AS learners,
  ROUND(AVG(EXTRACT(EPOCH FROM (m.mastered_at - f.first_at)) / 60)::numeric, 1) AS avg_minutes
FROM mastered m JOIN first_seen f USING (user_id, topic_id, letter_id)
GROUP BY m.topic_id, m.letter_id;

CREATE VIEW public.analytics_daily_active WITH (security_invoker=on) AS
SELECT date_trunc('day', started_at)::date AS day,
  COUNT(DISTINCT user_id)::int AS dau,
  COUNT(*)::int AS sessions
FROM public.game_sessions GROUP BY 1 ORDER BY 1 DESC;

CREATE VIEW public.analytics_paywall_funnel WITH (security_invoker=on) AS
SELECT step, COUNT(*)::int AS events, COUNT(DISTINCT user_id)::int AS users
FROM public.paywall_events GROUP BY step;

CREATE VIEW public.analytics_age_breakdown WITH (security_invoker=on) AS
SELECT
  COALESCE(age_band, 'unknown') AS age_band,
  COALESCE(gender, 'x') AS gender,
  COUNT(DISTINCT user_id)::int AS users,
  COUNT(*)::int AS sessions,
  ROUND(100.0 * SUM(correct) / NULLIF(SUM(correct + wrong), 0), 1) AS accuracy_pct
FROM public.game_sessions GROUP BY 1, 2;

-- Öğrenme gücü: bilmediği harfi öğrenene kadar geçen GERÇEK cevap süresi
CREATE VIEW public.analytics_learning_power WITH (security_invoker=on) AS
SELECT
  count(*)::int AS learned_items,
  count(DISTINCT user_id)::int AS learners,
  round((avg(time_to_learn_ms)/1000.0)::numeric, 1) AS avg_seconds_per_item,
  round((avg(time_to_learn_ms)/60000.0)::numeric, 2) AS avg_minutes_per_item
FROM public.letter_stats
WHERE knew_before IS NOT TRUE
  AND learned_at IS NOT NULL
  AND time_to_learn_ms IS NOT NULL
  AND time_to_learn_ms > 0;

CREATE VIEW public.analytics_letter_power WITH (security_invoker=on) AS
SELECT
  topic_id,
  letter_id,
  count(*)::int AS learners,
  round((avg(time_to_learn_ms)/1000.0)::numeric, 1) AS avg_seconds,
  count(*) FILTER (WHERE knew_before IS TRUE)::int AS knew_before_count
FROM public.letter_stats
WHERE learned_at IS NOT NULL
  AND time_to_learn_ms IS NOT NULL
  AND time_to_learn_ms > 0
  AND knew_before IS NOT TRUE
GROUP BY topic_id, letter_id
ORDER BY avg_seconds ASC;

-- Öğrenme hızı: dakikada/saatte kaç yeni öğe (pazarlama metriği)
CREATE VIEW public.analytics_learning_rate WITH (security_invoker=on) AS
WITH learned AS (
  SELECT ls.user_id,
         COALESCE(NULLIF(mode_g.mode,''),'normal') AS mode,
         count(*) AS learned_items,
         sum(ls.time_to_learn_ms) AS learn_ms
  FROM public.letter_stats ls
  LEFT JOIN LATERAL (
    SELECT mode FROM public.answer_events ae
    WHERE ae.user_id = ls.user_id AND ae.topic_id = ls.topic_id AND ae.letter_id = ls.letter_id
    ORDER BY ae.created_at DESC LIMIT 1
  ) mode_g ON true
  WHERE ls.knew_before IS NOT TRUE AND ls.learned_at IS NOT NULL
    AND ls.time_to_learn_ms IS NOT NULL AND ls.time_to_learn_ms > 0
  GROUP BY ls.user_id, COALESCE(NULLIF(mode_g.mode,''),'normal')
)
SELECT mode,
       count(DISTINCT user_id)::int AS learners,
       sum(learned_items)::int AS learned_items,
       round(sum(learn_ms) / 60000.0, 1) AS active_minutes,
       round(sum(learned_items)::numeric / NULLIF(sum(learn_ms) / 60000.0, 0), 2) AS items_per_minute,
       round(sum(learned_items)::numeric * 60.0 / NULLIF(sum(learn_ms) / 60000.0, 0), 1) AS items_per_hour
FROM learned
GROUP BY mode;

CREATE VIEW public.analytics_game_engagement WITH (security_invoker=on) AS
SELECT game_id,
       COALESCE(NULLIF(mode,''),'normal') AS mode,
       count(*)::int AS sessions,
       count(DISTINCT user_id)::int AS unique_users,
       round(sum(COALESCE(duration_ms,0)) / 60000.0, 1) AS total_minutes,
       round(avg(NULLIF(duration_ms,0)) / 1000.0, 1) AS avg_seconds,
       round(100.0 * sum(CASE WHEN completed THEN 1 ELSE 0 END)::numeric / NULLIF(count(*),0)::numeric, 1) AS completion_pct,
       round(100.0 * sum(correct)::numeric / NULLIF(sum(correct + wrong),0)::numeric, 1) AS accuracy_pct
FROM public.game_sessions
GROUP BY game_id, COALESCE(NULLIF(mode,''),'normal')
ORDER BY total_minutes DESC NULLS LAST;

CREATE VIEW public.analytics_retention WITH (security_invoker=on) AS
WITH signups AS (
  SELECT p.user_id, date_trunc('week', p.created_at)::date AS cohort_week, p.created_at::date AS signup_day
  FROM public.profiles p
),
activity AS (
  SELECT user_id, started_at::date AS day FROM public.game_sessions
  UNION
  SELECT user_id, opened_at::date AS day FROM public.screen_views
)
SELECT s.cohort_week,
       count(DISTINCT s.user_id)::int AS cohort_size,
       round(100.0 * count(DISTINCT CASE WHEN a.day = s.signup_day + 1 THEN s.user_id END)::numeric
             / NULLIF(count(DISTINCT s.user_id),0), 1) AS d1_pct,
       round(100.0 * count(DISTINCT CASE WHEN a.day BETWEEN s.signup_day + 7 AND s.signup_day + 8 THEN s.user_id END)::numeric
             / NULLIF(count(DISTINCT s.user_id),0), 1) AS d7_pct,
       round(100.0 * count(DISTINCT CASE WHEN a.day BETWEEN s.signup_day + 30 AND s.signup_day + 31 THEN s.user_id END)::numeric
             / NULLIF(count(DISTINCT s.user_id),0), 1) AS d30_pct
FROM signups s
LEFT JOIN activity a ON a.user_id = s.user_id
GROUP BY s.cohort_week
ORDER BY s.cohort_week DESC;

CREATE VIEW public.analytics_super_vs_normal WITH (security_invoker=on) AS
SELECT COALESCE(NULLIF(mode,''),'normal') AS mode,
       count(DISTINCT user_id)::int AS users,
       count(*)::int AS sessions,
       round(avg(NULLIF(duration_ms,0)) / 1000.0, 1) AS avg_seconds,
       round(100.0 * sum(CASE WHEN completed THEN 1 ELSE 0 END)::numeric / NULLIF(count(*),0), 1) AS completion_pct,
       round(100.0 * sum(correct)::numeric / NULLIF(sum(correct + wrong),0), 1) AS accuracy_pct
FROM public.game_sessions
GROUP BY COALESCE(NULLIF(mode,''),'normal');

CREATE VIEW public.analytics_user_progress WITH (security_invoker=on) AS
WITH learned AS (
  SELECT ls.user_id,
         count(*) FILTER (WHERE ls.learned_at IS NOT NULL AND coalesce(ls.knew_before, false) = false) AS learned_items,
         count(*) FILTER (WHERE ls.knew_before = true) AS known_items,
         count(*) AS total_items_seen,
         sum(ls.shown_count) AS total_shown,
         sum(ls.correct_count) AS total_correct,
         sum(ls.time_to_learn_ms) FILTER (WHERE ls.learned_at IS NOT NULL AND coalesce(ls.knew_before, false) = false) AS learn_ms,
         max(ls.last_seen_at) AS last_active
  FROM public.letter_stats ls
  GROUP BY ls.user_id
),
mode_mix AS (
  SELECT user_id,
         mode,
         count(*) AS n,
         row_number() OVER (PARTITION BY user_id ORDER BY count(*) DESC) AS rn
  FROM public.answer_events
  WHERE mode IS NOT NULL
  GROUP BY user_id, mode
)
SELECT l.user_id,
       coalesce(nullif(p.pseudonym, ''), 'Öğrenci #' || substring(l.user_id::text, 1, 6)) AS pseudonym,
       p.age_band,
       p.gender,
       coalesce((SELECT mode FROM mode_mix m WHERE m.user_id = l.user_id AND m.rn = 1), 'normal') AS primary_mode,
       l.learned_items,
       l.known_items,
       l.total_items_seen,
       CASE WHEN l.learned_items > 0 THEN round((l.learn_ms / l.learned_items / 1000.0)::numeric, 1) END AS avg_seconds_per_learned_item,
       CASE WHEN l.learn_ms > 0 AND l.learned_items > 0 THEN round((l.learned_items::numeric / (l.learn_ms / 3600000.0))::numeric, 2) END AS items_per_active_hour,
       l.last_active,
       CASE WHEN l.total_shown > 0 THEN round((l.total_correct::numeric / l.total_shown * 100)::numeric, 1) END AS accuracy_pct
FROM learned l
LEFT JOIN public.profiles p ON p.user_id = l.user_id
WHERE coalesce(p.analytics_consent, false) = true OR p.user_id IS NULL;

CREATE VIEW public.analytics_user_letter_breakdown WITH (security_invoker=on) AS
SELECT ls.user_id,
       ls.topic_id,
       ls.letter_id,
       ls.level,
       ls.knew_before,
       ls.learned_at,
       ls.shown_count,
       ls.correct_count,
       CASE WHEN ls.time_to_learn_ms IS NOT NULL THEN round((ls.time_to_learn_ms / 1000.0)::numeric, 1) END AS seconds_to_learn,
       ls.last_seen_at
FROM public.letter_stats ls
LEFT JOIN public.profiles p ON p.user_id = ls.user_id
WHERE coalesce(p.analytics_consent, false) = true OR p.user_id IS NULL;

CREATE VIEW public.analytics_super_vs_normal_per_user WITH (security_invoker=on) AS
SELECT ae.user_id,
       coalesce(nullif(p.pseudonym, ''), 'Öğrenci #' || substring(ae.user_id::text, 1, 6)) AS pseudonym,
       ae.mode,
       count(*) AS events,
       count(*) FILTER (WHERE ae.correct) AS correct,
       round((avg(ae.response_ms)/1000.0)::numeric, 2) AS avg_seconds,
       CASE WHEN count(*) > 0 THEN round((count(*) FILTER (WHERE ae.correct)::numeric / count(*) * 100)::numeric, 1) END AS accuracy_pct
FROM public.answer_events ae
LEFT JOIN public.profiles p ON p.user_id = ae.user_id
WHERE ae.mode IS NOT NULL AND coalesce(p.analytics_consent, false) = true
GROUP BY ae.user_id, p.pseudonym, ae.mode;

GRANT SELECT ON public.analytics_game_popularity        TO authenticated;
GRANT SELECT ON public.analytics_letter_learn_time      TO authenticated;
GRANT SELECT ON public.analytics_daily_active           TO authenticated;
GRANT SELECT ON public.analytics_paywall_funnel         TO authenticated;
GRANT SELECT ON public.analytics_age_breakdown          TO authenticated;
GRANT SELECT ON public.analytics_learning_power         TO authenticated;
GRANT SELECT ON public.analytics_letter_power           TO authenticated;
GRANT SELECT ON public.analytics_learning_rate          TO authenticated;
GRANT SELECT ON public.analytics_game_engagement        TO authenticated;
GRANT SELECT ON public.analytics_retention              TO authenticated;
GRANT SELECT ON public.analytics_super_vs_normal        TO authenticated;
GRANT SELECT ON public.analytics_user_progress          TO authenticated;
GRANT SELECT ON public.analytics_user_letter_breakdown  TO authenticated;
GRANT SELECT ON public.analytics_super_vs_normal_per_user TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) İLK ADMİN: kayıt olduktan sonra kendi user_id'nle şunu çalıştır
--    (Dashboard → Authentication → Users listesinden id'yi kopyala):
--
--    INSERT INTO public.user_roles (user_id, role)
--    VALUES ('BURAYA-USER-ID', 'admin');
-- ---------------------------------------------------------------------------
