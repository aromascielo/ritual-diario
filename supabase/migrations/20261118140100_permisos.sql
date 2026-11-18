-- Ritual Diario v2 — 2/6: permisos (CLAUDE.md §2 y §8)
-- Regla general: solo el equipo activo lee; las escrituras delicadas (tareas,
-- estados, personas) pasan por funciones RPC que validan permisos y dan
-- mensajes claros. RLS es la barrera final.

-- Auxiliares (security definer: leen profiles/area_members sin pasar por RLS) ----
create or replace function privado.es_equipo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and activo)
$$;

create or replace function privado.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and activo and rol = 'admin')
$$;

create or replace function privado.es_lider(p_area uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.area_members m join public.profiles p on p.id = m.profile_id
    where m.area_id = p_area and m.profile_id = auth.uid() and m.rol_area = 'lider' and p.activo)
$$;

create or replace function privado.es_miembro(p_area uuid, p_persona uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.area_members m join public.profiles p on p.id = m.profile_id
    where m.area_id = p_area and m.profile_id = coalesce(p_persona, auth.uid()) and p.activo)
$$;

create or replace function privado.gestiona_area(p_area uuid) returns boolean
language sql stable set search_path = '' as $$
  select privado.es_admin() or privado.es_lider(p_area)
$$;

create or replace function privado.carga_ventas() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and activo and (rol = 'admin' or carga_ventas))
$$;

revoke all on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated;

-- Alta de personas: solo mails invitados ----------------------------------
create or replace function privado.al_crear_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.team_invites;
begin
  select * into v_inv from public.team_invites where email = lower(new.email);
  if not found then
    raise exception 'Este mail no está invitado a Ritual Diario';
  end if;
  insert into public.profiles (id, nombre, email, rol, carga_ventas)
  values (new.id, v_inv.nombre, lower(new.email), v_inv.rol, v_inv.carga_ventas);
  delete from public.team_invites where email = v_inv.email;
  return new;
end;
$$;
revoke all on function privado.al_crear_usuario() from public, anon, authenticated;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function privado.al_crear_usuario();

-- RLS -------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.team_invites        enable row level security;
alter table public.areas               enable row level security;
alter table public.area_members        enable row level security;
alter table public.planes              enable row level security;
alter table public.objectives          enable row level security;
alter table public.objective_aportes   enable row level security;
alter table public.task_templates      enable row level security;
alter table public.task_template_areas enable row level security;
alter table public.task_instances      enable row level security;
alter table public.task_instance_areas enable row level security;
alter table public.task_comments       enable row level security;
alter table public.ventas              enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.app_notifications   enable row level security;

-- Nadie anónimo toca nada.
revoke all on all tables in schema public from anon;

-- Lectura para el equipo activo (todos ven todo).
create policy leer on public.profiles            for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.areas               for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.area_members        for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.planes              for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.objectives          for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.objective_aportes   for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.task_templates      for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.task_template_areas for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.task_instances      for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.task_instance_areas for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.task_comments       for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.ventas              for select to authenticated using ((select privado.es_equipo()));
create policy leer on public.team_invites        for select to authenticated using ((select privado.es_admin()));

-- Escritura directa solo de admin en tablas de configuración.
create policy admin_inserta on public.areas for insert to authenticated with check ((select privado.es_admin()));
create policy admin_edita   on public.areas for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy admin_inserta on public.planes for insert to authenticated with check ((select privado.es_admin()));
create policy admin_edita   on public.planes for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy admin_borra   on public.planes for delete to authenticated using ((select privado.es_admin()));

-- Objetivos: admin todos; líder los de su área (no generales ni de planes).
create policy crear on public.objectives for insert to authenticated with check (
  (select privado.es_admin())
  or (area_id is not null and plan_id is null and privado.es_lider(area_id) and creado_por = (select auth.uid())));
create policy editar on public.objectives for update to authenticated
  using ((select privado.es_admin()) or (area_id is not null and plan_id is null and privado.es_lider(area_id)))
  with check ((select privado.es_admin()) or (area_id is not null and plan_id is null and privado.es_lider(area_id)));
create policy borrar on public.objectives for delete to authenticated
  using ((select privado.es_admin()) or (area_id is not null and plan_id is null and privado.es_lider(area_id)));

-- Aportes manuales a objetivos numéricos (los de tareas los maneja marcar_tarea).
create policy cargar on public.objective_aportes for insert to authenticated with check (
  instance_id is null and cargado_por = (select auth.uid()) and exists (
    select 1 from public.objectives o where o.id = objective_id and o.tipo_medicion = 'numerico'
      and ((select privado.es_admin()) or (o.area_id is not null and privado.es_lider(o.area_id)))));
create policy borrar on public.objective_aportes for delete to authenticated using (
  instance_id is null and exists (
    select 1 from public.objectives o where o.id = objective_id
      and ((select privado.es_admin()) or (o.area_id is not null and privado.es_lider(o.area_id)))));

-- Comentarios: cualquiera del equipo comenta; cada una borra lo suyo (o la admin).
create policy comentar on public.task_comments for insert to authenticated
  with check ((select privado.es_equipo()) and profile_id = (select auth.uid()));
create policy borrar on public.task_comments for delete to authenticated
  using (profile_id = (select auth.uid()) or (select privado.es_admin()));

-- Ventas: admin y personas habilitadas (carga_ventas). Cada una edita/borra lo suyo; admin todo.
create policy cargar on public.ventas for insert to authenticated
  with check ((select privado.carga_ventas()) and cargado_por = (select auth.uid()));
create policy editar on public.ventas for update to authenticated
  using ((select privado.es_admin()) or ((select privado.carga_ventas()) and cargado_por = (select auth.uid())))
  with check ((select privado.es_admin()) or ((select privado.carga_ventas()) and cargado_por = (select auth.uid())));
create policy borrar on public.ventas for delete to authenticated
  using ((select privado.es_admin()) or ((select privado.carga_ventas()) and cargado_por = (select auth.uid())));

-- Suscripciones push: cada una las suyas.
create policy propias on public.push_subscriptions for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()) and (select privado.es_equipo()));

-- Alertas: cada una lee y marca como leídas las suyas (solo la columna "leida").
create policy propias_leer on public.app_notifications for select to authenticated
  using (destinatario_id = (select auth.uid()));
create policy propias_marcar on public.app_notifications for update to authenticated
  using (destinatario_id = (select auth.uid())) with check (destinatario_id = (select auth.uid()));
revoke update on public.app_notifications from authenticated;
grant update (leida) on public.app_notifications to authenticated;

-- profiles, team_invites, area_members, task_templates, task_template_areas,
-- task_instances y task_instance_areas NO tienen políticas de escritura:
-- se modifican solo con las funciones RPC (migraciones 3 y 5).

-- Alertas en vivo (Realtime).
alter publication supabase_realtime add table public.app_notifications;
