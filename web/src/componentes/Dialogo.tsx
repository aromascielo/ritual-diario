import { useEffect, useRef, type ReactNode } from 'react'

// Diálogo propio (nunca alert/prompt/confirm del navegador, CLAUDE.md §6).
export function Dialogo({ titulo, abierto, alCerrar, children, acciones }: {
  titulo: string
  abierto: boolean
  alCerrar: () => void
  children: ReactNode
  acciones: ReactNode
}) {
  const caja = useRef<HTMLDivElement>(null)
  // alCerrar cambia en cada render de quien abre el diálogo: se guarda en una ref para que el foco
  // vaya al primer campo SOLO al abrir (antes se volvía al primer campo con cada letra que se escribía).
  const cerrar = useRef(alCerrar)
  cerrar.current = alCerrar

  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar.current() }
    window.addEventListener('keydown', tecla)
    const primero = caja.current?.querySelector<HTMLElement>('textarea, input, select, button')
    primero?.focus()
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto])

  if (!abierto) return null
  return (
    <div className="dialogo-fondo" onClick={alCerrar}>
      <div
        ref={caja}
        className="dialogo"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dialogo-titulo">{titulo}</h2>
        <div className="dialogo-cuerpo">{children}</div>
        <div className="dialogo-acciones">{acciones}</div>
      </div>
    </div>
  )
}
