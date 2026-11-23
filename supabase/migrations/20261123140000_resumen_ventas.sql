-- Fase 4: resumen de ventas de un período para la pantalla Ventas.
-- Mismas cuentas que privado.valor_objetivo (CLAUDE.md §4: proporción solo sobre minoristas,
-- clientes mayoristas por nombre sin distinguir mayúsculas ni espacios). La app no suma en JavaScript.
create or replace function public.resumen_ventas(p_desde date, p_hasta date)
returns table (
  total numeric, conocidos numeric, tienda_online numeric, mayorista numeric,
  cantidad int, proporcion_tienda numeric, clientes_mayoristas int
)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(monto), 0),
         coalesce(sum(monto) filter (where canal = 'conocidos'), 0),
         coalesce(sum(monto) filter (where canal = 'tienda_online'), 0),
         coalesce(sum(monto) filter (where canal = 'mayorista'), 0),
         count(*)::int,
         round(100.0 * sum(monto) filter (where canal = 'tienda_online')
               / nullif(sum(monto) filter (where canal in ('conocidos', 'tienda_online')), 0), 1),
         count(distinct lower(trim(cliente))) filter (where canal = 'mayorista')::int
  from public.ventas
  where fecha between p_desde and p_hasta and privado.es_equipo()
$$;

revoke execute on function public.resumen_ventas(date, date) from public, anon;
grant execute on function public.resumen_ventas(date, date) to authenticated;
