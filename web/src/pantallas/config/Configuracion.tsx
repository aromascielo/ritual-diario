import { useState, type FormEvent } from 'react'
import { Encabezado } from '../../componentes/Piezas'
import { Dialogo } from '../../componentes/Dialogo'
import { useAvisar } from '../../componentes/Avisos'
import { actualizarMiNombre } from '../../lib/datos'
import { useSesion } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import { aplicarTema, temaGuardado, type Tema } from '../../lib/tema'

export function Configuracion() {
  const { yo, salir, recargarEquipo, miembros, areas } = useSesion()
  const avisar = useAvisar()
  const [nombre, setNombre] = useState(yo?.nombre ?? '')
  const [tema, setTema] = useState<Tema>(temaGuardado)
  const [confirmarSalida, setConfirmarSalida] = useState(false)

  if (!yo) return null
  const misAreas = miembros
    .filter((m) => m.profile_id === yo.id)
    .map((m) => ({ m, a: areas.find((a) => a.id === m.area_id) }))
    .filter((x) => x.a)
    .sort((x, y) => x.a!.orden - y.a!.orden)

  async function guardarNombre(e: FormEvent) {
    e.preventDefault()
    try {
      await actualizarMiNombre(nombre)
      await recargarEquipo()
      avisar('Nombre guardado')
    } catch (err) {
      avisar(mensajeDeError(err), 'error')
    }
  }

  function elegirTema(t: Tema) {
    setTema(t)
    aplicarTema(t)
  }

  return (
    <>
      <Encabezado titulo="Configuración" atras="hoy" />
      <main className="contenido">
        <section className="tarjeta formulario">
          <h2 className="bloque-titulo">Tu cuenta</h2>
          <p className="ayuda">{yo.email} · {yo.rol === 'admin' ? 'Admin' : 'Integrante'}{yo.carga_ventas ? ' · carga ventas' : ''}</p>
          <form onSubmit={guardarNombre} className="fila-form">
            <label className="campo crece">
              <span>Tu nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} />
            </label>
            <button className="boton" disabled={!nombre.trim() || nombre.trim() === yo.nombre}>Guardar</button>
          </form>
          <p className="ayuda">
            Tus áreas: {misAreas.length === 0
              ? 'ninguna todavía.'
              : misAreas.map((x) => `${x.a!.emoji} ${x.a!.nombre}${x.m.rol_area === 'lider' ? ' (líder)' : ''}`).join(' · ')}
          </p>
        </section>

        <section className="tarjeta formulario">
          <h2 className="bloque-titulo">Apariencia</h2>
          <div className="chips" role="radiogroup" aria-label="Apariencia">
            {(['claro', 'oscuro', 'auto'] as Tema[]).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tema === t}
                className={`chip${tema === t ? ' elegido' : ''}`} onClick={() => elegirTema(t)}>
                {t === 'claro' ? '☀︎ Claro' : t === 'oscuro' ? '☾ Oscuro' : 'Automático'}
              </button>
            ))}
          </div>
        </section>

        <section className="tarjeta formulario">
          <h2 className="bloque-titulo">Próximamente</h2>
          <p className="ayuda">Tareas recurrentes, áreas, personas y notificaciones se configuran acá a partir de la fase 3.</p>
        </section>

        <button className="boton boton-secundario boton-ancho" onClick={() => setConfirmarSalida(true)}>Cerrar sesión</button>
        <p className="ayuda centrado version">Ritual Diario v2 · fase 2</p>
      </main>
      <Dialogo
        titulo="¿Cerrar sesión?"
        abierto={confirmarSalida}
        alCerrar={() => setConfirmarSalida(false)}
        acciones={
          <>
            <button className="boton boton-secundario" onClick={() => setConfirmarSalida(false)}>Cancelar</button>
            <button className="boton" onClick={salir}>Cerrar sesión</button>
          </>
        }
      >
        <p>Para volver a entrar te va a llegar un código nuevo por mail.</p>
      </Dialogo>
    </>
  )
}
