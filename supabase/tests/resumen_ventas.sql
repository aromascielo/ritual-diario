-- Prueba de resumen_ventas (migración 20261123140000): mismas cifras que el Plan VEA. Se deshace sola.
-- Usa el perfil admin real (cambiar el id si hace falta). Esperado: total 450000, % tienda 66.7, 2 clientes mayoristas.
do $$
declare r record; a record; v_admin uuid := (select id from public.profiles where rol = 'admin' and activo limit 1);
  d date := privado.hoy(); v_ini date := date_trunc('month', privado.hoy())::date;
  v_fin date := (date_trunc('month', privado.hoy()) + interval '1 month - 1 day')::date; txt text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ventas (fecha, monto, canal, cliente) values
    (d, 100000, 'conocidos', null), (d, 200000, 'tienda_online', null),
    (d, 50000, 'mayorista', 'Hotel Paihuen'), (d, 30000, 'mayorista', '  hotel paihuen '), (d, 70000, 'mayorista', 'Cabañas del Lago');
  select * into r from public.resumen_ventas(v_ini, v_fin);
  txt := format('resumen: total %s · %% tienda %s · clientes may. %s', r.total, r.proporcion_tienda, r.clientes_mayoristas);
  for a in select o.titulo, av.valor from public.avance_objetivos(d) av join public.objectives o on o.id = av.objective_id
           where o.plan_id is not null and o.tipo_medicion in ('ventas','proporcion_ventas','clientes_mayoristas') loop
    txt := txt || E'\n' || 'VEA · ' || a.titulo || ': ' || a.valor;
  end loop;
  reset role;
  raise exception E'RESULTADO (se deshace todo):\n%', txt;
end $$;
