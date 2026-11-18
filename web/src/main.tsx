import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ProveedorAvisos } from './componentes/Avisos'
import { ProveedorSesion } from './lib/sesion'
import { aplicarTema, temaGuardado } from './lib/tema'
import './estilos.css'

aplicarTema(temaGuardado())

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <ProveedorAvisos>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </ProveedorAvisos>
  </StrictMode>,
)
