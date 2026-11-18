-- Ritual Diario v2 — 3/6: tareas (CLAUDE.md §4)
-- Generación de instancias, guardar/archivar tareas y cambiar su estado.
-- Todo por funciones RPC: una sola llamada guarda plantilla + áreas + instancias
-- (en la v1 eran varias llamadas sueltas y quedaban datos a medias).

alter default privileges in schema privado revoke execute on functions from public;

-- ¿A esta plantilla le toca el día d? -------------------------------------
create or replace function privado.toca_el_dia(
  p_frecuencia text, p_fecha_unica date, p_dias_semana int[], p_dia_mes int, d date
) returns boolean
language sql immutable set search_path = '' as $$
  select case p_frecuencia
    when 'unica'   then d = p_fecha_unica
    when 'diaria'  then true
    when 'semanal' then extract(isodow from d)::int = any (p_dias_semana)
    when 'mensual' then extract(day from d)::int = (
      with u as (select extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int as ultimo)
      select case when p_dia_mes = 0 then ultimo else least(p_dia_mes, ultimo) end from u)
    else false
  end
$$;

create or replace function privado.fecha_limite(d date, h time) returns timestamptz
language sql stable set search_path = '' as $$
  select (d + coalesce(h, time '23:59'))::timestamp at time zone privado.tz()
$$;

-- Genera instancias faltantes (próximos p_dias días; las únicas, en su fecha) ----
create or replace function privado.generar_instancias(p_template uuid default null, p_dias int default 14)
returns void
language sql security definer set search_path = '' as $$
  with dias as (
    select (privado.hoy() + g)::date as d from generate_series(0, p_dias - 1) g
  ),
  cand as (
    select t.id, t.responsable_id, t.titulo, d.d as fecha, t.hora_limite, t.peso, t.objective_id
    from public.task_templates t
    join public.profiles p on p.id = t.responsable_id and p.activo
    cross join dias d
    where t.activa and t.frecuencia <> 'unica'
      and (p_template is null or t.id = p_template)
      and privado.toca_el_dia(t.frecuencia, t.fecha_unica, t.dias_semana, t.dia_mes, d.d)
    union all
    select t.id, t.responsable_id, t.titulo, t.fecha_unica, t.hora_limite, t.peso, t.objective_id
    from public.task_templates t
    join public.profiles p on p.id = t.responsable_id and p.activo
    where t.activa and t.frecuencia = 'unica'
      and (p_template is null or t.id = p_template)
  ),
  nuevas as (
    insert into public.task_instances
      (template_id, responsable_id, titulo, fecha, fecha_limite, sin_horario, peso, objective_id)
    select id, responsable_id, titulo, fecha, privado.fecha_limite(fecha, hora_limite),
           hora_limite is null, peso, objective_id
    from cand
    on conflict (template_id, fecha) do nothing
    returning id, template_id
  )
  insert into public.task_instance_areas (instance_id, area_id)
  select n.id, ta.area_id
  from nuevas n join public.task_template_areas ta on ta.template_id = n.template_id
  on conflict do nothing;
$$;

