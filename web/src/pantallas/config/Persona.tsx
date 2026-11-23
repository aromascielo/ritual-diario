import { useState } from 'react'
import { Encabezado, Vacio } from '../../componentes/Piezas'
import { Dialogo } from '../../componentes/Dialogo'
import { useAvisar } from '../../componentes/Avisos'
import { ElegirAreasRol } from '../../componentes/ElegirAreasRol'
import { actualizarPersona, asignarArea } from '../../lib/datos'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Rol, RolArea } from '../../lib/tipos'

/** Una persona del equipo: datos, rol, permisos y áreas (solo admin). */
export function Persona({ id }: { id: string }) {
  const { yo, perfiles, areas, miembros, recargarEquipo } = useSesion()
  const { esAdmin } = usePermisos()
  const avisar = useAvisar()
  const p = perfiles.find((x) => x.id === id)
  const [nombre, setNombre] = useState(p?.nombre ?? '')
  const [rol, setRol] = useState<Rol>(p?.rol ?? 'integrante')
  const [cargaVentas, setCargaVentas] = useState(p?.carga_ventas ?? false)
  const [guardando, setGuardando] = useState(false)
  const [ocupadoAreas, setOcupadoAreas] = useState(false)
  const [confirmarBaja, setConfirmarBaja] = useState(false)

  if (!esAdmin) return (<><Encabezado titulo="Persona" atras="config/personas" /><main className="contenido"><Vacio emoji="🔒">Solo la admin gestiona el equipo.</Vacio></main></>)
  if (!p) return (<><Encabezado titulo="Persona" atras="config/personas" /><main className="contenido"><Vacio emoji="🔍">No encontramos a esta persona.</Vacio></main></>)

  const roles: Record<string, RolArea> = Object.fromEntries(
    miembros.filter((m) => m.profile_id === p.id).map((m) => [m.area_id, m.rol_area]))
  const cambios = nombre.trim() !== p.nombre || rol !== p.rol || cargaVentas !== p.carga_ventas

  async function guardar(activo: boolean, mensaje: string) {
    if (!nombre.trim()) { avisar('Escribí el nombre.', 'error'); return }
    setGuardando(true)
    try {
      await actualizarPersona(p!.id, nombre.trim(), rol, activo, cargaVentas)
      await recargarEquipo()
      avisar(mensaje)
    } catch (e) {
      avisar(mensajeDeError(e), 'error')
    } finally {
      setGuardando(false)
      setConfirmarBaja(false)
    }
  }

  async function cambiarArea(area: string, r: RolArea | null) {
    setOcupadoAreas(true)
    try {
      await asignarArea(p!.id, area, r)
      await recargarEquipo()
    } catch (e) {
      avisar(mensajeDeError(e), 'error')
    } finally {
      setOcupadoAreas(false)
    }
  }

  return (
    <>
      <Encabezado titulo={p.nombre} atras="config/personas" />
      <main className="contenido">
        {!p.activo && <p className="tarjeta aviso-baja">Esta persona está dada de baja: no puede entrar y no recibe tareas nuevas.</p>}
        <section className="tarjeta formulario">
          <p className="ayuda">{p.email}{p.id === yo?.id ? ' · sos vos' : ''}</p>
          <label className="campo"><span>Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} />
          </label>
          <fieldset className="campo">
            <legend>Rol</legend>
            <div className="chips" role="radiogroup" aria-label="Rol">
              {(['integrante', 'admin'] as Rol[]).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={rol === r}
                  className={`chip${rol === r ? ' elegido' : ''}`} onClick={() => setRol(r)}>
                  {r === 'admin' ? 'Admin (puede todo)' : 'Integrante'}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="interruptor">
            <input type="checkbox" checked={cargaVentas} onChange={(e) => setCargaVentas(e.target.checked)} />
            <span className="interruptor-pista" aria-hidden="true" />
            Puede cargar ventas
          </label>
          <button className="boton" disabled={!cambios || guardando} onClick={() => guardar(p.activo, 'Cambios guardados')}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </section>

        <section className="tarjeta formulario">
          <h2 className="bloque-titulo">Áreas</h2>
          <span className="ayuda">Tocá cada área para cambiar: No está → Miembro → Líder. Se guarda al tocar.</span>
          <ElegirAreasRol areas={areas.filter((a) => a.activa)} roles={roles} alCambiar={cambiarArea} deshabilitado={ocupadoAreas} />
        </section>

        {p.id !== yo?.id && (p.activo ? (
          <button className="enlace enlace-peligro" onClick={() => setConfirmarBaja(true)}>Dar de baja</button>
        ) : (
          <button className="boton boton-secundario boton-ancho" disabled={guardando} onClick={() => guardar(true, 'Persona reactivada')}>Reactivar</button>
        ))}
      </main>
      <Dialogo
        titulo={`¿Dar de baja a ${p.nombre}?`}
        abierto={confirmarBaja}
        alCerrar={() => setConfirmarBaja(false)}
        acciones={
          <>
            <button className="boton boton-secundario" onClick={() => setConfirmarBaja(false)}>Cancelar</button>
            <button className="boton boton-peligro" disabled={guardando} onClick={() => guardar(false, 'Persona dada de baja')}>Dar de baja</button>
          </>
        }
      >
        <p>No va a poder entrar y se borran sus tareas pendientes de hoy en adelante. Su historial queda guardado y la podés reactivar cuando quieras.</p>
      </Dialogo>
    </>
  )
}
