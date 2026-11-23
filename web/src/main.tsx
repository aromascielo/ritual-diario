import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ProveedorAvisos } from './componentes/Avisos'
import { ProveedorSesion } from './lib/sesion'
import { ProveedorAlertas } from './lib/alertas'
import { aplicarTema, temaGuardado } from './lib/tema'
import { registrarServiceWorker } from './lib/push'
import './estilos.css'

aplicarTema(temaGuardado())
registrarServiceWorker()

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <ProveedorAvisos>
      <ProveedorSesion>
        <ProveedorAlertas>
          <App />
        </ProveedorAlertas>
      </ProveedorSesion>
    </ProveedorAvisos>
  </StrictMode>,
)
