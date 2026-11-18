import { useState } from 'react'
import { marcarTarea } from '../lib/datos'
import { mensajeDeError } from '../lib/supabase'
import type { Estado, Instancia, ObjetivoBreve } from '../lib/tipos'
import { useAvisar } from './Avisos'
import { Dialogo } from './Dialogo'

/**
 * Cambiar el estado de una tarea, con los diálogos que hagan falta:
 * motivo al omitir y "¿cuántos?" si la tarea suma a un objetivo numérico.
 */
export function useMarcar(objetivos: ObjetivoBreve[], alTerminar: () => void) {
  const avisar = useAvisar()
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [paraOmitir, setParaOmitir] = useState<Instancia | null>(null)
  const [motivo, setMotivo] = useState('')
  const [paraContar, setParaContar] = useState<{ i: Instancia; obj: ObjetivoBreve } | null>(null)
  const [cantidad, setCantidad] = useState('')

  async function enviar(i: Instancia, estado: Estado, m?: string, c?: number) {
    setOcupada(i.id)
    try {
      await marcarTarea(i.id, estado, m, c)
      avisar(estado === 'hecha' ? '¡Hecha! 🌿' : estado === 'omitida' ? 'Tarea omitida' : 'Volvió a pendiente')
      alTerminar()
    } catch (e) {
      avisar(mensajeDeError(e), 'error')
    } finally {
      setOcupada(null)
    }
  }

  /** Tocar la casilla: alterna entre hecha y pendiente. */
  function alternar(i: Instancia) {
    if (i.estado === 'hecha') return enviar(i, 'pendiente')
    pedir(i, 'hecha')
  }

  function pedir(i: Instancia, estado: Estado) {
    if (estado === 'omitida') {
      setMotivo('')
      setParaOmitir(i)
      return
    }
    if (estado === 'hecha' && i.objective_id) {
      const obj = objetivos.find((o) => o.id === i.objective_id)
      if (obj?.tipo_medicion === 'numerico') {
        setCantidad('')
        setParaContar({ i, obj })
        return
      }
    }
    return enviar(i, estado)
  }

  const motivoOk = motivo.trim().length >= 3
  const numero = Number(cantidad.replace(',', '.'))

  const dialogos = (
    <>
      <Dialogo
        titulo="¿Por qué la omitís?"
        abierto={!!paraOmitir}
        alCerrar={() => setParaOmitir(null)}
        acciones={
          <>
            <button className="boton boton-secundario" onClick={() => setParaOmitir(null)}>Cancelar</button>
            <button
              className="boton"
              disabled={!motivoOk}
              onClick={() => { const i = paraOmitir!; setParaOmitir(null); enviar(i, 'omitida', motivo.trim()) }}
            >
              Omitir
            </button>
          </>
        }
      >
        <p className="ayuda">Una tarea omitida no cuenta como incumplida. A la admin le llega un aviso con el motivo.</p>
        <label className="campo">
          <span>Motivo</span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Por ejemplo: no llegó el material"
          />
        </label>
      </Dialogo>

      <Dialogo
        titulo="¿Cuántos?"
        abierto={!!paraContar}
        alCerrar={() => setParaContar(null)}
        acciones={
          <>
            <button className="boton boton-secundario" onClick={() => { const x = paraContar!; setParaContar(null); enviar(x.i, 'hecha') }}>
              Sin cantidad
            </button>
            <button
              className="boton"
              disabled={!(numero > 0)}
              onClick={() => { const x = paraContar!; setParaContar(null); enviar(x.i, 'hecha', undefined, numero) }}
            >
              Guardar
            </button>
          </>
        }
      >
        <p className="ayuda">Esta tarea suma al objetivo “{paraContar?.obj.titulo}”.</p>
        <label className="campo">
          <span>Cantidad{paraContar?.obj.unidad ? ` (${paraContar.obj.unidad})` : ''}</span>
          <input inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
        </label>
      </Dialogo>
    </>
  )

  return { ocupada, alternar, pedir, dialogos }
}
