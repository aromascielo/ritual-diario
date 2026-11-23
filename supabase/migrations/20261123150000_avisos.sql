-- Fase 5: avisos (CLAUDE.md §7).
-- - Alertas para la admin (campana): tarea de otra persona vencida, objetivo atrasado (1 vez por semana),
--   área por debajo del 70 % al cierre de la semana. (Omitida y eliminada ya se generan en marcar_tarea/archivar_tarea.)
-- - Push al celular: aviso previo (tareas no diarias), vencida, resumen de las 9:00, comentarios y, si la admin
--   lo activa, sus alertas. Todo pasa por una cola (privado.push_cola) que vacía la función "notificaciones".
-- - Silencio de 22:00 a 8:00: en ese horario no se generan avisos de tareas y la cola no se envía
--   (lo acumulado sale a las 8:00). Las pruebas ("Probar aviso") salen siempre.
-- Las claves (VAPID, URL de la función y clave de envío) están en Vault, nunca en el repositorio.

create extension if not exists pg_net;

-- La admin elige si sus alertas también le llegan al celular (desactivado por defecto).
alter table public.profiles add column push_alertas boolean not null default false;

create table privado.push_cola (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null,
  cuerpo text,
  url text not null default '/#/hoy',
  clave text not null unique,          -- evita mandar dos veces el mismo aviso
  urgente boolean not null default false, -- sale aunque sea horario de silencio (solo "Probar aviso")
  created_at timestamptz not null default now(),
  enviado_at timestamptz
);
create index on privado.push_cola (enviado_at, created_at);
create index on privado.push_cola (destinatario_id);
revoke all on privado.push_cola from public, anon, authenticated;

-- Horario de silencio (22:00 a 8:00, hora Argentina).
create or replace function privado.es_silencio(p_ahora timestamptz default now()) returns boolean
language sql stable set search_path = '' as $$
  select extract(hour from p_ahora at time zone privado.tz()) not between 8 and 21
$$;

create or replace function privado.encolar(p_dest uuid, p_titulo text, p_cuerpo text, p_url text, p_clave text,
                                           p_urgente boolean default false)
returns void language sql security definer set search_path = '' as $$
  insert into privado.push_cola (destinatario_id, titulo, cuerpo, url, clave, urgente)
  values (p_dest, left(p_titulo, 120), left(p_cuerpo, 240), coalesce(p_url, '/#/hoy'), p_clave, p_urgente)
  on conflict (clave) do nothing
$$;

-- Pide a la función "notificaciones" que vacíe la cola (la llamada sale después del commit).
create or replace function privado.disparar_envio() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_clave text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notif_url';
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'notif_clave';
  if v_url is null or v_clave is null then
    return; -- todavía no configurado: los avisos quedan en la cola
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-clave', v_clave),
    timeout_milliseconds := 20000
  );
end;
$$;

-- Link que abre cada alerta.
create or replace function privado.url_alerta(n public.app_notifications) returns text
language sql immutable set search_path = '' as $$
  select case
    when n.instance_id is not null then '/#/tarea/' || n.instance_id
    when n.objective_id is not null then '/#/objetivo/' || n.objective_id
    when n.area_id is not null then '/#/area/' || n.area_id
    else '/#/alertas' end
$$;

-- Si la destinataria activó "alertas al celular", cada alerta nueva también va por push.
create or replace function privado.alerta_a_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = new.destinatario_id and push_alertas and activo) then
    perform privado.encolar(new.destinatario_id, new.titulo, new.cuerpo, privado.url_alerta(new), 'alerta:' || new.id);
    if current_setting('ritual.en_lote', true) is distinct from '1' then
      perform privado.disparar_envio();
    end if;
  end if;
  return new;
end;
$$;
create trigger alerta_a_push after insert on public.app_notifications
  for each row execute function privado.alerta_a_push();

-- Comentario nuevo: push a la responsable y a la admin (si no es la responsable). Nunca a quien comentó.
create or replace function privado.comentario_a_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  i public.task_instances;
  v_quien text;
