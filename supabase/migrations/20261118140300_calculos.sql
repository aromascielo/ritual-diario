-- Ritual Diario v2 — 4/6: cálculos (CLAUDE.md §4 y §5)
-- Única fuente de verdad para cumplimiento, avance de objetivos y plan VEA.
-- La app y la función de notificaciones consultan estas funciones; no se recalcula en JavaScript.
-- Son security invoker: respetan RLS (el equipo lee todo).

-- Cumplimiento "al día": hechas / (hechas + pendientes ya vencidas). Omitidas no cuentan.
create or replace function public.cumplimiento(p_desde date, p_hasta date)
returns table (tipo text, ref_id uuid, hechas int, vencidas int, porcentaje numeric)
language sql stable set search_path = '' as $$
  with base as (
    select i.id, i.responsable_id, i.estado = 'hecha' as hecha,
           (i.estado = 'pendiente' and i.fecha_limite < now()) as vencida
    from public.task_instances i
    where i.fecha between p_desde and p_hasta and i.estado <> 'omitida'
  ),
  agrupado as (
    select 'persona'::text as tipo, b.responsable_id as ref_id,
           count(*) filter (where b.hecha)::int as hechas, count(*) filter (where b.vencida)::int as vencidas
    from base b group by b.responsable_id
    union all
    select 'area', ia.area_id,
           count(*) filter (where b.hecha)::int, count(*) filter (where b.vencida)::int
    from base b join public.task_instance_areas ia on ia.instance_id = b.id group by ia.area_id
    union all
    select 'equipo', null::uuid,
           count(*) filter (where b.hecha)::int, count(*) filter (where b.vencida)::int
    from base b
  )
  select a.tipo, a.ref_id, a.hechas, a.vencidas,
         round(100.0 * a.hechas / nullif(a.hechas + a.vencidas, 0), 1)
  from agrupado a
$$;

-- Valor de un objetivo entre dos fechas (según su forma de medir).
create or replace function privado.valor_objetivo(p_obj uuid, p_desde date, p_hasta date)
returns numeric
language plpgsql stable set search_path = '' as $$
declare
  o public.objectives;
  v numeric;
begin
  select * into o from public.objectives where id = p_obj;
  if not found then return null; end if;

  case o.tipo_medicion
    when 'tareas' then
      select coalesce(round(100.0 * sum(peso) filter (where estado = 'hecha') / nullif(sum(peso), 0), 1), 0)
      into v from public.task_instances
      where objective_id = o.id and fecha between p_desde and p_hasta and estado <> 'omitida';
    when 'numerico' then
      select coalesce(sum(cantidad), 0) into v from public.objective_aportes
      where objective_id = o.id
        and (created_at at time zone privado.tz())::date between p_desde and p_hasta;
    when 'ventas' then
      select coalesce(sum(monto), 0) into v from public.ventas
      where fecha between p_desde and p_hasta and (o.canal_ventas is null or canal = o.canal_ventas);
    when 'proporcion_ventas' then
      select round(100.0 * sum(monto) filter (where canal = o.canal_ventas)
                   / nullif(sum(monto) filter (where canal in ('conocidos', 'tienda_online')), 0), 1)
      into v from public.ventas where fecha between p_desde and p_hasta;
    when 'clientes_mayoristas' then
      select count(distinct lower(trim(cliente))) into v from public.ventas
      where fecha between p_desde and p_hasta and canal = 'mayorista';
    when 'cumplimiento' then
      select c.porcentaje into v from public.cumplimiento(p_desde, p_hasta) c
      where (o.area_id is null and c.tipo = 'equipo') or (c.tipo = 'area' and c.ref_id = o.area_id);
  end case;
  return v;
end;
$$;

-- Avance de los objetivos no archivados, a una fecha (hoy por defecto).
-- Objetivos "mensuales" se miden en el mes de esa fecha.
create or replace function public.avance_objetivos(p_fecha date default null)
returns table (objective_id uuid, desde date, hasta date, valor numeric, meta numeric,
               porcentaje numeric, ritmo numeric, atrasado boolean)
language plpgsql stable set search_path = '' as $$
declare
  o public.objectives;
  v_ref date;
  v_acumulativo boolean;
begin
  for o in select * from public.objectives where estado <> 'archivado' order by fecha_fin loop
    v_ref := least(greatest(coalesce(p_fecha, privado.hoy()), o.fecha_inicio), o.fecha_fin);
    if o.evaluacion = 'mensual' then
      desde := greatest(o.fecha_inicio, date_trunc('month', v_ref)::date);
      hasta := least(o.fecha_fin, (date_trunc('month', v_ref) + interval '1 month - 1 day')::date);
    else
      desde := o.fecha_inicio;
      hasta := o.fecha_fin;
    end if;
    objective_id := o.id;
    valor := privado.valor_objetivo(o.id, desde, hasta);
    meta := case when o.tipo_medicion = 'tareas' then 100 else o.meta_numerica end;
    porcentaje := case when valor is null then null else least(100, round(100.0 * valor / meta, 1)) end;
    v_acumulativo := o.tipo_medicion in ('tareas', 'numerico', 'ventas', 'clientes_mayoristas');
    ritmo := case when v_acumulativo
                  then round(100.0 * (v_ref - desde + 1) / (hasta - desde + 1), 1) end;
    atrasado := o.estado = 'activo' and valor is not null and case
                  when v_acumulativo then porcentaje < ritmo - 15
                  else valor < meta end;
    return next;
  end loop;
end;
$$;

-- Evolución mes a mes (para el plan VEA): valor de cada mes del objetivo hasta hoy.
create or replace function public.evolucion_objetivo(p_id uuid)
returns table (mes date, valor numeric)
language sql stable set search_path = '' as $$
  select m::date, privado.valor_objetivo(o.id,
           greatest(o.fecha_inicio, m::date),
           least(o.fecha_fin, (m + interval '1 month - 1 day')::date))
  from public.objectives o,
       generate_series(date_trunc('month', o.fecha_inicio),
                       date_trunc('month', least(o.fecha_fin, privado.hoy())),
                       interval '1 month') m
  where o.id = p_id
  order by 1
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.cumplimiento(date, date) to authenticated;
grant execute on function public.avance_objetivos(date) to authenticated;
grant execute on function public.evolucion_objetivo(uuid) to authenticated;
revoke all on function privado.valor_objetivo(uuid, date, date) from public, anon;
grant execute on function privado.valor_objetivo(uuid, date, date) to authenticated;
