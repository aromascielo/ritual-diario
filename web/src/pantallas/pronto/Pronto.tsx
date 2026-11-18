import { Encabezado, Vacio } from '../../componentes/Piezas'

/** Pantallas que llegan en las próximas fases. */
export function Pronto({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <Encabezado titulo={titulo} />
      <main className="contenido">
        <Vacio emoji="🌱">{texto}</Vacio>
      </main>
    </>
  )
}
