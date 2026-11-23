import { useCallback, useEffect, useState } from 'react'
import { Encabezado, Cargando, Vacio } from '../../componentes/Piezas'
import { Dialogo } from '../../componentes/Dialogo'
import { useAvisar } from '../../componentes/Avisos'
import { ElegirAreasRol } from '../../componentes/ElegirAreasRol'
import { cancelarInvitacion, invitarPersona, traerInvitaciones } from '../../lib/datos'
import { ir } from '../../lib/ruta'
import { useSesion, usePermisos } from '../../lib/sesion'
import { mensajeDeError } from '../../lib/supabase'
import type { Invitacion, Perfil, Rol, RolArea } from '../../lib/tipos'

const DIRECCION_APP = 'https://ritual-diario.aromascielo.workers.dev'

/** Configuración → Personas (solo admin; las funciones de la base lo exigen). */
export function ConfigPersonas() {
  const { perfiles, areas, miembros } = useSesion()
  const { esAdmin } = usePermisos()
  const avisar = useAvisar()
  const [invitaciones, setInvitaciones] = useState<Invitacion[] | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('integrante')
  const [cargaVentas, setCargaVentas] = useState(false)
  const [roles, setRoles] = useState<Record<string, RolArea | undefined>>({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paraCancelar, setParaCancelar] = useState<Invitacion | null>(null)
  const [invitada, setInvitada] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try { setInvitaciones(await traerInvitaciones()) } catch (e) { avisar(mensajeDeError(e), 'error') }
  }, [avisar])
  useEffect(() => { if (esAdmin) cargar() }, [cargar, esAdmin])

  if (!esAdmin) {
    return (<><Encabezado titulo="Personas" atras="config" /><main className="contenido"><Vacio emoji="🔒">Solo la admin gestiona el equipo.</Vacio></main></>)
  }

  const activas = perfiles.filter((p) => p.activo)
  const deBaja = perfiles.filter((p) => !p.activo)
  const areasActivas = areas.filter((a) => a.activa)

  function abrirInvitar() {
    setNombre(''); setEmail(''); setRol('integrante'); setCargaVentas(false); setRoles({}); setError(null); setInvitada(null)
    setAbierto(true)
  }

  async function invitar() {
    setError(null)
    if (!nombre.trim()) return setError('Escribí el nombre.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Escribí un mail válido.')
    setEnviando(true)
    try {
      const lista = Object.entries(roles).filter(([, r]) => r).map(([area_id, r]) => ({ area_id, rol_area: r as RolArea }))
      await invitarPersona(email.trim().toLowerCase(), nombre.trim(), rol, cargaVentas, lista)
      setInvitada(nombre.trim())
      await cargar()
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  async function cancelar() {
    const inv = paraCancelar
    setParaCancelar(null)
    if (!inv) return
    try {
      await cancelarInvitacion(inv.email)
      avisar('Invitación cancelada')
      await cargar()
    } catch (e) { avisar(mensajeDeError(e), 'error') }
  }

  function resumenAreas(p: Perfil) {
    const suyas = miembros.filter((m) => m.profile_id === p.id)
    const lider = suyas.filter((m) => m.rol_area === 'lider').length
    if (suyas.length === 0) return 'Sin áreas'
    return `${suyas.length} ${suyas.length === 1 ? 'área' : 'áreas'}${lider ? ` (líder en ${lider})` : ''}`
  }

  function Persona({ p }: { p: Perfil }) {
    return (
      <li>
        <button className="tarjeta fila-config" onClick={() => ir(`persona/${p.id}`)}>
          <span className="avatar" aria-hidden="true">{p.nombre.slice(0, 1).toUpperCase()}</span>
          <span className="fila-config-texto">
            <strong>{p.nombre}</strong>
            <span className="ayuda">
              {p.rol === 'admin' ? 'Admin' : 'Integrante'}{p.carga_ventas ? ' · carga ventas' : ''} · {resumenAreas(p)}
            </span>
          </span>
          <span className="fila-flecha" aria-hidden="true">›</span>
        </button>
      </li>
    )
  }

  return (
    <>
      <Encabezado titulo="Personas" atras="config" />
      <main className="contenido">
        <ul className="lista-config">{activas.map((p) => <Persona key={p.id} p={p} />)}</ul>

        <section className="bloque">
          <h2 className="bloque-titulo">✉️ Invitaciones pendientes</h2>
          {!invitaciones && <Cargando />}
          {invitaciones && invitaciones.length === 0 && <p className="ayuda">No hay invitaciones esperando.</p>}
          <ul className="lista-config">
            {invitaciones?.map((inv) => (
              <li key={inv.email} className="tarjeta fila-config">
                <span className="avatar avatar-invitada" aria-hidden="true">✉️</span>
                <span className="fila-config-texto">
                  <strong>{inv.nombre}</strong>
                  <span className="ayuda">
                    {inv.email} · {inv.rol === 'admin' ? 'Admin' : 'Integrante'}
                    {inv.areas.length ? ` · ${inv.areas.length} ${inv.areas.length === 1 ? 'área' : 'áreas'}` : ' · sin áreas'}
                  </span>
                </span>
                <button className="enlace enlace-chico" onClick={() => setParaCancelar(inv)}>Cancelar</button>
              </li>
            ))}
          </ul>
        </section>

        {deBaja.length > 0 && (
          <section className="bloque">
            <h2 className="bloque-titulo">Dadas de baja</h2>
            <ul className="lista-config archivadas">{deBaja.map((p) => <Persona key={p.id} p={p} />)}</ul>
          </section>
        )}
      </main>
      <button className="boton-flotante" onClick={abrirInvitar}><span aria-hidden="true">＋</span> Invitar persona</button>

      <Dialogo
        titulo={invitada ? '¡Invitación lista!' : 'Invitar persona'}
        abierto={abierto}
        alCerrar={() => { if (!enviando) setAbierto(false) }}
        acciones={invitada ? (
          <button className="boton" onClick={() => setAbierto(false)}>Listo</button>
        ) : (
          <>
            <button className="boton boton-secundario" disabled={enviando} onClick={() => setAbierto(false)}>Cancelar</button>
            <button className="boton" disabled={enviando} onClick={invitar}>{enviando ? 'Invitando…' : 'Invitar'}</button>
          </>
        )}
      >
        {invitada ? (
          <>
            <p>Ahora mandale a {invitada} la dirección de la app:</p>
            <p className="direccion-app">{DIRECCION_APP}</p>
            <p className="ayuda">Entra con su mail, le llega un código y ya queda con el rol y las áreas que elegiste.</p>
          </>
        ) : (
          <div className="formulario">
            <label className="campo"><span>Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Laura" />
            </label>
            <label className="campo"><span>Mail</span>
              <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@gmail.com" />
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
            <fieldset className="campo">
              <legend>Áreas</legend>
              <span className="ayuda">Tocá cada área para elegir: No está → Miembro → Líder.</span>
              <ElegirAreasRol areas={areasActivas} roles={roles}
                alCambiar={(a, r) => setRoles((x) => ({ ...x, [a]: r ?? undefined }))} />
            </fieldset>
            {error && <p className="error-texto" role="alert">{error}</p>}
          </div>
        )}
      </Dialogo>

      <Dialogo
        titulo="¿Cancelar la invitación?"
        abierto={!!paraCancelar}
        alCerrar={() => setParaCancelar(null)}
        acciones={
          <>
            <button className="boton boton-secundario" onClick={() => setParaCancelar(null)}>Volver</button>
            <button className="boton boton-peligro" onClick={cancelar}>Cancelar invitación</button>
          </>
        }
      >
        <p>{paraCancelar?.nombre} ({paraCancelar?.email}) ya no va a poder entrar, salvo que la vuelvas a invitar.</p>
      </Dialogo>
    </>
  )
}
