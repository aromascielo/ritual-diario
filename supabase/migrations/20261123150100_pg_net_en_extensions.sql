-- Aviso de seguridad de Supabase (extension_in_public): pg_net quedó registrada en el esquema public.
-- Se reinstala en "extensions". Sus funciones siguen en el esquema "net" (net.http_post), así que
-- privado.disparar_envio no cambia. Solo se pierden pedidos en cola de ese instante (no hay ninguno).
drop extension if exists pg_net;
create extension pg_net with schema extensions;
