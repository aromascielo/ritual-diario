-- Pruebas de permisos y reglas de Ritual Diario v2.
-- Se corre entera en el SQL Editor (o con execute_sql). Crea personas de prueba,
-- simula a cada una y al final LANZA UN ERROR a propósito con el resumen:
-- así se deshace todo y no queda ningún dato de prueba en la base.
-- Cada línea del resumen empieza con OK o FALLA.

do $$
declare
  r text[] := '{}';
  v_admin uuid := gen_random_uuid();
  v_laura uuid := gen_random_uuid();
  v_mia   uuid := gen_random_uuid();
  a_prod uuid; a_adm uuid; a_redes uuid;
  t1 uuid; t2 uuid; i_hoy uuid; i_man uuid;
  n int; n2 int;
begin
  select id into a_prod  from public.areas where nombre = 'Producción';
  select id into a_adm   from public.areas where nombre = 'Administración';
  select id into a_redes from public.areas where nombre = 'Redes y contenido orgánico';

  -- Personas de prueba ---------------------------------------------------
  insert into public.team_invites (email, nombre, rol, carga_ventas) values
    ('admin@prueba.local', 'Admin', 'admin', false),
    ('laura@prueba.local', 'Laura', 'integrante', true),
    ('mia@prueba.local',   'Mia',   'integrante', false);
  insert into auth.users (id, email, aud, role) values
    (v_admin, 'admin@prueba.local', 'authenticated', 'authenticated'),
    (v_laura, 'laura@prueba.local', 'authenticated', 'authenticated'),
    (v_mia,   'mia@prueba.local',   'authenticated', 'authenticated');
  insert into public.area_members (area_id, profile_id, rol_area) values
    (a_prod, v_laura, 'lider'), (a_prod, v_mia, 'miembro');

  begin
    insert into auth.users (id, email, aud, role)
    values (gen_random_uuid(), 'intruso@prueba.local', 'authenticated', 'authenticated');
    r := r || 'FALLA 01 un mail no invitado pudo crear cuenta'::text;
  exception when others then
    r := r || ('OK    01 mail no invitado bloqueado: ' || sqlerrm);
  end;

  -- Como LAURA (líder de Producción) -------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_laura, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    t1 := public.guardar_tarea(null, 'Prueba semanal', v_mia, 'semanal', array[a_prod],
                               p_dias_semana => array[1,2,3,4,5,6,7], p_hora_limite => '18:00');
    select count(*) into n from public.task_instances where template_id = t1;
    r := r || (case when n = 14 then 'OK    02' else 'FALLA 02' end
               || ' líder crea recurrente y se la asigna a otra; instancias: ' || n);
  exception when others then r := r || ('FALLA 02 líder no pudo crear recurrente: ' || sqlerrm); end;

  begin
    perform public.guardar_tarea(null, 'En área ajena', v_laura, 'unica', array[a_redes], p_fecha_unica => privado.hoy());
    r := r || 'FALLA 03 líder creó tarea en un área que no es suya'::text;
  exception when others then r := r || ('OK    03 líder no puede crear en área ajena: ' || sqlerrm); end;

  -- Cambiar la hora no duplica (bug de la v1)
  begin
    perform public.guardar_tarea(t1, 'Prueba semanal', v_mia, 'semanal', array[a_prod],
                                 p_dias_semana => array[1,2,3,4,5,6,7], p_hora_limite => '10:00');
    select count(*), count(*) filter (where (fecha_limite at time zone privado.tz())::time <> '10:00')
      into n, n2 from public.task_instances where template_id = t1;
    r := r || (case when n = 14 and n2 = 0 then 'OK    04' else 'FALLA 04' end
               || ' cambiar la hora no duplica: ' || n || ' instancias, ' || n2 || ' con hora vieja');
  exception when others then r := r || ('FALLA 04 ' || sqlerrm); end;

  begin
    perform public.guardar_tarea(null, 'Objetivo prod', v_laura, 'unica', array[a_prod], p_fecha_unica => privado.hoy());
    insert into public.objectives (area_id, titulo, fecha_inicio, fecha_fin, tipo_medicion, creado_por)
    values (a_prod, 'Objetivo de Producción', privado.hoy(), privado.hoy() + 30, 'tareas', v_laura);
    r := r || 'OK    05 líder crea objetivo de su área'::text;
  exception when others then r := r || ('FALLA 05 ' || sqlerrm); end;

  begin
    insert into public.objectives (area_id, titulo, fecha_inicio, fecha_fin, tipo_medicion, creado_por)
    values (a_adm, 'Objetivo ajeno', privado.hoy(), privado.hoy() + 30, 'tareas', v_laura);
    r := r || 'FALLA 06 líder creó objetivo en área ajena'::text;
  exception when others then r := r || ('OK    06 líder no crea objetivos en área ajena: ' || sqlerrm); end;

  begin
    insert into public.ventas (monto, canal) values (15000, 'conocidos');
    r := r || 'OK    07 persona habilitada carga una venta'::text;
  exception when others then r := r || ('FALLA 07 ' || sqlerrm); end;

  select id into i_hoy from public.task_instances where template_id = t1 and fecha = privado.hoy();
  select id into i_man from public.task_instances where template_id = t1 and fecha = privado.hoy() + 1;

  begin
    perform public.marcar_tarea(i_hoy, 'hecha');
    r := r || 'FALLA 08 la líder marcó una tarea de otra persona'::text;
  exception when others then r := r || ('OK    08 solo la responsable o la admin marcan: ' || sqlerrm); end;

  reset role;

  -- Como MIA (miembro de Producción) -------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_mia, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform public.guardar_tarea(null, 'Recurrente de miembro', v_mia, 'diaria', array[a_prod]);
    r := r || 'FALLA 09 una miembro creó una recurrente'::text;
  exception when others then r := r || ('OK    09 miembro no crea recurrentes: ' || sqlerrm); end;

  begin
    t2 := public.guardar_tarea(null, 'Mi tarea puntual', v_mia, 'unica', array[a_prod], p_fecha_unica => privado.hoy() + 2);
    select count(*) into n from public.task_instances where template_id = t2 and fecha = privado.hoy() + 2;
    r := r || (case when n = 1 then 'OK    10' else 'FALLA 10' end || ' miembro crea tarea única con fecha propia');
  exception when others then r := r || ('FALLA 10 ' || sqlerrm); end;

  begin
    perform public.guardar_tarea(null, 'Para otra', v_laura, 'unica', array[a_prod], p_fecha_unica => privado.hoy());
    r := r || 'FALLA 11 una miembro le asignó una tarea a otra persona'::text;
  exception when others then r := r || ('OK    11 miembro no asigna a otras: ' || sqlerrm); end;

  begin
    perform public.guardar_tarea(t1, 'Editada por Mia', v_mia, 'semanal', array[a_prod], p_dias_semana => array[1]);
    r := r || 'FALLA 12 una miembro editó una recurrente que no creó'::text;
  exception when others then r := r || ('OK    12 miembro no edita recurrentes ajenas: ' || sqlerrm); end;

  begin
    perform public.marcar_tarea(i_hoy, 'hecha');
    r := r || 'OK    13 la responsable marca su tarea como hecha'::text;
  exception when others then r := r || ('FALLA 13 ' || sqlerrm); end;

  begin
    perform public.marcar_tarea(i_man, 'omitida', '');
    r := r || 'FALLA 14 se omitió una tarea sin motivo'::text;
  exception when others then r := r || ('OK    14 omitir exige motivo: ' || sqlerrm); end;

  begin
    perform public.marcar_tarea(i_man, 'omitida', 'Falta materia prima');
    r := r || 'OK    15 la responsable omite con motivo'::text;
  exception when others then r := r || ('FALLA 15 ' || sqlerrm); end;

  begin
    insert into public.ventas (monto, canal) values (1000, 'conocidos');
    r := r || 'FALLA 16 una persona no habilitada cargó una venta'::text;
  exception when others then r := r || ('OK    16 sin permiso no se cargan ventas: ' || sqlerrm); end;

  select count(*) into n from public.app_notifications;
  r := r || (case when n = 0 then 'OK    17' else 'FALLA 17' end || ' una integrante no ve alertas ajenas (ve ' || n || ')');

  begin
    perform public.invitar_persona('nueva@prueba.local', 'Nueva');
    r := r || 'FALLA 18 una integrante invitó a alguien'::text;
  exception when others then r := r || ('OK    18 solo la admin invita: ' || sqlerrm); end;

  begin
    update public.task_instances set estado = 'hecha' where id = i_man;
    get diagnostics n = row_count;
    r := r || (case when n = 0 then 'OK    19' else 'FALLA 19' end || ' no se puede saltear la función y editar la tabla directo');
  exception when others then r := r || ('OK    19 no se puede editar la tabla directo: ' || sqlerrm); end;

  reset role;

  -- Como ADMIN -----------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.app_notifications where tipo = 'tarea_omitida';
  r := r || (case when n = 1 then 'OK    20' else 'FALLA 20' end || ' a la admin le llegó la alerta de tarea omitida');

  select count(*) into n from public.avance_objetivos();
  r := r || (case when n >= 5 then 'OK    21' else 'FALLA 21' end || ' avance de objetivos calcula ' || n || ' objetivos');

  select count(*) into n from public.cumplimiento(privado.hoy() - 7, privado.hoy()) where tipo = 'equipo';
  r := r || (case when n = 1 then 'OK    22' else 'FALLA 22' end || ' cumplimiento del equipo');

  reset role;

  -- Como LAURA: archivar no borra el historial -----------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_laura, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.archivar_tarea(t1);
    select count(*) into n from public.task_instances where template_id = t1;
    r := r || (case when n = 2 then 'OK    23' else 'FALLA 23' end
               || ' archivar conserva la hecha y la omitida, borra las futuras (quedan ' || n || ')');
  exception when others then r := r || ('FALLA 23 ' || sqlerrm); end;
  reset role;

  -- Sin iniciar sesión -----------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    select count(*) into n from public.areas;
    r := r || 'FALLA 24 alguien sin sesión pudo leer áreas'::text;
  exception when others then r := r || ('OK    24 sin sesión no se lee nada: ' || sqlerrm); end;
  reset role;

  raise exception E'RESULTADO (se deshace todo a propósito)\n%', array_to_string(r, E'\n');
end;
$$;
