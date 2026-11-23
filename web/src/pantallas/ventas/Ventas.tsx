import { useCallback, useEffect, useMemo, useState } from 'react'
import { Encabezado, Cargando, ErrorCarga, Vacio } from '../../componentes/Piezas'
import { Dialogo } from '../../componentes/Dialogo'
import { useAvisar } from '../../componentes/Avisos'
import { borrarVenta, clientesMayoristas, guardarVenta, resumenVentas, traerVentas, type DatosVenta } from '../../lib/datos'
import { hoyISO } from '../../lib/fechas'
import { EMOJI_CANAL, NOMBRES_CANAL, diaMes, nombreMes, numero, pesos } from '../../lib/formato'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Canal, ResumenVentas, Venta } from '../../lib/tipos'

function finDeMes(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10) // fecha armada en UTC a propósito
}
function moverMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 10)
}

const VACIA: DatosVenta = { fecha: hoyISO(), monto: 0, canal: 'tienda_online', cliente: '', nota: '' }

/** Ventas del mes: totales (calculados en la base) y listado; carga una por una (CLAUDE.md §4). */
export function Ventas() {
  const { yo, perfiles } = useSesion()
  const { esAdmin, cargaVentas } = usePermisos()
  const avisar = useAvisar()
  const [mes, setMes] = useState(hoyISO().slice(0, 8) + '01')
  const [ventas, setVentas] = useState<Venta[] | null>(null)
  const [resumen, setResumen] = useState<ResumenVentas | null>(null)
  const [clientes, setClientes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: string | null; d: DatosVenta; monto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [paraBorrar, setParaBorrar] = useState<Venta | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const fin = finDeMes(mes)
      const [v, r, c] = await Promise.all([traerVentas(mes, fin), resumenVentas(mes, fin), clientesMayoristas()])
      setVentas(v); setResumen(r); setClientes(c)
    } catch (e) { setError(mensajeDeError(e)) }
  }, [mes])
  useEffect(() => { setVentas(null); cargar() }, [cargar])

  const nombre = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles])
  const esMesActual = mes === hoyISO().slice(0, 8) + '01'
  const puedeTocar = (v: Venta) => esAdmin || (cargaVentas && v.cargado_por === yo?.id)

  function abrir(v: Venta | null) {
    setErrorForm(null)
    setEditando(v
      ? { id: v.id, d: { fecha: v.fecha, monto: v.monto, canal: v.canal, cliente: v.cliente ?? '', nota: v.nota ?? '' }, monto: String(v.monto).replace('.', ',') }
      : { id: null, d: { ...VACIA, fecha: esMesActual ? hoyISO() : finDeMes(mes) }, monto: '' })
  }

  async function guardar() {
    if (!editando || !yo) return
    const monto = Number(editando.monto.replace(/\./g, '').replace(',', '.'))
    if (!(monto > 0)) return setErrorForm('Escribí el monto en pesos.')
    if (editando.d.canal === 'mayorista' && !editando.d.cliente.trim()) return setErrorForm('Para una venta mayorista escribí el cliente.')
    if (!editando.d.fecha) return setErrorForm('Elegí la fecha.')
    setGuardando(true)
    setErrorForm(null)
    try {
      // Mismo cliente escrito distinto ("hotel paihuen" / "Hotel Paihuen"): se guarda como ya estaba cargado.
      const igual = clientes.find((c) => c.toLowerCase() === editando.d.cliente.trim().toLowerCase())
      const cliente = editando.d.canal === 'mayorista' ? (igual ?? editando.d.cliente.trim()) : ''
      await guardarVenta(editando.id, { ...editando.d, cliente, monto }, yo.id)
      avisar(editando.id ? 'Venta guardada' : `Venta de ${pesos.format(monto)} cargada 🌿`)
      const mesVenta = editando.d.fecha.slice(0, 8) + '01'
      setEditando(null)
      if (mesVenta !== mes) setMes(mesVenta); else await cargar()
    } catch (e) { setErrorForm(mensajeDeError(e)) } finally { setGuardando(false) }
  }

  async function borrar() {
    const v = paraBorrar
    setParaBorrar(null)
    if (!v) return
    try { await borrarVenta(v.id); avisar('Venta borrada'); await cargar() } catch (e) { avisar(mensajeDeError(e), 'error') }
  }

  const e = editando
  const cambiar = <K extends keyof DatosVenta>(k: K, val: DatosVenta[K]) => setEditando((x) => (x ? { ...x, d: { ...x.d, [k]: val } } : x))

  return (
    <>
      <Encabezado titulo="Ventas" atras="vea" />
      <main className="contenido">
        <div className="selector-mes">
          <button className="boton-icono" onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior">‹</button>
          <h1 className="titulo-serif">{nombreMes(mes, true)}</h1>
          <button className="boton-icono" onClick={() => setMes(moverMes(mes, 1))} disabled={esMesActual} aria-label="Mes siguiente">›</button>
        </div>

        {error && <ErrorCarga mensaje={error} reintentar={cargar} />}
        {resumen && (
          <section className="tarjeta resumen-ventas">
            <div className="avance-grande">
              <span className="resumen-numero">{pesos.format(resumen.total)}</span>
              <span className="ayuda">{resumen.cantidad === 1 ? '1 venta' : `${resumen.cantidad} ventas`} en el mes</span>
            </div>
            <ul className="canales">
              {(['conocidos', 'tienda_online', 'mayorista'] as Canal[]).map((c) => (
                <li key={c}><span>{EMOJI_CANAL[c]} {NOMBRES_CANAL[c]}</span><strong>{pesos.format(resumen[c])}</strong></li>
              ))}
            </ul>
            <p className="ayuda">
              Tienda online: {resumen.proporcion_tienda == null ? '—' : `${numero.format(resumen.proporcion_tienda)} %`} de lo minorista
              (meta 2/3) · {resumen.clientes_mayoristas === 1 ? '1 cliente mayorista' : `${resumen.clientes_mayoristas} clientes mayoristas`}
            </p>
          </section>
        )}

        {!ventas && !error && <Cargando />}
        {ventas && ventas.length === 0 && <Vacio emoji="🧾">No hay ventas cargadas en {nombreMes(mes, true)}.</Vacio>}
        {ventas && ventas.length > 0 && (
          <ul className="lista-tareas">
            {ventas.map((v) => (
              <li key={v.id} className="fila-tarea">
                <span className="fila-config-emoji" aria-hidden="true">{EMOJI_CANAL[v.canal]}</span>
                <button type="button" className="fila-texto" disabled={!puedeTocar(v)} onClick={() => abrir(v)}>
                  <span className="fila-titulo">{pesos.format(v.monto)}{v.cliente ? ` · ${v.cliente}` : ''}</span>
                  <span className="fila-meta">
                    {diaMes(v.fecha)} · {NOMBRES_CANAL[v.canal]} · cargó {nombre.get(v.cargado_por ?? '') ?? '—'}{v.nota ? ` · ${v.nota}` : ''}
                  </span>
                </button>
                {puedeTocar(v) && <button className="enlace enlace-chico" onClick={() => setParaBorrar(v)}>Borrar</button>}
              </li>
            ))}
          </ul>
        )}
        {!cargaVentas && <p className="ayuda centrado">Las ventas las cargan la admin y quienes tienen el permiso "carga ventas".</p>}
      </main>
      {cargaVentas && <button className="boton-flotante" onClick={() => abrir(null)}><span aria-hidden="true">＋</span> Cargar venta</button>}

      <Dialogo
        titulo={e?.id ? 'Editar venta' : 'Cargar venta'}
        abierto={!!e}
        alCerrar={() => { if (!guardando) setEditando(null) }}
        acciones={
          <>
            <button className="boton boton-secundario" disabled={guardando} onClick={() => setEditando(null)}>Cancelar</button>
            <button className="boton" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        {e && (
          <div className="formulario">
            <label className="campo"><span>Monto ($)</span>
              <input className="input-monto" inputMode="decimal" value={e.monto} placeholder="15000"
                onChange={(x) => setEditando({ ...e, monto: x.target.value })} />
            </label>
            <fieldset className="campo">
              <legend>¿Por dónde?</legend>
              <div className="chips">
                {(['conocidos', 'tienda_online', 'mayorista'] as Canal[]).map((c) => (
                  <button key={c} type="button" className={`chip${e.d.canal === c ? ' elegido' : ''}`} aria-pressed={e.d.canal === c} onClick={() => cambiar('canal', c)}>
                    {EMOJI_CANAL[c]} {NOMBRES_CANAL[c]}
                  </button>
                ))}
              </div>
              <span className="ayuda">Meta del plan: de lo minorista, 1/3 a conocidos y 2/3 a desconocidos por la tienda online.</span>
            </fieldset>
            {e.d.canal === 'mayorista' && (
              <label className="campo"><span>Cliente</span>
                <input value={e.d.cliente} onChange={(x) => cambiar('cliente', x.target.value)} list="clientes-mayoristas" maxLength={80} placeholder="Por ejemplo: Hotel Paihuen" />
                <datalist id="clientes-mayoristas">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
            )}
            <label className="campo"><span>Fecha</span>
              <input type="date" value={e.d.fecha} max={hoyISO()} onChange={(x) => cambiar('fecha', x.target.value)} />
            </label>
            <label className="campo"><span>Nota (opcional)</span>
              <input value={e.d.nota} onChange={(x) => cambiar('nota', x.target.value)} maxLength={200} />
            </label>
            {errorForm && <p className="error-texto" role="alert">{errorForm}</p>}
          </div>
        )}
      </Dialogo>
      <Dialogo
        titulo="¿Borrar la venta?"
        abierto={!!paraBorrar}
        alCerrar={() => setParaBorrar(null)}
        acciones={<><button className="boton boton-secundario" onClick={() => setParaBorrar(null)}>Cancelar</button><button className="boton boton-peligro" onClick={borrar}>Borrar</button></>}
      >
        <p>{paraBorrar && `${pesos.format(paraBorrar.monto)} del ${diaMes(paraBorrar.fecha)} (${NOMBRES_CANAL[paraBorrar.canal]}). Cambia los números del Plan VEA. No se puede deshacer.`}</p>
      </Dialogo>
    </>
  )
}