begin
  select * into i from public.task_instances where id = new.instance_id;
  select split_part(nombre, ' ', 1) into v_quien from public.profiles where id = new.profile_id;
  perform privado.encolar(p.id, format('💬 %s comentó "%s"', v_quien, i.titulo), new.texto,
                          '/#/tarea/' || i.id, 'comentario:' || new.id || ':' || p.id)
  from public.profiles p
  where p.activo and p.id <> new.profile_id
    and (p.id = i.responsable_id or (p.rol = 'admin' and p.id <> i.responsable_id));
  perform privado.disparar_envio();
  return new;
end;
$$;
create trigger comentario_a_push after insert on public.task_comments
  for each row execute function privado.comentario_a_push();

-- Revisión de cada hora (pg_cron). p_ahora es parámetro para poder probarla.
create or replace function privado.preparar_avisos(p_ahora timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_tz text := privado.tz();
  v_local timestamp := p_ahora at time zone privado.tz();
  d date := (p_ahora at time zone privado.tz())::date;
  h int := extract(hour from p_ahora at time zone privado.tz());
  v_antes int;
  v_despues int;
  v_ids uuid[];
  r record;
begin
  if privado.es_silencio(p_ahora) then
    return 0;
  end if;
  -- Las alertas que se crean acá no disparan el envío una por una: el cron lo dispara al final.
  perform set_config('ritual.en_lote', '1', true);
  select count(*) into v_antes from privado.push_cola;

  -- 1) Vencidas sin completar (de los últimos 2 días, para no avisar cosas viejas).
  select coalesce(array_agg(i.id), '{}') into v_ids
  from public.task_instances i
  join public.task_templates t on t.id = i.template_id and t.activa
  where i.estado = 'pendiente' and i.fecha_limite < p_ahora and not i.notificada_vencida
    and i.fecha >= d - 2;

  -- Alerta a la admin si la tarea es de otra persona.
  insert into public.app_notifications (destinatario_id, tipo, titulo, cuerpo, instance_id)
  select p.id, 'tarea_vencida',
         format('⏰ A %s se le venció "%s"', split_part(r2.nombre, ' ', 1), v.titulo), 'Venció sin completar.', v.id
  from public.task_instances v
  join public.profiles r2 on r2.id = v.responsable_id
  join public.profiles p on p.rol = 'admin' and p.activo and p.id <> v.responsable_id
  where v.id = any(v_ids);

  -- Push a la responsable: uno por tarea, o uno solo si son varias.
  for r in
    select v.responsable_id, count(*) as n, min(v.id::text)::uuid as una,
           string_agg(v.titulo, ' · ' order by v.titulo) as titulos
    from public.task_instances v join public.profiles p on p.id = v.responsable_id and p.activo
    where v.id = any(v_ids)
    group by v.responsable_id
  loop
    if r.n = 1 then
      perform privado.encolar(r.responsable_id, '⏰ Venció sin completar', r.titulos, '/#/tarea/' || r.una,
                              'vencida:' || r.una);
    else
      perform privado.encolar(r.responsable_id, format('⏰ Vencieron %s tareas sin completar', r.n), r.titulos,
                              '/#/hoy', 'vencidas:' || r.responsable_id || ':' || to_char(v_local, 'YYYY-MM-DD HH24'));
    end if;
  end loop;
  update public.task_instances set notificada_vencida = true, notificada_previa = true
  where id = any(v_ids);

  -- 2) Aviso previo de tareas no diarias: "Mañana vence…" o "Hoy vence a las HH:MM…" (uno solo por tarea).
  for r in
    select i.id, i.responsable_id, i.titulo, i.fecha, i.sin_horario,
           to_char(i.fecha_limite at time zone v_tz, 'HH24:MI') as hhmm
    from public.task_instances i
    join public.task_templates t on t.id = i.template_id and t.activa and t.frecuencia <> 'diaria'
    join public.profiles p on p.id = i.responsable_id and p.activo
    where i.estado = 'pendiente' and not i.notificada_previa and i.fecha_limite >= p_ahora
      and i.fecha between d and d + 1
  loop
    perform privado.encolar(r.responsable_id,
      case when r.fecha = d then
             case when r.sin_horario then '📅 Hoy vence' else '📅 Hoy vence a las ' || r.hhmm end
           else
             case when r.sin_horario then '📅 Mañana vence' else '📅 Mañana vence a las ' || r.hhmm end
      end,
      r.titulo, '/#/tarea/' || r.id, 'previa:' || r.id);
    update public.task_instances set notificada_previa = true where id = r.id;
  end loop;

  -- 3) Resumen de las 9:00: "Hoy tenés N tareas" (incluye las vencidas pendientes).
  if h = 9 then
    for r in
      select p.id,
             count(*) filter (where i.fecha = d) as hoy,
             count(*) filter (where i.fecha < d or i.fecha_limite < p_ahora) as vencidas
      from public.profiles p
      join public.task_instances i on i.responsable_id = p.id and i.estado = 'pendiente'
      join public.task_templates t on t.id = i.template_id and t.activa
      where p.activo and i.fecha between d - 60 and d
      group by p.id
    loop
      if r.hoy + r.vencidas > 0 then
        perform privado.encolar(r.id,
          case when r.hoy + r.vencidas = 1 then '☀️ Hoy tenés 1 tarea' else format('☀️ Hoy tenés %s tareas', r.hoy + r.vencidas) end,
          case when r.vencidas = 0 then 'Que tengas un lindo día 🌿'
               when r.vencidas = 1 then 'Incluye 1 vencida.'
               else format('Incluye %s vencidas.', r.vencidas) end,
          '/#/hoy', 'resumen:' || r.id || ':' || d);
      end if;
    end loop;

    -- 4) Objetivos atrasados: una alerta por objetivo y por semana.
    insert into public.app_notifications (destinatario_id, tipo, titulo, cuerpo, objective_id)
    select p.id, 'objetivo_atrasado', format('🐢 "%s" va atrasado', o.titulo),
           case when a.ritmo is not null
                then format('Va %s %% y el ritmo esperado es %s %%.', round(coalesce(a.porcentaje, 0)), round(a.ritmo))
                else 'Está por debajo de la meta.' end,
           o.id
    from public.avance_objetivos(d) a
    join public.objectives o on o.id = a.objective_id and o.estado = 'activo' and o.fecha_inicio <= d
    join public.profiles p on p.rol = 'admin' and p.activo
    where a.atrasado
      and not exists (select 1 from public.app_notifications n
                      where n.tipo = 'objetivo_atrasado' and n.objective_id = o.id and n.destinatario_id = p.id
                        and n.created_at > p_ahora - interval '7 days');
  end if;

  -- 5) Domingo 20:00: áreas por debajo del 70 % al día en la semana.
  if extract(isodow from d) = 7 and h = 20 then
    insert into public.app_notifications (destinatario_id, tipo, titulo, cuerpo, area_id)
    select p.id, 'area_bajo_cumplimiento', format('📉 %s %s cerró la semana con %s %% al día', a.emoji, a.nombre, round(c.porcentaje)),
           format('%s hechas de %s que vencieron.', c.hechas, c.hechas + c.vencidas), a.id
    from public.cumplimiento(d - 6, d) c
    join public.areas a on a.id = c.ref_id and a.activa
    join public.profiles p on p.rol = 'admin' and p.activo
    where c.tipo = 'area' and c.porcentaje < 70
      and not exists (select 1 from public.app_notifications n
                      where n.tipo = 'area_bajo_cumplimiento' and n.area_id = a.id and n.destinatario_id = p.id
                        and n.created_at > p_ahora - interval '6 days');
  end if;

  select count(*) into v_despues from privado.push_cola;
  return v_despues - v_antes;
