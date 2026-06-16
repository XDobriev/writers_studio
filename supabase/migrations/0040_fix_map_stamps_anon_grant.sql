-- map_stamps имел GRANT для anon — лишняя поверхность атаки (RLS работает,
-- но принцип минимальных привилегий требует убрать доступ у неавторизованных).
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.map_stamps FROM anon;
