// Conexión con Supabase (proyecto "ritual-diario", San Pablo).
// La clave "publishable" es pública por diseño: lo que protege los datos son los permisos
// de la base (RLS y funciones). Nunca poner acá la clave "secret" ni la "service_role".
// Para apuntar a otro proyecto (por ejemplo uno de pruebas) se pueden definir
// VITE_SUPABASE_URL y VITE_SUPABASE_KEY al armar la app.
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://oehrvzijfktxcoyfommj.supabase.co'
export const SUPABASE_KEY: string =
  import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_QC0jrN5Sr6HQLsHEcVxwMw_9S3HpRxc'
