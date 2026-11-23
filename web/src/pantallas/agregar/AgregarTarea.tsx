import { Encabezado } from '../../componentes/Piezas'
import { FormTarea } from '../../componentes/FormTarea'
import { useAvisar } from '../../componentes/Avisos'
import { guardarTarea } from '../../lib/datos'
import { fechaCorta, hoyISO } from '../../lib/fechas'
import { describirFrecuencia } from '../../lib/frecuencia'
import { volver } from '../../lib/ruta'
import { useSesion } from '../../lib/sesion'

export function AgregarTarea() {
  const { yo } = useSesion()
  const avisar = useAvisar()
  if (!yo) return null
  return (
    <>
      <Encabezado titulo="Agregar tarea" atras="hoy" />
      <main className="contenido">
        <FormTarea
          nueva
          textoBoton="Guardar tarea"
          inicial={{
            id: null, titulo: '', descripcion: '', responsable: yo.id, areas: [], frecuencia: 'unica',
            fecha: hoyISO(), dias: [], diaMes: null, hora: null, objetivo: null,
          }}
          alGuardar={async (t) => {
            await guardarTarea(t)
            avisar(t.frecuencia === 'unica'
              ? `Tarea agregada para ${fechaCorta(t.fecha!).toLowerCase()} 🌿`
              : `Tarea agregada: ${describirFrecuencia({ frecuencia: t.frecuencia, dias_semana: t.dias, dia_mes: t.diaMes }).toLowerCase()} 🌿`)
            volver('hoy')
          }}
        />
      </main>
    </>
  )
}
