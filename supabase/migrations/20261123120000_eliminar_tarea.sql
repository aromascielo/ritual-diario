-- Eliminar tarea (pedido de Cami, 23 nov 2026).
-- Antes: archivar borraba solo los días pendientes desde hoy, así que un día vencido de antes
-- seguía apareciendo en "Vencidas" después de eliminar la tarea.
-- Ahora: se borran TODOS los días pendientes (también los vencidos que nunca se hicieron).
-- Los días hechos u omitidos quedan en el historial. Si elimina otra persona, la admin recibe un aviso.

alter table public.app_notifications drop constraint app_notifications_tipo_check;
alter table public.app_notifications add constraint app_notifications_tipo_check
  check (tipo in ('tarea_vencida', 'tarea_omitida', 'tarea_eliminada', 'objetivo_atrasado',
                  'area_bajo_cumplimiento', 'comentario'));

create or replace function public.archivar_tarea(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  t public.task_templates;
  v_nombre text;
begin
  select * into t from public.task_templates where id = p_id;
  if not found or not t.activa then
    raise exception 'La tarea no existe o ya fue eliminada';
  end if;
  if not privado.puede_editar_tarea(p_id) then
    raise exception 'No podés eliminar esta tarea';
  end if;

  update public.task_templates set activa = false, updated_at = now() where id = p_id;

  -- Todos los días pendientes, también los vencidos. Sus áreas y comentarios se borran en cascada.
  delete from public.task_instances where template_id = p_id and estado = 'pendiente';

  perform privado.sincronizar_tarea(p_id);

  select nombre into v_nombre from public.profiles where id = v_uid;
  insert into public.app_notifications (destinatario_id, tipo, titulo, cuerpo)
  select p.id, 'tarea_eliminada',
         format('🗑️ %s eliminó "%s"', v_nombre, t.titulo),
         case when t.frecuencia = 'unica' then 'Era una tarea de una sola vez.'
              else 'Era una tarea que se repetía: se borraron sus días pendientes.' end
  from public.profiles p
  where p.rol = 'admin' and p.activo and p.id <> v_uid;
end;
$$;

revoke execute on function public.archivar_tarea(uuid) from public, anon;
grant execute on function public.archivar_tarea(uuid) to authenticated;
