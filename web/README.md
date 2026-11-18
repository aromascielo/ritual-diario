# web/ — la app Ritual Diario v2

- `npm install` y `npm run dev` para trabajar; `npm run build` arma `dist/`.
- Cloudflare (Workers Builds) usa: carpeta raíz `web`, build `npm run build`, deploy `npx wrangler deploy` (ver `wrangler.jsonc`).
- Estructura: `src/lib` (supabase, fechas, sesión, datos), `src/componentes`, `src/pantallas/<pantalla>`.
- Las cuentas y los permisos viven en la base (ver `../CLAUDE.md` §5 y §8): la app no recalcula nada.
