-- append_user_dictionary_word — SECURITY DEFINER без проверки вызывающего.
-- Любой авторизованный мог дописать слова в словарь другого пользователя.
-- Фикс: проверяем auth.uid() = p_user_id перед обновлением.
CREATE OR REPLACE FUNCTION public.append_user_dictionary_word(
  p_user_id uuid,
  p_word    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET user_dictionary = array_append(user_dictionary, p_word)
  WHERE user_id = p_user_id
    AND NOT (user_dictionary @> ARRAY[p_word]);
END;
$$;
