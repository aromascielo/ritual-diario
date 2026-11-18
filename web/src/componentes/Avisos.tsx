import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Tipo = 'ok' | 'error'
interface Aviso { id: number; texto: string; tipo: Tipo }

const Ctx = createContext<(texto: string, tipo?: Tipo) => void>(() => {})

/** Mensajitos que aparecen abajo unos segundos ("Tarea guardada", errores…). */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const n = useRef(0)

  const avisar = useCallback((texto: string, tipo: Tipo = 'ok') => {
    const id = ++n.current
    setAvisos((a) => [...a.slice(-1), { id, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 6000 : 3000)
  }, [])

  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div className="avisos" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso aviso-${a.tipo}`} role={a.tipo === 'error' ? 'alert' : 'status'}>
            {a.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useAvisar() {
  return useContext(Ctx)
}
