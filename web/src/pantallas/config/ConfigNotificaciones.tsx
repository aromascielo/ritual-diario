import { useCallback, useEffect, useState } from 'react'
import { Encabezado, Cargando } from '../../componentes/Piezas'
import { useAvisar } from '../../componentes/Avisos'
import { activarPush, alertasAlCelular, desactivarPush, estadoPush, probarAviso, type EstadoPush } from '../../lib/push'
import { useSesion } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'

/** Configuración → Notificaciones: activar los avisos en este celular, probarlos y (admin) alertas al celular. */
export function ConfigNotificaciones() {
  const { yo, recargarEquipo } = useSesion()
  const avisar = useAvisar()
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const revisar = useCallback(async () => { setEstado(await estadoPush()) }, [])
  useEffect(() => { revisar() }, [revisar])

  if (!yo) return null

  async function activar() {
    setOcupado(true)
    try {
      const e = await activarPush()
      setEstado(e)
      if (e === 'activo') avisar('Avisos activados en este celular 🌿')
      else if (e === 'bloqueado') avisar('El celular bloqueó los avisos. Mirá los pasos de abajo.', 'error')
    } catch (err) {
      avisar(mensajeDeError(err), 'error')
    } finally {
      setOcupado(false)
    }
  }

  async function apagar() {
    setOcupado(true)
    await desactivarPush()
    await revisar()
    setOcupado(false)
    avisar('Avisos apagados en este celular')
  }

  async function probar() {
    setOcupado(true)
    try {
      const n = await probarAviso()
      avisar(n === 0 ? 'Este celular no tiene los avisos activados' : 'Listo: en unos segundos te llega el aviso de prueba')
    } catch (err) {
      avisar(mensajeDeError(err), 'error')
    } finally {
      setOcupado(false)
    }
  }

  async function cambiarAlertas(v: boolean) {
    try {
      await alertasAlCelular(v)
      await recargarEquipo()
      avisar(v ? 'Las alertas del equipo también te van a llegar al celular' : 'Las alertas quedan solo en la campana')
    } catch (err) {
      avisar(mensajeDeError(err), 'error')
    }
  }

  return (
    <>
      <Encabezado titulo="Notificaciones" atras="config" />
      <main className="contenido">
        <section className="tarjeta formulario">
          <h2 className="bloque-titulo">Avisos en este celular</h2>
          {!estado && <Cargando />}
          {estado === 'activo' && (
            <>
              <p>✅ Los avisos están <strong>activados</strong> en este celular.</p>
              <div className="fila-form">
                <button className="boton" onClick={probar} disabled={ocupado}>Probar aviso</button>
                <button className="boton boton-secundario" onClick={apagar} disabled={ocupado}>Apagar</button>
              </div>
            </>
          )}
          {estado === 'apagado' && (
            <>
              <p>Activalos para que te avise el celular cuando una tarea esté por vencer, cuando venza y cuando te comenten.</p>
              <button className="boton boton-ancho" onClick={activar} disabled={ocupado}>Activar avisos</button>
              <p className="ayuda">El celular te va a preguntar si permitís notificaciones: tocá <strong>Permitir</strong>.</p>
            </>
          )}
          {estado === 'bloqueado' && (
            <>
              <p>El celular tiene <strong>bloqueados</strong> los avisos de Ritual Diario.</p>
              <ol className="pasos">
                <li>Mantené apretado el ícono de Ritual Diario en la pantalla de inicio y tocá <strong>Información de la app</strong> (ⓘ).</li>
                <li>Entrá a <strong>Notificaciones</strong> y activalas.</li>
                <li>Volvé a la app y tocá <strong>Activar avisos</strong>.</li>
              </ol>
              <button className="boton boton-secundario boton-ancho" onClick={revisar}>Ya las activé</button>
            </>
          )}
          {estado === 'iphone-sin-instalar' && (
            <>
              <p>En iPhone los avisos solo funcionan con la app agregada a la pantalla de inicio.</p>
              <ol className="pasos">
                <li>Abrí esta página en <strong>Safari</strong>.</li>
                <li>Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
                <li>Elegí <strong>Agregar a inicio</strong> y después <strong>Agregar</strong>.</li>
                <li>Abrí Ritual Diario desde el ícono nuevo, entrá con tu código y volvé a esta pantalla.</li>
              </ol>
            </>
          )}
          {estado === 'sin-soporte' && (
            <p>Este navegador no permite avisos. Probá con Chrome en Android, o con la app agregada a inicio en iPhone.</p>
          )}
        </section>

        <section className="tarjeta formulario">
          <h2 className="bloque-titulo">Qué te avisa</h2>
          <ul className="lista-simple">
            <li>☀️ A las 9:00, cuántas tareas tenés para hoy.</li>
            <li>📅 El día antes (o el mismo día) de una tarea que no es diaria.</li>
            <li>⏰ Cuando una tarea tuya vence sin completar.</li>
            <li>💬 Cuando alguien comenta una tarea tuya.</li>
          </ul>
          <p className="ayuda">De 22:00 a 8:00 no suena nada: lo que se junte te llega a las 8:00.</p>
        </section>

        {yo.rol === 'admin' && (
          <section className="tarjeta formulario">
            <h2 className="bloque-titulo">Alertas del equipo</h2>
            <label className="interruptor">
              <input type="checkbox" checked={yo.push_alertas} onChange={(e) => cambiarAlertas(e.target.checked)} />
              <span className="interruptor-pista" aria-hidden="true" />
              Que también me lleguen al celular
            </label>
            <p className="ayuda">Siempre las ves en la campana 🔔. Si activás esto, además te llegan como aviso.</p>
          </section>
        )}
      </main>
    </>
  )
}
