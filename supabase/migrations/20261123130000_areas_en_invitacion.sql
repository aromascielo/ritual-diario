-- Fase 3: al invitar a alguien se eligen sus áreas (y su rol en cada una).
-- Se guardan en la invitación y se aplican solas en su primer ingreso.

alter table public.team_invites
  add column areas jsonb not null default '[]'::jsonb
  check (jsonb_typeof(areas) = 'array');

comment on column public.team_invites.areas is
  'Áreas que se asignan en el primer ingreso: [{"area_id": uuid, "rol_area": "lider"|"miembro"}]';

drop function if exists public.invitar_persona(text, text, text, boolean);

create or replace function public.invitar_persona(
  p_email text, p_nombre text, p_rol text default 'integrante', p_carga_ventas boolean default false,
  p_areas jsonb default '[]'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_areas jsonb := coalesce(p_areas, '[]'::jsonb);
begin
  perform privado.exigir_admin();
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El mail no parece válido';
  end if;
  if length(trim(coalesce(p_nombre, ''))) = 0 then
    raise exception 'Escribí el nombre de la persona';
  end if;
  if exists (select 1 from public.profiles where email = v_email) then
    raise exception 'Esa persona ya está en el equipo';
  end if;
  if jsonb_typeof(v_areas) <> 'array' then
    raise exception 'Las áreas no tienen el formato correcto';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_areas) e
    where coalesce(e->>'rol_area', '') not in ('lider', 'miembro')
       or not exists (select 1 from public.areas a where a.id::text = e->>'area_id' and a.activa)
  ) then
    raise exception 'Alguna de las áreas elegidas no existe o está archivada';
  end if;

  insert into public.team_invites (email, nombre, rol, carga_ventas, invitado_por, areas)
  values (v_email, trim(p_nombre), p_rol, p_carga_ventas, auth.uid(), v_areas)
  on conflict (email) do update set nombre = excluded.nombre, rol = excluded.rol,
    carga_ventas = excluded.carga_ventas, invitado_por = excluded.invitado_por, areas = excluded.areas;
end;
$$;

revoke execute on function public.invitar_persona(text, text, text, boolean, jsonb) from public, anon;
grant execute on function public.invitar_persona(text, text, text, boolean, jsonb) to authenticated;

create or replace function privado.al_crear_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.team_invites;
begin
  select * into v_inv from public.team_invites where email = lower(new.email);
  if not found then
    raise exception 'Este mail no está invitado a Ritual Diario';
  end if;
  insert into public.profiles (id, nombre, email, rol, carga_ventas)
  values (new.id, v_inv.nombre, lower(new.email), v_inv.rol, v_inv.carga_ventas);

  -- Áreas elegidas al invitar (se ignoran las que se archivaron mientras tanto).
  insert into public.area_members (area_id, profile_id, rol_area)
  select a.id, new.id, e->>'rol_area'
  from jsonb_array_elements(v_inv.areas) e
  join public.areas a on a.id::text = e->>'area_id' and a.activa
  where e->>'rol_area' in ('lider', 'miembro')
  on conflict (area_id, profile_id) do update set rol_area = excluded.rol_area;

  delete from public.team_invites where email = v_inv.email;
  return new;
end;
$$;
revoke all on function privado.al_crear_usuario() from public, anon, authenticated;
