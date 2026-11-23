-- Pruebas de "invitar con áreas" (migración 20261123130000). Se deshace solo al terminar.
do $$
declare
  r text[] := '{}';
  v_admin uuid := gen_random_uuid();
  v_nueva uuid := gen_random_uuid();
  v_otra uuid := gen_random_uuid();
  a_prod uuid; a_log uuid;
  n int;
begin
  select id into a_prod from public.areas where nombre = 'Producción';
  select id into a_log from public.areas where nombre = 'Logística y envíos';
  insert into public.team_invites (email, nombre, rol) values ('prueba-admin@ejemplo.test', 'Admin prueba', 'admin');
  insert into auth.users (id, email, aud, role) values (v_admin, 'prueba-admin@ejemplo.test', 'authenticated', 'authenticated');

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.invitar_persona('Nueva@Ejemplo.test', 'Nueva', 'integrante', true,
    jsonb_build_array(jsonb_build_object('area_id', a_prod, 'rol_area', 'lider'),
                      jsonb_build_object('area_id', a_log, 'rol_area', 'miembro')));
  r := r || 'OK    1: la admin invita con 2 áreas'::text;
  begin
    perform public.invitar_persona('mala@ejemplo.test', 'Mala', 'integrante', false,
      jsonb_build_array(jsonb_build_object('area_id', a_prod, 'rol_area', 'jefa')));
    r := r || 'FALLA 2: aceptó un rol de área inválido'::text;
  exception when others then r := r || ('OK    2: rol de área inválido rechazado (' || sqlerrm || ')'); end;
  begin
    perform public.invitar_persona('sin-nombre@ejemplo.test', '  ');
    r := r || 'FALLA 3: aceptó una invitación sin nombre'::text;
  exception when others then r := r || ('OK    3: sin nombre rechazado (' || sqlerrm || ')'); end;
  perform public.invitar_persona('otra@ejemplo.test', 'Otra');
  r := r || 'OK    4: invitar sin áreas sigue andando'::text;
  reset role;

  insert into auth.users (id, email, aud, role) values (v_nueva, 'nueva@ejemplo.test', 'authenticated', 'authenticated');
  select count(*) into n from public.area_members where profile_id = v_nueva
    and ((area_id = a_prod and rol_area = 'lider') or (area_id = a_log and rol_area = 'miembro'));
  r := r || (case when n = 2 then 'OK    5: al entrar quedó líder en Producción y miembro en Logística' else 'FALLA 5: ' || n end);
  select count(*) into n from public.profiles where id = v_nueva and carga_ventas;
  r := r || (case when n = 1 then 'OK    6: quedó con permiso de cargar ventas' else 'FALLA 6' end);
  select count(*) into n from public.team_invites where email = 'nueva@ejemplo.test';
  r := r || (case when n = 0 then 'OK    7: la invitación se borra al entrar' else 'FALLA 7' end);

  insert into auth.users (id, email, aud, role) values (v_otra, 'otra@ejemplo.test', 'authenticated', 'authenticated');
  select count(*) into n from public.area_members where profile_id = v_otra;
  r := r || (case when n = 0 then 'OK    8: sin áreas en la invitación, entra sin áreas' else 'FALLA 8' end);

  raise exception E'RESULTADO (se deshace todo):\n%', array_to_string(r, E'\n');
end $$;
