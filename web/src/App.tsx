import { Cargando, ErrorCarga, NavInferior } from './componentes/Piezas'
import { useRuta } from './lib/ruta'
import { useSesion } from './lib/sesion'
import { Login } from './pantallas/login/Login'
import { Hoy } from './pantallas/hoy/Hoy'
import { DetalleTarea } from './pantallas/tarea/DetalleTarea'
import { AgregarTarea } from './pantallas/agregar/AgregarTarea'
import { Objetivos } from './pantallas/objetivos/Objetivos'
import { Configuracion } from './pantallas/config/Configuracion'
import { Pronto } from './pantallas/pronto/Pronto'

export function App() {
  const { cargando, error, session, yo, salir, recargarEquipo } = useSesion()
  const ruta = useRuta()

  if (cargando) return <main className="contenido"><Cargando /></main>
  if (!session) return <Login />
  if (error && !yo) return <main className="contenido"><ErrorCarga mensaje={error} reintentar={recargarEquipo} /></main>
  if (!yo || !yo.activo) {
    return (
      <main className="login">
        <div className="login-caja tarjeta">
          <h1 className="titulo-serif">Cuenta sin acceso</h1>
          <p>Tu cuenta no está activa en el equipo. Si creés que es un error, avisale a Cami.</p>
          <button className="boton boton-ancho" onClick={salir}>Salir</button>
        </div>
      </main>
    )
  }

  let pantalla
  switch (ruta.pantalla) {
    case 'tarea':
      pantalla = ruta.id ? <DetalleTarea key={ruta.id} id={ruta.id} /> : <Hoy />
      break
    case 'agregar':
      pantalla = <AgregarTarea />
      break
    case 'objetivos':
      pantalla = <Objetivos />
      break
    case 'areas':
      pantalla = <Pronto titulo="Áreas" texto="Acá vas a ver cada área con su % al día de la semana. Llega en la fase 5." />
      break
    case 'equipo':
      pantalla = <Pronto titulo="Equipo" texto="Acá vas a ver a cada persona con sus pendientes y su % al día. Llega en la fase 5." />
      break
    case 'config':
      pantalla = <Configuracion />
      break
    default:
      pantalla = <Hoy />
  }

  const pestana = ['hoy', 'objetivos', 'areas', 'equipo'].includes(ruta.pantalla) ? ruta.pantalla : ruta.pantalla === 'tarea' || ruta.pantalla === 'agregar' ? 'hoy' : ''
  return (
    <div className="app">
      {pantalla}
      <NavInferior actual={pestana} />
    </div>
  )
}
