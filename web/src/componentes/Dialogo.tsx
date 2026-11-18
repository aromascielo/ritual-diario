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

  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar() }
    window.addEventListener('keydown', tecla)
    const primero = caja.current?.querySelector<HTMLElement>('textarea, input, select, button')
    primero?.focus()
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, alCerrar])

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
