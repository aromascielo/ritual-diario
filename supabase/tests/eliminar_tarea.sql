-- Pruebas de "eliminar tarea" (migración 20261123120000). Se deshace solo al terminar (raise final).
-- Correr en el editor SQL de Supabase o con execute_sql. Resultado esperado: todas las líneas "OK".
do $$
declare
  r text[] := '{}';
  v_admin uuid := gen_random_uuid();
  v_lider uuid := gen_random_uuid();
  v_miembro uuid := gen_random_uuid();
  a uuid;
  t_rec uuid; t_unica uuid;
  n int;
begin
  select id into a from public.areas where nombre = 'Producción';
  insert into public.team_invites (email, nombre, rol) values
    ('prueba-admin@ejemplo.test', 'Admin prueba', 'admin'),
    ('prueba-lider@ejemplo.test', 'Líder prueba', 'integrante'),
    ('prueba-miembro@ejemplo.test', 'Miembro prueba', 'integrante');
  insert into auth.users (id, email, aud, role) values
    (v_admin, 'prueba-admin@ejemplo.test', 'authenticated', 'authenticated'),
    (v_lider, 'prueba-lider@ejemplo.test', 'authenticated', 'authenticated'),
    (v_miembro, 'prueba-miembro@ejemplo.test', 'authenticated', 'authenticated');
  insert into public.area_members (area_id, profile_id, rol_area) values (a, v_lider, 'lider'), (a, v_miembro, 'miembro');

  -- La líder crea una tarea diaria para la miembro.
  perform set_config('request.jwt.claims', json_build_object('sub', v_lider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  t_rec := public.guardar_tarea(null, 'Diaria de prueba', v_miembro, 'diaria', array[a]);
  reset role;

  -- Historial simulado: ayer vencida sin hacer, anteayer hecha.
  insert into public.task_instances (template_id, responsable_id, titulo, fecha, fecha_limite, sin_horario, estado, completada_por, completada_at)
  values (t_rec, v_miembro, 'Diaria de prueba', privado.hoy() - 1, privado.fecha_limite(privado.hoy() - 1, null), true, 'pendiente', null, null),
         (t_rec, v_miembro, 'Diaria de prueba', privado.hoy() - 2, privado.fecha_limite(privado.hoy() - 2, null), true, 'hecha', v_miembro, now());

  -- 1) La miembro (responsable) no puede eliminar una tarea que se repite.
  perform set_config('request.jwt.claims', json_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.archivar_tarea(t_rec);
    r := r || 'FALLA 1: la miembro pudo eliminar una tarea recurrente'::text;
  exception when others then r := r || ('OK    1: miembro no elimina recurrente (' || sqlerrm || ')'); end;
  -- La miembro crea una única para ella (sí puede eliminarla después).
  t_unica := public.guardar_tarea(null, 'Única de la miembro', v_miembro, 'unica', array[a], p_fecha_unica => privado.hoy());
  perform public.archivar_tarea(t_unica);
  select count(*) into n from public.task_instances where template_id = t_unica;
  r := r || (case when n = 0 then 'OK    2: miembro elimina su única' else 'FALLA 2' end);
  reset role;

  -- 3) La líder elimina la diaria: se van TODOS los pendientes (también el vencido de ayer), queda la hecha.
  perform set_config('request.jwt.claims', json_build_object('sub', v_lider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.archivar_tarea(t_rec);
  reset role;
  select count(*) into n from public.task_instances where template_id = t_rec and estado = 'pendiente';
  r := r || (case when n = 0 then 'OK    3a: sin pendientes (ni la vencida de ayer)' else 'FALLA 3a: quedan ' || n end);
  select count(*) into n from public.task_instances where template_id = t_rec and estado = 'hecha';
  r := r || (case when n = 1 then 'OK    3b: la hecha queda en el historial' else 'FALLA 3b' end);
  select count(*) into n from public.app_notifications where tipo = 'tarea_eliminada' and destinatario_id = v_admin;
  r := r || (case when n = 2 then 'OK    3c: la admin recibió los 2 avisos de eliminación' else 'FALLA 3c: avisos ' || n end);

  -- 4) No se puede eliminar dos veces; 5) la admin elimina cualquiera y no se avisa a sí misma.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.archivar_tarea(t_rec);
    r := r || 'FALLA 4'::text;
  exception when others then r := r || ('OK    4: ya eliminada (' || sqlerrm || ')'); end;
  t_unica := public.guardar_tarea(null, 'Única de la líder', v_lider, 'unica', array[a], p_fecha_unica => privado.hoy());
  perform public.archivar_tarea(t_unica);
  reset role;
  select count(*) into n from public.task_instances where template_id = t_unica;
  r := r || (case when n = 0 then 'OK    5a: la admin elimina la tarea de otra' else 'FALLA 5a' end);
  select count(*) into n from public.app_notifications where tipo = 'tarea_eliminada' and destinatario_id = v_admin;
  r := r || (case when n = 2 then 'OK    5b: la admin no se avisa a sí misma' else 'FALLA 5b' end);

  raise exception E'RESULTADO (se deshace todo):\n%', array_to_string(r, E'\n');
end $$;
