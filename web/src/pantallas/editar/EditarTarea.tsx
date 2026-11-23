import { useCallback, useEffect, useState } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio } from '../../componentes/Piezas'
import { FormTarea } from '../../componentes/FormTarea'
import { useAvisar } from '../../componentes/Avisos'
import { eliminarTarea, guardarTarea, traerPlantilla } from '../../lib/datos'
import { Dialogo } from '../../componentes/Dialogo'
import { volver } from '../../lib/ruta'
import { usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Plantilla } from '../../lib/tipos'

/** Editar una tarea (la plantilla): los cambios se aplican desde hoy. */
export function EditarTarea({ id }: { id: string }) {
  const { esAdmin, puedeEditarTarea } = usePermisos()
  const [confirmar, setConfirmar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const avisar = useAvisar()
  const [plantilla, setPlantilla] = useState<Plantilla | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try { setPlantilla(await traerPlantilla(id)) } catch (e) { setError(mensajeDeError(e)) }
  }, [id])
  useEffect(() => { cargar() }, [cargar])

  async function eliminar() {
    setEliminando(true)
    try {
      await eliminarTarea(id)
      setConfirmar(false)
      avisar('Tarea eliminada')
      volver('hoy')
    } catch (e) {
      avisar(mensajeDeError(e), 'error')
      setEliminando(false)
    }
  }

  let cuerpo
  if (error) cuerpo = <ErrorCarga mensaje={error} reintentar={cargar} />
  else if (plantilla === undefined) cuerpo = <Cargando />
  else if (plantilla === null || !plantilla.activa) cuerpo = <Vacio emoji="🔍">Esta tarea ya no existe o fue eliminada.</Vacio>
  else if (!puedeEditarTarea({ ...plantilla })) cuerpo = <Vacio emoji="🔒">No tenés permiso para editar esta tarea.</Vacio>
  else {
    const p = plantilla
    cuerpo = (
      <FormTarea
        nueva={false}
        textoBoton="Guardar cambios"
        inicial={{
          id: p.id, titulo: p.titulo, descripcion: p.descripcion ?? '', responsable: p.responsable_id, areas: p.areas,
          frecuencia: p.frecuencia, fecha: p.fecha_unica, dias: p.dias_semana ?? [], diaMes: p.dia_mes,
          hora: p.hora_limite ? p.hora_limite.slice(0, 5) : null, objetivo: p.objective_id,
        }}
        alGuardar={async (t) => {
          await guardarTarea(t)
          avisar('Cambios guardados 🌿')
          volver('hoy')
        }}
      />
    )
    cuerpo = (
      <>
        {cuerpo}
        <button className="enlace enlace-peligro" onClick={() => setConfirmar(true)}>🗑️ Eliminar tarea</button>
        <Dialogo
          titulo="¿Eliminar esta tarea?"
          abierto={confirmar}
          alCerrar={() => { if (!eliminando) setConfirmar(false) }}
          acciones={
            <>
              <button className="boton boton-secundario" disabled={eliminando} onClick={() => setConfirmar(false)}>Cancelar</button>
              <button className="boton boton-peligro" disabled={eliminando} onClick={eliminar}>{eliminando ? 'Eliminando…' : 'Eliminar'}</button>
            </>
          }
        >
          <p>“{p.titulo}”{p.frecuencia === 'unica' ? ' se borra si todavía está pendiente.' : ' deja de repetirse y se borran todos sus días pendientes, también los vencidos.'}</p>
          <p className="ayuda">Lo que ya se hizo u omitió queda en el historial. No se puede deshacer.{!esAdmin ? ' A la admin le llega un aviso.' : ''}</p>
        </Dialogo>
      </>
    )
  }
  return (
    <>
      <Encabezado titulo="Editar tarea" atras="hoy" />
      <main className="contenido">{cuerpo}</main>
    </>
  )
}
