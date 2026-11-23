import { Cargando, ErrorCarga, NavInferior } from './componentes/Piezas'
import { useRuta } from './lib/ruta'
import { useSesion } from './lib/sesion'
import { Login } from './pantallas/login/Login'
import { Hoy } from './pantallas/hoy/Hoy'
import { DetalleTarea } from './pantallas/tarea/DetalleTarea'
import { AgregarTarea } from './pantallas/agregar/AgregarTarea'
import { Objetivos } from './pantallas/objetivos/Objetivos'
import { Configuracion } from './pantallas/config/Configuracion'
import { Areas, DetalleArea } from './pantallas/areas/Areas'
import { Equipo, DetalleMiembro } from './pantallas/equipo/Equipo'
import { EditarTarea } from './pantallas/editar/EditarTarea'
import { ConfigTareas } from './pantallas/config/ConfigTareas'
import { ConfigAreas } from './pantallas/config/ConfigAreas'
import { ConfigPersonas } from './pantallas/config/ConfigPersonas'
import { Persona } from './pantallas/config/Persona'
import { DetalleObjetivo } from './pantallas/objetivos/DetalleObjetivo'
import { FormObjetivo } from './pantallas/objetivos/FormObjetivo'
import { PlanVea } from './pantallas/vea/PlanVea'
import { Ventas } from './pantallas/ventas/Ventas'

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
    case 'objetivo':
      pantalla = ruta.id ? <DetalleObjetivo key={ruta.id} id={ruta.id} /> : <Objetivos />
      break
    case 'objetivo-form':
      pantalla = <FormObjetivo key={ruta.id ?? 'nuevo'} id={ruta.id ?? 'nuevo'} />
      break
    case 'vea':
      pantalla = <PlanVea />
      break
    case 'ventas':
      pantalla = <Ventas />
      break
    case 'areas':
      pantalla = <Areas />
      break
    case 'area':
      pantalla = ruta.id ? <DetalleArea key={ruta.id} id={ruta.id} /> : <Areas />
      break
    case 'equipo':
      pantalla = <Equipo />
      break
    case 'miembro':
      pantalla = ruta.id ? <DetalleMiembro key={ruta.id} id={ruta.id} /> : <Equipo />
      break
    case 'editar':
      pantalla = ruta.id ? <EditarTarea key={ruta.id} id={ruta.id} /> : <Hoy />
      break
    case 'persona':
      pantalla = ruta.id ? <Persona key={ruta.id} id={ruta.id} /> : <ConfigPersonas />
      break
    case 'config':
      pantalla = ruta.id === 'tareas' ? <ConfigTareas />
        : ruta.id === 'areas' ? <ConfigAreas />
        : ruta.id === 'personas' ? <ConfigPersonas />
        : <Configuracion />
      break
    default:
      pantalla = <Hoy />
  }

  const pestana = ['hoy', 'objetivos', 'areas', 'equipo'].includes(ruta.pantalla) ? ruta.pantalla : ['tarea', 'agregar', 'editar'].includes(ruta.pantalla) ? 'hoy'
    : ['objetivo', 'objetivo-form', 'vea', 'ventas'].includes(ruta.pantalla) ? 'objetivos'
    : ruta.pantalla === 'area' ? 'areas' : ruta.pantalla === 'miembro' ? 'equipo' : ''
  return (
    <div className="app">
      {pantalla}
      <NavInferior actual={pestana} />
    </div>
  )
}
