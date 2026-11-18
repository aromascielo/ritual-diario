-- Ritual Diario v2 — 1/6: tablas base
-- Ver CLAUDE.md §11 (modelo de datos). Se usan columnas text con CHECK en vez de
-- tipos enum para poder agregar o quitar valores sin migraciones complicadas.

create extension if not exists pgcrypto;

-- Esquema interno: funciones auxiliares que NO se exponen por la API.
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

-- Zona horaria del negocio: definida en un solo lugar.
create or replace function privado.tz() returns text
language sql immutable set search_path = '' as $$ select 'America/Argentina/Buenos_Aires' $$;

create or replace function privado.hoy() returns date
language sql stable set search_path = '' as $$ select (now() at time zone privado.tz())::date $$;

-- Personas --------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  email text not null unique,
  rol text not null default 'integrante' check (rol in ('admin', 'integrante')),
  activo boolean not null default true,
  carga_ventas boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.team_invites (
  email text primary key check (email = lower(trim(email))),
  nombre text not null,
  rol text not null default 'integrante' check (rol in ('admin', 'integrante')),
  carga_ventas boolean not null default false,
  invitado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Áreas -----------------------------------------------------------------
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  color text not null,
  emoji text not null,
  orden int not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.area_members (
  area_id uuid not null references public.areas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rol_area text not null default 'miembro' check (rol_area in ('lider', 'miembro')),
  primary key (area_id, profile_id)
);

-- Planes y objetivos ----------------------------------------------------
create table public.planes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  area_id uuid references public.areas(id) on delete set null,
  fecha_inicio date not null,
  fecha_fin date not null check (fecha_fin >= fecha_inicio),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.planes(id) on delete set null,
  area_id uuid references public.areas(id) on delete set null,
  titulo text not null check (length(trim(titulo)) between 1 and 120),
  descripcion text,
  periodo text not null default 'mensual'
    check (periodo in ('semanal', 'mensual', 'trimestral', 'personalizado')),
  fecha_inicio date not null,
  fecha_fin date not null,
  tipo_medicion text not null check (tipo_medicion in
    ('tareas', 'numerico', 'ventas', 'proporcion_ventas', 'clientes_mayoristas', 'cumplimiento')),
  -- 'periodo': se mide en todo el rango; 'mensual': se mide mes a mes (meta por mes).
  evaluacion text not null default 'periodo' check (evaluacion in ('periodo', 'mensual')),
  meta_numerica numeric check (meta_numerica is null or meta_numerica > 0),
  unidad text,
  canal_ventas text check (canal_ventas is null or canal_ventas in ('conocidos', 'tienda_online', 'mayorista')),
  valor_base numeric,
  estado text not null default 'activo' check (estado in ('activo', 'cumplido', 'archivado')),
  creado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio),
  check (tipo_medicion = 'tareas' or meta_numerica is not null),
  check (tipo_medicion <> 'proporcion_ventas' or canal_ventas in ('conocidos', 'tienda_online'))
);

-- Tareas ----------------------------------------------------------------
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 1 and 120),
  descripcion text,
  responsable_id uuid not null references public.profiles(id),
  creado_por uuid references public.profiles(id) on delete set null,
  frecuencia text not null check (frecuencia in ('unica', 'diaria', 'semanal', 'mensual')),
  fecha_unica date,
  dias_semana int[],          -- 1 = lunes … 7 = domingo
  dia_mes int check (dia_mes between 0 and 31),  -- 0 = último día; si el mes es más corto, el último día
  hora_limite time,           -- null = sin horario (vence 23:59)
  peso int not null default 1 check (peso between 1 and 100),
  objective_id uuid references public.objectives(id) on delete set null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (frecuencia <> 'unica' or fecha_unica is not null),
  check (frecuencia <> 'semanal' or (dias_semana is not null and cardinality(dias_semana) > 0
         and dias_semana <@ array[1,2,3,4,5,6,7])),
  check (frecuencia <> 'mensual' or dia_mes is not null)
);

create table public.task_template_areas (
  template_id uuid not null references public.task_templates(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  primary key (template_id, area_id)
);

create table public.task_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  responsable_id uuid not null references public.profiles(id),
  titulo text not null,
  fecha date not null,
  fecha_limite timestamptz not null,
  sin_horario boolean not null default false,
  peso int not null default 1,
  objective_id uuid references public.objectives(id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecha', 'omitida')),
  completada_por uuid references public.profiles(id),
  completada_at timestamptz,
  omitida_motivo text,
  omitida_por uuid references public.profiles(id),
  omitida_at timestamptz,
  notificada_previa boolean not null default false,
  notificada_vencida boolean not null default false,
  created_at timestamptz not null default now(),
  unique (template_id, fecha),
  check (estado <> 'omitida' or length(trim(coalesce(omitida_motivo, ''))) >= 3)
);

create table public.task_instance_areas (
  instance_id uuid not null references public.task_instances(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  primary key (instance_id, area_id)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.task_instances(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id),
  texto text not null check (length(trim(texto)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.objective_aportes (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.objectives(id) on delete cascade,
  instance_id uuid references public.task_instances(id) on delete cascade,
  cantidad numeric not null check (cantidad <> 0),
  nota text,
  cargado_por uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (objective_id, instance_id)
);

-- Ventas (plan VEA) -----------------------------------------------------
create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default privado.hoy(),
  monto numeric(12, 2) not null check (monto > 0),
  canal text not null check (canal in ('conocidos', 'tienda_online', 'mayorista')),
  cliente text,
  nota text,
  cargado_por uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (canal <> 'mayorista' or length(trim(coalesce(cliente, ''))) > 0)
);

-- Notificaciones --------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in
    ('tarea_vencida', 'tarea_omitida', 'objetivo_atrasado', 'area_bajo_cumplimiento', 'comentario')),
  titulo text not null,
  cuerpo text,
  instance_id uuid references public.task_instances(id) on delete set null,
  objective_id uuid references public.objectives(id) on delete set null,
  area_id uuid references public.areas(id) on delete set null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

-- Índices ---------------------------------------------------------------
create index on public.area_members (profile_id);
create index on public.team_invites (invitado_por);
create index on public.planes (area_id);
create index on public.objectives (plan_id);
create index on public.objectives (area_id);
create index on public.objectives (creado_por);
create index on public.task_templates (responsable_id);
create index on public.task_templates (creado_por);
create index on public.task_templates (objective_id);
create index on public.task_template_areas (area_id);
create index on public.task_instances (responsable_id, fecha);
create index on public.task_instances (fecha);
create index on public.task_instances (fecha_limite) where estado = 'pendiente';
create index on public.task_instances (objective_id);
create index on public.task_instances (completada_por);
create index on public.task_instances (omitida_por);
create index on public.task_instance_areas (area_id);
create index on public.task_comments (instance_id);
create index on public.task_comments (profile_id);
create index on public.objective_aportes (instance_id);
create index on public.objective_aportes (cargado_por);
create index on public.ventas (fecha);
create index on public.ventas (cargado_por);
create index on public.push_subscriptions (profile_id);
create index on public.app_notifications (destinatario_id, leida);
create index on public.app_notifications (instance_id);
create index on public.app_notifications (objective_id);
create index on public.app_notifications (area_id);
