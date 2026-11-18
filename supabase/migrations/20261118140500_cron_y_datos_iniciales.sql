-- Ritual Diario v2 — 6/6: tarea programada y datos iniciales reales
-- (áreas y plan VEA). Las personas NO van acá: se invitan desde la app.

create extension if not exists pg_cron with schema extensions;

-- Genera las tareas recurrentes de los próximos 14 días, todos los días a las 00:05 (hora Argentina = 03:05 UTC).
select cron.schedule('generar-instancias', '5 3 * * *', $$select privado.generar_instancias();$$);

insert into public.areas (nombre, descripcion, color, emoji, orden) values
  ('Producción', 'Velas, difusores, cosmética sólida y pedidos mayoristas (10 días de producción)', '#6F7C12', '🕯️', 1),
  ('Tienda online', 'Fichas de producto, stock en Tiendanube y consultas', '#1098F7', '🛍️', 2),
  ('Mayorista / B2B', 'Catálogo, pedidos, hoteles y turismo', '#6B5E62', '📦', 3),
  ('Redes y contenido orgánico', 'Instagram, TikTok, publicaciones orgánicas y UGC', '#F17300', '📱', 4),
  ('Campañas creativas', 'Campañas por fechas especiales, conceptos y piezas', '#9AA544', '✨', 5),
  ('Publicidad paga', 'Anuncios en Meta/Instagram, presupuesto y resultados', '#0B6FB8', '📣', 6),
  ('Logística y envíos', 'Despachos martes y jueves por Correo Argentino y retiros en el showroom', '#B85700', '🚚', 7),
  ('Administración', 'Cobros, costos, cierre del mes y plan VEA', '#9A8D91', '📊', 8);

-- Plan VEA a abril 2027 (CLAUDE.md §4). Base: octubre 2026 = $400.000 en ventas.
with plan as (
  insert into public.planes (titulo, descripcion, area_id, fecha_inicio, fecha_fin)
  select 'Plan VEA — abril 2027',
         'Visión, evaluación y agenda del primer cuatrimestre. Base: octubre 2026 ($400.000 en ventas).',
         id, date '2026-11-01', date '2027-04-30'
  from public.areas where nombre = 'Administración'
  returning id, area_id
)
insert into public.objectives
  (plan_id, area_id, titulo, descripcion, periodo, fecha_inicio, fecha_fin, tipo_medicion,
   evaluacion, meta_numerica, unidad, canal_ventas, valor_base)
select plan.id, plan.area_id, x.titulo, x.descripcion, 'personalizado', date '2026-11-01', date '2027-04-30',
       x.tipo, x.evaluacion, x.meta, x.unidad, x.canal, x.base
from plan, (values
  ('Duplicar ingresos', 'Ventas del mes: de $400.000 (octubre 2026) a $800.000.',
     'ventas', 'mensual', 800000::numeric, '$', null::text, 400000::numeric),
  ('2/3 de las ventas minoristas por la tienda online', 'Por monto: 1/3 a conocidos y 2/3 a desconocidos por la tienda online.',
     'proporcion_ventas', 'mensual', 66.7, '%', 'tienda_online', null),
  ('Al menos 2 clientes mayoristas', 'Clientes mayoristas distintos con compras en el período.',
     'clientes_mayoristas', 'periodo', 2, 'clientes', null, null),
  ('80 % de tareas del equipo cumplidas', 'Cumplimiento al día del equipo, mes a mes.',
     'cumplimiento', 'mensual', 80, '%', null, null)
) as x(titulo, descripcion, tipo, evaluacion, meta, unidad, canal, base);
