ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_dictionary text[] DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.append_user_dictionary_word(
  p_user_id uuid,
  p_word    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET user_dictionary = array_append(user_dictionary, p_word)
  WHERE user_id = p_user_id
    AND NOT (user_dictionary @> ARRAY[p_word]);
END;
$$;