end;
$$;

-- Para la función "notificaciones" (se conecta directo a la base). Toma los avisos pendientes
-- (marcándolos como enviados para que dos llamadas a la vez no manden doble) con las suscripciones.
create or replace function privado.tomar_cola(p_ahora timestamptz default now())
returns table (cola_id uuid, titulo text, cuerpo text, url text, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = '' as $$
declare
  v_silencio boolean := privado.es_silencio(p_ahora);
begin
  -- Lo que tiene más de 2 días ya no sirve: se descarta.
  update privado.push_cola set enviado_at = p_ahora
  where enviado_at is null and created_at < p_ahora - interval '2 days';

  return query
  with tomados as (
    update privado.push_cola c set enviado_at = p_ahora
    where c.id in (select x.id from privado.push_cola x
                   where x.enviado_at is null and (x.urgente or not v_silencio)
                   order by x.created_at limit 300 for update skip locked)
    returning c.id, c.destinatario_id, c.titulo, c.cuerpo, c.url
  )
  select t.id, t.titulo, t.cuerpo, t.url, s.endpoint, s.p256dh, s.auth
  from tomados t join public.push_subscriptions s on s.profile_id = t.destinatario_id;
end;
$$;

create or replace function privado.clave_envio_ok(p_clave text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'notif_clave' and decrypted_secret = p_clave)
$$;

create or replace function privado.config_push()
returns table (publica text, privada text, sujeto text)
language sql stable security definer set search_path = '' as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_publica'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_privada'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_sujeto')
$$;

-- Ninguna de estas es para la app: solo las usan el cron y la función "notificaciones".
revoke execute on function privado.es_silencio(timestamptz) from public, anon;
revoke execute on function privado.encolar(uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function privado.disparar_envio() from public, anon, authenticated;
revoke execute on function privado.url_alerta(public.app_notifications) from public, anon;
revoke execute on function privado.alerta_a_push() from public, anon, authenticated;
revoke execute on function privado.comentario_a_push() from public, anon, authenticated;
revoke execute on function privado.preparar_avisos(timestamptz) from public, anon, authenticated;
revoke execute on function privado.tomar_cola(timestamptz) from public, anon, authenticated;
revoke execute on function privado.clave_envio_ok(text) from public, anon, authenticated;
revoke execute on function privado.config_push() from public, anon, authenticated;

-- Funciones para la app ---------------------------------------------------------

-- Guarda la suscripción push de este dispositivo para la persona que entró
-- (si el celular lo usaba otra persona, pasa a la nueva).
create or replace function public.guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_equipo() then
    raise exception 'Tu cuenta no está activa en el equipo';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Suscripción no válida';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300));
end;
$$;

-- La admin activa o desactiva que sus alertas también le lleguen al celular.
create or replace function public.mis_avisos(p_push_alertas boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_equipo() then
    raise exception 'Tu cuenta no está activa en el equipo';
  end if;
  update public.profiles set push_alertas = coalesce(p_push_alertas, false) where id = auth.uid();
end;
$$;

-- "Probar aviso": manda un push a los dispositivos de quien lo pide (sale aunque sea de noche).
create or replace function public.probar_aviso() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not privado.es_equipo() then
    raise exception 'Tu cuenta no está activa en el equipo';
  end if;
  select count(*) into n from public.push_subscriptions where profile_id = auth.uid();
  perform privado.encolar(auth.uid(), '🌿 ¡Los avisos funcionan!', 'Así te van a llegar las tareas de Ritual Diario.',
                          '/#/config', 'prueba:' || auth.uid() || ':' || clock_timestamp(), true);
  perform privado.disparar_envio();
  return n;
end;
$$;

-- Marcar todas mis alertas como leídas.
create or replace function public.leer_alertas() returns void
language sql security invoker set search_path = '' as $$
  update public.app_notifications set leida = true where destinatario_id = auth.uid() and not leida
$$;

revoke execute on function public.guardar_suscripcion(text, text, text, text) from public, anon;
revoke execute on function public.mis_avisos(boolean) from public, anon;
revoke execute on function public.probar_aviso() from public, anon;
revoke execute on function public.leer_alertas() from public, anon;
grant execute on function public.guardar_suscripcion(text, text, text, text) to authenticated;
grant execute on function public.mis_avisos(boolean) to authenticated;
grant execute on function public.probar_aviso() to authenticated;
grant execute on function public.leer_alertas() to authenticated;

-- Revisión de cada hora en punto (hora Argentina = UTC-3, siempre hora entera).
select cron.schedule('avisos', '0 * * * *', $$select privado.preparar_avisos(); select privado.disparar_envio();$$);
