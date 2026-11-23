-- Pruebas de avisos y alertas (migración 20261123150000_avisos). Se deshace solo al terminar (raise final).
-- Correr en el editor SQL de Supabase o con execute_sql. Resultado esperado: todas las líneas "OK".
do $$
declare
  r text[] := '{}';
  v_admin uuid := gen_random_uuid();
  v_miembro uuid := gen_random_uuid();
  a uuid;
  t_ayer uuid; t_manana uuid; t_diaria uuid;
  i_ayer uuid; i_manana uuid;
  d date := privado.hoy();
  a_las10 timestamptz := (privado.hoy() + time '10:00') at time zone privado.tz();
  a_las9 timestamptz := (privado.hoy() + time '09:00') at time zone privado.tz();
  a_las23 timestamptz := (privado.hoy() + time '23:00') at time zone privado.tz();
  n int;
  txt text;
begin
  select id into a from public.areas where nombre = 'Producción';
  insert into public.team_invites (email, nombre, rol) values
    ('prueba-admin@ejemplo.test', 'Admin Prueba', 'admin'),
    ('prueba-miembro@ejemplo.test', 'Miembro Prueba', 'integrante');
  insert into auth.users (id, email, aud, role) values
    (v_admin, 'prueba-admin@ejemplo.test', 'authenticated', 'authenticated'),
    (v_miembro, 'prueba-miembro@ejemplo.test', 'authenticated', 'authenticated');
  insert into public.area_members (area_id, profile_id, rol_area) values (a, v_miembro, 'miembro');

  -- La admin crea: una única de ayer (quedó vencida), una única de mañana a las 15:00 y una diaria.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  t_ayer := public.guardar_tarea(null, 'Única de ayer', v_miembro, 'unica', array[a], p_fecha_unica => d);
  t_manana := public.guardar_tarea(null, 'Única de mañana', v_miembro, 'unica', array[a], p_fecha_unica => d + 1, p_hora_limite => time '15:00');
  t_diaria := public.guardar_tarea(null, 'Diaria', v_miembro, 'diaria', array[a]);
  reset role;
  -- No se puede crear con fecha pasada: se simula que era de ayer.
  update public.task_instances set fecha = d - 1, fecha_limite = privado.fecha_limite(d - 1, null) where template_id = t_ayer;
  select id into i_ayer from public.task_instances where template_id = t_ayer;
  select id into i_manana from public.task_instances where template_id = t_manana;

  -- 1) De noche (23:00) no se genera nada.
  n := privado.preparar_avisos(a_las23);
  r := r || (case when n = 0 then 'OK    1: silencio de 22 a 8' else 'FALLA 1: generó ' || n end);

  -- 2) A las 10:00: push "venció" a la miembro y alerta a la admin.
  perform privado.preparar_avisos(a_las10);
  select count(*) into n from privado.push_cola where destinatario_id = v_miembro and clave = 'vencida:' || i_ayer;
  r := r || (case when n = 1 then 'OK    2a: push de vencida a la responsable' else 'FALLA 2a: ' || n end);
  select count(*) into n from public.app_notifications where destinatario_id = v_admin and tipo = 'tarea_vencida' and instance_id = i_ayer;
  r := r || (case when n = 1 then 'OK    2b: alerta de vencida a la admin' else 'FALLA 2b: ' || n end);

  -- 3) Aviso previo: "Mañana vence a las 15:00" para la única; la diaria no tiene aviso previo.
  select titulo into txt from privado.push_cola where clave = 'previa:' || i_manana;
  r := r || (case when txt = '📅 Mañana vence a las 15:00' then 'OK    3a: aviso previo de la única' else 'FALLA 3a: ' || coalesce(txt, 'nada') end);
  select count(*) into n from privado.push_cola c join public.task_instances i on c.clave = 'previa:' || i.id
  where i.template_id = t_diaria;
  r := r || (case when n = 0 then 'OK    3b: la diaria no tiene aviso previo' else 'FALLA 3b' end);

  -- 4) Correr de nuevo no repite nada.
  select count(*) into n from privado.push_cola where destinatario_id in (v_admin, v_miembro);
  perform privado.preparar_avisos(a_las10 + interval '20 minutes');
  r := r || (case when n = (select count(*) from privado.push_cola where destinatario_id in (v_admin, v_miembro))
                  and (select count(*) from public.app_notifications where destinatario_id = v_admin and tipo = 'tarea_vencida') = 1
             then 'OK    4: no repite avisos' else 'FALLA 4' end);

  -- 5) Resumen de las 9:00 (solo a esa hora).
  perform privado.preparar_avisos(a_las9);
  select titulo into txt from privado.push_cola where clave = 'resumen:' || v_miembro || ':' || d;
  r := r || (case when txt like '☀️ Hoy tenés % tarea%' then 'OK    5: resumen de las 9 (' || txt || ')' else 'FALLA 5: ' || coalesce(txt, 'nada') end);

  -- 6) Comentarios: la admin comenta → push a la miembro (no a la admin); la miembro comenta → push a la admin.
  insert into public.task_comments (instance_id, profile_id, texto) values (i_manana, v_admin, '¿Llegás?');
  select count(*) into n from privado.push_cola where clave like 'comentario:%' and destinatario_id = v_miembro;
  r := r || (case when n = 1 then 'OK    6a: comentario avisa a la responsable' else 'FALLA 6a: ' || n end);
  select count(*) into n from privado.push_cola where clave like 'comentario:%' and destinatario_id = v_admin;
  r := r || (case when n = 0 then 'OK    6b: no se avisa a quien comentó' else 'FALLA 6b' end);
  insert into public.task_comments (instance_id, profile_id, texto) values (i_manana, v_miembro, 'Sí');
  select count(*) into n from privado.push_cola where clave like 'comentario:%' and destinatario_id = v_admin;
  r := r || (case when n = 1 then 'OK    6c: comentario de la responsable avisa a la admin' else 'FALLA 6c: ' || n end);

  -- 7) Suscripciones: se guardan con la función; si el celular pasa a otra persona, se mueve.
  perform set_config('request.jwt.claims', json_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.guardar_suscripcion('https://push.ejemplo.test/abc', 'clave', 'auth');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.guardar_suscripcion('https://push.ejemplo.test/abc', 'clave', 'auth');
  reset role;
  select count(*) into n from public.push_subscriptions where endpoint = 'https://push.ejemplo.test/abc' and profile_id = v_admin;
  r := r || (case when n = 1 and not exists (select 1 from public.push_subscriptions where profile_id = v_miembro)
             then 'OK    7: el celular pasa a la nueva persona' else 'FALLA 7' end);

  -- 8) La cola no sale de noche (salvo pruebas) y sí de día.
  perform set_config('request.jwt.claims', json_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.guardar_suscripcion('https://push.ejemplo.test/xyz', 'clave', 'auth');
  reset role;
  select count(*) into n from privado.tomar_cola(a_las23) where endpoint like 'https://push.ejemplo.test/%';
  r := r || (case when n = 0 then 'OK    8a: de noche no sale nada' else 'FALLA 8a: ' || n end);
  select count(*) into n from privado.tomar_cola(a_las10) where endpoint = 'https://push.ejemplo.test/xyz';
  r := r || (case when n >= 3 then 'OK    8b: de día sale lo acumulado (' || n || ')' else 'FALLA 8b: ' || n end);
  select count(*) into n from privado.tomar_cola(a_las10) where endpoint like 'https://push.ejemplo.test/%';
  r := r || (case when n = 0 then 'OK    8c: no se manda dos veces' else 'FALLA 8c: ' || n end);

  -- 9) Alertas al celular (admin, opcional): al activarlo, una omitida también va por push.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mis_avisos(true);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_miembro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.marcar_tarea(i_manana, 'omitida', 'Falta material');
  reset role;
  select count(*) into n from privado.push_cola c join public.app_notifications x on c.clave = 'alerta:' || x.id
  where x.destinatario_id = v_admin and x.tipo = 'tarea_omitida';
  r := r || (case when n = 1 then 'OK    9: alerta de omitida también al celular' else 'FALLA 9: ' || n end);

  -- 10) La app no puede usar las funciones internas ni leer la cola.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform privado.preparar_avisos();
    r := r || 'FALLA 10a: authenticated corrió preparar_avisos'::text;
  exception when others then r := r || ('OK    10a: preparar_avisos no es para la app (' || sqlerrm || ')'); end;
  begin
    perform count(*) from privado.push_cola;
    r := r || 'FALLA 10b: authenticated leyó la cola'::text;
  exception when others then r := r || ('OK    10b: la cola no se lee desde la app (' || sqlerrm || ')'); end;
  reset role;

  raise exception E'RESULTADO (se deshace todo):\n%', array_to_string(r, E'\n');
end $$;
