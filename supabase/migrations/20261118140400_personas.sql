-- Ritual Diario v2 — 5/6: gestión de personas y áreas (solo admin, CLAUDE.md §2)

create or replace function privado.exigir_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_admin() then
    raise exception 'Solo la admin puede hacer esto';
  end if;
end;
$$;

-- Invitar a alguien (después entra con el código que le llega por mail).
create or replace function public.invitar_persona(
  p_email text, p_nombre text, p_rol text default 'integrante', p_carga_ventas boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  perform privado.exigir_admin();
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El mail no parece válido';
  end if;
  if exists (select 1 from public.profiles where email = v_email) then
    raise exception 'Esa persona ya está en el equipo';
  end if;
  insert into public.team_invites (email, nombre, rol, carga_ventas, invitado_por)
  values (v_email, trim(p_nombre), p_rol, p_carga_ventas, auth.uid())
  on conflict (email) do update set nombre = excluded.nombre, rol = excluded.rol,
    carga_ventas = excluded.carga_ventas, invitado_por = excluded.invitado_por;
end;
$$;

-- Editar a una persona (nombre, rol, si carga ventas, alta/baja).
create or replace function public.actualizar_persona(
  p_id uuid, p_nombre text, p_rol text, p_activo boolean, p_carga_ventas boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_admin();
  if (p_rol <> 'admin' or not p_activo)
     and not exists (select 1 from public.profiles
                     where rol = 'admin' and activo and id <> p_id) then
    raise exception 'Tiene que quedar al menos una admin activa';
  end if;
  update public.profiles
  set nombre = trim(p_nombre), rol = p_rol, activo = p_activo, carga_ventas = p_carga_ventas
  where id = p_id;
  if not found then
    raise exception 'La persona no existe';
  end if;
  -- Al dar de baja, sus tareas futuras pendientes dejan de existir (la admin las reasigna).
  if not p_activo then
    perform privado.sincronizar_tarea(t.id) from public.task_templates t where t.responsable_id = p_id;
    delete from public.push_subscriptions where profile_id = p_id;
  end if;
end;
$$;

-- Asignar un área a una persona ('lider' o 'miembro'); p_rol_area null = quitarla del área.
create or replace function public.asignar_area(p_persona uuid, p_area uuid, p_rol_area text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_admin();
  if p_rol_area is null then
    delete from public.area_members where profile_id = p_persona and area_id = p_area;
  else
    insert into public.area_members (area_id, profile_id, rol_area)
    values (p_area, p_persona, p_rol_area)
    on conflict (area_id, profile_id) do update set rol_area = excluded.rol_area;
  end if;
end;
$$;

-- Cada persona puede cambiar su propio nombre.
create or replace function public.actualizar_mi_nombre(p_nombre text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if length(trim(coalesce(p_nombre, ''))) = 0 then
    raise exception 'Escribí tu nombre';
  end if;
  update public.profiles set nombre = trim(p_nombre) where id = auth.uid() and activo;
end;
$$;

-- Cancelar una invitación que todavía no se usó.
create or replace function public.cancelar_invitacion(p_email text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_admin();
  delete from public.team_invites where email = lower(trim(p_email));
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.invitar_persona(text, text, text, boolean) to authenticated;
grant execute on function public.actualizar_persona(uuid, text, text, boolean, boolean) to authenticated;
grant execute on function public.asignar_area(uuid, uuid, text) to authenticated;
grant execute on function public.actualizar_mi_nombre(text) to authenticated;
grant execute on function public.cancelar_invitacion(text) to authenticated;
revoke all on function privado.exigir_admin() from public, anon;
grant execute on function privado.exigir_admin() to authenticated;
