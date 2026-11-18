import { useEffect, useState } from 'react'

// Rutas con hash (#/hoy, #/tarea/<id>…) para que funcione "atrás" y los push abran la tarea exacta.
export interface Ruta {
  pantalla: string
  id: string | null
}

function leer(): Ruta {
  const partes = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  return { pantalla: partes[0] ?? 'hoy', id: partes[1] ? decodeURIComponent(partes[1]) : null }
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(leer)
  useEffect(() => {
    const cambio = () => {
      setRuta(leer())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', cambio)
    return () => window.removeEventListener('hashchange', cambio)
  }, [])
  return ruta
}

// Cuántas veces se navegó dentro de la app (para saber si "atrás" queda adentro).
let pasos = 0

export function ir(ruta: string): void {
  pasos++
  window.location.hash = ruta.startsWith('#') ? ruta : `#/${ruta.replace(/^\//, '')}`
}

/** Vuelve atrás si se llegó navegando dentro de la app; si no (por ejemplo desde un push), va a Hoy. */
export function volver(destino = 'hoy'): void {
  if (pasos > 0) {
    pasos--
    window.history.back()
  } else {
    window.location.replace(`#/${destino}`)
  }
}