-- Aplica los datos actuales de una plantilla a sus instancias pendientes de hoy
-- en adelante: borra las que ya no corresponden, actualiza el resto (sin moverlas
-- de día, así no hay duplicados) y genera las que falten.
create or replace function privado.sincronizar_tarea(p_template uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.task_templates;
  v_hoy date := privado.hoy();
begin
  select * into t from public.task_templates where id = p_template;
  if not found then return; end if;

  delete from public.task_instances i
  where i.template_id = t.id and i.estado = 'pendiente' and i.fecha >= v_hoy
    and (not t.activa
         or not privado.toca_el_dia(t.frecuencia, t.fecha_unica, t.dias_semana, t.dia_mes, i.fecha)
         or not exists (select 1 from public.profiles p where p.id = t.responsable_id and p.activo));

  update public.task_instances i
  set titulo = t.titulo,
      responsable_id = t.responsable_id,
      peso = t.peso,
      objective_id = t.objective_id,
      sin_horario = t.hora_limite is null,
      fecha_limite = privado.fecha_limite(i.fecha, t.hora_limite),
      notificada_previa = case when i.fecha_limite is distinct from privado.fecha_limite(i.fecha, t.hora_limite)
                                 or i.responsable_id is distinct from t.responsable_id
                               then false else i.notificada_previa end,
      notificada_vencida = case when i.fecha_limite is distinct from privado.fecha_limite(i.fecha, t.hora_limite)
                                  or i.responsable_id is distinct from t.responsable_id
                                then false else i.notificada_vencida end
  where i.template_id = t.id and i.estado = 'pendiente' and i.fecha >= v_hoy;

  delete from public.task_instance_areas ia
  using public.task_instances i
  where ia.instance_id = i.id and i.template_id = t.id and i.estado = 'pendiente' and i.fecha >= v_hoy
    and not exists (select 1 from public.task_template_areas ta
                    where ta.template_id = t.id and ta.area_id = ia.area_id);

  insert into public.task_instance_areas (instance_id, area_id)
  select i.id, ta.area_id
  from public.task_instances i join public.task_template_areas ta on ta.template_id = i.template_id
  where i.template_id = t.id and i.estado = 'pendiente' and i.fecha >= v_hoy
  on conflict do nothing;

  if t.activa then
    perform privado.generar_instancias(t.id);
  end if;
end;
$$;

-- ¿La persona actual puede crear/gestionar una tarea así? (CLAUDE.md §2) ----
-- Admin: siempre. En cada área elegida: líder, o miembro creando una única para sí misma.
-- La responsable tiene que pertenecer a alguna de las áreas.
create or replace function privado.puede_tarea(p_frecuencia text, p_responsable uuid, p_areas uuid[])
returns boolean
language sql stable set search_path = '' as $$
  select privado.es_admin() or (
    cardinality(p_areas) > 0
    and (select bool_and(privado.es_lider(a)
                         or (p_frecuencia = 'unica' and p_responsable = auth.uid() and privado.es_miembro(a)))
         from unnest(p_areas) a)
    and exists (select 1 from unnest(p_areas) a where privado.es_miembro(a, p_responsable))
  )
$$;

create or replace function privado.puede_editar_tarea(p_template uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.es_admin() or exists (
    select 1 from public.task_templates t
    where t.id = p_template
      and (t.creado_por = auth.uid() or t.responsable_id = auth.uid())
      and privado.puede_tarea(t.frecuencia, t.responsable_id,
            array(select area_id from public.task_template_areas where template_id = t.id)))
$$;

-- RPC: crear o editar una tarea -----------------------------------------
create or replace function public.guardar_tarea(
  p_id uuid,
  p_titulo text,
  p_responsable uuid,
  p_frecuencia text,
  p_areas uuid[],
  p_descripcion text default null,
  p_fecha_unica date default null,
  p_dias_semana int[] default null,
  p_dia_mes int default null,
  p_hora_limite time default null,
  p_peso int default 1,
  p_objective uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := p_id;
  v_areas uuid[] := array(select distinct a from unnest(coalesce(p_areas, '{}')) a);
begin
  if not privado.es_equipo() then
    raise exception 'No tenés acceso a Ritual Diario';
  end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then
    raise exception 'La tarea necesita un título';
  end if;
  if cardinality(v_areas) = 0 then
    raise exception 'Elegí al menos un área';
  end if;
  if exists (select 1 from unnest(v_areas) a
             where not exists (select 1 from public.areas ar where ar.id = a and ar.activa)) then
    raise exception 'Alguna de las áreas elegidas no existe o está archivada';
  end if;
  if not exists (select 1 from public.profiles where id = p_responsable and activo) then
    raise exception 'La responsable elegida no está activa en el equipo';
  end if;
  if p_frecuencia = 'unica' and p_fecha_unica is null then
    raise exception 'Elegí la fecha de la tarea';
  end if;
  if p_frecuencia = 'unica' and p_id is null and p_fecha_unica < privado.hoy() then
    raise exception 'La fecha no puede ser anterior a hoy';
  end if;
  if p_objective is not null
     and not exists (select 1 from public.objectives where id = p_objective and estado = 'activo') then
    raise exception 'El objetivo elegido no está activo';
  end if;

  if not privado.puede_tarea(p_frecuencia, p_responsable, v_areas) then
    raise exception 'No tenés permiso para crear o asignar esta tarea en esas áreas';
  end if;

  if p_id is null then
    insert into public.task_templates
      (titulo, descripcion, responsable_id, creado_por, frecuencia, fecha_unica, dias_semana,
       dia_mes, hora_limite, peso, objective_id)
    values
      (trim(p_titulo), nullif(trim(p_descripcion), ''), p_responsable, v_uid, p_frecuencia,
       case when p_frecuencia = 'unica' then p_fecha_unica end,
       case when p_frecuencia = 'semanal' then (select array_agg(distinct x order by x) from unnest(p_dias_semana) x) end,
       case when p_frecuencia = 'mensual' then p_dia_mes end,
       p_hora_limite, coalesce(p_peso, 1), p_objective)
    returning id into v_id;
  else
    if not privado.puede_editar_tarea(p_id) then
      raise exception 'No podés editar esta tarea';
    end if;
    update public.task_templates set
      titulo = trim(p_titulo),
      descripcion = nullif(trim(p_descripcion), ''),
      responsable_id = p_responsable,
      frecuencia = p_frecuencia,
      fecha_unica = case when p_frecuencia = 'unica' then p_fecha_unica end,
      dias_semana = case when p_frecuencia = 'semanal' then (select array_agg(distinct x order by x) from unnest(p_dias_semana) x) end,
      dia_mes = case when p_frecuencia = 'mensual' then p_dia_mes end,
      hora_limite = p_hora_limite,
      peso = coalesce(p_peso, 1),
      objective_id = p_objective,
      updated_at = now()
    where id = p_id;
    if not found then
      raise exception 'La tarea no existe';
    end if;
    delete from public.task_template_areas where template_id = p_id and area_id <> all (v_areas);
  end if;

  insert into public.task_template_areas (template_id, area_id)
  select v_id, a from unnest(v_areas) a
  on conflict do nothing;

  perform privado.sincronizar_tarea(v_id);
  return v_id;
end;
$$;

-- RPC: eliminar (archivar) una tarea — conserva el historial ----------------
create or replace function public.archivar_tarea(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.puede_editar_tarea(p_id) then
    raise exception 'No podés eliminar esta tarea';
  end if;
  update public.task_templates set activa = false, updated_at = now() where id = p_id;
  perform privado.sincronizar_tarea(p_id);
end;
$$;

-- RPC: marcar una instancia como hecha / omitida / pendiente ----------------
create or replace function public.marcar_tarea(
  p_instancia uuid,
  p_estado text,
  p_motivo text default null,
  p_cantidad numeric default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  i public.task_instances;
  v_tipo_obj text;
  v_nombre text;
begin
  select * into i from public.task_instances where id = p_instancia for update;
  if not found then
    raise exception 'La tarea no existe';
  end if;
  if not (privado.es_admin() or (i.responsable_id = v_uid and privado.es_equipo())) then
    raise exception 'Solo la responsable o la admin pueden cambiar esta tarea';
  end if;

  -- Siempre se descarta el aporte anterior de esta tarea (se vuelve a cargar si corresponde).
  delete from public.objective_aportes where instance_id = i.id;

  if p_estado = 'hecha' then
    update public.task_instances set estado = 'hecha', completada_por = v_uid, completada_at = now(),
      omitida_motivo = null, omitida_por = null, omitida_at = null
    where id = i.id;
    if i.objective_id is not null and coalesce(p_cantidad, 0) > 0 then
      select tipo_medicion into v_tipo_obj from public.objectives where id = i.objective_id;
      if v_tipo_obj = 'numerico' then
        insert into public.objective_aportes (objective_id, instance_id, cantidad, cargado_por)
        values (i.objective_id, i.id, p_cantidad, v_uid);
      end if;
    end if;

  elsif p_estado = 'omitida' then
    if length(trim(coalesce(p_motivo, ''))) < 3 then
      raise exception 'Escribí el motivo para omitir la tarea';
    end if;
    update public.task_instances set estado = 'omitida', omitida_motivo = trim(p_motivo),
      omitida_por = v_uid, omitida_at = now(), completada_por = null, completada_at = null
    where id = i.id;
    select nombre into v_nombre from public.profiles where id = v_uid;
    insert into public.app_notifications (destinatario_id, tipo, titulo, cuerpo, instance_id)
    select p.id, 'tarea_omitida',
           format('⏭️ %s omitió "%s"', v_nombre, i.titulo),
           'Motivo: ' || trim(p_motivo), i.id
    from public.profiles p
    where p.rol = 'admin' and p.activo and p.id <> v_uid;

  elsif p_estado = 'pendiente' then
    update public.task_instances set estado = 'pendiente', completada_por = null, completada_at = null,
      omitida_motivo = null, omitida_por = null, omitida_at = null
    where id = i.id;

  else
    raise exception 'Estado no válido: %', p_estado;
  end if;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.guardar_tarea(uuid, text, uuid, text, uuid[], text, date, int[], int, time, int, uuid) to authenticated;
grant execute on function public.archivar_tarea(uuid) to authenticated;
grant execute on function public.marcar_tarea(uuid, text, text, numeric) to authenticated;
revoke all on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated;
-- Estas dos solo las usan otras funciones (que corren como dueño), no la gente.
revoke execute on function privado.generar_instancias(uuid, int) from authenticated;
revoke execute on function privado.sincronizar_tarea(uuid) from authenticated;
