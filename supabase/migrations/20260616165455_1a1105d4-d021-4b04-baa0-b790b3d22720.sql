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
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF _topic_id IS NULL OR length(trim(_topic_id)) = 0 OR _letter_id IS NULL OR length(trim(_letter_id)) = 0 THEN
    RAISE EXCEPTION 'invalid_answer_target';
  END IF;

  IF _response_ms IS NOT NULL AND _response_ms > 0 THEN
    _add_ms := LEAST(_response_ms, 60000)::bigint;
  END IF;

  INSERT INTO public.answer_events (user_id, topic_id, letter_id, game_id, correct, response_ms, mode)
  VALUES (_uid, _topic_id, _letter_id, _game_id, COALESCE(_correct, false), _response_ms, _mode);

  SELECT * INTO _existing
  FROM public.letter_stats
  WHERE user_id = _uid AND topic_id = _topic_id AND letter_id = _letter_id
  FOR UPDATE;

  IF FOUND THEN
    _new_shown := _existing.shown_count + 1;
    _new_correct := _existing.correct_count + CASE WHEN COALESCE(_correct, false) THEN 1 ELSE 0 END;
    _new_wrong := _existing.wrong_count + CASE WHEN COALESCE(_correct, false) THEN 0 ELSE 1 END;
    _new_level := CASE WHEN COALESCE(_correct, false)
      THEN LEAST(4, _existing.level + 1)
      ELSE GREATEST(1, _existing.level - 1)
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
    WHERE id = _existing.id
    RETURNING * INTO _result;
  ELSE
    _new_shown := 1;
    _new_correct := CASE WHEN COALESCE(_correct, false) THEN 1 ELSE 0 END;
    _new_wrong := CASE WHEN COALESCE(_correct, false) THEN 0 ELSE 1 END;
    _new_level := CASE WHEN COALESCE(_correct, false) THEN 2 ELSE 1 END;
    _new_total_ms := _add_ms;
    _new_knew_before := NULL;
    _learned_now := (_new_level >= 3 AND _new_knew_before IS DISTINCT FROM true);

    INSERT INTO public.letter_stats (
      user_id, topic_id, letter_id, shown_count, correct_count, wrong_count, level,
      knew_before, learned_at, time_to_learn_ms, total_response_ms, first_seen_at, last_seen_at
    ) VALUES (
      _uid, _topic_id, _letter_id, _new_shown, _new_correct, _new_wrong, _new_level,
      _new_knew_before,
      CASE WHEN _learned_now THEN now() ELSE NULL END,
      CASE WHEN _learned_now THEN _new_total_ms ELSE NULL END,
      _new_total_ms, now(), now()
    )
    RETURNING * INTO _result;
  END IF;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_letter_answer(text, text, boolean, text, integer, text) TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letter_stats TO authenticated;
GRANT ALL ON public.letter_stats TO service_role;
GRANT INSERT ON public.answer_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answer_events TO authenticated;
GRANT ALL ON public.answer_events TO service_role;