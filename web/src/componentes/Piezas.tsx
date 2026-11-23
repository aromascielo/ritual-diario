import type { ReactNode } from 'react'
import { ir, volver } from '../lib/ruta'
import { useSesion } from '../lib/sesion'
import { useAlertas } from '../lib/alertas'

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="cargando" role="status">
      <span className="ruedita" aria-hidden="true" />
      {texto}
    </div>
  )
}

export function Vacio({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="vacio">
      <div className="vacio-emoji" aria-hidden="true">{emoji}</div>
      <p>{children}</p>
    </div>
  )
}

export function ErrorCarga({ mensaje, reintentar }: { mensaje: string; reintentar: () => void }) {
  return (
    <div className="tarjeta error-carga" role="alert">
      <p>{mensaje}</p>
      <button className="boton boton-secundario" onClick={reintentar}>Reintentar</button>
    </div>
  )
}

/** Campana de alertas (solo admin) con la cantidad sin leer. */
function Campana() {
  const { yo } = useSesion()
  const { noLeidas } = useAlertas()
  if (yo?.rol !== 'admin') return null
  return (
    <button className="boton-icono campana" onClick={() => ir('alertas')}
      aria-label={noLeidas > 0 ? `Alertas: ${noLeidas} sin leer` : 'Alertas'}>
      <span aria-hidden="true">🔔</span>
      {noLeidas > 0 && <span className="badge" aria-hidden="true">{noLeidas > 99 ? '99+' : noLeidas}</span>}
    </button>
  )
}

/** Barra de arriba: título (o botón atrás), campana (admin) y engranaje. */
export function Encabezado({ titulo, atras }: { titulo?: string; atras?: string }) {
  return (
    <header className="encabezado">
      {atras !== undefined ? (
        <button className="boton-icono" onClick={() => volver(atras)} aria-label="Volver">
          <span aria-hidden="true">‹</span>
        </button>
      ) : (
        <span className="marca">Ritual Diario</span>
      )}
      {titulo && <h1 className="encabezado-titulo">{titulo}</h1>}
      <Campana />
      <button className="boton-icono" onClick={() => ir('config')} aria-label="Configuración">
        <span aria-hidden="true">⚙︎</span>
      </button>
    </header>
  )
}

const PESTANAS = [
  { ruta: 'hoy', texto: 'Hoy', icono: '☀︎' },
  { ruta: 'objetivos', texto: 'Objetivos', icono: '◎' },
  { ruta: 'areas', texto: 'Áreas', icono: '▦' },
  { ruta: 'equipo', texto: 'Equipo', icono: '☺︎' },
]

export function NavInferior({ actual }: { actual: string }) {
  return (
    <nav className="nav-inferior" aria-label="Secciones">
      {PESTANAS.map((p) => (
        <a
          key={p.ruta}
          href={`#/${p.ruta}`}
          className={`nav-item${actual === p.ruta ? ' activo' : ''}`}
          aria-current={actual === p.ruta ? 'page' : undefined}
        >
          <span className="nav-icono" aria-hidden="true">{p.icono}</span>
          <span>{p.texto}</span>
        </a>
      ))}
    </nav>
  )
}

/** Etiqueta de área con su emoji y color. */
export function ChipArea({ emoji, nombre, color }: { emoji: string; nombre: string; color: string }) {
  return (
    <span className="chip-area" style={{ borderColor: color }}>
      <span aria-hidden="true">{emoji}</span> {nombre}
    </span>
  )
}

export function Barra({ porcentaje, ritmo, atrasado }: { porcentaje: number | null; ritmo?: number | null; atrasado?: boolean }) {
  const p = Math.max(0, Math.min(100, porcentaje ?? 0))
  return (
    <div className="barra" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`barra-relleno${atrasado ? ' atrasado' : ''}`} style={{ width: `${p}%` }} />
      {ritmo != null && <div className="barra-ritmo" style={{ left: `${Math.min(100, ritmo)}%` }} title={`Ritmo esperado: ${ritmo} %`} />}
    </div>
  )
}
